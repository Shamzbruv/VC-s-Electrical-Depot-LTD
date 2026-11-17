begin;

-- ---------------------------------------------------------------------------
-- 1. Permissions: administrators manage staff and read the audit trail.
--    'access' (Team) and 'audit' are tied to the owner and admin ROLES only and
--    can never be granted through custom permission lists.
-- ---------------------------------------------------------------------------
create or replace function public.vcs_can(p_user uuid, p_area text) returns boolean
language sql stable set search_path='' as $$
  select exists(
    select 1 from public.staff_roles s where s.user_id=p_user and s.active and
    (s.role='owner'
      or (p_area in ('access','audit') and s.role='admin')
      or (p_area not in ('access','audit') and p_area=any(coalesce(s.permissions,
        case s.role
          when 'admin' then array['finance','finance_reports','dispatch','catalog','leads','website']
          when 'accountant' then array['finance','finance_reports']
          when 'dispatcher' then array['dispatch']
          when 'driver' then array['drive']
          when 'order_fulfillment' then array['dispatch']
          when 'catalog_editor' then array['catalog']
          when 'marketing_editor' then array['website']
          when 'reports_viewer' then array['finance_reports']
          else array[]::text[] end))))
  );
$$;
revoke all on function public.vcs_can(uuid,text) from public,anon,authenticated;

-- The profile area lists the permissions a user holds; include 'audit'.
-- (vcs_read is wrapped below so the original function body is not duplicated.)

-- ---------------------------------------------------------------------------
-- 2. Audit log: richer, append-only.
-- ---------------------------------------------------------------------------
alter table public.audit_logs add column if not exists actor_email text;
alter table public.audit_logs add column if not exists actor_role text;
alter table public.audit_logs add column if not exists summary text;
alter table public.audit_logs add column if not exists outcome text not null default 'success';
create index if not exists audit_logs_created on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor on public.audit_logs(actor,created_at desc);
create index if not exists audit_logs_operation on public.audit_logs(operation,created_at desc);

create or replace function public.vcs_audit_summary(op text, d jsonb) returns text
language sql immutable set search_path='' as $$
  select case op
    when 'sign_in' then 'Signed in'
    when 'sign_out' then 'Signed out'
    when 'finance_export' then 'Exported the finance ledger (CSV)'
    when 'role_preview' then 'Opened role preview'
    when 'finance_add' then 'Posted a finance entry'
    when 'finance_void' then 'Voided a finance entry'
    when 'dispatch_create' then 'Queued a delivery package'
    when 'dispatch_assign' then 'Assigned a driver'
    when 'dispatch_cancel' then 'Cancelled a delivery'
    when 'drive_accept' then 'Accepted a delivery'
    when 'drive_complete' then 'Completed a delivery'
    when 'drive_issue' then 'Reported a delivery issue'
    when 'product_save' then 'Saved a product'
    when 'product_visibility' then 'Changed product visibility'
    when 'product_publish_all' then 'Published all products'
    when 'product_hide_all' then 'Hid all products'
    when 'product_import' then 'Imported products'
    when 'lead_status' then 'Updated an enquiry status'
    when 'website_save' then 'Saved a website draft'
    when 'website_publish' then 'Published a website page'
    when 'website_discard' then 'Discarded a website draft'
    when 'access_invite' then 'Approved a staff email'
    when 'access_save' then 'Changed staff access'
    when 'staff_profile_save' then 'Updated a staff profile'
    when 'stock_adjusted' then 'Adjusted stock'
    else replace(op,'_',' ') end;
$$;

-- Fill identity and a readable summary for every audit row, whichever function wrote it.
create or replace function public.vcs_audit_fill() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.actor is not null and (new.actor_email is null or new.actor_role is null) then
    select coalesce(new.actor_email,u.email), coalesce(new.actor_role,s.role) into new.actor_email,new.actor_role
    from (select 1) x left join auth.users u on u.id=new.actor left join public.staff_roles s on s.user_id=new.actor;
  end if;
  if new.summary is null then new.summary:=public.vcs_audit_summary(new.operation,new.details); end if;
  return new;
end;
$$;
revoke all on function public.vcs_audit_fill() from public,anon,authenticated;
drop trigger if exists vcs_audit_fill on public.audit_logs;
create trigger vcs_audit_fill before insert on public.audit_logs for each row execute function public.vcs_audit_fill();

create or replace function public.vcs_audit_immutable() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Audit records are append-only.'; end;
$$;
drop trigger if exists vcs_audit_no_change on public.audit_logs;
create trigger vcs_audit_no_change before update or delete on public.audit_logs for each row execute function public.vcs_audit_immutable();
drop trigger if exists vcs_audit_no_truncate on public.audit_logs;
create trigger vcs_audit_no_truncate before truncate on public.audit_logs for each statement execute function public.vcs_audit_immutable();
revoke all on public.audit_logs from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 3. Staff profiles (optional, owner/admin-entered details; nothing is invented).
-- ---------------------------------------------------------------------------
create table if not exists public.staff_profiles(
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check(length(display_name)<=120), job_title text check(length(job_title)<=120), phone text check(length(phone)<=50),
  updated_at timestamptz not null default now()
);
alter table public.staff_profiles enable row level security;
revoke all on public.staff_profiles from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 4. Guarded wrapper around the existing vcs_write. The original body is kept
--    unchanged as vcs_write_core and is no longer callable by clients.
-- ---------------------------------------------------------------------------
alter function public.vcs_write(text,jsonb) rename to vcs_write_core;
revoke all on function public.vcs_write_core(text,jsonb) from public,anon,authenticated;

create function public.vcs_write(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; target uuid; target_role text; before_row jsonb; after_row jsonb; result jsonb; staff_email text;
begin
  select role into actor_role from public.staff_roles where user_id=actor and active;
  if actor_role is null then raise exception 'Active staff account required.'; end if;

  if p_action in ('access_save','access_invite') then
    if not public.vcs_can(actor,'access') then raise exception 'Staff management permission required.'; end if;
    if actor_role<>'owner' then
      if coalesce(p->>'role','') in ('admin','owner') then raise exception 'Only the owner can assign the Administrator role.'; end if;
      if p_action='access_save' then target:=(p->>'id')::uuid;
      else
        staff_email:=lower(trim(p->>'email'));
        select id into target from auth.users where lower(email)=staff_email;
      end if;
      select role into target_role from public.staff_roles where user_id=target;
      if target_role in ('admin','owner') then raise exception 'Only the owner can change an Administrator or Owner.'; end if;
    end if;
    if p_action='access_save' then target:=(p->>'id')::uuid;
    else select id into target from auth.users where lower(email)=lower(trim(p->>'email')); end if;
    select to_jsonb(s)-'user_id' into before_row from public.staff_roles s where user_id=target;
    result:=public.vcs_write_core(p_action,p);
    select to_jsonb(s)-'user_id' into after_row from public.staff_roles s where user_id=target;
    insert into public.audit_logs(actor,operation,entity,details) values(actor,'staff_access_change','staff',jsonb_build_object(
      'action',p_action,'target',target,'target_email',coalesce(lower(trim(p->>'email')),(select email from auth.users where id=target)),
      'before',before_row,'after',coalesce(after_row,jsonb_build_object('role',p->>'role','active',p->>'active','permissions',p->'permissions','pending',true))));
    return result;
  end if;
  return public.vcs_write_core(p_action,p);
end;
$$;
revoke all on function public.vcs_write(text,jsonb) from public,anon;
grant execute on function public.vcs_write(text,jsonb) to authenticated;

-- Profile permissions now include 'audit'.
alter function public.vcs_read(text,jsonb) rename to vcs_read_core;
revoke all on function public.vcs_read_core(text,jsonb) from public,anon,authenticated;
create function public.vcs_read(p_area text,p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  result:=public.vcs_read_core(p_area,p);
  if p_area='profile' then
    result:=jsonb_set(result,'{permissions}',coalesce((select jsonb_agg(area) from unnest(array['finance','finance_reports','dispatch','drive','catalog','leads','website','access','audit']) as area where public.vcs_can(actor,area)),'[]'::jsonb));
  end if;
  return result;
end;
$$;
revoke all on function public.vcs_read(text,jsonb) from public,anon;
grant execute on function public.vcs_read(text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Team directory and profile editing.
-- ---------------------------------------------------------------------------
create function public.vcs_team_read(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if not public.vcs_can(actor,'access') then raise exception 'Staff management permission required.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.pending desc, t.email) from (
    select u.id,u.email,s.role,s.active,s.permissions,false as pending,u.last_sign_in_at,u.created_at,
      f.display_name,f.job_title,f.phone,
      (select count(*) from public.audit_logs a where a.actor=u.id and a.created_at>now()-interval '30 days') as actions_30d
    from public.staff_roles s join auth.users u on u.id=s.user_id left join public.staff_profiles f on f.user_id=u.id
    union all
    select null::uuid,a.email,a.role,a.active,a.permissions,true,null::timestamptz,a.approved_at,null,null,null,0::bigint from public.staff_activation a
  ) t),'[]'::jsonb);
end;
$$;
revoke all on function public.vcs_team_read(jsonb) from public,anon;
grant execute on function public.vcs_team_read(jsonb) to authenticated;

create function public.vcs_team_write(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; target uuid:=(p->>'id')::uuid; target_role text;
begin
  select role into actor_role from public.staff_roles where user_id=actor and active;
  if not public.vcs_can(actor,'access') then raise exception 'Staff management permission required.'; end if;
  if p_action<>'staff_profile_save' then raise exception 'Unknown team action.'; end if;
  select role into target_role from public.staff_roles where user_id=target;
  if target_role is null then raise exception 'Choose an existing staff member.'; end if;
  if actor_role<>'owner' and target<>actor and target_role in ('owner','admin') then raise exception 'Only the owner can edit an Administrator or Owner profile.'; end if;
  if coalesce(length(p->>'display_name'),0)>120 or coalesce(length(p->>'job_title'),0)>120 or coalesce(length(p->>'phone'),0)>50 then raise exception 'Check the profile details.'; end if;
  insert into public.staff_profiles(user_id,display_name,job_title,phone) values(target,nullif(trim(p->>'display_name'),''),nullif(trim(p->>'job_title'),''),nullif(trim(p->>'phone'),''))
  on conflict(user_id) do update set display_name=excluded.display_name,job_title=excluded.job_title,phone=excluded.phone,updated_at=now();
  insert into public.audit_logs(actor,operation,entity,details) values(actor,'staff_profile_save','staff',jsonb_build_object('target',target,'target_email',(select email from auth.users where id=target)));
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.vcs_team_write(text,jsonb) from public,anon;
grant execute on function public.vcs_team_write(text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Audit read (filtered, paginated) and client-reported session events.
-- ---------------------------------------------------------------------------
create function public.vcs_audit_read(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); q text:=nullif(trim(coalesce(p->>'q','')),''); who uuid:=nullif(p->>'actor','')::uuid; op text:=nullif(p->>'operation','');
  from_day date:=nullif(p->>'from','')::date; to_day date:=nullif(p->>'to','')::date; page integer:=greatest(0,least(100000,coalesce((p->>'offset')::integer,0)));
  lim integer:=greatest(1,least(500,coalesce((p->>'limit')::integer,50))); total bigint; rows jsonb;
begin
  if not public.vcs_can(actor,'audit') then raise exception 'Audit permission required.'; end if;
  select count(*) into total from public.audit_logs a where (who is null or a.actor=who) and (op is null or a.operation=op)
    and (from_day is null or (a.created_at at time zone 'America/Jamaica')::date>=from_day) and (to_day is null or (a.created_at at time zone 'America/Jamaica')::date<=to_day)
    and (q is null or a.summary ilike '%'||q||'%' or a.actor_email ilike '%'||q||'%' or a.operation ilike '%'||q||'%' or a.details::text ilike '%'||q||'%');
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from (
    select a.id,a.created_at,a.actor,a.actor_email,a.actor_role,a.operation,a.entity,a.summary,a.outcome,a.details from public.audit_logs a
    where (who is null or a.actor=who) and (op is null or a.operation=op)
      and (from_day is null or (a.created_at at time zone 'America/Jamaica')::date>=from_day) and (to_day is null or (a.created_at at time zone 'America/Jamaica')::date<=to_day)
      and (q is null or a.summary ilike '%'||q||'%' or a.actor_email ilike '%'||q||'%' or a.operation ilike '%'||q||'%' or a.details::text ilike '%'||q||'%')
    order by a.created_at desc,a.id limit lim offset page) r;
  return jsonb_build_object('total',total,'rows',rows,
    'operations',(select coalesce(jsonb_agg(distinct operation order by operation),'[]'::jsonb) from public.audit_logs),
    'people',(select coalesce(jsonb_agg(jsonb_build_object('id',x.person,'email',x.email) order by x.email),'[]'::jsonb) from (select distinct l.actor as person,l.actor_email as email from public.audit_logs l where l.actor is not null and l.actor_email is not null) x));
end;
$$;
revoke all on function public.vcs_audit_read(jsonb) from public,anon;
grant execute on function public.vcs_audit_read(jsonb) to authenticated;

create function public.vcs_audit_event(p_kind text,p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if not exists(select 1 from public.staff_roles where user_id=actor and active) then raise exception 'Active staff account required.'; end if;
  if p_kind not in ('sign_in','sign_out','finance_export','role_preview') then raise exception 'Unsupported audit event.'; end if;
  insert into public.audit_logs(actor,operation,entity,details) values(actor,p_kind,'session',jsonb_build_object('area',left(coalesce(p->>'area',''),60)));
  return '{"ok":true}'::jsonb;
end;
$$;
revoke all on function public.vcs_audit_event(text,jsonb) from public,anon;
grant execute on function public.vcs_audit_event(text,jsonb) to authenticated;

commit;
