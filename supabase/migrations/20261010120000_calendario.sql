-- Calendario: tareas programadas (§6.2 temporizadores / recordatorios, ampliado).
--
-- Cada ocurrencia es una fila; las tareas que se repiten comparten series_id (así cada día se
-- puede marcar hecho, cancelar o mover por separado). Al empezar una tarea se crea su entrada.

create table public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  series_id uuid,
  title text not null check (length(trim(title)) > 0),
  notes text,
  template_id uuid references public.templates (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  sample_codes text[] not null default '{}',
  starts_at timestamptz not null,
  duration_minutes int check (duration_minutes > 0),
  -- Aviso push (el cron lo envía una vez); null = sin aviso.
  remind_at timestamptz,
  notified_at timestamptz,
  status text not null default 'pendiente' check (status in ('pendiente', 'hecha', 'cancelada')),
  entry_id uuid references public.entries (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheduled_tasks_user_time_idx on public.scheduled_tasks (user_id, starts_at);
create index scheduled_tasks_series_idx on public.scheduled_tasks (series_id) where series_id is not null;
create index scheduled_tasks_remind_idx on public.scheduled_tasks (remind_at)
  where remind_at is not null and notified_at is null and status = 'pendiente';
create trigger z_touch before update on public.scheduled_tasks
  for each row execute function public.set_updated_at();

-- Herramienta de planeación (no registro de bitácora): se puede borrar.
grant select, insert, update, delete on public.scheduled_tasks to authenticated;
alter table public.scheduled_tasks enable row level security;

create policy "propio: leer" on public.scheduled_tasks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "propio: crear" on public.scheduled_tasks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (template_id is null or exists (select 1 from public.templates t where t.id = template_id))
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
  );
create policy "propio: editar" on public.scheduled_tasks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (template_id is null or exists (select 1 from public.templates t where t.id = template_id))
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
    and (entry_id is null or exists (select 1 from public.entries e where e.id = entry_id))
  );
create policy "propio: borrar" on public.scheduled_tasks for delete to authenticated
  using (user_id = (select auth.uid()));
