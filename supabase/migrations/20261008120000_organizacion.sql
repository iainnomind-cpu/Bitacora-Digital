-- Etapa 6b — Organización automática de la bandeja (docs/design.md §7.6).
--
-- Al volver a organizar la bandeja, las propuestas pendientes anteriores no se borran (quedan
-- para trazabilidad) ni cuentan como rechazadas por el usuario: pasan a 'reemplazado'.

alter table public.capture_groups drop constraint if exists capture_groups_status_check;
alter table public.capture_groups add constraint capture_groups_status_check
  check (status in ('pendiente_revision', 'aceptado', 'rechazado', 'modificado', 'reemplazado'));
