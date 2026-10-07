-- Etapa 2 · 2/4 — Integridad tipo bitácora de papel (docs/design.md §3, §4, §11).
--
-- Triggers BEFORE UPDATE en entries (corren en orden alfabético):
--   a_guard     → ciclo de vida: borrador → cerrada → (anulada). Cerrada no se edita.
--   b_revision  → guarda la fila anterior en entry_revisions.
--   c_search    → recalcula search_vector.
--   z_touch     → updated_at (migración anterior).

-- ---------------------------------------------------------------------------
-- Ciclo de vida y bloqueo de entradas cerradas
-- ---------------------------------------------------------------------------
create or replace function public.entries_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Columnas que cambian solas o que se permiten al anular; el resto debe quedar igual.
  ignored text[] := array['status', 'void_reason', 'updated_at', 'change_source', 'search_vector'];
begin
  if tg_op = 'INSERT' then
    if new.status <> 'borrador' then
      raise exception 'Una entrada nueva debe empezar como borrador.';
    end if;
    return new;
  end if;

  if new.id <> old.id or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'No se puede cambiar id, user_id ni created_at de una entrada.';
  end if;

  if old.status = 'anulada' then
    raise exception 'La entrada está anulada y no se puede modificar.';
  end if;

  if new.status = 'anulada' and length(trim(coalesce(new.void_reason, ''))) = 0 then
    raise exception 'Para anular una entrada escribe el motivo.';
  end if;

  if old.status = 'cerrada' then
    if new.status = 'anulada'
       and (to_jsonb(new) - ignored) = (to_jsonb(old) - ignored) then
      return new;
    end if;
    raise exception 'La entrada está cerrada: solo se le pueden agregar adendas.';
  end if;

  -- old.status = 'borrador'
  if new.status = 'cerrada' then
    new.closed_at := now();
  elsif new.status = 'borrador' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger a_guard before insert or update on public.entries
  for each row execute function public.entries_guard();

-- ---------------------------------------------------------------------------
-- Revisiones: cada guardado con cambios reales deja la versión anterior
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER para que el usuario no necesite (ni tenga) permiso de insertar
-- revisiones directamente: solo existen las que crea este trigger.
create or replace function public.entries_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ignored text[] := array['updated_at', 'change_source', 'search_vector'];
  next_rev int;
begin
  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    select coalesce(max(r.revision), 0) + 1 into next_rev
    from public.entry_revisions r
    where r.entry_id = old.id;

    insert into public.entry_revisions (user_id, entry_id, revision, snapshot, change_source)
    values (old.user_id, old.id, next_rev, to_jsonb(old) - 'search_vector', new.change_source);
  end if;

  -- Si el próximo update no menciona change_source, vuelve a contar como 'usuario'.
  new.change_source := 'usuario';
  return new;
end;
$$;

create trigger b_revision before update on public.entries
  for each row execute function public.entries_revision();

-- ---------------------------------------------------------------------------
-- Búsqueda de texto completo (español, sin acentos)
-- ---------------------------------------------------------------------------
-- Para buscar usar la misma normalización:
--   search_vector @@ websearch_to_tsquery('spanish', public.unaccent_es(:q))
create or replace function public.unaccent_es(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''));
$$;

create or replace function public.entries_search()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  data_text text;
begin
  -- Todos los valores de texto y número dentro de data, a cualquier profundidad.
  select string_agg(v #>> '{}', ' ') into data_text
  from jsonb_path_query(
    new.data, 'strict $.** ? (@.type() == "string" || @.type() == "number")'
  ) as v;

  new.search_vector :=
    setweight(to_tsvector('spanish', public.unaccent_es(new.title)), 'A')
    || setweight(to_tsvector('spanish', public.unaccent_es(new.objective)), 'B')
    || setweight(to_tsvector('spanish', public.unaccent_es(data_text)), 'C')
    || setweight(to_tsvector('spanish', public.unaccent_es(
         concat_ws(' ', new.observations, new.results, new.next_steps))), 'C')
    || setweight(to_tsvector('simple', public.unaccent_es(new.data_location)), 'D');
  return new;
end;
$$;

create trigger c_search before insert or update on public.entries
  for each row execute function public.entries_search();

-- ---------------------------------------------------------------------------
-- Versiones de plantilla inmutables
-- ---------------------------------------------------------------------------
create or replace function public.forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los registros de % no se pueden modificar.', tg_table_name;
end;
$$;

create trigger a_immutable before update on public.template_versions
  for each row execute function public.forbid_update();
create trigger a_immutable before update on public.entry_revisions
  for each row execute function public.forbid_update();
create trigger a_immutable before update on public.entry_addenda
  for each row execute function public.forbid_update();

-- ---------------------------------------------------------------------------
-- Adjuntos: no se mueven a / desde entradas que ya no son borrador
-- ---------------------------------------------------------------------------
-- Los campos ai_* sí se pueden actualizar (el análisis puede terminar después del cierre).
create or replace function public.attachments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ignored text[] := array['ai_description', 'ai_extracted_text', 'ai_tags', 'ai_status', 'updated_at'];
  entry_status text;
begin
  if tg_op = 'UPDATE' and old.entry_id is not null
     and (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    select e.status into entry_status from public.entries e where e.id = old.entry_id;
    if entry_status <> 'borrador' then
      raise exception 'El adjunto pertenece a una entrada cerrada y no se puede modificar.';
    end if;
  end if;

  if new.entry_id is not null
     and (tg_op = 'INSERT' or new.entry_id is distinct from old.entry_id) then
    select e.status into entry_status from public.entries e where e.id = new.entry_id;
    if entry_status is distinct from 'borrador' then
      raise exception 'Solo se pueden agregar adjuntos a entradas en borrador.';
    end if;
  end if;
  return new;
end;
$$;

create trigger a_guard before insert or update on public.attachments
  for each row execute function public.attachments_guard();

-- ---------------------------------------------------------------------------
-- Muestras: el padre debe ser del mismo usuario y no puede haber ciclos
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque una política RLS de samples que consulte samples se recursa.
create or replace function public.samples_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cursor_id uuid := new.parent_id;
  owner uuid;
  depth int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  select s.user_id into owner from public.samples s where s.id = new.parent_id;
  if owner is distinct from new.user_id then
    raise exception 'La muestra padre no existe.';
  end if;

  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Una muestra no puede ser su propia descendiente.';
    end if;
    depth := depth + 1;
    if depth > 50 then
      raise exception 'La cadena de muestras es demasiado profunda.';
    end if;
    select s.parent_id into cursor_id from public.samples s where s.id = cursor_id;
  end loop;
  return new;
end;
$$;

create trigger a_guard before insert or update of parent_id, user_id on public.samples
  for each row execute function public.samples_guard();
