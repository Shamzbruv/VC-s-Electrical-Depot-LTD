begin;
alter table orders add column discount bigint not null default 0 check(discount>=0);
create table discount_redemptions(id uuid primary key default gen_random_uuid(),promotion_id uuid references promotions(id),order_id uuid unique references orders(id),amount bigint not null,active boolean default true);
alter table discount_redemptions enable row level security;revoke all on discount_redemptions from anon,authenticated;
alter table promotions add constraint valid_discount check(kind in('percent','fixed') and value>=0 and (kind<>'percent' or value<=100));
create or replace function public.create_order(p jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare o orders; v products; item jsonb; lines jsonb:='[]'; sub bigint:=0; ship bigint:=0; qty integer; disc bigint:=0; promo promotions; settings jsonb; zone shipping_zones; begin
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
 if coalesce(p->>'promo','')<>'' then
 select * into promo from promotions where upper(code)=upper(p->>'promo') and active for update;
 if not found or (promo.starts_at is not null and promo.starts_at>now()) or (promo.ends_at is not null and promo.ends_at<now()) or (promo.max_uses is not null and promo.uses>=promo.max_uses) or sub<promo.minimum then raise exception 'Promotion is invalid, expired or ineligible';end if;
 if promo.kind='percent' then disc:=floor(sub*promo.value/100.0);elsif promo.kind='fixed' then disc:=least(sub,promo.value);else raise exception 'Invalid promotion configuration';end if;
 update promotions set uses=uses+1 where id=promo.id;
 end if;
 if (p->>'expected_total')::bigint<>sub+ship-disc then raise exception 'Prices changed. Refresh your basket and review the current total.';end if;
 insert into orders(user_id,email,name,phone,address,method,subtotal,shipping,total,discount,items,notes,access_hash,idempotency_key,request_hash) values(nullif(p->>'user_id','')::uuid,p->>'email',p->>'name',p->>'phone',p->'address',p->>'method',sub,ship,sub+ship-disc,disc,lines,p->>'notes',p->>'access_hash',(p->>'key')::uuid,p->>'request_hash') returning * into o;
 if promo.id is not null then insert into discount_redemptions(promotion_id,order_id,amount) values(promo.id,o.id,disc);end if;
 insert into order_events(order_id,status,note) values(o.id,'awaiting_payment','Order received. Bank transfer requires staff verification.');
 for item in select value from jsonb_array_elements(lines) loop insert into stock_movements(product_id,order_id,delta,kind,reason) values((item->>'id')::uuid,o.id,-(item->>'qty')::integer,'reservation','Checkout reservation');end loop;
 insert into payment_attempts(order_id,method,status,amount) values(o.id,'bank_transfer','pending_verification',o.total);
 insert into email_notifications(entity_id,template,recipient) values(o.id,'order_received',o.email);
 return to_jsonb(o)-'access_hash';end$$;
create or replace function public.order_action(p_id uuid,p_action text,p_note text,p_actor uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare o orders;item jsonb;allowed text[];begin
 select * into o from orders where id=p_id for update;if not found then raise exception 'Order not found';end if;
 if p_action='verify_payment' then
  if o.payment_status<>'pending_verification' or o.status='cancelled' then raise exception 'Order cannot be verified in this state';end if;
  if length(trim(p_note))<3 then raise exception 'External payment reference is required';end if;
  update orders set payment_status='paid',status='unfulfilled' where id=o.id;
  for item in select value from jsonb_array_elements(o.items) loop update products set stock=stock-(item->>'qty')::integer,reserved=reserved-(item->>'qty')::integer where id=(item->>'id')::uuid; insert into stock_movements(product_id,order_id,delta,kind,reason) values((item->>'id')::uuid,o.id,-(item->>'qty')::integer,'sale',p_note);end loop;
  update payment_attempts set status='verified',reference=p_note where order_id=o.id;
  select * into o from orders where id=p_id;
  insert into invoices(order_id,snapshot) values(o.id,to_jsonb(o)-'access_hash') on conflict(order_id) do nothing;
 elsif p_action='cancelled' then
  if o.payment_status='paid' or o.status='cancelled' then raise exception 'Paid or cancelled orders require a separate reconciliation workflow';end if;
  for item in select value from jsonb_array_elements(o.items) loop update products set reserved=reserved-(item->>'qty')::integer where id=(item->>'id')::uuid;insert into stock_movements(product_id,order_id,delta,kind,reason) values((item->>'id')::uuid,o.id,(item->>'qty')::integer,'release',p_note);end loop;
  update orders set status='cancelled' where id=o.id;
  update promotions set uses=greatest(0,uses-1) where id in(select promotion_id from discount_redemptions where order_id=o.id and active);update discount_redemptions set active=false where order_id=o.id and active;
 else
  if o.payment_status<>'paid' then raise exception 'Verify payment before fulfilment';end if;
  allowed:=case o.status when 'unfulfilled' then array['picking'] when 'picking' then array['packed'] when 'packed' then case when o.method='pickup' then array['ready_for_pickup'] else array['dispatched'] end when 'dispatched' then array['delivered'] when 'ready_for_pickup' then array['collected'] else array[]::text[] end;
  if not p_action=any(allowed) then raise exception 'Invalid order transition';end if;
  update orders set status=p_action,tracking=case when p_action='dispatched' then p_note else tracking end where id=o.id;
 end if;
 insert into order_events(order_id,status,note) values(o.id,p_action,case when p_action='verify_payment' then 'Payment verified by staff' else p_note end);
 insert into audit_logs(actor,operation,entity,details) values(p_actor,p_action,'orders',jsonb_build_object('id',o.id,'note',p_note));
 select * into o from orders where id=p_id;return to_jsonb(o)-'access_hash';end$$;
commit;
