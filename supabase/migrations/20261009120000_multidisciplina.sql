-- Bitácora para cualquier laboratorio + protocolos + soluciones.
--
-- 1. Proyectos/experimentos: cada entrada puede pertenecer a uno; cada proyecto aporta contexto y
--    vocabulario a la IA. El perfil tiene el contexto del área y el proyecto activo.
-- 2. Tipos de muestra configurables por usuario (antes: lista fija en un check).
-- 3. Plantillas desde protocolo: las fotos/PDF del protocolo quedan con la versión.
-- 4. Temporizadores de pasos ligados a una entrada (reminders.entry_id).
-- 5. Biblioteca de reactivos (peso molecular) y recetas de soluciones guardadas.
-- 6. PDFs permitidos en el bucket (protocolos).

-- ---------------------------------------------------------------------------
-- 1. Proyectos y contexto de IA
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  -- Contexto para la IA: técnicas, modelo experimental, objetivo (texto libre).
  ai_context text,
  vocabulary text[] not null default '{}',
  color text,
  status text not null default 'activo' check (status in ('activo', 'archivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects (user_id);
create trigger z_touch before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.entries add column project_id uuid references public.projects (id);
create index entries_project_idx on public.entries (project_id, entry_date desc);

alter table public.profiles
  add column active_project_id uuid references public.projects (id) on delete set null,
  -- Descripción del área/laboratorio para la IA (reemplaza el texto fijo de neurobiología).
  add column ai_context text,
  add column vocabulary text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 2. Tipos de muestra configurables
-- ---------------------------------------------------------------------------
create table public.sample_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(trim(label)) > 0),
  -- Tipos que pueden ser su origen (animal → tejido → bloque…).
  parent_keys text[] not null default '{}',
  -- Datos sugeridos al registrar una muestra de este tipo.
  metadata_keys text[] not null default '{}',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
create trigger z_touch before update on public.sample_types
  for each row execute function public.set_updated_at();

create or replace function public.seed_default_sample_types(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.sample_types (user_id, key, label, parent_keys, metadata_keys)
  values
    (p_user_id, 'animal', 'Animal', '{}', '{genotipo,sexo,"fecha de nacimiento","grupo de tratamiento"}'),
    (p_user_id, 'tejido', 'Tejido', '{animal}', '{región,hemisferio}'),
    (p_user_id, 'bloque', 'Bloque', '{tejido,animal}', '{resina,orientación}'),
    (p_user_id, 'navaja', 'Navaja', '{}', '{"lote de vidrio","calidad del filo"}'),
    (p_user_id, 'rejilla', 'Rejilla', '{bloque}', '{"tipo de rejilla",cortes}'),
    (p_user_id, 'laminilla', 'Laminilla', '{bloque,tejido}', '{tinción}'),
    (p_user_id, 'muestra_microct', 'Muestra de microCT', '{tejido,animal}', '{"tinción de contraste"}'),
    (p_user_id, 'otro', 'Otro', '{animal,tejido,bloque}', '{}')
  on conflict (user_id, key) do nothing;
$$;
revoke execute on function public.seed_default_sample_types(uuid) from public, anon, authenticated;

do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.seed_default_sample_types(u.id);
  end loop;
  -- Tipos que ya se usan en muestras existentes y no estén en la lista (no debería haber).
  insert into public.sample_types (user_id, key, label)
  select distinct s.user_id, s.sample_type, initcap(replace(s.sample_type, '_', ' '))
  from public.samples s
  on conflict (user_id, key) do nothing;
end;
$$;

-- El tipo de cada muestra debe existir entre los tipos del mismo usuario.
alter table public.samples drop constraint if exists samples_sample_type_check;
alter table public.samples add constraint samples_sample_type_fkey
  foreign key (user_id, sample_type) references public.sample_types (user_id, key);

-- Contexto inicial para cuentas existentes: el que antes estaba fijo en el código.
update public.profiles
set ai_context = 'Laboratorio de neurobiología: histología, inmunohistoquímica, microscopía '
  || 'electrónica, ultramicrotomía y microCT con ratones 3xTg.'
where ai_context is null;

-- Alta de usuario: también sus tipos de muestra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(split_part(coalesce(new.email, ''), '@', 1), ''))
  on conflict (user_id) do nothing;

  perform public.seed_default_sample_types(new.id);
  perform public.seed_default_templates(new.id);
  perform public.seed_default_reminders(new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Fuentes del protocolo (rutas en Storage) en cada versión de plantilla
-- ---------------------------------------------------------------------------
alter table public.template_versions
  add column protocol_sources text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 4. Temporizadores de pasos
-- ---------------------------------------------------------------------------
alter table public.reminders add column entry_id uuid references public.entries (id);
create index reminders_timers_idx on public.reminders (fire_at) where fire_at is not null and enabled;

-- ---------------------------------------------------------------------------
-- 5. Reactivos y soluciones (herramientas del usuario, no registros de bitácora: se pueden borrar)
-- ---------------------------------------------------------------------------
create table public.reagent_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  formula text,
  molecular_weight numeric check (molecular_weight > 0), -- g/mol
  cas text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create trigger z_touch before update on public.reagent_library
  for each row execute function public.set_updated_at();

-- components: [{name, amount, unit, molecular_weight?, concentration?, note?}]
create table public.solution_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  final_volume_ml numeric check (final_volume_ml > 0),
  components jsonb not null default '[]' check (jsonb_typeof(components) = 'array'),
  ph numeric,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger z_touch before update on public.solution_recipes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permisos y RLS de lo nuevo (la migración _rls_storage revocó los permisos por defecto)
-- ---------------------------------------------------------------------------
grant select, insert, update on public.projects, public.sample_types to authenticated;
grant select, insert, update, delete on public.reagent_library, public.solution_recipes to authenticated;

alter table public.projects enable row level security;
alter table public.sample_types enable row level security;
alter table public.reagent_library enable row level security;
alter table public.solution_recipes enable row level security;

create policy "propio: leer" on public.projects for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.projects for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.projects for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "propio: leer" on public.sample_types for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.sample_types for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.sample_types for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "propio: todo" on public.reagent_library for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propio: todo" on public.solution_recipes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Entradas: el proyecto (si hay) debe ser del usuario.
drop policy "propio: crear" on public.entries;
drop policy "propio: editar" on public.entries;
create policy "propio: crear" on public.entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.templates t where t.id = template_id)
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
  );
create policy "propio: editar" on public.entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.templates t where t.id = template_id)
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
  );

-- Perfil: el proyecto activo debe ser del usuario.
drop policy "propio: editar" on public.profiles;
create policy "propio: editar" on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (active_project_id is null
         or exists (select 1 from public.projects p where p.id = active_project_id))
  );

-- Temporizadores: la entrada (si hay) debe ser del usuario.
drop policy "propio: crear" on public.reminders;
drop policy "propio: editar" on public.reminders;
create policy "propio: crear" on public.reminders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (entry_id is null or exists (select 1 from public.entries e where e.id = entry_id))
  );
create policy "propio: editar" on public.reminders for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (entry_id is null or exists (select 1 from public.entries e where e.id = entry_id))
  );

-- ---------------------------------------------------------------------------
-- 6. PDFs de protocolos en el bucket
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/*', 'audio/*', 'application/pdf']
where id = 'attachments';
