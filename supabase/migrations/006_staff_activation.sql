begin;

create table public.staff_activation (
  email text primary key, role text not null, active boolean not null, permissions text[],
  approved_at timestamptz not null default now()
);
alter table public.staff_activation enable row level security;
revoke all on public.staff_activation from public,anon,authenticated;

create function public.vcs_claim_activation() returns trigger
language plpgsql security definer set search_path='' as $$
declare approved public.staff_activation%rowtype;
begin
  if new.email_confirmed_at is null then return new; end if;
  delete from public.staff_activation where email=lower(new.email) returning * into approved;
  if found then
    insert into public.staff_roles(user_id,role,active,permissions)
    values(new.id,approved.role,approved.active,approved.permissions)
    on conflict(user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.vcs_claim_activation() from public,anon,authenticated;
create trigger vcs_claim_activation after insert or update of email_confirmed_at on auth.users
for each row execute function public.vcs_claim_activation();

create function public.vcs_can_activate(p_email text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.staff_activation where email=lower(trim(p_email)) and active);
$$;
revoke all on function public.vcs_can_activate(text) from public,authenticated;
grant execute on function public.vcs_can_activate(text) to anon;

create function public.vcs_unassign_disabled_driver(p_user uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare parcel public.dispatch_packages%rowtype;
begin
  for parcel in select * from public.dispatch_packages
    where driver_id=p_user and status in ('assigned','in_transit') order by id for update
  loop
    update public.dispatch_packages set status='issue',finished_at=now(),result_note='Driver access changed. Assign another driver to resume.'
      where id=parcel.id;
    delete from public.dispatch_location where package_id=parcel.id;
    insert into public.dispatch_events(package_id,actor,event,note) values(parcel.id,p_actor,'issue','Driver access changed.');
    insert into public.staff_notifications(user_id,package_id,message)
      select s.user_id,parcel.id,'Driver access changed. Reassign VC-'||parcel.number
      from public.staff_roles s where s.active and (s.user_id=parcel.created_by or public.vcs_can(s.user_id,'dispatch'));
  end loop;
end;
$$;
revoke all on function public.vcs_unassign_disabled_driver(uuid,uuid) from public,anon,authenticated;

create or replace function public.vcs_read(p_area text,p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); staff_role text; result jsonb; start_day date; end_day date; day_count int;
begin
  select role into staff_role from public.staff_roles where user_id=actor and active;
  if staff_role is null then raise exception 'Your account has no active staff access.'; end if;
  if p_area='profile' then
    return jsonb_build_object('id',actor,'role',staff_role,'email',auth.jwt()->>'email',
      'permissions',(select jsonb_agg(area) from unnest(array['finance','finance_reports','dispatch','drive','catalog','leads','website','access']) as area where public.vcs_can(actor,area)));
  end if;
  if p_area='notifications' then
    select jsonb_agg(to_jsonb(n)) into result from (select id,package_id,message,created_at,read_at from public.staff_notifications where user_id=actor order by id desc limit 75) n;
  elsif p_area='overview' then
    if not public.vcs_can(actor,'dispatch') then raise exception 'Dispatch permission required.'; end if;
    return (select jsonb_build_object('pending',count(*) filter(where status in ('pending','assigned','issue')),
      'in_transit',count(*) filter(where status='in_transit'),'delivered',count(*) filter(where status='delivered'),
      'cancelled',count(*) filter(where status='cancelled')) from public.dispatch_packages);
  elsif p_area in ('dispatch','drive') then
    if not public.vcs_can(actor,p_area) then raise exception 'Delivery permission required.'; end if;
    select jsonb_agg(to_jsonb(d)) into result from (
      select d.*,case when p_area='dispatch' then u.email end as driver_email,
        case when p_area='dispatch' and d.status='in_transit' and l.package_id is not null then to_jsonb(l)-'package_id' end as location,
        (select jsonb_agg(to_jsonb(e) order by e.id desc) from (select id,event,note,created_at from public.dispatch_events where package_id=d.id order by id desc limit 25) e) as timeline
      from public.dispatch_packages d left join auth.users u on u.id=d.driver_id left join public.dispatch_location l on l.package_id=d.id
      where (p_area='dispatch' or d.driver_id=actor)
      and (coalesce(p->>'status','')='' or d.status=p->>'status' or (p->>'status'='active' and d.status in ('assigned','in_transit')))
      order by case when d.status in ('assigned','pending','in_transit','issue') then 0 else 1 end, d.created_at desc
      limit 200 offset greatest(0,least(100000,coalesce((p->>'offset')::integer,0)))
    ) d;
  elsif p_area='drivers' then
    if not public.vcs_can(actor,'dispatch') then raise exception 'Dispatch permission required.'; end if;
    select jsonb_agg(jsonb_build_object('id',s.user_id,'email',u.email) order by u.email) into result
      from public.staff_roles s join auth.users u on u.id=s.user_id where s.role<>'owner' and public.vcs_can(s.user_id,'drive');
  elsif p_area='finance' then
    if not (public.vcs_can(actor,'finance') or public.vcs_can(actor,'finance_reports')) then raise exception 'Finance permission required.'; end if;
    start_day:=nullif(p->>'from','')::date;end_day:=nullif(p->>'to','')::date;day_count:=end_day-start_day;
    if day_count is null or day_count not between 0 and 365 then raise exception 'Choose a period of up to 366 days.'; end if;
    return jsonb_build_object(
      'totals',(select jsonb_build_object('income',coalesce(sum(amount_cents) filter(where kind='income'),0),'expense',coalesce(sum(amount_cents) filter(where kind='expense'),0),'count',count(*)) from public.daily_finance where entry_date between start_day and end_day and (public.vcs_can(actor,'finance_reports') or created_by=actor) and voided_at is null),
      'trend',(select coalesce(jsonb_agg(to_jsonb(t) order by t.day),'[]') from
        (select entry_date as day, coalesce(sum(amount_cents) filter(where kind='income'),0) as income,coalesce(sum(amount_cents) filter(where kind='expense'),0) as expense
         from public.daily_finance where entry_date between start_day and end_day and (public.vcs_can(actor,'finance_reports') or created_by=actor) and voided_at is null group by entry_date) t),
      'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.amount desc),'[]') from
        (select kind,category,sum(amount_cents) as amount from public.daily_finance where entry_date between start_day and end_day and (public.vcs_can(actor,'finance_reports') or created_by=actor) and voided_at is null group by kind,category) c),
      'rows',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from (select * from public.daily_finance where entry_date between start_day and end_day and (public.vcs_can(actor,'finance_reports') or created_by=actor) order by entry_date desc,created_at desc limit 200 offset greatest(0,least(100000,coalesce((p->>'offset')::integer,0)))) f));
  elsif p_area='catalog' then
    if not public.vcs_can(actor,'catalog') then raise exception 'Catalog permission required.'; end if;
    select jsonb_agg(to_jsonb(r)) into result from (select id,name,slug,sku,category,description,image,unit,specs,status,sample from public.products
      where status<>'archived' and (coalesce(p->>'q','')='' or name ilike '%'||(p->>'q')||'%' or sku ilike '%'||(p->>'q')||'%' or category ilike '%'||(p->>'q')||'%')
      order by name,id limit 200 offset greatest(0,least(100000,coalesce((p->>'offset')::integer,0)))) r;
  elsif p_area='leads' then
    if not public.vcs_can(actor,'leads') then raise exception 'Enquiry permission required.'; end if;
    select jsonb_agg(to_jsonb(r)) into result from (select * from (
      select id,'quote' as kind,name,email,company,phone,body,status,created_at from public.quotes
      union all select id,'contact',name,email,null,null,body,status,created_at from public.inquiries
    ) q order by created_at desc limit 200 offset greatest(0,least(100000,coalesce((p->>'offset')::integer,0)))) r;
  elsif p_area='website' then
    if not public.vcs_can(actor,'website') then raise exception 'Website permission required.'; end if;
    return coalesce((select to_jsonb(w) from public.website_edits w where route=p->>'route'),jsonb_build_object('revision',0,'draft','{}'::jsonb,'published','{}'::jsonb));
  elsif p_area='access' then
    if not public.vcs_can(actor,'access') then raise exception 'Owner permission required.'; end if;
    select jsonb_agg(to_jsonb(account) order by account.email) into result from (
      select u.id,u.email,s.role,s.active,s.permissions,false as pending
      from auth.users u left join public.staff_roles s on u.id=s.user_id where u.email_confirmed_at is not null
      union all select null::uuid,a.email,a.role,a.active,a.permissions,true from public.staff_activation a
    ) account;
  else raise exception 'Unknown workspace area.';
  end if;
  return coalesce(result,'[]'::jsonb);
end;
$$;
create or replace function public.vcs_write(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; parcel public.dispatch_packages%rowtype; state text; log_event text; message text;
  allowed text[]:=array['finance','finance_reports','dispatch','drive','catalog','leads','website']; revision_now integer; affected int; staff_email text;
begin
  if not exists(select 1 from public.staff_roles where user_id=actor and active) then raise exception 'Active staff account required.'; end if;
  if p_action='notifications_read' then
    update public.staff_notifications set read_at=now() where user_id=actor and read_at is null and id<=coalesce((p->>'through')::bigint,0);
    return '{"ok":true}'::jsonb;
  elsif p_action in ('finance_add','finance_void') then
    if not public.vcs_can(actor,'finance') then raise exception 'Finance entry permission required.'; end if;
    if p_action='finance_add' then
      target:=(p->>'id')::uuid;
      if coalesce(length(trim(p->>'category')),0) not between 1 and 80 or (p->>'entry_date')::date >(now() at time zone 'America/Jamaica')::date
        or coalesce(length(p->>'notes'),0)>1500 or coalesce(length(p->>'party'),0)>150 or coalesce(length(p->>'reference'),0)>100
        then raise exception 'Check the date, category and entry details.'; end if;
      insert into public.daily_finance(id,entry_date,kind,category,amount_cents,method,party,reference,notes,created_by)
      values(target,(p->>'entry_date')::date,p->>'kind',trim(p->>'category'),(p->>'amount_cents')::bigint,p->>'method',coalesce(p->>'party',''),coalesce(p->>'reference',''),coalesce(p->>'notes',''),actor)
      on conflict(id) do nothing;
      if not found then return jsonb_build_object('id',target); end if;
    else
      target:=(p->>'id')::uuid;
      if coalesce(length(trim(p->>'reason')),0) not between 3 and 300 then raise exception 'Enter a reason for voiding the entry.'; end if;
      update public.daily_finance set voided_at=now(),void_reason=p->>'reason' where id=target and voided_at is null
        and (created_by=actor or public.vcs_can(actor,'finance_reports'));
      if not found then raise exception 'Entry unavailable or already voided.'; end if;
    end if;
  elsif p_action in ('dispatch_create','dispatch_assign','dispatch_cancel','drive_accept','drive_complete','drive_issue','drive_location') then
    if left(p_action,9)='dispatch_' and not public.vcs_can(actor,'dispatch') then raise exception 'Dispatch permission required.'; end if;
    if left(p_action,6)='drive_' and not public.vcs_can(actor,'drive') then raise exception 'Driver permission required.'; end if;
    target:=(p->>'id')::uuid;
    if p_action='dispatch_create' then
      if coalesce(length(trim(p->>'recipient')),0) not between 2 and 150 or coalesce(length(trim(p->>'phone')),0) not between 7 and 50
        or coalesce(length(trim(p->>'address')),0) not between 5 and 500 or coalesce(length(trim(p->>'description')),0) not between 2 and 1000
        or coalesce(length(p->>'notes'),0)>1000 then raise exception 'Enter the recipient, telephone, destination and package contents.'; end if;
      insert into public.dispatch_packages(id,recipient,phone,address,description,delivery_date,notes,created_by)
      values(target,trim(p->>'recipient'),trim(p->>'phone'),trim(p->>'address'),trim(p->>'description'),(p->>'delivery_date')::date,coalesce(p->>'notes',''),actor)
      on conflict(id) do nothing returning * into parcel;
      if not found then return jsonb_build_object('id',target); end if;
      log_event:='created';message:='Package queued for delivery';
    else
      select * into parcel from public.dispatch_packages where id=target for update;
      if not found or (left(p_action,6)='drive_' and parcel.driver_id is distinct from actor) then raise exception 'Package unavailable.'; end if;
      if p_action='drive_location' then
        if parcel.status<>'in_transit' then raise exception 'Tracking session has ended.'; end if;
        insert into public.dispatch_location(package_id,latitude,longitude,accuracy)
        values(target,(p->>'latitude')::float8,(p->>'longitude')::float8,(p->>'accuracy')::float8)
        on conflict(package_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=now()
        where public.dispatch_location.updated_at < now()-interval '8 seconds';
        return '{"ok":true}'::jsonb;
      elsif p_action='dispatch_assign' then
        if parcel.status not in ('pending','assigned','issue') or not public.vcs_can((p->>'driver_id')::uuid,'drive') then raise exception 'Choose an active driver for a package awaiting assignment.'; end if;
        if parcel.status='assigned' and parcel.driver_id=(p->>'driver_id')::uuid then return jsonb_build_object('id',target);end if;
        if parcel.driver_id is not null and parcel.driver_id<>(p->>'driver_id')::uuid then
          insert into public.staff_notifications(user_id,package_id,message) values(parcel.driver_id,target,'Package VC-'||parcel.number||' was reassigned.');
        end if;
        update public.dispatch_packages set driver_id=(p->>'driver_id')::uuid,status='assigned',started_at=null,finished_at=null,result_note=null where id=target returning * into parcel;
        log_event:='assigned';message:='Driver assigned';
      elsif p_action='drive_accept' then
        if parcel.status='in_transit' then return jsonb_build_object('id',target);end if;
        if parcel.status<>'assigned' then raise exception 'The package is unavailable for acceptance.';end if;
        if p->>'consent' is distinct from 'true' then raise exception 'Confirm location sharing before accepting this delivery.';end if;
        insert into public.dispatch_location(package_id,latitude,longitude,accuracy)
          values(target,(p->>'latitude')::float8,(p->>'longitude')::float8,(p->>'accuracy')::float8)
          on conflict(package_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=now();
        update public.dispatch_packages set status='in_transit',started_at=now() where id=target returning * into parcel;
        log_event:='accepted';message:='Driver accepted and started delivery tracking';
      else
        state:=case p_action when 'drive_complete' then 'delivered' when 'drive_issue' then 'issue' else 'cancelled' end;
        if parcel.status=state then return jsonb_build_object('id',target);end if;
        if (left(p_action,6)='drive_' and parcel.status<>'in_transit') or parcel.status in ('delivered','cancelled') then raise exception 'This delivery has already ended.';end if;
        if coalesce(length(trim(p->>'note')),0)>500 or (state in ('issue','cancelled') and coalesce(length(trim(p->>'note')),0)<3) then raise exception 'Enter a short reason for this status.';end if;
        update public.dispatch_packages set status=state,finished_at=now(),result_note=nullif(trim(p->>'note'),'') where id=target returning * into parcel;
        delete from public.dispatch_location where package_id=target;
        log_event:=state;
        message:=case state when 'delivered' then 'Package delivered' when 'issue' then 'Driver reported a delivery issue' else 'Delivery cancelled' end;
      end if;
    end if;
    insert into public.dispatch_events(package_id,actor,event,note) values(target,actor,log_event,nullif(trim(p->>'note'),''));
    insert into public.staff_notifications(user_id,package_id,message)
      select s.user_id,target,message||' · VC-'||parcel.number from public.staff_roles s
      where s.active and s.user_id<>actor and (s.user_id=parcel.driver_id or s.user_id=parcel.created_by or public.vcs_can(s.user_id,'dispatch'));
  elsif p_action in ('product_save','product_visibility','product_publish_all','product_hide_all','product_import') then
    if not public.vcs_can(actor,'catalog') then raise exception 'Catalog permission required.'; end if;
    if p_action in ('product_publish_all','product_hide_all') then
      update public.products set status=case p_action when 'product_publish_all' then 'published' else 'draft' end,updated_at=now()
      where status<>'archived' and not sample;
      get diagnostics affected=row_count;
    elsif p_action='product_visibility' then
      target:=(p->>'id')::uuid;
      update public.products set status=case when p->>'public'='true' then 'published' else 'draft' end,updated_at=now()
        where id=target and status<>'archived' and not sample;
      if not found then raise exception 'Save real product details before publishing.'; end if;
    elsif p_action='product_import' then
      if jsonb_typeof(p->'rows') is distinct from 'array' or jsonb_array_length(p->'rows') not between 1 and 200 then raise exception 'Import up to 200 products at once.'; end if;
      insert into public.products(name,slug,sku,category,description,image,price,unit,status,sample)
      select trim(x.name),x.slug,trim(x.sku),trim(x.category),coalesce(x.description,''),coalesce(nullif(x.image,''),'/products/cable.svg'),0,coalesce(nullif(x.unit,''),'each'),'draft',false
        from jsonb_to_recordset(p->'rows') x(name text,slug text,sku text,category text,description text,image text,unit text)
        where coalesce(length(trim(x.name)),0) between 1 and 160 and coalesce(length(trim(x.sku)),0) between 1 and 80
          and coalesce(length(trim(x.category)),0) between 1 and 100 and x.slug ~ '^[a-z0-9-]{1,180}$'
          and coalesce(length(x.description),0)<=4000 and coalesce(length(x.image),0)<=1000 and coalesce(x.image,'') ~ '^(|/(?!/)[A-Za-z0-9_./-]+|https://[^[:space:]]+)$';
      get diagnostics affected=row_count;
      if affected<>jsonb_array_length(p->'rows') then raise exception 'One or more rows have invalid product details.'; end if;
    else
      target:=coalesce((p->>'id')::uuid,gen_random_uuid());
      if coalesce(length(trim(p->>'name')),0) not between 1 and 160 or coalesce(length(trim(p->>'sku')),0) not between 1 and 80 or coalesce(length(trim(p->>'category')),0) not between 1 and 100
        or coalesce(p->>'slug','') !~ '^[a-z0-9-]{1,180}$' or coalesce(length(p->>'description'),0)>4000
        or coalesce(length(p->>'image'),0)>1000 or coalesce(p->>'image','') !~ '^(|/(?!/)[A-Za-z0-9_./-]+|https://[^[:space:]]+)$' then raise exception 'Check the name, SKU, category, slug and image URL.'; end if;
      insert into public.products(id,name,slug,sku,category,description,image,price,unit,status,sample)
        values(target,trim(p->>'name'),p->>'slug',trim(p->>'sku'),trim(p->>'category'),coalesce(p->>'description',''),coalesce(nullif(p->>'image',''),'/products/cable.svg'),0,coalesce(nullif(p->>'unit',''),'each'),'draft',false)
        on conflict(id) do update set name=excluded.name,slug=excluded.slug,sku=excluded.sku,category=excluded.category,description=excluded.description,image=excluded.image,unit=excluded.unit,sample=false,updated_at=now();
    end if;
  elsif p_action='lead_status' then
    if not public.vcs_can(actor,'leads') then raise exception 'Enquiry permission required.'; end if;
    target:=(p->>'id')::uuid;state:=p->>'status';
    if coalesce(state,'') not in ('new','reviewing','quoted','closed') then raise exception 'Invalid request status.';end if;
    if p->>'kind'='quote' then update public.quotes set status=state where id=target;
    elsif p->>'kind'='contact' then update public.inquiries set status=state where id=target;
    else raise exception 'Unknown request type.';end if;
  elsif p_action in ('website_save','website_publish','website_discard') then
    if not public.vcs_can(actor,'website') then raise exception 'Website permission required.'; end if;
    if coalesce(p->>'route','') !~ '^/(|shop|quotes|info/[a-z0-9-]{1,70})$' or jsonb_typeof(p->'edits') is distinct from 'object'
      or length((p->'edits')::text)>200000 then raise exception 'Invalid website page or edits.'; end if;
    insert into public.website_edits(route) values(p->>'route') on conflict do nothing;
    select revision into revision_now from public.website_edits where route=p->>'route' for update;
    if revision_now is distinct from (p->>'revision')::integer then raise exception 'Another editor changed this page. Reopen it before saving.'; end if;
    update public.website_edits set draft=case when p_action='website_discard' then published else p->'edits' end,
      published=case when p_action='website_publish' then p->'edits' else published end,
      published_at=case when p_action='website_publish' then now() else published_at end,
      revision=revision+1,updated_at=now() where route=p->>'route';
  elsif p_action in ('access_save','access_invite') then
    if not public.vcs_can(actor,'access') then raise exception 'Owner permission required.'; end if;
    target:=(p->>'id')::uuid;state:=p->>'role';
    staff_email:=lower(trim(p->>'email'));
    if p_action='access_invite' then
      if coalesce(length(staff_email),0) not between 5 and 254 or staff_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
        raise exception 'Enter a valid staff email.';
      end if;
      select id into target from auth.users where lower(email)=staff_email and email_confirmed_at is not null;
    end if;
    if target=actor or exists(select 1 from public.staff_roles where user_id=target and role='owner') then raise exception 'Owner access cannot be changed here.'; end if;
    if (p_action='access_save' and not exists(select 1 from auth.users where id=target and email_confirmed_at is not null))
      or coalesce(state,'') not in ('admin','accountant','dispatcher','driver','catalog_editor','marketing_editor','reports_viewer')
      or (p->'permissions' is distinct from 'null'::jsonb and (jsonb_typeof(p->'permissions') is distinct from 'array'
        or exists(select 1 from jsonb_array_elements_text(p->'permissions') as x where not (x=any(allowed)))))
      then raise exception 'Choose a verified account and supported permissions.';end if;
    if target is null then
      insert into public.staff_activation(email,role,active,permissions)
      values(staff_email,state,p->>'active'='true',case when p->'permissions'='null'::jsonb then null else array(select jsonb_array_elements_text(p->'permissions')) end)
      on conflict(email) do update set role=excluded.role,active=excluded.active,permissions=excluded.permissions;
    else
      insert into public.staff_roles(user_id,role,active,permissions)
      values(target,state,p->>'active'='true',case when p->'permissions'='null'::jsonb then null else array(select jsonb_array_elements_text(p->'permissions')) end)
      on conflict(user_id) do update set role=excluded.role,active=excluded.active,permissions=excluded.permissions;
      if not public.vcs_can(target,'drive') then perform public.vcs_unassign_disabled_driver(target,actor); end if;
    end if;
  else raise exception 'Unknown workspace action.';
  end if;
  insert into public.audit_logs(actor,operation,entity,details) values(actor,p_action,'operations',jsonb_build_object('id',target,'route',p->>'route','affected',affected));
  return jsonb_build_object('ok',true,'id',target,'affected',affected,'revision',revision_now+1);
end;
$$;
create or replace function public.vcs_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare request_id uuid; rate_key text; email text;
begin
  email := lower(trim(p->>'email'));
  if coalesce(p->>'kind','') not in ('contact','quote') or coalesce(length(trim(p->>'name')),0) not between 2 and 150
    or coalesce(length(email),0) not between 5 and 254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or coalesce(length(trim(p->>'body')),0) not between 5 and 10000 or coalesce(length(p->>'company'),0)>150
    or coalesce(length(p->>'phone'),0)>50 or coalesce(p->>'website','')<>'' or p->>'consent' is distinct from 'true'
    then raise exception 'Check your contact details and request.'; end if;
  rate_key := 'request:' || md5(email);
  if not public.hit_limit(rate_key) then raise exception 'Too many requests. Please try again later.'; end if;
  if p->>'kind'='quote' then
    insert into public.quotes(name,email,phone,company,body)
    values(trim(p->>'name'),email,nullif(trim(p->>'phone'),''),nullif(trim(p->>'company'),''),trim(p->>'body')) returning id into request_id;
  else
    insert into public.inquiries(name,email,body)
    values(trim(p->>'name'),email,trim(p->>'body')) returning id into request_id;
  end if;
  return jsonb_build_object('id',request_id,'message','Your request was recorded. Our team can reply using the contact details you provided.');
end;
$$;
commit;
