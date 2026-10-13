-- La fecha de la entrada (entry_date) sale siempre del inicio, en la zona horaria del usuario.
-- Antes la app la mandaba aparte y podía quedar desfasada: inicio el 17 de septiembre pero la
-- entrada en el día en que se registró. Solo se recalcula en borradores (las cerradas no cambian).

create or replace function public.entries_date_from_start()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tz text;
begin
  if new.started_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'borrador' then
    return new;
  end if;
  select p.timezone into tz from public.profiles p where p.user_id = new.user_id;
  new.entry_date := (new.started_at at time zone coalesce(tz, 'America/Mexico_City'))::date;
  return new;
end;
$$;

-- "a0" corre antes que a_guard (orden alfabético).
create trigger a0_date_from_start before insert or update on public.entries
  for each row execute function public.entries_date_from_start();

-- Corregir las entradas que ya quedaron desfasadas (también las cerradas: es la misma
-- actividad, solo se acomoda en su día). El historial guarda la versión anterior.
alter table public.entries disable trigger a_guard;

update public.entries e
set entry_date = (e.started_at at time zone coalesce(p.timezone, 'America/Mexico_City'))::date
from public.profiles p
where p.user_id = e.user_id
  and e.started_at is not null
  and e.status <> 'anulada'
  and e.entry_date <> (e.started_at at time zone coalesce(p.timezone, 'America/Mexico_City'))::date;

alter table public.entries enable trigger a_guard;
