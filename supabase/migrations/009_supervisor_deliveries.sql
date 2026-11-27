begin;

-- Keep existing work and access, while replacing specialist role templates with Admin.
update public.staff_roles set permissions=case
  when role='owner' then null
  when permissions is not null then array(select distinct case when scope in ('finance','finance_reports') then 'reports' when scope='drive' then 'dispatch' else scope end from unnest(permissions) scope)
  when role in ('accountant','reports_viewer') then array['reports']
  when role in ('driver','dispatcher','order_fulfillment') then array['dispatch']
  when role='catalog_editor' then array['catalog']
  when role='marketing_editor' then array['website']
  else null end;
update public.staff_activation set permissions=case
  when permissions is not null then array(select distinct case when scope in ('finance','finance_reports') then 'reports' when scope='drive' then 'dispatch' else scope end from unnest(permissions) scope)
  when role in ('accountant','reports_viewer') then array['reports']
  when role in ('driver','dispatcher','order_fulfillment') then array['dispatch']
  when role='catalog_editor' then array['catalog']
  when role='marketing_editor' then array['website'] else null end;
update public.staff_roles set role='admin' where role<>'owner';
update public.staff_activation set role='admin' where role<>'owner';
alter table public.staff_roles drop constraint staff_roles_role_check;
alter table public.staff_roles add constraint staff_roles_role_check check(role in ('owner','admin'));

create or replace function public.vcs_can(p_user uuid,p_area text) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.staff_roles s where user_id=p_user and active
   and (role='owner' or (p_area<>'access' and p_area=any(coalesce(s.permissions,array['dispatch','catalog','leads','website','reports'])))));
$$;

alter table public.dispatch_packages add column customer_email text;
alter table public.dispatch_packages add column order_reference text not null default '';
alter table public.dispatch_packages add column order_items jsonb not null default '[]'::jsonb;
alter table public.dispatch_packages add column vehicle text not null default '';
alter table public.dispatch_packages add column delivery_window text not null default '';
alter table public.dispatch_packages add column received_by text;
alter table public.dispatch_packages add column release_cycle integer not null default 0;
alter table public.dispatch_packages add column updated_at timestamptz not null default now();
delete from public.dispatch_location;

create table public.delivery_email_jobs (
 id uuid primary key default gen_random_uuid(),
 sequence bigint generated always as identity unique,
 package_id uuid not null references public.dispatch_packages(id),
 phase text not null check(phase in ('out_for_delivery','arrived')),
 cycle integer not null,
 recipient text not null,
 payload jsonb not null,
 state text not null default 'queued' check(state in ('queued','processing','sent','failed','skipped','needs_review')),
 attempts integer not null default 0,
 lease_token uuid,
 leased_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 provider_id text,
 last_error text,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 unique(package_id,phase,cycle)
);
create index delivery_email_due_idx on public.delivery_email_jobs(state,next_attempt_at);
create index delivery_email_package_idx on public.delivery_email_jobs(package_id,created_at);
alter table public.delivery_email_jobs enable row level security;
revoke all on public.delivery_email_jobs from public,anon,authenticated;

-- An owner changes roles. An administrator can receive individual workspace permissions.
alter function public.vcs_read(text,jsonb) rename to vcs_read_legacy;
revoke all on function public.vcs_read_legacy(text,jsonb) from public,anon,authenticated;
create function public.vcs_read(p_area text,p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); role_name text;
begin
 select role into role_name from public.staff_roles where user_id=actor and active;
 if role_name is null then raise exception 'Your account has no active staff access.';end if;
 if p_area='profile' then
  return jsonb_build_object('id',actor,'role',role_name,'email',auth.jwt()->>'email','permissions',
    (select coalesce(jsonb_agg(area),'[]') from unnest(array['dispatch','catalog','leads','website','access','reports']) area where public.vcs_can(actor,area)));
 end if;
 if p_area in ('drive','drivers','finance') then raise exception 'This workspace has been retired.';end if;
 return public.vcs_read_legacy(p_area,p);
end;
$$;
revoke all on function public.vcs_read(text,jsonb) from public,anon;
grant execute on function public.vcs_read(text,jsonb) to authenticated;

alter function public.vcs_write(text,jsonb) rename to vcs_write_legacy;
revoke all on function public.vcs_write_legacy(text,jsonb) from public,anon,authenticated;
create function public.vcs_write(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; staff_email text; actor uuid:=auth.uid();
begin
 if not exists(select 1 from public.staff_roles where user_id=actor and active) then raise exception 'Active staff account required.';end if;
 if p_action in ('access_save','access_invite') then
  if not public.vcs_can(actor,'access') then raise exception 'Owner permission required.';end if;
  if p->>'role' not in ('owner','admin') or p->>'role' is null then raise exception 'Choose Owner or Admin.';end if;
  if jsonb_typeof(p->'permissions') not in ('array','null') or p->'permissions' is null
    or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(p->'permissions')='array' then p->'permissions' else '[]'::jsonb end) a where a not in ('dispatch','catalog','leads','website','reports'))
    then raise exception 'Choose supported workspace permissions.';end if;
  target:=(p->>'id')::uuid;staff_email:=lower(trim(p->>'email'));
  if p_action='access_invite' then
   if coalesce(staff_email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(staff_email)>254 then raise exception 'Enter a valid staff email.';end if;
   select id into target from auth.users where lower(email)=staff_email and email_confirmed_at is not null;
  elsif not exists(select 1 from auth.users where id=target and email_confirmed_at is not null) then
   raise exception 'Choose a verified staff account.';
  end if;
  if target=actor or exists(select 1 from public.staff_roles where user_id=target and role='owner') then raise exception 'Existing owner access cannot be changed here.';end if;
  if target is null then
   insert into public.staff_activation(email,role,active,permissions) values(staff_email,p->>'role',coalesce((p->>'active')::boolean,false),
     case when p->>'role'='owner' or p->'permissions'='null'::jsonb then null else array(select jsonb_array_elements_text(p->'permissions')) end)
   on conflict(email) do update set role=excluded.role,active=excluded.active,permissions=excluded.permissions;
  else
   insert into public.staff_roles(user_id,role,active,permissions) values(target,p->>'role',coalesce((p->>'active')::boolean,false),
     case when p->>'role'='owner' or p->'permissions'='null'::jsonb then null else array(select jsonb_array_elements_text(p->'permissions')) end)
   on conflict(user_id) do update set role=excluded.role,active=excluded.active,permissions=excluded.permissions;
  end if;
  insert into public.audit_logs(actor,operation,entity,details) values(actor,p_action,'staff',jsonb_build_object('id',target,'role',p->>'role'));
  return '{"ok":true}';
 end if;
 if left(p_action,6)='drive_' or left(p_action,9)='dispatch_' or left(p_action,8)='finance_' then
   raise exception 'Use the supervisor delivery workspace.';
 end if;
 return public.vcs_write_legacy(p_action,p);
end;
$$;
revoke all on function public.vcs_write(text,jsonb) from public,anon;
grant execute on function public.vcs_write(text,jsonb) to authenticated;

create function public.vcs_supervisor_read(p_area text,p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; from_day date; to_day date;
begin
 if not exists(select 1 from public.staff_roles where user_id=actor and active) then raise exception 'Active staff account required.';end if;
 if p_area='setup' then return '{"version":1}'::jsonb;end if;
 if p_area='picking_products' then
  if not public.vcs_can(actor,'dispatch') then raise exception 'Delivery permission required.';end if;
  return coalesce((select jsonb_agg(to_jsonb(item)) from (
    select name,sku,unit from public.products where status<>'archived' and not sample order by name limit 200
  ) item),'[]'::jsonb);
 end if;
 if p_area in ('shipments','automations') then
  if not public.vcs_can(actor,'dispatch') then raise exception 'Delivery permission required.';end if;
  if p_area='automations' then
   return (select jsonb_build_object(
     'queued',count(*) filter(where state in ('queued','processing')),
     'failed',count(*) filter(where state in ('failed','needs_review')),
     'sent',count(*) filter(where state='sent'),
     'jobs',coalesce((select jsonb_agg(to_jsonb(j)) from (
       select id,package_id,phase,state,recipient,attempts,last_error,created_at,sent_at
       from public.delivery_email_jobs order by created_at desc limit 100) j),'[]'::jsonb))
     from public.delivery_email_jobs);
  end if;
  select jsonb_agg(to_jsonb(d)) into result from (
    select s.*,
      coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'event',e.event,'note',e.note,'created_at',e.created_at) order by e.created_at desc)
        from public.dispatch_events e where e.package_id=s.id),'[]') as timeline,
      coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'phase',j.phase,'state',j.state,'created_at',j.created_at,'sent_at',j.sent_at,'error',j.last_error) order by j.created_at desc)
        from public.delivery_email_jobs j where j.package_id=s.id),'[]') as emails
    from public.dispatch_packages s
    where (coalesce(p->>'status','')='' or s.status=p->>'status' or (p->>'status'='open' and s.status not in ('delivered','cancelled')))
      and (coalesce(p->>'q','')='' or s.recipient ilike '%'||(p->>'q')||'%' or s.order_reference ilike '%'||(p->>'q')||'%' or s.number::text=p->>'q')
    order by case when s.status in ('delivered','cancelled') then 1 else 0 end,s.delivery_date,s.created_at desc
    limit 100 offset greatest(0,least(coalesce((p->>'offset')::int,0),100000))
  ) d;
  return coalesce(result,'[]'::jsonb);
 end if;
 if p_area='reports' then
  if not (public.vcs_can(actor,'reports') or public.vcs_can(actor,'dispatch')) then raise exception 'Operations report permission required.';end if;
  from_day:=(p->>'from')::date;to_day:=(p->>'to')::date;
  if to_day-from_day not between 0 and 365 or from_day is null or to_day is null then raise exception 'Choose a reporting period of up to 366 days.';end if;
  return (select jsonb_build_object(
    'created',count(*),'delivered',count(*) filter(where status='delivered'),
    'open',count(*) filter(where status not in ('delivered','cancelled')),
    'issues',count(*) filter(where status='issue'),
    'overdue',count(*) filter(where delivery_date<(now() at time zone 'America/Jamaica')::date and status not in ('delivered','cancelled')),
    'rows',coalesce((select jsonb_agg(to_jsonb(r)) from (
      select number,order_reference,recipient,delivery_date,status,started_at,finished_at,received_by
      from public.dispatch_packages where (created_at at time zone 'America/Jamaica')::date between from_day and to_day
      order by created_at desc limit 1000) r),'[]'))
    from public.dispatch_packages where (created_at at time zone 'America/Jamaica')::date between from_day and to_day);
 end if;
 raise exception 'Unknown supervisor workspace.';
end;
$$;
revoke all on function public.vcs_supervisor_read(text,jsonb) from public,anon;
grant execute on function public.vcs_supervisor_read(text,jsonb) to authenticated;

create function public.vcs_supervisor_write(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); parcel public.dispatch_packages%rowtype; target uuid:=(p->>'id')::uuid;
  items jsonb; entry jsonb; next_state text; event_name text; email_job public.delivery_email_jobs%rowtype;
begin
 if not public.vcs_can(actor,'dispatch') then raise exception 'Delivery permission required.';end if;
 if p_action='resolve_email' then
  if p->>'confirmed' is distinct from 'true' or coalesce(length(trim(p->>'note')),0) not between 10 and 500 then
    raise exception 'Confirm manual customer follow-up and enter a reason of at least 10 characters.';
  end if;
  select * into email_job from public.delivery_email_jobs where id=target for update;
  if not found or email_job.state not in ('failed','needs_review') then raise exception 'Only an email requiring review can be closed manually.';end if;
  update public.delivery_email_jobs set state='skipped',last_error='Handled manually: '||trim(p->>'note') where id=target;
  insert into public.dispatch_events(package_id,actor,event,note) values(email_job.package_id,actor,'customer_follow_up',p->>'note');
  insert into public.audit_logs(actor,operation,entity,details) values(actor,'delivery_email_resolved','delivery_email',jsonb_build_object('id',target,'note',p->>'note'));
  return jsonb_build_object('id',target);
 end if;
 if p_action='save' then
  items:=p->'items';
  if coalesce(length(trim(p->>'recipient')),0) not between 2 and 150
    or coalesce(p->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(p->>'email')>254
    or coalesce(length(trim(p->>'phone')),0) not between 7 and 50
    or coalesce(length(trim(p->>'address')),0) not between 5 and 500
    or coalesce(length(p->>'reference'),0)>100 or coalesce(length(p->>'vehicle'),0)>100
    or coalesce(length(p->>'window'),0)>100 or coalesce(length(p->>'notes'),0)>1000
    or jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 100
    then raise exception 'Check the customer, destination and order details.';end if;
  for entry in select * from jsonb_array_elements(items) loop
    if coalesce(length(trim(entry->>'name')),0) not between 1 and 160
      or coalesce((entry->>'quantity')::numeric,0) not between 0.001 and 1000000
      or coalesce(length(trim(entry->>'unit')),0) not between 1 and 40
      or jsonb_typeof(entry->'loaded') is distinct from 'boolean' then raise exception 'Each order item needs a name, quantity, unit and loading check.';end if;
  end loop;
  if target is null then raise exception 'Delivery ID required.';end if;
  select * into parcel from public.dispatch_packages where id=target for update;
  if found and parcel.status not in ('pending','assigned','issue') then raise exception 'This delivery has already left the depot. Its order summary is locked.';end if;
  insert into public.dispatch_packages(id,recipient,phone,address,description,delivery_date,notes,created_by,customer_email,order_reference,order_items,vehicle,delivery_window)
    values(target,trim(p->>'recipient'),trim(p->>'phone'),trim(p->>'address'),
      (select string_agg(x->>'name',', ') from jsonb_array_elements(items) x),(p->>'date')::date,coalesce(p->>'notes',''),actor,
      lower(trim(p->>'email')),coalesce(p->>'reference',''),items,coalesce(p->>'vehicle',''),coalesce(p->>'window',''))
    on conflict(id) do update set recipient=excluded.recipient,phone=excluded.phone,address=excluded.address,description=excluded.description,
      delivery_date=excluded.delivery_date,notes=excluded.notes,customer_email=excluded.customer_email,order_reference=excluded.order_reference,
      order_items=excluded.order_items,vehicle=excluded.vehicle,delivery_window=excluded.delivery_window,updated_at=now()
      where public.dispatch_packages.status in ('pending','assigned','issue');
  if not found then raise exception 'This delivery has already left the depot. Reopen the delivery list.';end if;
  event_name:='order_saved';
 else
  select * into parcel from public.dispatch_packages where id=target for update;
  if not found then raise exception 'Delivery unavailable.';end if;
  if p_action='release' then
   if parcel.status='in_transit' then return jsonb_build_object('id',target);end if;
   if parcel.status not in ('pending','assigned','issue') then raise exception 'Only an open delivery can leave the depot.';end if;
   if p->>'confirmed' is distinct from 'true' then raise exception 'Confirm the order and customer email before dispatch.';end if;
   if jsonb_array_length(parcel.order_items)=0 or exists(select 1 from jsonb_array_elements(parcel.order_items) x where x->>'loaded' is distinct from 'true')
     or coalesce(parcel.customer_email,'')='' then raise exception 'Save a customer email and check every item as loaded before dispatch.';end if;
   next_state:='in_transit';event_name:='out_for_delivery';
   update public.dispatch_packages set status=next_state,started_at=now(),finished_at=null,result_note=null,release_cycle=release_cycle+1,updated_at=now()
     where id=target returning * into parcel;
  elsif p_action='arrive' then
   if parcel.status='delivered' then return jsonb_build_object('id',target);end if;
   if parcel.status<>'in_transit' then raise exception 'Only a delivery on the way can be marked as arrived.';end if;
   if p->>'confirmed' is distinct from 'true' or coalesce(length(trim(p->>'received_by')),0) not between 2 and 150
     then raise exception 'Confirm arrival and record who received the items.';end if;
   next_state:='delivered';event_name:='arrived';
   update public.dispatch_packages set status=next_state,finished_at=now(),received_by=trim(p->>'received_by'),result_note=left(p->>'note',500),updated_at=now()
     where id=target returning * into parcel;
  elsif p_action in ('issue','cancel') then
   next_state:=case when p_action='issue' then 'issue' else 'cancelled' end;
   if parcel.status=next_state then return jsonb_build_object('id',target);end if;
   if parcel.status in ('delivered','cancelled') then raise exception 'This delivery is already closed.';end if;
   if coalesce(length(trim(p->>'note')),0) not between 3 and 500 then raise exception 'Record a reason for this update.';end if;
   event_name:=next_state;
   update public.dispatch_packages set status=next_state,finished_at=now(),result_note=p->>'note',updated_at=now() where id=target;
   update public.delivery_email_jobs set state='skipped',last_error='Delivery paused or cancelled before this update was sent.'
     where package_id=target and state in ('queued','failed');
  else raise exception 'Unknown delivery action.';
  end if;
  delete from public.dispatch_location where package_id=target;
  if event_name in ('out_for_delivery','arrived') and coalesce(parcel.customer_email,'')<>'' then
   insert into public.delivery_email_jobs(package_id,phase,cycle,recipient,payload)
     values(target,event_name,parcel.release_cycle,parcel.customer_email,jsonb_build_object(
       'number',parcel.number,'reference',parcel.order_reference,'recipient',parcel.recipient,'email',parcel.customer_email,
       'address',parcel.address,'date',parcel.delivery_date,'window',parcel.delivery_window,'items',parcel.order_items,'received_by',parcel.received_by,'phase',event_name));
  end if;
 end if;
 insert into public.dispatch_events(package_id,actor,event,note) values(target,actor,event_name,left(p->>'note',500));
 insert into public.audit_logs(actor,operation,entity,details) values(actor,'delivery_'||event_name,'dispatch',jsonb_build_object('id',target));
 insert into public.staff_notifications(user_id,package_id,message)
  select s.user_id,target,'Delivery update · '||replace(event_name,'_',' ') from public.staff_roles s
  where s.active and s.user_id<>actor and public.vcs_can(s.user_id,'dispatch');
 return jsonb_build_object('id',target);
end;
$$;
revoke all on function public.vcs_supervisor_write(text,jsonb) from public,anon;
grant execute on function public.vcs_supervisor_write(text,jsonb) to authenticated;

-- Worker functions require the server credential; browser JWTs cannot claim or acknowledge mail.
create function public.vcs_email_claim(p_package uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.delivery_email_jobs%rowtype; lease uuid:=gen_random_uuid();
begin
 update public.delivery_email_jobs set state='needs_review',last_error='Automatic retry window ended. Review the provider log before contacting this customer.'
  where state in ('queued','failed','processing') and created_at<now()-interval '23 hours';
 select * into job from public.delivery_email_jobs j
  where (p_package is null or j.package_id=p_package) and j.attempts<5 and j.created_at>now()-interval '23 hours'
    and ((j.state in ('queued','failed') and j.next_attempt_at<=now()) or (j.state='processing' and j.leased_until<now()))
    and not exists(select 1 from public.delivery_email_jobs previous where previous.package_id=j.package_id
      and previous.sequence<j.sequence and previous.state not in ('sent','skipped'))
  order by j.sequence for update skip locked limit 1;
 if not found then return null;end if;
 update public.delivery_email_jobs set state='processing',lease_token=lease,leased_until=now()+interval '2 minutes',attempts=attempts+1 where id=job.id;
 return jsonb_build_object('id',job.id,'lease',lease,'recipient',job.recipient,'payload',job.payload);
end;
$$;
create function public.vcs_email_ack(p_id uuid,p_lease uuid,p_provider text,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.delivery_email_jobs set state=case when p_error is null then 'sent' when attempts>=5 then 'needs_review' else 'failed' end,
   provider_id=p_provider,last_error=left(p_error,300),sent_at=case when p_error is null then now() end,
   next_attempt_at=now()+interval '5 minutes',leased_until=null
   where id=p_id and lease_token=p_lease and state='processing';
end;
$$;
revoke all on function public.vcs_email_claim(uuid),public.vcs_email_ack(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.vcs_email_claim(uuid),public.vcs_email_ack(uuid,uuid,text,text) to service_role;


alter function public.vcs_dashboard() rename to vcs_dashboard_legacy;
revoke all on function public.vcs_dashboard_legacy() from public,anon,authenticated;
create function public.vcs_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); summary jsonb; overdue bigint; failed bigint; stale bigint;
begin
 summary:=public.vcs_dashboard_legacy()-'finance';
 if public.vcs_can(actor,'dispatch') then
  select count(*) into overdue from public.dispatch_packages
    where delivery_date<(now() at time zone 'America/Jamaica')::date and status not in ('delivered','cancelled');
  select count(*) into failed from public.delivery_email_jobs where state in ('failed','needs_review');
 end if;
 if public.vcs_can(actor,'leads') then
  stale:=(select count(*) from public.quotes where status='new' and created_at<now()-interval '48 hours')
    +(select count(*) from public.inquiries where status='new' and created_at<now()-interval '48 hours');
 end if;
 return summary||jsonb_build_object('attention',jsonb_build_object('overdue',overdue,'email_failed',failed,'stale_requests',stale));
end;
$$;
revoke all on function public.vcs_dashboard() from public,anon,authenticated;
grant execute on function public.vcs_dashboard() to authenticated;

create function public.vcs_email_schedule_active() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare enabled boolean;
begin
 if to_regclass('cron.job') is null then return false;end if;
 execute 'select exists(select 1 from cron.job where jobname=''vcs-delivery-email-retries'' and active)' into enabled;
 return coalesce(enabled,false);
end;
$$;
revoke all on function public.vcs_email_schedule_active() from public,anon,authenticated;
grant execute on function public.vcs_email_schedule_active() to service_role;

commit;
