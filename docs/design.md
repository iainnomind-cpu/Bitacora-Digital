# Bitácora de Laboratorio Digital — Documento de Diseño

## 1. Resumen

PWA (Progressive Web App) para llevar la bitácora de laboratorio desde el teléfono y la computadora. Permite crear entradas a partir de **plantillas por actividad** (tinción, fijación, cortes, navajas de vidrio, microCT, etc.), adjuntar **fotos**, **notas de voz** y **notas de texto**, **transcribir** los audios y **llenar las plantillas con IA** a partir de lo dictado, y recibir **notificaciones** para mantener el hábito.

La IA además actúa como **asistente de organización**: a partir de lo que el usuario captura rápido (fotos, audios, texto), **sugiere qué plantilla usar** según la actividad, **agrupa** el material en entradas, lo **asigna** a entradas existentes cuando corresponde y **propone nuevas plantillas** cuando una actividad se repite y no encaja en ninguna. El usuario siempre aprueba antes de que algo se guarde.

Contexto de uso: laboratorio de neurobiología (histología, microscopía electrónica, ultramicrotomía, microCT, modelos murinos 3xTg). El usuario trabaja con guantes, a veces sin buena señal, y necesita registrar rápido **durante** el experimento.

### Objetivos
- Registrar lo que **realmente** pasó (tiempos reales, desviaciones, observaciones), rápido y con mínima fricción.
- **Capturar primero, organizar después:** durante el experimento solo se toma la foto, se graba el audio o se escribe una línea; la IA propone cómo ordenarlo.
- Trazabilidad completa: animal → bloque → navaja → corte → rejilla → imagen/escaneo.
- Integridad tipo bitácora de papel: nada se borra, todo cambio deja rastro con fecha y hora.
- Un solo sistema desplegado: frontend y backend en Vercel.

### Fuera de alcance (por ahora)
- Gestión completa de inventario (LIMS).
- Almacenar datos crudos pesados (volúmenes de microCT, imágenes de TEM): la app guarda la **ruta** o referencia, no el archivo.
- Colaboración multiusuario avanzada (el modelo de datos sí debe soportar varios usuarios desde el inicio).

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) + TypeScript (modo `strict`) |
| Hosting (front + back) | Vercel: páginas, Route Handlers / Server Actions y Vercel Cron |
| Base de datos | Supabase Postgres |
| Autenticación | Supabase Auth (magic link por correo) |
| Archivos | Supabase Storage (buckets privados) |
| IA | OpenAI API: transcripción de audio y extracción estructurada |
| UI | Tailwind CSS + shadcn/ui |
| Validación | Zod (formularios, API y respuestas de IA) |
| Estado servidor | TanStack Query |
| Offline | IndexedDB (Dexie) + service worker |
| PWA | Web App Manifest + service worker (Serwist o equivalente mantenido) |
| Push | Web Push con claves VAPID (librería `web-push`) |

**Regla clave:** todo lo que use claves secretas (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`) corre **solo en el servidor** (Route Handlers / Server Actions). Nunca en el cliente.

**Modelos de OpenAI:** no fijar los nombres en el código. Usar variables de entorno (`OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`) y verificar en la documentación oficial cuáles están vigentes al momento de implementar. El modelo de texto debe soportar *structured outputs* (respuesta según JSON Schema).

---

## 3. Conceptos del dominio

- **Entrada (entry):** un registro de una actividad en una fecha. Usa una plantilla.
- **Plantilla (template):** define los campos de una actividad. Es editable por el usuario y está **versionada**: una entrada guarda qué versión de plantilla usó.
- **Muestra (sample):** cualquier objeto rastreable: animal, cerebro/hemisferio, bloque de resina, navaja de vidrio, rejilla, muestra de microCT, laminilla. Las muestras tienen relación padre → hijo (ej. animal → bloque → rejilla).
- **Adjunto (attachment):** foto o audio ligado a una entrada.
- **Revisión (revision):** copia del estado anterior de una entrada cada vez que se edita.
- **Adenda (addendum):** nota añadida a una entrada ya cerrada. No modifica el contenido original.

### Ciclo de vida de una entrada
1. `borrador` → editable libremente (cada guardado crea revisión).
2. `cerrada` → el usuario la "firma" (o se cierra automáticamente a las 23:59 del día siguiente, configurable). Ya no se edita; solo admite **adendas**.
3. Nunca se borra físicamente. Existe `anulada` (con motivo obligatorio), que la oculta de la vista normal pero la conserva.

---

## 4. Modelo de datos (Supabase / Postgres)

Todas las tablas llevan `id uuid`, `user_id uuid` (FK a `auth.users`), `created_at timestamptz` y `updated_at timestamptz` donde aplique. **RLS activado en todas**, con políticas `user_id = auth.uid()`.

### `profiles`
- `user_id`, `display_name`, `timezone` (default `America/Mexico_City`), `lab_name`, `auto_close_hours` (default 48).

### `templates`
- `name` (ej. "Tinción IBA1-DAB"), `activity_type` (enum o texto: `perfusion_fijacion`, `postfijacion`, `inclusion_resina`, `navaja_vidrio`, `corte_semifino`, `corte_fino`, `tincion`, `contraste_rejillas`, `microct`, `tratamiento_farmaco`, `libre`, …)
- `description`, `icon`, `color`
- `is_archived boolean`
- `current_version int`

### `template_versions`
- `template_id`, `version int`
- `fields jsonb` — arreglo de definiciones de campo (ver sección 5)
- `protocol_notes text` — texto del protocolo estándar (lo usa la IA para detectar desviaciones)
- Inmutable una vez creada.

### `entries`
- `entry_date date` (día al que pertenece, según zona horaria del usuario)
- `started_at timestamptz`, `ended_at timestamptz` (opcionales)
- `template_id`, `template_version int`
- `title text`
- `objective text`
- `data jsonb` — valores de los campos de la plantilla
- `observations text`, `results text`, `next_steps text`
- `data_location text` — ruta de datos crudos (ej. `Disco/Tesis/2026-10-06_IBA1/`)
- `status` (`borrador` | `cerrada` | `anulada`), `closed_at`, `void_reason`
- `ai_flags jsonb` — avisos de la IA (campos faltantes, desviaciones), ver sección 7
- `search_vector tsvector` (generado, configuración `spanish`)

### `entry_revisions` (solo inserción)
- `entry_id`, `revision int`, `snapshot jsonb` (fila completa anterior), `changed_at`, `change_source` (`usuario` | `ia_aceptada` | `sync_offline`)
- Se llena con un **trigger** `BEFORE UPDATE` en `entries`.
- RLS: el usuario puede leer e insertar (vía trigger), **nunca** actualizar ni borrar.

### `entry_addenda`
- `entry_id`, `content text`, `created_at`. Solo inserción.

### `samples`
- `code text` (único por usuario; ej. `3xTg-M-014`, `B-014-A`, `N-061026-01`, `R-014-A-03`)
- `sample_type` (`animal`, `tejido`, `bloque`, `navaja`, `rejilla`, `laminilla`, `muestra_microct`, `otro`)
- `parent_id uuid` (FK a `samples`, nullable)
- `metadata jsonb` (ej. animal: genotipo, sexo, fecha de nacimiento, grupo de tratamiento; navaja: lote de vidrio, calidad del filo)
- `status` (`activa`, `agotada`, `descartada`), `storage_location text` (caja/posición)

### `entry_samples`
- `entry_id`, `sample_id`, `role` (`usada`, `producida`) — ej. una sesión de corte **usa** un bloque y una navaja y **produce** rejillas.

### `attachments`
- `entry_id` (nullable mientras está en "bandeja de entrada", ver 6.3)
- `kind` (`foto` | `audio` | `texto`) — `texto` es una nota rápida escrita; no tiene archivo en Storage, el contenido va en `text_content`
- `storage_path text` (null para `texto`), `mime_type`, `size_bytes`, `duration_seconds` (audio)
- `text_content text` (solo para `texto`)
- `caption text` (escrito por el usuario)
- `ai_description text` — descripción de la foto generada por IA (qué se ve: rejilla, bloque, corte al estereoscopio, pantalla de un equipo, etiqueta, etc.)
- `ai_extracted_text text` — texto leído de la foto (etiquetas, pantallas de equipos, códigos)
- `ai_tags text[]` — actividad probable, tipo de objeto, códigos de muestra detectados
- `ai_status` (`pendiente` | `procesado` | `error`)
- `captured_at timestamptz`

### `capture_groups`
Agrupaciones propuestas por la IA para el material de la bandeja de entrada.
- `attachment_ids uuid[]`
- `suggested_activity_type`, `suggested_template_id`, `confidence numeric` (0–1)
- `suggested_target` (`nueva_entrada` | `entrada_existente`), `target_entry_id` (si aplica)
- `suggested_title text`, `reasoning text` (explicación corta en español de por qué se agruparon)
- `status` (`pendiente_revision` | `aceptado` | `rechazado` | `modificado`)

### `transcriptions`
- `attachment_id`, `text`, `language` (default `es`), `model`, `status` (`pendiente` | `procesando` | `lista` | `error`), `error_message`

### `ai_suggestions`
- `entry_id` (nullable), `kind` (`llenado_plantilla`, `campos_faltantes`, `resumen_semanal`, `sugerencia_plantilla`, `agrupacion_bandeja`, `nueva_plantilla`)
- `input_ref jsonb` (qué transcripciones/texto se usaron)
- `output jsonb`, `status` (`pendiente_revision` | `aceptada` | `rechazada` | `aceptada_parcial`)
- Guarda siempre lo que propuso la IA, aunque se rechace.

### `push_subscriptions`
- `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`, `last_success_at`

### `reminders`
- `title`, `body`, `kind` (`inicio_dia`, `cierre_dia`, `revision_semanal`, `personalizado`, `temporizador`)
- `schedule` (hora local + días de la semana) o `fire_at timestamptz` (para únicos/temporizadores)
- `enabled boolean`, `last_sent_at`

### `weekly_reviews`
- `week_start date`, `summary text` (generado por IA, editable), `notes text`

### Storage
- Bucket privado `attachments`, rutas: `{user_id}/{yyyy}/{mm}/{entry_id|inbox}/{uuid}.{ext}`
- Acceso solo con URLs firmadas de corta duración.

---

## 5. Sistema de plantillas

### Tipos de campo (`fields[]` en `template_versions`)
Cada campo: `{ key, label, type, required, unit?, options?, default?, expected?, help?, sample_type? }`

| `type` | Uso |
|---|---|
| `text` | texto corto |
| `longtext` | texto largo |
| `number` | número con `unit` opcional (µL, mL, %, °C, nm, mg/kg…) |
| `duration` | duración (guardar en segundos, mostrar mm:ss / h:mm) |
| `datetime` / `time` | momento |
| `select` / `multiselect` | opciones fijas |
| `boolean` | sí/no |
| `rating` | calidad 1–5 (ej. calidad del filo, calidad del corte) |
| `sample_ref` | referencia a una o más `samples` de un `sample_type` |
| `reagent` | grupo: nombre, marca, lote, concentración/dilución |
| `steps` | lista de pasos con `planificado` vs `real` (tiempo/valor) y nota |

`expected` permite declarar el valor del protocolo (ej. incubación 30 min) para que la app y la IA marquen **desviaciones** cuando el valor real difiera.

### Plantillas iniciales (seed)
Todas incluyen además los campos comunes de la entrada (objetivo, observaciones, resultados, siguiente paso, ubicación de datos).

1. **Perfusión / fijación:** animal (`sample_ref:animal`), peso, anestésico y dosis, solución de lavado y volumen, fijador (`reagent`), volumen, flujo, duración, calidad de la perfusión (`rating`), tejidos obtenidos (crea `samples` hijas).
2. **Postfijación:** tejido, fijador, temperatura, duración.
3. **Inclusión en resina:** tejido/bloque, `steps` (deshidratación, infiltración, polimerización) con tiempos planificados vs reales, resina y lote, temperatura de polimerización, bloques producidos.
4. **Fabricación de navajas de vidrio:** lote/marca de tiras de vidrio, equipo y parámetros, navajas producidas (crea `samples:navaja` con código), calidad del filo (`rating`), tramo útil del filo, línea de tensión, bote de agua (sí/no, tipo), destino (`semifinos` / `finos` / `descartada`).
5. **Corte semifino:** bloque, navaja, equipo, grosor programado, velocidad, calidad (`rating` + problemas: `multiselect` rayas / chatter / compresión / enrollado), tinción (ej. azul de toluidina), región observada, laminillas producidas.
6. **Corte fino:** bloque, navaja, grosor programado, color de interferencia (`select`: gris, plata, oro…), velocidad, calidad y problemas, rejillas producidas (tipo de rejilla, cortes por rejilla), ubicación (caja/posición).
7. **Contraste de rejillas:** rejillas, reactivos (`reagent`) y tiempos (`steps`).
8. **Tinción inmunohistoquímica (ej. IBA1-DAB):** cortes/laminillas, recuperación antigénica, bloqueo, anticuerpo primario (`reagent`: dilución, lote), tiempo/temperatura de incubación, secundario, revelado DAB (tiempo real), contratinción, `steps` con planificado vs real.
9. **MicroCT:** muestra, preparación/tinción de contraste, equipo, parámetros de escaneo (voltaje, potencia, voxel, filtro, tiempo de exposición, proyecciones), duración, ruta de archivos.
10. **Tratamiento con fármaco:** animal(es), compuesto, dosis, vía, volumen, hora, lote, observaciones del animal.
11. **Libre:** solo campos comunes.

### Editor de plantillas
- Crear, duplicar, editar y archivar plantillas desde la app.
- Editar = crear nueva versión. Las entradas anteriores siguen mostrando su versión original.
- Reordenar campos, marcar obligatorios, definir unidades y valores esperados.

---

## 6. Funciones

### 6.1 Fase 1 — MVP
1. **Autenticación** con magic link (Supabase Auth).
2. **Vista "Hoy":** línea de tiempo de las entradas del día, botón grande "Nueva entrada", accesos rápidos a grabar audio, tomar foto y escribir nota rápida (**captura rápida**: no hay que elegir entrada ni plantilla).
3. **Nueva entrada:** el usuario describe la actividad en una frase o dictado ("voy a cortar finos del bloque 14") y la IA **sugiere la plantilla** (sección 7.5); también puede elegirla manualmente (más usadas primero) → formulario dinámico generado desde `fields`.
4. **Fecha y hora automáticas** (`entry_date`, `started_at`); botón "terminar" para `ended_at`.
5. **Fotos** desde la cámara (`<input type="file" accept="image/*" capture>`), compresión en el cliente antes de subir, pie de foto opcional.
6. **Notas de voz** con `MediaRecorder` (formato compatible con iOS y Android; detectar `mimeType` soportado), límite configurable de duración.
7. **Transcripción** automática de cada audio (sección 7.1).
8. **Llenado de plantilla con IA** desde transcripciones, notas de texto y fotos, con revisión obligatoria antes de aplicar (sección 7.2).
9. **Organización automática de la bandeja de entrada:** la IA agrupa fotos, audios y notas sueltas, sugiere plantilla y propone crear una entrada nueva o agregarlos a una existente (sección 7.6).
10. **Historial de cambios** (revisiones) visible por entrada, y cierre de entradas + adendas.
11. **Muestras:** crear y buscar muestras; vincularlas a entradas; ver la cadena padre → hijos.
12. **Búsqueda** por texto (full-text en español), fecha, plantilla/actividad y código de muestra.
13. **Recordatorios con notificaciones push:** inicio del día, cierre del día, revisión semanal.
14. **PWA instalable** con manifest e iconos.
15. **Modo sin conexión** básico (sección 6.3).

### 6.2 Fase 2
- Detección de desviaciones contra `expected` / `protocol_notes` y campos faltantes (sección 7.3).
- **Temporizadores** de pasos (ej. incubación): al iniciar un paso con duración, programar notificación push al terminar.
- **Resumen semanal** con IA + vista de revisión semanal.
- **Exportar a PDF** por entrada, por día, por semana o por experimento (incluyendo revisiones y adendas).
- Editor de plantillas completo.
- Vista de trazabilidad: desde una rejilla, ver toda la cadena hasta el animal y todas las entradas involucradas.
- **Análisis de fotos con IA** (descripción, lectura de etiquetas y pantallas de equipos) para mejorar la organización (sección 7.6).
- **Propuesta de nuevas plantillas** cuando una actividad se repite en entradas "Libre" (sección 7.7).

### 6.3 Bandeja de entrada y modo sin conexión
- **Bandeja de entrada:** fotos, audios y notas de texto capturados rápido sin elegir entrada quedan con `entry_id = null`. La IA propone agrupaciones (`capture_groups`) y el usuario las acepta, corrige o rechaza; también puede asignarlos manualmente.
- **Offline:** borradores de entrada y archivos se guardan en IndexedDB con una cola de sincronización. Al recuperar conexión se suben en orden (primero archivos, luego entradas). Indicador visible de "pendiente de sincronizar".
- Conflictos: si una entrada se editó en dos dispositivos, gana la última escritura y la otra versión queda en `entry_revisions` con `change_source = 'sync_offline'`.

### 6.4 Fase 3 (ideas)
- Preguntas sobre el historial con IA ("¿qué navajas dieron mejores cortes finos?"), usando consultas SQL sobre `data`/`samples` y/o búsqueda semántica con `pgvector`.
- Escanear códigos QR/etiquetas de muestras con la cámara.
- Exportar a Markdown/Obsidian.
- Sellado de tiempo externo de exportaciones.

---

## 7. Integración con IA (OpenAI)

Principios para **todas** las funciones de IA:
- La IA **nunca inventa** valores. Si algo no se dijo, el campo queda `null`.
- Si algo es ambiguo, lo marca en `uncertain` en vez de adivinar.
- Toda propuesta de la IA se muestra como sugerencia con vista de diferencias (actual vs propuesto) y el usuario acepta todo, parte o nada. Nada se escribe en `entries` sin confirmación.
- Se guarda todo en `ai_suggestions` (trazabilidad).
- Idioma: español. Debe respetar terminología técnica, unidades y códigos de muestra tal como se dictaron.

### 7.1 Transcripción
Flujo:
1. El cliente sube el audio **directo a Supabase Storage** con una URL de subida firmada (no pasar el archivo por la función de Vercel, por el límite de tamaño del cuerpo de la petición).
2. El cliente llama `POST /api/transcribe` con el `attachment_id`.
3. El servidor descarga el audio de Storage, lo envía a la API de transcripción de OpenAI (`language: "es"`, y un `prompt` con vocabulario del laboratorio: IBA1, DAB, 3xTg, ultramicrotomo, semifino, glutaraldehído, microCT, etc. + códigos de muestras recientes).
4. Guarda el texto en `transcriptions` y actualiza el estado.
- Verificar el límite de tamaño de archivo de la API de transcripción y el tiempo máximo de ejecución de funciones en Vercel; configurar `maxDuration` en la ruta. Limitar la duración de grabación en el cliente para quedarse dentro de los límites (o partir el audio).

### 7.2 Llenado de plantilla
`POST /api/ai/fill-template` con `entry_id` y las fuentes (transcripciones y/o texto).
- El servidor convierte `fields` de la versión de plantilla en un **JSON Schema** y usa *structured outputs* del modelo de texto.
- Salida esperada:
```json
{
  "fields": { "<key>": "<valor o null>" },
  "objective": "string | null",
  "observations": "string | null",
  "results": "string | null",
  "next_steps": "string | null",
  "samples_mentioned": ["código", "..."],
  "uncertain": [{ "key": "string", "reason": "string" }],
  "deviations": [{ "key": "string", "expected": "string", "actual": "string" }]
}
```
- Validar la respuesta con Zod antes de guardarla. Si no valida, guardar como error y no mostrar nada roto al usuario.
- `samples_mentioned` se cruza con `samples` existentes y se proponen como vínculos.

### 7.3 Campos faltantes y desviaciones
- Determinista primero (sin IA): campos `required` vacíos y valores reales distintos de `expected`.
- IA opcional: revisar `protocol_notes` vs lo registrado y sugerir lo que parece faltar (ej. "no anotaste el lote del anticuerpo").
- Resultado en `entries.ai_flags`, mostrado como avisos discretos en la entrada.

### 7.4 Resumen semanal
- Cron semanal (o botón manual): reunir las entradas de la semana y generar un resumen por actividad, problemas encontrados, desviaciones y siguientes pasos. Guardar en `weekly_reviews` como texto editable.

### 7.5 Sugerencia de plantilla
`POST /api/ai/suggest-template` con texto, transcripción y/o fotos.
- Entrada al modelo: lista de plantillas del usuario (nombre, `activity_type`, descripción y nombres de campos; **no** las versiones completas), el contenido capturado, la hora del día y las últimas entradas del día (contexto: si en la mañana hubo "Fabricación de navajas", es probable que siga "Corte fino").
- Salida (structured output):
```json
{
  "suggestions": [
    { "template_id": "uuid", "confidence": 0.0, "reason": "string corto en español" }
  ],
  "no_good_match": false,
  "proposed_title": "string"
}
```
- Mostrar máximo 3 sugerencias ordenadas por confianza, con la razón en una línea. Siempre visible la opción "Elegir otra" y "Libre".
- Si `no_good_match = true`, sugerir "Libre" y registrar el caso (alimenta la sección 7.7).
- Optimización: antes de llamar al modelo, aplicar reglas simples (palabras clave como "navaja", "rejilla", "DAB", "perfusión") para responder al instante; usar IA solo si las reglas no son concluyentes.

### 7.6 Organización automática (bandeja de entrada)
Objetivo: el usuario captura sin pensar y la IA ordena.

**Procesamiento de cada adjunto al subirlo:**
- Audio → transcripción (7.1).
- Foto → modelo con visión: `ai_description` (qué se ve), `ai_extracted_text` (etiquetas, pantallas de equipo, códigos escritos a mano) y `ai_tags` (actividad probable, tipo de objeto, códigos de muestra). Enviar la imagen redimensionada para controlar costo.
- Nota de texto → se usa tal cual.

*Nota de fases:* en el MVP la agrupación funciona con hora de captura, transcripciones y notas de texto; el análisis de fotos con visión se agrega en Fase 2 y mejora la agrupación sin cambiar el flujo.

**Agrupación** (`POST /api/ai/organize-inbox`, se ejecuta al abrir la bandeja, con botón "Organizar" y en el cron de cierre del día):
1. Pre-agrupar de forma determinista por **cercanía en el tiempo** (ej. capturas con menos de 20 min de separación, configurable) y por **códigos de muestra** compartidos.
2. Enviar al modelo los grupos candidatos (solo texto: transcripciones, notas, `ai_description`, `ai_tags`, horas) junto con las plantillas del usuario y las entradas en `borrador` del día.
3. El modelo decide para cada grupo: unir/separar grupos, plantilla sugerida, si va a una **entrada existente** (ej. hay un borrador de "Tinción IBA1-DAB" abierto y el audio dice "ya revelé con DAB, 4 minutos") o a una **nueva**, y un título.
4. Salida (structured output) → filas en `capture_groups` con `confidence` y `reasoning`.

**Revisión en la bandeja:**
- Cada grupo se muestra como tarjeta: miniaturas, extracto de transcripción, plantilla sugerida, destino y la razón ("Las 3 fotos y el audio se tomaron entre 10:05 y 10:20 y mencionan el bloque B-014-A").
- Acciones: **Aceptar** (crea/actualiza la entrada y lanza el llenado de plantilla 7.2), **Cambiar plantilla**, **Mover adjunto** a otro grupo, **Separar**, **Rechazar** (queda en la bandeja).
- Aceptar todo con un toque cuando la confianza sea alta, pero nunca automático sin confirmación.

**Orden dentro de la entrada:**
- Los adjuntos se ordenan por `captured_at` y se muestran en una línea de tiempo dentro de la entrada.
- Al llenar la plantilla, la IA usa ese orden para los `steps` (planificado vs real) y para calcular duraciones reales a partir de las horas de captura cuando el usuario no las dictó (marcándolo como estimado).
- A cada foto se le propone un pie de foto (`caption`) a partir de `ai_description`, editable.

### 7.7 Propuesta de nuevas plantillas
- Cuando haya varias entradas "Libre" (ej. 3 o más) o casos `no_good_match` con contenido parecido, la IA propone una plantilla nueva: nombre, `activity_type`, campos con tipo y unidad, y campos que parecen obligatorios.
- Se presenta como sugerencia en la pantalla de Plantillas; el usuario la edita y la guarda como nueva plantilla (versión 1).
- También disponible bajo demanda: "Crear plantilla a partir de esta entrada" o "a partir de este protocolo" (pegando el texto del protocolo).

### Costos y control
- Registrar en logs el uso por llamada (modelo, tokens/segundos de audio).
- Límite diario configurable de llamadas de IA por usuario.

---

## 8. Notificaciones push

- Generar claves VAPID; la pública va al cliente, la privada solo en el servidor.
- Al activar notificaciones (desde Ajustes, con un botón; nunca pedir permiso al abrir la app), guardar la suscripción en `push_subscriptions`.
- **iOS:** las notificaciones web solo funcionan con la app **instalada en la pantalla de inicio** (iOS 16.4+). Mostrar instrucciones de instalación si se detecta iOS en Safari sin instalar.
- **Envío programado:** endpoint `POST /api/cron/reminders`, protegido con `CRON_SECRET`, que calcula qué recordatorios tocan según la zona horaria del usuario y los envía con `web-push`. Si una suscripción devuelve 404/410, borrarla.
- **Frecuencia del cron:** verificar qué permite el plan de Vercel que se use. Si el plan no permite la frecuencia necesaria (por ejemplo, para temporizadores de minutos), usar `pg_cron` + `pg_net` de Supabase para llamar al mismo endpoint, manteniendo la lógica en Vercel.
- Al tocar la notificación, abrir la vista correspondiente (Hoy, la entrada, o la revisión semanal).

Recordatorios por defecto (editables):
- Inicio del día (ej. 9:00): "Anota la fecha, título y objetivo de hoy".
- Cierre del día (ej. 18:00): "Antes de irte: resultados, ubicación de datos y siguiente paso".
- Revisión semanal (ej. viernes 17:00).
- Aviso de entradas en `borrador` sin cerrar de días anteriores.

---

## 9. Pantallas (mobile-first)

1. **Hoy** — línea de tiempo del día, botón "Nueva entrada", botones rápidos 🎙️ y 📷, contador de bandeja de entrada.
2. **Selector de plantilla** — cuadrícula con iconos grandes; recientes primero.
3. **Editor de entrada** — formulario dinámico, adjuntos, transcripciones, botón "Llenar con IA", avisos, botón "Cerrar entrada".
4. **Revisión de sugerencia IA** — diferencias campo por campo con aceptar/rechazar.
5. **Grabadora** — un botón grande, tiempo transcurrido, estado de subida/transcripción.
6. **Bandeja de entrada** — fotos, audios y notas sin asignar, mostrados como **grupos sugeridos por la IA** con plantilla, destino y razón; acciones aceptar / cambiar / separar / rechazar.
7. **Buscar** — texto + filtros (fecha, actividad, muestra).
8. **Muestras** — lista por tipo, detalle con cadena padre/hijos y entradas relacionadas.
9. **Plantillas** — lista y editor.
10. **Historial de entrada** — revisiones y adendas.
11. **Revisión semanal**.
12. **Ajustes** — perfil, zona horaria, notificaciones, recordatorios, instalar app, exportar.

Requisitos de UX:
- Botones grandes (uso con guantes), objetivos táctiles ≥ 48 px.
- Modo oscuro.
- Guardado automático de borradores (debounce), sin botón "guardar" obligatorio.
- Navegación inferior: Hoy · Buscar · ➕ · Muestras · Ajustes.
- Fechas y horas siempre en la zona horaria del usuario; guardar en UTC.

---

## 10. API (Route Handlers en Vercel)

| Método y ruta | Función |
|---|---|
| `POST /api/uploads/sign` | URL firmada para subir foto/audio a Storage |
| `POST /api/transcribe` | Transcribir un audio |
| `POST /api/ai/fill-template` | Proponer llenado de plantilla |
| `POST /api/ai/check-entry` | Campos faltantes y desviaciones |
| `POST /api/ai/weekly-summary` | Resumen semanal |
| `POST /api/ai/suggest-template` | Sugerir plantilla según la actividad |
| `POST /api/ai/analyze-photo` | Describir foto, leer texto y etiquetar |
| `POST /api/ai/organize-inbox` | Agrupar y proponer destino del material de la bandeja |
| `POST /api/ai/propose-template` | Proponer una plantilla nueva |
| `POST /api/push/subscribe` / `DELETE /api/push/subscribe` | Alta/baja de suscripción push |
| `POST /api/push/test` | Enviar notificación de prueba |
| `POST /api/cron/reminders` | Envío programado (protegido con `CRON_SECRET`) |
| `POST /api/cron/auto-close` | Cerrar borradores vencidos |
| `GET /api/export/pdf` | Exportar (fase 2) |

El CRUD normal (entradas, muestras, plantillas) puede hacerse con el cliente de Supabase + RLS o con Server Actions; elegir uno y ser consistente. Todo input validado con Zod.

---

## 11. Seguridad e integridad

- RLS en todas las tablas; políticas probadas.
- `entry_revisions` y `entry_addenda`: solo inserción. Sin `DELETE` en ninguna tabla de registros para el rol `authenticated` (anular en lugar de borrar).
- Trigger que impide actualizar `entries` con `status = 'cerrada'` (salvo pasar a `anulada` con motivo).
- Bucket privado; URLs firmadas de corta duración.
- Claves secretas solo en variables de entorno del servidor.
- Endpoints de cron verifican `Authorization: Bearer ${CRON_SECRET}`.
- Respaldos: exportación completa (JSON + archivos) disponible desde Ajustes.

---

## 12. Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_TRANSCRIBE_MODEL=
OPENAI_TEXT_MODEL=
OPENAI_VISION_MODEL=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:
CRON_SECRET=
AI_DAILY_CALL_LIMIT=
```

---

## 13. Estructura sugerida del proyecto

```
/app
  /(auth)/login
  /(app)/hoy
  /(app)/entrada/[id]
  /(app)/entrada/nueva
  /(app)/bandeja
  /(app)/buscar
  /(app)/muestras
  /(app)/plantillas
  /(app)/revision-semanal
  /(app)/ajustes
  /api/...
/components
  /entry        (formulario dinámico, adjuntos, sugerencias IA)
  /recorder
  /samples
  /ui           (shadcn)
/lib
  /supabase     (clientes server/browser)
  /ai           (transcripción, prompts, schemas)
  /templates    (tipos de campo, fields → Zod / JSON Schema)
  /offline      (Dexie, cola de sincronización)
  /push
/public
  manifest.webmanifest, iconos
/supabase
  /migrations
  seed.sql      (plantillas iniciales)
/types
```

---

## 14. Plan de implementación (para Claude Code)

Trabajar por etapas; al terminar cada una, debe compilar, pasar lint y poder desplegarse en Vercel.

1. **Base:** proyecto Next.js + TypeScript estricto, Tailwind, shadcn/ui, ESLint/Prettier, clientes de Supabase, login con magic link, layout mobile-first con navegación inferior.
2. **Base de datos:** migraciones de todas las tablas, RLS, triggers de revisiones y de bloqueo de entradas cerradas, `search_vector`, seed de plantillas.
3. **Plantillas → formularios:** tipos de campo, generador de formulario dinámico, conversión `fields` → Zod y → JSON Schema.
4. **Entradas:** crear, editar con autoguardado, cerrar, adendas, historial; vista Hoy.
5. **Adjuntos:** subida firmada de fotos y audios, notas de texto, grabadora, captura rápida, bandeja de entrada.
6. **IA:** transcripción, sugerencia de plantilla y llenado de plantilla con pantalla de revisión.
6b. **Organización automática:** análisis de fotos, agrupación de la bandeja y tarjetas de revisión.
7. **Muestras:** CRUD, vínculos con entradas, cadena padre/hijos.
8. **Búsqueda.**
9. **PWA + push:** manifest, service worker, suscripción, recordatorios por cron, instrucciones para iOS.
10. **Offline:** IndexedDB y cola de sincronización.
11. **Fase 2** (desviaciones, temporizadores, resumen semanal, PDF, editor de plantillas completo).

### Criterios de aceptación del MVP
- Puedo instalar la app en el teléfono (Android y iPhone) y abrirla desde la pantalla de inicio.
- Puedo crear una entrada de "Corte fino", dictar un audio y ver la plantilla llenada por la IA para revisar y aceptar.
- Si edito una entrada, puedo ver la versión anterior. Una entrada cerrada no se puede modificar, solo agregar adendas.
- Puedo buscar un código de bloque y ver todas las entradas donde aparece.
- Recibo la notificación de cierre del día en el teléfono.
- Puedo tomar fotos sin señal y se suben solas al recuperar conexión.
- Si escribo o dicto "voy a hacer cortes finos del bloque 14", la app me sugiere la plantilla "Corte fino" con una razón.
- Si tomo 3 fotos y grabo 2 audios sueltos durante una sesión, la bandeja me propone agruparlos en una sola entrada con la plantilla correcta, y al aceptar la plantilla queda prellenada para revisar.
