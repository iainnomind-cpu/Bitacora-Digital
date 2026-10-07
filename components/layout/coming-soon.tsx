import type { LucideIcon } from "lucide-react";

/** Marcador para secciones que se implementan en etapas posteriores del plan (docs/design.md §14). */
export function ComingSoon({
  icon: Icon,
  title,
  stage,
  children,
}: {
  icon: LucideIcon;
  title: string;
  stage: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon className="size-10 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-xs text-sm text-muted-foreground">{children}</p>}
      <p className="text-xs text-muted-foreground">Etapa {stage} del plan</p>
    </div>
  );
}
