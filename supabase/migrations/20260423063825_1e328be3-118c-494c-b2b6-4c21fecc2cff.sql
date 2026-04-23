create table if not exists public.blog_discover_previews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  variant_name text not null default 'principal',
  title_variant text not null,
  description_variant text not null,
  image_variant_url text not null,
  ready_for_publish boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, variant_name)
);

alter table public.blog_discover_previews enable row level security;

create index if not exists idx_blog_discover_previews_post_id on public.blog_discover_previews(post_id);
create index if not exists idx_blog_discover_previews_ready on public.blog_discover_previews(ready_for_publish);

drop policy if exists "Published discover previews are public" on public.blog_discover_previews;
create policy "Published discover previews are public"
on public.blog_discover_previews
for select
to public
using (
  ready_for_publish = true
  and exists (
    select 1
    from public.blog_posts bp
    where bp.id = blog_discover_previews.post_id
      and bp.published = true
      and bp.deleted_at is null
  )
);

drop policy if exists "Admins manage discover previews" on public.blog_discover_previews;
create policy "Admins manage discover previews"
on public.blog_discover_previews
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create trigger update_blog_discover_previews_updated_at
before update on public.blog_discover_previews
for each row
execute function public.update_updated_at_column();