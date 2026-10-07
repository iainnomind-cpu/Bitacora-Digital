-- Etapa 2 · 1/4 — Esquema: tablas, restricciones e índices (docs/design.md §4).
--
-- Convenciones:
-- - Todas las tablas llevan user_id con default auth.uid(): el cliente no necesita mandarlo.
-- - Estados y tipos como text + check (más fácil de ampliar que un enum de Postgres).
--   activity_type queda libre porque el usuario puede crear actividades nuevas.
-- - Nada de ON DELETE CASCADE entre registros de la bitácora: no se borran, se anulan.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Mexico_City',
  lab_name text,
  auto_close_hours int not null default 48 check (auto_close_hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- templates / template_versions
-- ---------------------------------------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  activity_type text not null default 'libre',
  description text,
  icon text,
  color text,
  is_archived boolean not null default false,
  current_version int not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_user_idx on public.templates (user_id) where not is_archived;

-- fields: arreglo de definiciones de campo (§5). Inmutable una vez creada.
create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid not null references public.templates (id) on delete cascade,
  version int not null check (version > 0),
  fields jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),
  protocol_notes text,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
create index template_versions_user_idx on public.template_versions (user_id);

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  template_id uuid not null,
  template_version int not null,
  title text not null default '',
  objective text,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  observations text,
  results text,
  next_steps text,
  data_location text,
  status text not null default 'borrador' check (status in ('borrador', 'cerrada', 'anulada')),
  closed_at timestamptz,
  void_reason text,
  ai_flags jsonb not null default '{}',
  -- Origen del próximo cambio; lo lee el trigger de revisiones y lo regresa a 'usuario'.
  change_source text not null default 'usuario'
    check (change_source in ('usuario', 'ia_aceptada', 'sync_offline')),
  -- Lo calcula un trigger (no columna generada) para poder quitar acentos con unaccent.
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (template_id, template_version)
    references public.template_versions (template_id, version),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  check (status <> 'anulada' or length(trim(coalesce(void_reason, ''))) > 0)
);
create index entries_user_date_idx on public.entries (user_id, entry_date desc);
create index entries_template_idx on public.entries (template_id);
create index entries_drafts_idx on public.entries (user_id, entry_date) where status = 'borrador';
create index entries_search_idx on public.entries using gin (search_vector);

-- Solo inserción (vía trigger). snapshot = fila completa anterior.
create table public.entry_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id),
  revision int not null check (revision > 0),
  snapshot jsonb not null,
  changed_at timestamptz not null default now(),
  change_source text not null default 'usuario'
    check (change_source in ('usuario', 'ia_aceptada', 'sync_offline')),
  unique (entry_id, revision)
);
create index entry_revisions_user_idx on public.entry_revisions (user_id);

-- Notas añadidas a entradas cerradas. Solo inserción.
create table public.entry_addenda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id),
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);
create index entry_addenda_entry_idx on public.entry_addenda (entry_id, created_at);
create index entry_addenda_user_idx on public.entry_addenda (user_id);

-- ---------------------------------------------------------------------------
-- samples / entry_samples
-- ---------------------------------------------------------------------------
create table public.samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null check (length(trim(code)) > 0),
  sample_type text not null check (
    sample_type in ('animal', 'tejido', 'bloque', 'navaja', 'rejilla', 'laminilla',
                    'muestra_microct', 'otro')
  ),
  parent_id uuid references public.samples (id),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  status text not null default 'activa' check (status in ('activa', 'agotada', 'descartada')),
  storage_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);
create index samples_user_type_idx on public.samples (user_id, sample_type);
create index samples_parent_idx on public.samples (parent_id);
create index samples_code_trgm_idx on public.samples using gin (code extensions.gin_trgm_ops);

-- Una sesión de corte "usa" un bloque y una navaja y "produce" rejillas.
create table public.entry_samples (
  entry_id uuid not null references public.entries (id),
  sample_id uuid not null references public.samples (id),
  role text not null check (role in ('usada', 'producida')),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, sample_id, role)
);
create index entry_samples_sample_idx on public.entry_samples (sample_id);
create index entry_samples_user_idx on public.entry_samples (user_id);

-- ---------------------------------------------------------------------------
-- attachments / capture_groups / transcriptions
-- ---------------------------------------------------------------------------
-- entry_id null = en la bandeja de entrada (§6.3).
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid references public.entries (id),
  kind text not null check (kind in ('foto', 'audio', 'texto')),
  storage_path text unique,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  duration_seconds numeric check (duration_seconds >= 0),
  text_content text,
  caption text,
  ai_description text,
  ai_extracted_text text,
  ai_tags text[] not null default '{}',
  ai_status text not null default 'pendiente' check (ai_status in ('pendiente', 'procesado', 'error')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'texto' and storage_path is null and length(trim(coalesce(text_content, ''))) > 0)
    or (kind <> 'texto' and storage_path is not null)
  )
);
create index attachments_entry_idx on public.attachments (entry_id, captured_at);
create index attachments_inbox_idx on public.attachments (user_id, captured_at) where entry_id is null;

create table public.capture_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attachment_ids uuid[] not null check (cardinality(attachment_ids) > 0),
  suggested_activity_type text,
  suggested_template_id uuid references public.templates (id) on delete set null,
  confidence numeric check (confidence between 0 and 1),
  suggested_target text check (suggested_target in ('nueva_entrada', 'entrada_existente')),
  target_entry_id uuid references public.entries (id),
  suggested_title text,
  reasoning text,
  status text not null default 'pendiente_revision'
    check (status in ('pendiente_revision', 'aceptado', 'rechazado', 'modificado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (suggested_target <> 'entrada_existente' or target_entry_id is not null)
);
create index capture_groups_user_status_idx on public.capture_groups (user_id, status);

create table public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attachment_id uuid not null references public.attachments (id),
  text text,
  language text not null default 'es',
  model text,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'procesando', 'lista', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transcriptions_attachment_idx on public.transcriptions (attachment_id);
create index transcriptions_user_idx on public.transcriptions (user_id);

-- ---------------------------------------------------------------------------
-- ai_suggestions — se guarda siempre lo que propuso la IA, aunque se rechace.
-- ---------------------------------------------------------------------------
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid references public.entries (id),
  kind text not null check (
    kind in ('llenado_plantilla', 'campos_faltantes', 'resumen_semanal', 'sugerencia_plantilla',
             'agrupacion_bandeja', 'nueva_plantilla')
  ),
  input_ref jsonb not null default '{}',
  output jsonb,
  status text not null default 'pendiente_revision'
    check (status in ('pendiente_revision', 'aceptada', 'rechazada', 'aceptada_parcial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_suggestions_entry_idx on public.ai_suggestions (entry_id);
create index ai_suggestions_user_kind_idx on public.ai_suggestions (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- push_subscriptions / reminders / weekly_reviews
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- schedule: {"time": "HH:MM", "days": [1..7]} en hora local del usuario (1 = lunes, ISO).
-- fire_at: para recordatorios únicos y temporizadores.
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  body text,
  kind text not null check (
    kind in ('inicio_dia', 'cierre_dia', 'revision_semanal', 'personalizado', 'temporizador')
  ),
  schedule jsonb,
  fire_at timestamptz,
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (schedule is not null or fire_at is not null)
);
create index reminders_user_idx on public.reminders (user_id);
create index reminders_enabled_idx on public.reminders (enabled) where enabled;

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------------
-- El prefijo "z_" hace que corra después de los demás BEFORE UPDATE (orden alfabético).
create trigger z_touch before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.templates
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.entries
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.samples
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.attachments
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.capture_groups
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.transcriptions
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.ai_suggestions
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.reminders
  for each row execute function public.set_updated_at();
create trigger z_touch before update on public.weekly_reviews
  for each row execute function public.set_updated_at();
