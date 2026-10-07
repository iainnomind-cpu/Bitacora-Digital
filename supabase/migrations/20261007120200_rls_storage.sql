-- Etapa 2 · 3/4 — Permisos, RLS y Storage (docs/design.md §4, §11).
--
-- Regla general: cada quien ve y escribe solo lo suyo (user_id = auth.uid()).
-- Sin DELETE en tablas de registros: se anula o se archiva. Solo se pueden borrar
-- vínculos de muestras en borradores, suscripciones push y recordatorios.
-- Las referencias a otras tablas se validan con EXISTS: como esas tablas también tienen
-- RLS, el EXISTS solo encuentra filas del mismo usuario.

-- ---------------------------------------------------------------------------
-- Privilegios de tabla (RLS filtra filas; esto limita operaciones)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on all tables in schema public to authenticated;

revoke insert, update on public.entry_revisions from authenticated;  -- solo el trigger
revoke update on public.template_versions, public.entry_addenda from authenticated;
grant delete on public.entry_samples, public.push_subscriptions, public.reminders to authenticated;

-- Funciones internas: no exponer por RPC.
revoke execute on function public.entries_revision() from public, anon, authenticated;
revoke execute on function public.samples_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.entries enable row level security;
alter table public.entry_revisions enable row level security;
alter table public.entry_addenda enable row level security;
alter table public.samples enable row level security;
alter table public.entry_samples enable row level security;
alter table public.attachments enable row level security;
alter table public.capture_groups enable row level security;
alter table public.transcriptions enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.weekly_reviews enable row level security;

-- profiles
create policy "propio: leer" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- templates
create policy "propio: leer" on public.templates for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.templates for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.templates for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- template_versions (inmutables)
create policy "propio: leer" on public.template_versions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.template_versions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.templates t where t.id = template_id)
  );

-- entries
create policy "propio: leer" on public.entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.templates t where t.id = template_id)
  );
create policy "propio: editar" on public.entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.templates t where t.id = template_id)
  );

-- entry_revisions (solo lectura; las inserta el trigger)
create policy "propio: leer" on public.entry_revisions for select to authenticated
  using (user_id = (select auth.uid()));

-- entry_addenda (solo inserción, y solo en entradas cerradas)
create policy "propio: leer" on public.entry_addenda for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear en cerradas" on public.entry_addenda for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'cerrada')
  );

-- samples (el trigger samples_guard valida el padre)
create policy "propio: leer" on public.samples for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.samples for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.samples for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- entry_samples (se vinculan y desvinculan solo mientras la entrada es borrador)
create policy "propio: leer" on public.entry_samples for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: vincular en borrador" on public.entry_samples for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'borrador')
    and exists (select 1 from public.samples s where s.id = sample_id)
  );
create policy "propio: desvincular en borrador" on public.entry_samples for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'borrador')
  );

-- attachments (el trigger attachments_guard valida la entrada)
create policy "propio: leer" on public.attachments for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.attachments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.attachments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- capture_groups
create policy "propio: leer" on public.capture_groups for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.capture_groups for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (suggested_template_id is null
         or exists (select 1 from public.templates t where t.id = suggested_template_id))
    and (target_entry_id is null
         or exists (select 1 from public.entries e where e.id = target_entry_id))
  );
create policy "propio: editar" on public.capture_groups for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (suggested_template_id is null
         or exists (select 1 from public.templates t where t.id = suggested_template_id))
    and (target_entry_id is null
         or exists (select 1 from public.entries e where e.id = target_entry_id))
  );

-- transcriptions
create policy "propio: leer" on public.transcriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.transcriptions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.attachments a where a.id = attachment_id)
  );
create policy "propio: editar" on public.transcriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ai_suggestions
create policy "propio: leer" on public.ai_suggestions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.ai_suggestions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (entry_id is null or exists (select 1 from public.entries e where e.id = entry_id))
  );
create policy "propio: editar" on public.ai_suggestions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- push_subscriptions
create policy "propio: leer" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propio: borrar" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- reminders
create policy "propio: leer" on public.reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.reminders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.reminders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propio: borrar" on public.reminders for delete to authenticated
  using (user_id = (select auth.uid()));

-- weekly_reviews
create policy "propio: leer" on public.weekly_reviews for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.weekly_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "propio: editar" on public.weekly_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado "attachments"
-- ---------------------------------------------------------------------------
-- Rutas: {user_id}/{yyyy}/{mm}/{entry_id|inbox}/{uuid}.{ext}. Acceso con URLs firmadas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 52428800, array['image/*', 'audio/*'])
on conflict (id) do nothing;

create policy "attachments: leer propios" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "attachments: subir propios" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "attachments: reemplazar propios" on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
