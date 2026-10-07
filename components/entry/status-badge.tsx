import { ENTRY_STATUS_LABELS, type EntryStatus } from "@/lib/queries/entries";
import { cn } from "@/lib/utils";

const STYLES: Record<EntryStatus, string> = {
  borrador: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  cerrada: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  anulada: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = (status in STYLES ? status : "borrador") as EntryStatus;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
        STYLES[s],
        className,
      )}
    >
      {ENTRY_STATUS_LABELS[s]}
    </span>
  );
}
