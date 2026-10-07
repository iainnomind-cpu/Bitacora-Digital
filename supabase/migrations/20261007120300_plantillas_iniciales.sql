-- Etapa 2 · 4/4 — Alta de usuario: perfil, plantillas iniciales y recordatorios
-- (docs/design.md §5 "Plantillas iniciales", §8 "Recordatorios por defecto").
--
-- Las plantillas son por usuario (editables y versionadas), así que el seed corre al
-- crearse cada cuenta. Al final se aplica también a las cuentas que ya existan.
--
-- Formato de cada campo (§5): { key, label, type, required, unit?, options?, default?,
-- expected?, help?, sample_type? } y además:
--   sample_ref → multiple (varias muestras), role ('usada' | 'producida', default 'usada')
--   reagent    → multiple (varios reactivos); cada valor es {nombre, marca, lote, concentracion}
--   steps      → expected: [{label, planned_seconds?}] con los pasos del protocolo
-- Los valores esperados del protocolo (expected, protocol_notes) se dejan vacíos: los
-- llena el usuario con su protocolo real; la app no inventa tiempos ni concentraciones.

create or replace function public.seed_default_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  new_id uuid;
begin
  for t in
    select * from (values
      ('Perfusión / fijación', 'perfusion_fijacion', 'Perfusión transcardiaca y fijación del animal.', 'syringe', 'red', $j$[
        {"key": "animal", "label": "Animal", "type": "sample_ref", "sample_type": "animal", "required": true},
        {"key": "peso", "label": "Peso", "type": "number", "unit": "g", "required": false},
        {"key": "anestesico", "label": "Anestésico", "type": "text", "required": false},
        {"key": "dosis_anestesico", "label": "Dosis de anestésico", "type": "number", "unit": "mg/kg", "required": false},
        {"key": "solucion_lavado", "label": "Solución de lavado", "type": "text", "required": false},
        {"key": "volumen_lavado", "label": "Volumen de lavado", "type": "number", "unit": "mL", "required": false},
        {"key": "fijador", "label": "Fijador", "type": "reagent", "required": false},
        {"key": "volumen_fijador", "label": "Volumen de fijador", "type": "number", "unit": "mL", "required": false},
        {"key": "flujo", "label": "Flujo", "type": "number", "unit": "mL/min", "required": false},
        {"key": "duracion", "label": "Duración", "type": "duration", "required": false},
        {"key": "calidad_perfusion", "label": "Calidad de la perfusión", "type": "rating", "required": false},
        {"key": "tejidos_obtenidos", "label": "Tejidos obtenidos", "type": "sample_ref", "sample_type": "tejido", "multiple": true, "role": "producida", "required": false}
      ]$j$),
      ('Postfijación', 'postfijacion', 'Postfijación del tejido.', 'flask-conical', 'orange', $j$[
        {"key": "tejido", "label": "Tejido", "type": "sample_ref", "sample_type": "tejido", "multiple": true, "required": true},
        {"key": "fijador", "label": "Fijador", "type": "reagent", "required": false},
        {"key": "temperatura", "label": "Temperatura", "type": "number", "unit": "°C", "required": false},
        {"key": "duracion", "label": "Duración", "type": "duration", "required": false}
      ]$j$),
      ('Inclusión en resina', 'inclusion_resina', 'Deshidratación, infiltración y polimerización.', 'box', 'amber', $j$[
        {"key": "tejido", "label": "Tejido", "type": "sample_ref", "sample_type": "tejido", "multiple": true, "required": true},
        {"key": "pasos", "label": "Pasos", "type": "steps", "required": false, "expected": [
          {"label": "Deshidratación"}, {"label": "Infiltración"}, {"label": "Polimerización"}
        ]},
        {"key": "resina", "label": "Resina", "type": "reagent", "required": false},
        {"key": "temperatura_polimerizacion", "label": "Temperatura de polimerización", "type": "number", "unit": "°C", "required": false},
        {"key": "bloques_producidos", "label": "Bloques producidos", "type": "sample_ref", "sample_type": "bloque", "multiple": true, "role": "producida", "required": false}
      ]$j$),
      ('Fabricación de navajas de vidrio', 'navaja_vidrio', 'Navajas de vidrio para ultramicrotomía.', 'triangle', 'sky', $j$[
        {"key": "tiras_vidrio", "label": "Tiras de vidrio (lote / marca)", "type": "text", "required": false},
        {"key": "equipo", "label": "Equipo", "type": "text", "required": false},
        {"key": "parametros", "label": "Parámetros del equipo", "type": "longtext", "required": false},
        {"key": "navajas_producidas", "label": "Navajas producidas", "type": "sample_ref", "sample_type": "navaja", "multiple": true, "role": "producida", "required": true},
        {"key": "calidad_filo", "label": "Calidad del filo", "type": "rating", "required": false},
        {"key": "tramo_util", "label": "Tramo útil del filo", "type": "text", "required": false},
        {"key": "linea_tension", "label": "Línea de tensión", "type": "text", "required": false},
        {"key": "bote_agua", "label": "Bote de agua", "type": "boolean", "required": false},
        {"key": "tipo_bote", "label": "Tipo de bote", "type": "text", "required": false},
        {"key": "destino", "label": "Destino", "type": "select", "options": ["semifinos", "finos", "descartada"], "required": false}
      ]$j$),
      ('Corte semifino', 'corte_semifino', 'Cortes semifinos para orientación y selección de región.', 'slice', 'teal', $j$[
        {"key": "bloque", "label": "Bloque", "type": "sample_ref", "sample_type": "bloque", "required": true},
        {"key": "navaja", "label": "Navaja", "type": "sample_ref", "sample_type": "navaja", "required": false},
        {"key": "equipo", "label": "Equipo", "type": "text", "required": false},
        {"key": "grosor", "label": "Grosor programado", "type": "number", "unit": "µm", "required": false},
        {"key": "velocidad", "label": "Velocidad", "type": "number", "unit": "mm/s", "required": false},
        {"key": "calidad", "label": "Calidad del corte", "type": "rating", "required": false},
        {"key": "problemas", "label": "Problemas", "type": "multiselect", "options": ["rayas", "chatter", "compresión", "enrollado"], "required": false},
        {"key": "tincion", "label": "Tinción", "type": "text", "default": "Azul de toluidina", "required": false},
        {"key": "region_observada", "label": "Región observada", "type": "text", "required": false},
        {"key": "laminillas_producidas", "label": "Laminillas producidas", "type": "sample_ref", "sample_type": "laminilla", "multiple": true, "role": "producida", "required": false}
      ]$j$),
      ('Corte fino', 'corte_fino', 'Cortes ultrafinos para microscopía electrónica.', 'layers', 'cyan', $j$[
        {"key": "bloque", "label": "Bloque", "type": "sample_ref", "sample_type": "bloque", "required": true},
        {"key": "navaja", "label": "Navaja", "type": "sample_ref", "sample_type": "navaja", "required": false},
        {"key": "grosor", "label": "Grosor programado", "type": "number", "unit": "nm", "required": false},
        {"key": "color_interferencia", "label": "Color de interferencia", "type": "select", "options": ["gris", "plata", "oro", "morado", "azul"], "required": false},
        {"key": "velocidad", "label": "Velocidad", "type": "number", "unit": "mm/s", "required": false},
        {"key": "calidad", "label": "Calidad del corte", "type": "rating", "required": false},
        {"key": "problemas", "label": "Problemas", "type": "multiselect", "options": ["rayas", "chatter", "compresión", "enrollado"], "required": false},
        {"key": "rejillas_producidas", "label": "Rejillas producidas", "type": "sample_ref", "sample_type": "rejilla", "multiple": true, "role": "producida", "required": false},
        {"key": "tipo_rejilla", "label": "Tipo de rejilla", "type": "text", "required": false},
        {"key": "cortes_por_rejilla", "label": "Cortes por rejilla", "type": "number", "required": false},
        {"key": "ubicacion", "label": "Ubicación (caja / posición)", "type": "text", "required": false}
      ]$j$),
      ('Contraste de rejillas', 'contraste_rejillas', 'Contraste de rejillas para microscopía electrónica.', 'grid-3x3', 'violet', $j$[
        {"key": "rejillas", "label": "Rejillas", "type": "sample_ref", "sample_type": "rejilla", "multiple": true, "required": true},
        {"key": "reactivos", "label": "Reactivos", "type": "reagent", "multiple": true, "required": false},
        {"key": "pasos", "label": "Pasos", "type": "steps", "required": false}
      ]$j$),
      ('Tinción IBA1-DAB', 'tincion', 'Inmunohistoquímica con revelado DAB.', 'droplets', 'pink', $j$[
        {"key": "cortes", "label": "Cortes / laminillas", "type": "sample_ref", "sample_type": "laminilla", "multiple": true, "required": true},
        {"key": "recuperacion_antigenica", "label": "Recuperación antigénica", "type": "longtext", "required": false},
        {"key": "bloqueo", "label": "Bloqueo", "type": "text", "required": false},
        {"key": "anticuerpo_primario", "label": "Anticuerpo primario", "type": "reagent", "required": true},
        {"key": "incubacion_primario_duracion", "label": "Incubación del primario: duración", "type": "duration", "required": false},
        {"key": "incubacion_primario_temperatura", "label": "Incubación del primario: temperatura", "type": "number", "unit": "°C", "required": false},
        {"key": "anticuerpo_secundario", "label": "Anticuerpo secundario", "type": "reagent", "required": false},
        {"key": "revelado_dab", "label": "Revelado DAB (tiempo real)", "type": "duration", "required": false},
        {"key": "contratincion", "label": "Contratinción", "type": "text", "required": false},
        {"key": "pasos", "label": "Pasos", "type": "steps", "required": false}
      ]$j$),
      ('MicroCT', 'microct', 'Escaneo de microtomografía computarizada.', 'scan', 'indigo', $j$[
        {"key": "muestra", "label": "Muestra", "type": "sample_ref", "sample_type": "muestra_microct", "required": true},
        {"key": "preparacion", "label": "Preparación / tinción de contraste", "type": "longtext", "required": false},
        {"key": "equipo", "label": "Equipo", "type": "text", "required": false},
        {"key": "voltaje", "label": "Voltaje", "type": "number", "unit": "kV", "required": false},
        {"key": "potencia", "label": "Potencia", "type": "number", "unit": "W", "required": false},
        {"key": "voxel", "label": "Tamaño de vóxel", "type": "number", "unit": "µm", "required": false},
        {"key": "filtro", "label": "Filtro", "type": "text", "required": false},
        {"key": "exposicion", "label": "Tiempo de exposición", "type": "number", "unit": "ms", "required": false},
        {"key": "proyecciones", "label": "Proyecciones", "type": "number", "required": false},
        {"key": "duracion", "label": "Duración del escaneo", "type": "duration", "required": false}
      ]$j$),
      ('Tratamiento con fármaco', 'tratamiento_farmaco', 'Administración de un compuesto a uno o más animales.', 'pill', 'emerald', $j$[
        {"key": "animales", "label": "Animales", "type": "sample_ref", "sample_type": "animal", "multiple": true, "required": true},
        {"key": "compuesto", "label": "Compuesto", "type": "text", "required": true},
        {"key": "dosis", "label": "Dosis", "type": "number", "unit": "mg/kg", "required": false},
        {"key": "via", "label": "Vía", "type": "select", "options": ["intraperitoneal", "subcutánea", "oral", "intravenosa", "intranasal", "otra"], "required": false},
        {"key": "volumen", "label": "Volumen", "type": "number", "unit": "µL", "required": false},
        {"key": "hora", "label": "Hora", "type": "time", "required": false},
        {"key": "lote", "label": "Lote", "type": "text", "required": false},
        {"key": "observaciones_animal", "label": "Observaciones del animal", "type": "longtext", "required": false}
      ]$j$),
      ('Libre', 'libre', 'Solo los campos comunes: objetivo, observaciones, resultados y siguiente paso.', 'notebook-pen', 'slate', '[]')
    ) as v(name, activity_type, description, icon, color, fields)
  loop
    -- Idempotente: si el usuario ya tiene una plantilla con ese nombre, no se duplica.
    if not exists (
      select 1 from public.templates x where x.user_id = p_user_id and x.name = t.name
    ) then
      insert into public.templates (user_id, name, activity_type, description, icon, color)
      values (p_user_id, t.name, t.activity_type, t.description, t.icon, t.color)
      returning id into new_id;

      insert into public.template_versions (user_id, template_id, version, fields)
      values (p_user_id, new_id, 1, t.fields::jsonb);
    end if;
  end loop;
end;
$$;

create or replace function public.seed_default_reminders(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.reminders r where r.user_id = p_user_id) then
    return;
  end if;

  insert into public.reminders (user_id, kind, title, body, schedule) values
    (p_user_id, 'inicio_dia', 'Inicio del día',
     'Anota la fecha, título y objetivo de hoy.', '{"time": "09:00", "days": [1, 2, 3, 4, 5]}'),
    (p_user_id, 'cierre_dia', 'Cierre del día',
     'Antes de irte: resultados, ubicación de datos y siguiente paso.', '{"time": "18:00", "days": [1, 2, 3, 4, 5]}'),
    (p_user_id, 'revision_semanal', 'Revisión semanal',
     'Repasa la semana y anota los siguientes pasos.', '{"time": "17:00", "days": [5]}');
end;
$$;

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

  perform public.seed_default_templates(new.id);
  perform public.seed_default_reminders(new.id);
  return new;
end;
$$;

revoke execute on function public.seed_default_templates(uuid) from public, anon, authenticated;
revoke execute on function public.seed_default_reminders(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cuentas que ya existían antes de esta migración.
do $$
declare
  u record;
begin
  for u in select id, email from auth.users loop
    insert into public.profiles (user_id, display_name)
    values (u.id, nullif(split_part(coalesce(u.email, ''), '@', 1), ''))
    on conflict (user_id) do nothing;
    perform public.seed_default_templates(u.id);
    perform public.seed_default_reminders(u.id);
  end loop;
end;
$$;
