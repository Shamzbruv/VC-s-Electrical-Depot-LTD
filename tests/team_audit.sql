-- Run in a disposable database after migrations 001-009. Everything is rolled back.
begin;
do $$
declare o uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); r jsonb; failed boolean; n int;
begin
  insert into auth.users(id,email) values(o,'owner@example.invalid'),(a,'admin@example.invalid'),(a2,'admin2@example.invalid'),(d,'driver@example.invalid');
  insert into public.staff_roles(user_id,role,active) values(o,'owner',true),(a,'admin',true),(a2,'admin',true),(d,'driver',true);
  -- permissions
  if not public.vcs_can(a,'access') or not public.vcs_can(a,'audit') then raise exception 'Admin should manage staff and read audit'; end if;
  if public.vcs_can(d,'access') or public.vcs_can(d,'audit') then raise exception 'Driver must not manage staff'; end if;
  update public.staff_roles set permissions=array['finance'] where user_id=d;
  if public.vcs_can(d,'access') then raise exception 'Custom permissions must not grant access'; end if;
  update public.staff_roles set permissions=null where user_id=d;
  -- admin manages a driver, audit row is written with identity
  perform set_config('request.jwt.claim.sub',a::text,true); perform set_config('request.jwt.claim.email','admin@example.invalid',true);
  r:=public.vcs_write('access_save',jsonb_build_object('id',d,'role','dispatcher','active',false,'permissions',null));
  if (select role from public.staff_roles where user_id=d)<>'dispatcher' or (select active from public.staff_roles where user_id=d) then raise exception 'Admin could not update staff'; end if;
  select count(*) into n from public.audit_logs where operation='staff_access_change' and actor=a and actor_email='admin@example.invalid' and details->'before'->>'role'='driver';
  if n<>1 then raise exception 'Access change not audited with before/after (%)',n; end if;
  -- admin cannot create admins, change admins, or change owner
  failed:=false; begin perform public.vcs_write('access_save',jsonb_build_object('id',d,'role','admin','active',true,'permissions',null)); exception when others then failed:=true; end;
  if not failed then raise exception 'Admin assigned Administrator role'; end if;
  failed:=false; begin perform public.vcs_write('access_save',jsonb_build_object('id',a2,'role','driver','active',false,'permissions',null)); exception when others then failed:=true; end;
  if not failed then raise exception 'Admin changed another admin'; end if;
  failed:=false; begin perform public.vcs_write('access_save',jsonb_build_object('id',o,'role','driver','active',false,'permissions',null)); exception when others then failed:=true; end;
  if not failed then raise exception 'Admin changed owner'; end if;
  failed:=false; begin perform public.vcs_write('access_invite',jsonb_build_object('email','new@example.invalid','role','admin','active',true,'permissions',null)); exception when others then failed:=true; end;
  if not failed then raise exception 'Admin invited an admin'; end if;
  r:=public.vcs_write('access_invite',jsonb_build_object('email','new@example.invalid','role','accountant','active',true,'permissions',null));
  -- team directory and audit read
  r:=public.vcs_team_read(); if jsonb_array_length(r)<5 then raise exception 'Team directory incomplete'; end if;
  r:=public.vcs_audit_read(jsonb_build_object('operation','staff_access_change')); if (r->>'total')::int<1 then raise exception 'Audit read empty'; end if;
  perform public.vcs_audit_event('sign_in','{}');
  failed:=false; begin perform public.vcs_audit_event('delete_everything','{}'); exception when others then failed:=true; end;
  if not failed then raise exception 'Arbitrary audit event accepted'; end if;
  -- owner may manage admins
  perform set_config('request.jwt.claim.sub',o::text,true);
  perform public.vcs_write('access_save',jsonb_build_object('id',a2,'role','accountant','active',true,'permissions',null));
  -- non-managers are denied
  perform set_config('request.jwt.claim.sub',d::text,true);
  update public.staff_roles set active=true where user_id=d;
  failed:=false; begin perform public.vcs_audit_read(); exception when others then failed:=true; end;
  if not failed then raise exception 'Non-admin read audit'; end if;
  failed:=false; begin perform public.vcs_team_read(); exception when others then failed:=true; end;
  if not failed then raise exception 'Non-admin read team'; end if;
  -- append-only
  failed:=false; begin update public.audit_logs set summary='x'; exception when others then failed:=true; end;
  if not failed then raise exception 'Audit update allowed'; end if;
  failed:=false; begin delete from public.audit_logs; exception when others then failed:=true; end;
  if not failed then raise exception 'Audit delete allowed'; end if;
  failed:=false; begin truncate public.audit_logs; exception when others then failed:=true; end;
  if not failed then raise exception 'Audit truncate allowed'; end if;
  -- direct core access is closed to clients
  if has_function_privilege('authenticated','public.vcs_write_core(text,jsonb)','EXECUTE') then raise exception 'Core write exposed'; end if;
  raise notice 'team/audit assertions passed';
end$$;
rollback;
