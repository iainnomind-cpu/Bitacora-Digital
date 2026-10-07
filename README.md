# Bitácora de laboratorio digital

PWA para llevar la bitácora de laboratorio. Diseño completo en [`docs/design.md`](docs/design.md).

Stack: Next.js 16 (App Router) · TypeScript estricto · Tailwind 4 · shadcn/ui · Supabase · TanStack Query · Zod.

## Puesta en marcha

1. `npm install`
2. Llenar `.env.local` (ver `.env.local.example`).
3. `npm run dev` → http://localhost:3000

## Configuración de Supabase Auth (magic link)

En el panel de Supabase:

- **Authentication → URL Configuration**
  - Site URL: la URL de producción en Vercel.
  - Redirect URLs: `http://localhost:3000/**` y `https://<tu-app>.vercel.app/**`.
- **Authentication → Emails → Magic Link**: usar una plantilla que incluya el enlace con
  `token_hash` y el código, para que funcione aunque el correo se abra en otro navegador
  (en iPhone la app instalada no comparte sesión con Safari):

  ```html
  <h2>Entrar a la Bitácora</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Entrar</a></p>
  <p>O escribe este código en la app: <strong>{{ .Token }}</strong></p>
  ```

  Con la plantilla por defecto el enlace solo funciona en el mismo navegador que lo pidió, y
  el correo no trae el código.

## Base de datos

Las migraciones están en [`supabase/migrations/`](supabase/migrations). Sin la CLI de Supabase,
se aplican en el panel: **SQL Editor → New query**, pegar el contenido de cada archivo **en
orden** (por nombre) y pulsar **Run**.

| Archivo                      | Qué hace                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| `…_esquema.sql`              | Tablas, restricciones e índices                             |
| `…_integridad.sql`           | Ciclo de vida de entradas, revisiones, búsqueda, inmutables |
| `…_rls_storage.sql`          | Permisos, RLS y bucket privado `attachments`                |
| `…_plantillas_iniciales.sql` | Perfil, 11 plantillas y recordatorios al crear cada cuenta  |

Reglas que impone la base de datos (no solo la app):

- Una entrada nace en `borrador`; cada guardado con cambios deja la versión anterior en
  `entry_revisions`. Al pasar a `cerrada` ya no se edita: solo admite adendas. Se puede
  anular (con motivo), nunca borrar.
- Las versiones de plantilla, revisiones y adendas no se modifican.
- Búsqueda: `search_vector @@ websearch_to_tsquery('spanish', unaccent_es(:q))` (sin acentos).

## Notificaciones y tareas programadas

- **Claves:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`),
  `VAPID_SUBJECT` (`mailto:tu-correo` o la URL https de la app) y `CRON_SECRET` (cadena aleatoria).
- **Cierre automático de borradores** (`/api/cron/auto-close`): Vercel Cron, una vez al día
  (`vercel.json`). Vercel manda `Authorization: Bearer ${CRON_SECRET}` solo.
- **Recordatorios** (`/api/cron/reminders`): necesitan correr cada pocos minutos, más seguido de lo
  que permite el plan gratuito de Vercel, así que los dispara `pg_cron` desde Supabase. Una vez
  publicada la app, en **SQL Editor**:

  ```sql
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  select cron.schedule(
    'bitacora-recordatorios',
    '*/10 * * * *',
    $$ select net.http_post(
         url := 'https://<tu-app>.vercel.app/api/cron/reminders',
         headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
       ) $$
  );
  ```

  El endpoint calcula la hora local de cada usuario y no repite envíos, así que cualquier
  intervalo de 5 a 15 minutos funciona. Para quitarlo: `select cron.unschedule('bitacora-recordatorios');`

- **iPhone:** las notificaciones solo llegan con la app instalada en la pantalla de inicio
  (iOS 16.4+). Ajustes → Instalar la app muestra los pasos.
- **Íconos:** `node scripts/gen-icons.mjs` regenera `public/icons/`.

## Scripts

| Script              | Qué hace                  |
| ------------------- | ------------------------- |
| `npm run dev`       | Servidor de desarrollo    |
| `npm run build`     | Compilación de producción |
| `npm run lint`      | ESLint                    |
| `npm run typecheck` | `tsc --noEmit`            |
| `npm run format`    | Prettier                  |
