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

| Archivo                      | Qué hace                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| `…_esquema.sql`              | Tablas, restricciones e índices                              |
| `…_integridad.sql`           | Ciclo de vida de entradas, revisiones, búsqueda, inmutables  |
| `…_rls_storage.sql`          | Permisos, RLS y bucket privado `attachments`                 |
| `…_plantillas_iniciales.sql` | Perfil, 11 plantillas y recordatorios al crear cada cuenta   |

Reglas que impone la base de datos (no solo la app):

- Una entrada nace en `borrador`; cada guardado con cambios deja la versión anterior en
  `entry_revisions`. Al pasar a `cerrada` ya no se edita: solo admite adendas. Se puede
  anular (con motivo), nunca borrar.
- Las versiones de plantilla, revisiones y adendas no se modifican.
- Búsqueda: `search_vector @@ websearch_to_tsquery('spanish', unaccent_es(:q))` (sin acentos).

## Scripts

| Script              | Qué hace                  |
| ------------------- | ------------------------- |
| `npm run dev`       | Servidor de desarrollo    |
| `npm run build`     | Compilación de producción |
| `npm run lint`      | ESLint                    |
| `npm run typecheck` | `tsc --noEmit`            |
| `npm run format`    | Prettier                  |
