begin;

create function public.vcs_media_library(p_query text default '',p_offset integer default 0)
returns table(name text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.vcs_can_manage_media() then
    raise exception 'Website or product permission required.';
  end if;
  return query
    select o.name,o.created_at from storage.objects o
    where o.bucket_id='staff-media'
      and (coalesce(p_query,'')='' or strpos(substr(o.name,38),left(lower(p_query),70))>0)
    order by o.created_at desc,o.name
    limit 9 offset greatest(0,least(coalesce(p_offset,0),10000));
end;
$$;
revoke all on function public.vcs_media_library(text,integer) from public,anon,authenticated;
grant execute on function public.vcs_media_library(text,integer) to authenticated;

commit;
