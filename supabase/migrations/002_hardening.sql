begin;
create schema if not exists commerce_private;
revoke all on schema commerce_private from public,anon,authenticated;
create function commerce_private.release_expired() returns void language plpgsql security invoker set search_path=public as $$declare o orders;begin for o in select * from orders where payment_status='pending_verification' and status='awaiting_payment' and expires_at<now() for update skip locked loop perform order_action(o.id,'cancelled','Payment reservation expired',null);end loop;end$$;
revoke all on function commerce_private.release_expired() from public,anon,authenticated;
grant usage on schema commerce_private to service_role;grant execute on function commerce_private.release_expired() to service_role;
-- Runs before checkout and payment verification so stale holds are released once.
create function commerce_private.expire_before_checkout() returns trigger language plpgsql security invoker set search_path=public as $$begin perform commerce_private.release_expired();return new;end$$;
revoke all on function commerce_private.expire_before_checkout() from public,anon,authenticated;
create trigger expire_before_order before insert on public.orders for each statement execute function commerce_private.expire_before_checkout();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalog','catalog',true,3145728,array['image/jpeg','image/png','image/webp']),('invoices','invoices',false,10485760,array['application/pdf']) on conflict(id) do nothing;
-- All writes use an authorized server route. Private PDFs have no public read policy.
create policy catalog_read on storage.objects for select to anon,authenticated using(bucket_id='catalog');
commit;
