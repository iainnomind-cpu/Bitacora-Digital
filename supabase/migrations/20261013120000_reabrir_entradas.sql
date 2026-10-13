-- Reabrir una entrada cerrada para corregirla. Antes solo se podían agregar adendas.
-- Queda rastro: la app agrega una adenda con el motivo antes de reabrir, y el trigger de
-- revisiones guarda la versión cerrada tal como estaba.
-- Cerrada → borrador solo cambia el estado (el resto de columnas debe quedar igual).

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
    if new.status in ('anulada', 'borrador')
       and (to_jsonb(new) - ignored) = (to_jsonb(old) - ignored) then
      if new.status = 'borrador' then
        new.closed_at := null;
      end if;
      return new;
    end if;
    raise exception 'La entrada está cerrada: reábrela para editarla o agrégale una adenda.';
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
