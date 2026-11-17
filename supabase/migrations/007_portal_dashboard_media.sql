begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('staff-media','staff-media',false,2097152,array['image/webp'])
on conflict(id) do nothing;

create function public.vcs_can_manage_media() returns boolean
language sql stable security definer set search_path='' as $$
  select public.vcs_can(auth.uid(),'website') or public.vcs_can(auth.uid(),'catalog');
$$;
revoke all on function public.vcs_can_manage_media() from public,anon,authenticated;
grant execute on function public.vcs_can_manage_media() to authenticated;

create index if not exists vcs_published_product_image_idx on public.products(image)
  where status='published' and not sample;

create function public.vcs_media_is_live(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.products
    where status='published' and not sample and image='/api/media/'||object_name
  ) or exists (
    select 1 from public.website_edits w
    cross join lateral jsonb_each(w.published) as item
    where w.published_at is not null and item.value->>'src'='/api/media/'||object_name
  );
$$;
revoke all on function public.vcs_media_is_live(text) from public,anon,authenticated;
grant execute on function public.vcs_media_is_live(text) to anon,authenticated;

create policy "Media staff can add WebP files" on storage.objects for insert to authenticated
with check (bucket_id='staff-media' and public.vcs_can_manage_media()
  and name ~ '^[0-9a-f-]{36}-[a-z0-9-]{1,70}\.webp$');

create policy "Media staff can see library files" on storage.objects for select to authenticated
using (bucket_id='staff-media' and public.vcs_can_manage_media());

create policy "Visitors can load published site images" on storage.objects for select to anon,authenticated
using (bucket_id='staff-media' and public.vcs_media_is_live(name));

create function public.vcs_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  current_day date:=(now() at time zone 'America/Jamaica')::date;
  month_start date:=date_trunc('month', current_day)::date;
  summary jsonb:='{}'::jsonb;
  item jsonb;
  dispatch_all boolean:=public.vcs_can(actor,'dispatch');
  finance_all boolean:=public.vcs_can(actor,'finance_reports');
begin
  if not exists(select 1 from public.staff_roles where user_id=actor and active) then
    raise exception 'Your account has no active staff access.';
  end if;

  if public.vcs_can(actor,'leads') then
    select jsonb_build_object(
      'new_quotes',(select count(*) from public.quotes where status='new'),
      'new_inquiries',(select count(*) from public.inquiries where status='new'),
      'reviewing',(select count(*) from public.quotes where status='reviewing') +
                  (select count(*) from public.inquiries where status='reviewing')
    ) into item;
    summary:=summary||jsonb_build_object('enquiries',item);
  end if;

  if public.vcs_can(actor,'catalog') then
    select jsonb_build_object('published',count(*) filter(where status='published' and not sample),
      'private',count(*) filter(where status='draft' and not sample)) into item from public.products;
    summary:=summary||jsonb_build_object('catalogue',item);
  end if;

  if public.vcs_can(actor,'website') then
    select jsonb_build_object('drafts',count(*) filter(where draft<>published),
      'draft_routes',coalesce(jsonb_agg(route order by route) filter(where draft<>published),'[]'::jsonb),
      'last_published',max(published_at)) into item from public.website_edits;
    summary:=summary||jsonb_build_object('website',item);
  end if;

  if finance_all or public.vcs_can(actor,'finance') then
    select jsonb_build_object(
      'income',case when finance_all then coalesce(sum(amount_cents) filter(where kind='income'),0) end,
      'expense',case when finance_all then coalesce(sum(amount_cents) filter(where kind='expense'),0) end,
      'entries',count(*),'reports',finance_all
    ) into item from public.daily_finance where entry_date between month_start and current_day
      and voided_at is null and (finance_all or created_by=actor);
    summary:=summary||jsonb_build_object('finance',item);
  end if;

  if dispatch_all or public.vcs_can(actor,'drive') then
    select jsonb_build_object(
      'pending',count(*) filter(where status in ('pending','assigned')),
      'in_transit',count(*) filter(where status='in_transit'),
      'issues',count(*) filter(where status='issue'),
      'delivered',count(*) filter(where status='delivered' and (finished_at at time zone 'America/Jamaica')::date=current_day),
      'all_drivers',dispatch_all)
    into item from public.dispatch_packages where dispatch_all or driver_id=actor;
    summary:=summary||jsonb_build_object('deliveries',item);
  end if;

  if public.vcs_can(actor,'access') then
    select jsonb_build_object('active',(select count(*) from public.staff_roles where active),
      'pending',(select count(*) from public.staff_activation where active)) into item;
    summary:=summary||jsonb_build_object('team',item);
  end if;
  return summary;
end;
$$;
revoke all on function public.vcs_dashboard() from public,anon,authenticated;
grant execute on function public.vcs_dashboard() to authenticated;

commit;
