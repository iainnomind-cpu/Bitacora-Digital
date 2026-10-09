-- Flujo real de histología: cerebro → hipocampo → cortes de 50 µm → subículo microdisecado →
-- bloque → semifinos. Hacía falta:
--   1. que un tejido pueda venir de otro tejido (regiones) o de un corte (microdisección);
--   2. el tipo "corte": sección gruesa (vibratomo/criostato), flotante o antes de montarse;
--   3. que una laminilla pueda venir de un corte montado.

create or replace function public.seed_default_sample_types(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.sample_types (user_id, key, label, parent_keys, metadata_keys)
  values
    (p_user_id, 'animal', 'Animal', '{}', '{genotipo,sexo,"fecha de nacimiento","grupo de tratamiento"}'),
    (p_user_id, 'tejido', 'Tejido', '{animal,tejido,corte}', '{región,hemisferio}'),
    (p_user_id, 'corte', 'Corte', '{tejido,bloque}', '{"grosor µm",plano,"posición / serie"}'),
    (p_user_id, 'bloque', 'Bloque', '{tejido,animal}', '{resina,orientación}'),
    (p_user_id, 'navaja', 'Navaja', '{}', '{"lote de vidrio","calidad del filo"}'),
    (p_user_id, 'rejilla', 'Rejilla', '{bloque}', '{"tipo de rejilla",cortes}'),
    (p_user_id, 'laminilla', 'Laminilla', '{bloque,tejido,corte}', '{tinción}'),
    (p_user_id, 'muestra_microct', 'Muestra de microCT', '{tejido,animal}', '{"tinción de contraste"}'),
    (p_user_id, 'otro', 'Otro', '{animal,tejido,bloque}', '{}')
  on conflict (user_id, key) do nothing;
$$;
revoke execute on function public.seed_default_sample_types(uuid) from public, anon, authenticated;

-- Cuentas existentes: agregar "corte" y ampliar los orígenes (sin quitar los que ya tengan).
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.seed_default_sample_types(u.id);
  end loop;
end;
$$;

update public.sample_types
set parent_keys = (select array_agg(distinct k) from unnest(parent_keys || '{tejido,corte}'::text[]) k)
where key = 'tejido';

update public.sample_types
set parent_keys = (select array_agg(distinct k) from unnest(parent_keys || '{corte}'::text[]) k)
where key = 'laminilla';
