import { SAMPLE_STATUS_LABELS, type SampleStatus } from "@/lib/queries/samples";
import { cn } from "@/lib/utils";

const STYLES: Record<SampleStatus, string> = {
  activa: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  agotada: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  descartada: "bg-muted text-muted-foreground line-through",
};

export function SampleStatusBadge({ status }: { status: SampleStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
        STYLES[status] ?? STYLES.activa,
      )}
    >
      {SAMPLE_STATUS_LABELS[status] ?? status}
    </span>
  );
}
