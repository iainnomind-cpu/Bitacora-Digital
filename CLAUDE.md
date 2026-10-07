@AGENTS.md

# Bitácora de laboratorio digital

- Documento de diseño (fuente de verdad): `docs/design.md`. Implementar por las etapas de su §14.
- UI y textos en español. Mobile-first, objetivos táctiles ≥ 48 px (uso con guantes).
- **CRUD:** cliente de Supabase en el navegador + RLS + TanStack Query (encaja con el modo
  offline de la etapa 10). Server Actions / Route Handlers solo para lo que usa claves
  secretas (IA, push, cron, service role).
- `cacheComponents` está activo: cualquier lectura de cookies/sesión en el servidor va dentro
  de `<Suspense>`. La autenticación y redirecciones viven en `proxy.ts` (antes `middleware`).
- shadcn/ui usa el estilo `base-nova` (Base UI, no Radix): no hay `asChild`; para enlaces con
  estilo de botón usar `buttonVariants()` sobre `<Link>`.
- Base de datos: migraciones en `supabase/migrations/` (se aplican pegándolas en el SQL Editor;
  no hay CLI). Las tablas nuevas necesitan `grant` explícito a `authenticated` y RLS: la
  migración `_rls_storage.sql` revoca los permisos por defecto de `anon`/`authenticated`.
  Las entradas cerradas las bloquea un trigger; el cliente solo debe mostrar el error.
- Antes de terminar una etapa: `npm run typecheck`, `npm run lint`, `npm run build`.
