begin;
create table public.staff_roles(user_id uuid primary key references auth.users(id), role text not null check(role in ('owner','admin','catalog_editor','order_fulfillment','marketing_editor','reports_viewer')), active boolean not null default true);
create table public.products(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,sku text unique not null,category text not null,description text not null default '',image text not null default '/products/cable.svg',price bigint not null check(price>=0),store_price bigint not null default 0 check(store_price>=0),stock integer not null default 0 check(stock>=0),reserved integer not null default 0 check(reserved>=0 and reserved<=stock),unit text not null default 'each',status text not null default 'draft' check(status in('draft','published','archived')),specs jsonb not null default '{}',featured boolean default false,sample boolean default false,updated_at timestamptz not null default now());
create table public.store_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
create table public.orders(id uuid primary key default gen_random_uuid(),number bigint generated always as identity unique,user_id uuid references auth.users(id),email text not null,name text not null,phone text not null,address jsonb not null,method text not null,payment_status text not null default 'pending_verification',status text not null default 'awaiting_payment',subtotal bigint not null,shipping bigint not null,total bigint not null,items jsonb not null,notes text default '',tracking text default '',access_hash text not null,idempotency_key uuid unique not null,request_hash text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '48 hours');
create table public.order_events(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),status text not null,note text,created_at timestamptz default now());
create table public.stock_movements(id uuid primary key default gen_random_uuid(),product_id uuid references public.products(id),order_id uuid references public.orders(id),delta integer not null,kind text not null,reason text not null,created_at timestamptz default now());
create table public.quotes(id uuid primary key default gen_random_uuid(),name text not null,email text not null,phone text,company text,body text not null,items jsonb default '[]',status text default 'new',response text default '',valid_until date,created_at timestamptz default now());
create table public.inquiries(id uuid primary key default gen_random_uuid(),name text not null,email text not null,body text not null,status text default 'new',created_at timestamptz default now());
create table public.content(id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null,body text not null,status text default 'draft',updated_at timestamptz default now());
create table public.shipping_zones(id uuid primary key default gen_random_uuid(),name text not null,parishes jsonb default '[]',rate bigint not null default 0 check(rate>=0),active boolean default false);
create table public.promotions(id uuid primary key default gen_random_uuid(),code text unique not null,kind text not null default 'percent',value integer not null default 0,minimum bigint default 0,starts_at timestamptz,ends_at timestamptz,max_uses integer,uses integer default 0,active boolean default false);
create table public.reviews(id uuid primary key default gen_random_uuid(),product_id uuid references public.products(id),user_id uuid references auth.users(id),rating integer check(rating between 1 and 5),body text,status text default 'pending',created_at timestamptz default now());
create table public.invoices(id uuid primary key default gen_random_uuid(),number bigint generated always as identity unique,order_id uuid unique references public.orders(id),snapshot jsonb not null,state text default 'issued',created_at timestamptz default now());
create table public.payment_attempts(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),method text,status text,reference text,amount bigint,created_at timestamptz default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor uuid,operation text not null,entity text,details jsonb default '{}',created_at timestamptz default now());
create table public.email_notifications(id uuid primary key default gen_random_uuid(),entity_id uuid,template text,recipient text,state text not null default 'not_configured',created_at timestamptz default now());
create table public.rate_limits(key text primary key,count integer not null default 1,expires_at timestamptz not null);
create index products_category on public.products(category,status);
create index orders_created on public.orders(created_at desc);
create index orders_user on public.orders(user_id);
create index events_order on public.order_events(order_id);
create index movements_product on public.stock_movements(product_id);
create index quotes_created on public.quotes(created_at desc);
create index products_search on public.products using gin(to_tsvector('english',name||' '||sku||' '||description));
do $$declare t text;begin foreach t in array array['staff_roles','products','store_settings','orders','order_events','stock_movements','quotes','inquiries','content','shipping_zones','promotions','reviews','invoices','payment_attempts','audit_logs','email_notifications','rate_limits'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;end$$;
grant select on public.products, public.content to anon,authenticated;
create policy published_catalog on public.products for select to anon,authenticated using(status='published');
create policy published_content on public.content for select to anon,authenticated using(status='published');
grant select on public.orders to authenticated;
create policy own_orders on public.orders for select to authenticated using((select auth.uid())=user_id);
-- Only server-side service-role requests may call transactional functions.
create function public.create_order(p jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare o orders; v products; item jsonb; lines jsonb:='[]'; sub bigint:=0; ship bigint:=0; qty integer; settings jsonb; zone shipping_zones; begin
 select * into o from orders where idempotency_key=(p->>'key')::uuid;
 if found then if o.request_hash<>p->>'request_hash' then raise exception 'Checkout key already used for different details';end if;return to_jsonb(o)-'access_hash';end if;
 select value into settings from store_settings where key='commerce';
 if coalesce((settings->>'bank_enabled')::boolean,false)=false then raise exception 'Checkout is not configured yet. Please request a quotation.';end if;
 if length(coalesce(settings->>'bank_instructions',''))<10 then raise exception 'Payment instructions must be configured';end if;
 if p->>'method'='pickup' then if length(coalesce(settings->>'pickup_address',''))<5 then raise exception 'Pickup address is not configured';end if;
 elsif p->>'method'='delivery' then select * into zone from shipping_zones where id=(p->>'zone')::uuid and active; if not found or not(zone.parishes ? (p->'address'->>'parish')) then raise exception 'Delivery is unavailable for this parish';end if; ship:=zone.rate;
 else raise exception 'Invalid fulfilment method';end if;
 if jsonb_array_length(p->'items') not between 1 and 100 then raise exception 'Invalid basket';end if;
 for item in select value from jsonb_array_elements(p->'items') order by value->>'id' loop
  qty:=(item->>'qty')::integer;if qty not between 1 and 9999 then raise exception 'Invalid quantity';end if;
  select * into v from products where id=(item->>'id')::uuid and status='published' for update;
  if not found then raise exception 'Product unavailable';end if;
  if v.sample then raise exception 'Sample products cannot be ordered';end if;
  if v.stock-v.reserved<qty then raise exception 'Insufficient stock for %',v.name;end if;
  sub:=sub+v.price*qty;lines:=lines||jsonb_build_array(jsonb_build_object('id',v.id,'name',v.name,'sku',v.sku,'price',v.price,'qty',qty,'unit',v.unit));
  update products set reserved=reserved+qty where id=v.id;
 end loop;
 if (p->>'expected_total')::bigint<>sub+ship then raise exception 'Prices changed. Refresh your basket and review the current total.';end if;
 insert into orders(user_id,email,name,phone,address,method,subtotal,shipping,total,items,notes,access_hash,idempotency_key,request_hash) values(nullif(p->>'user_id','')::uuid,p->>'email',p->>'name',p->>'phone',p->'address',p->>'method',sub,ship,sub+ship,lines,p->>'notes',p->>'access_hash',(p->>'key')::uuid,p->>'request_hash') returning * into o;
 insert into order_events(order_id,status,note) values(o.id,'awaiting_payment','Order received. Bank transfer requires staff verification.');
 for item in select value from jsonb_array_elements(lines) loop insert into stock_movements(product_id,order_id,delta,kind,reason) values((item->>'id')::uuid,o.id,-(item->>'qty')::integer,'reservation','Checkout reservation');end loop;
 insert into payment_attempts(order_id,method,status,amount) values(o.id,'bank_transfer','pending_verification',o.total);
 insert into email_notifications(entity_id,template,recipient) values(o.id,'order_received',o.email);
 return to_jsonb(o)-'access_hash';end$$;
revoke all on function public.create_order(jsonb) from public,anon,authenticated;
grant execute on function public.create_order(jsonb) to service_role;
create function public.order_action(p_id uuid,p_action text,p_note text,p_actor uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare o orders;item jsonb;allowed text[];begin
 select * into o from orders where id=p_id for update;if not found then raise exception 'Order not found';end if;
 if p_action='verify_payment' then
  if o.payment_status<>'pending_verification' or o.status='cancelled' then raise exception 'Order cannot be verified in this state';end if;
  if length(trim(p_note))<3 then raise exception 'External payment reference is required';end if;
  update orders set payment_status='paid',status='unfulfilled' where id=o.id;
  for item in select value from jsonb_array_elements(o.items) loop update products set stock=stock-(item->>'qty')::integer,reserved=reserved-(item->>'qty')::integer where id=(item->>'id')::uuid; insert into stock_movements(product_id,order_id,delta,kind,reason) values((item->>'id')::uuid,o.id,-(item->>'qty')::integer,'sale',p_note);end loop;
  update payment_attempts set status='verified',reference=p_note where order_id=o.id;
  insert into invoices(order_id,snapshot) values(o.id,to_jsonb(o)-'access_hash') on conflict(order_id) do nothing;
 elsif p_action='cancelled' then
  if o.payment_status='paid' or o.status='cancelled' then raise exception 'Paid or cancelled orders require a separate reconciliation workflow';end if;
  for item in select value from jsonb_array_elements(o.items) loop update products set reserved=reserved-(item->>'qty')::integer where id=(item->>'id')::uuid;insert into stock_movements(product_id,order_id,delta,kind,reason) values((item->>'id')::uuid,o.id,(item->>'qty')::integer,'release',p_note);end loop;
  update orders set status='cancelled' where id=o.id;
 else
  if o.payment_status<>'paid' then raise exception 'Verify payment before fulfilment';end if;
  allowed:=case o.status when 'unfulfilled' then array['picking'] when 'picking' then array['packed'] when 'packed' then case when o.method='pickup' then array['ready_for_pickup'] else array['dispatched'] end when 'dispatched' then array['delivered'] when 'ready_for_pickup' then array['collected'] else array[]::text[] end;
  if not p_action=any(allowed) then raise exception 'Invalid order transition';end if;
  update orders set status=p_action,tracking=case when p_action='dispatched' then p_note else tracking end where id=o.id;
 end if;
 insert into order_events(order_id,status,note) values(o.id,p_action,case when p_action='verify_payment' then 'Payment verified by staff' else p_note end);
 insert into audit_logs(actor,operation,entity,details) values(p_actor,p_action,'orders',jsonb_build_object('id',o.id,'note',p_note));
 select * into o from orders where id=p_id;return to_jsonb(o)-'access_hash';end$$;
revoke all on function public.order_action(uuid,text,text,uuid) from public,anon,authenticated;grant execute on function public.order_action(uuid,text,text,uuid) to service_role;
create function public.adjust_stock(p_id uuid,p_stock integer,p_reason text,p_actor uuid) returns void language plpgsql security invoker set search_path=public as $$declare v products;begin select * into v from products where id=p_id for update;if not found or p_stock<v.reserved or length(trim(p_reason))<3 then raise exception 'Stock must cover reservations; reason required';end if;update products set stock=p_stock,updated_at=now() where id=p_id;insert into stock_movements(product_id,delta,kind,reason) values(p_id,p_stock-v.stock,'adjustment',p_reason);insert into audit_logs(actor,operation,entity,details) values(p_actor,'stock_adjusted','products',jsonb_build_object('id',p_id,'before',v.stock,'after',p_stock,'reason',p_reason));end$$;
revoke all on function public.adjust_stock(uuid,integer,text,uuid) from public,anon,authenticated;grant execute on function public.adjust_stock(uuid,integer,text,uuid) to service_role;
create function public.hit_limit(p_key text) returns boolean language plpgsql security invoker set search_path=public as $$declare n integer;begin insert into rate_limits(key,count,expires_at) values(p_key,1,now()+interval '1 hour') on conflict(key) do update set count=case when rate_limits.expires_at<now() then 1 else rate_limits.count+1 end,expires_at=case when rate_limits.expires_at<now() then now()+interval '1 hour' else rate_limits.expires_at end returning count into n;return n<=15;end$$;
revoke all on function public.hit_limit(text) from public,anon,authenticated;grant execute on function public.hit_limit(text) to service_role;
insert into store_settings values('commerce','{"bank_enabled":false,"bank_instructions":"","pickup_address":"","email_provider":"not_configured","tax_enabled":false}',now()),('brand','{"name":"VC’s Electrical Depot LTD","hero_title":"Powering your next project.","hero_body":"From the first wire to the final fitting. Find electrical essentials for your home, business and next big build.","email":"","phone":"","address":"","hours":""}',now());
insert into content(slug,title,body,status) values('about','Built around your next project.','VC’s Electrical Depot LTD is building a simpler way to source electrical supplies in Jamaica. Explore cables, lighting, circuit protection and everyday essentials, or send your materials list for a tailored quotation.','published'),('shipping','Delivery & collection','Delivery zones, charges and the collection address are awaiting store confirmation. Request a quote for delivery to your parish.','published'),('returns','Returns & warranty','The store’s returns, refund and warranty terms are awaiting approval. Contact the team through the enquiry form before placing an order.','published'),('privacy','Privacy notice','This private staging site stores enquiry and order details to respond to requests. Final data retention, privacy contact and customer rights information must be approved before public launch.','published'),('terms','Terms of purchase','This site is currently in private staging. Sample products are illustrative. Live purchasing will be enabled once the catalog, policies and payment methods are approved.','published'),('faq','Frequently asked questions','Can I request a bulk quote? Yes—send your quantities and specifications through Request a Quote.\n\nCan I collect my order? Collection will be available once the store confirms its pickup address.\n\nAre these live prices? Sample products and prices are clearly labelled; the live catalog is awaiting approval.','published');
commit;
