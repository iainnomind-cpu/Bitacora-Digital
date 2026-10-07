import {
  Box,
  Droplets,
  FlaskConical,
  Grid3x3,
  Layers,
  NotebookPen,
  Pill,
  Scan,
  Slice,
  Syringe,
  Triangle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// templates.icon y templates.color guardan nombres; aquí se traducen a componentes y clases
// estáticas (Tailwind solo genera las clases que aparecen literalmente en el código).
const ICONS: Record<string, LucideIcon> = {
  box: Box,
  droplets: Droplets,
  "flask-conical": FlaskConical,
  "grid-3x3": Grid3x3,
  layers: Layers,
  "notebook-pen": NotebookPen,
  pill: Pill,
  scan: Scan,
  slice: Slice,
  syringe: Syringe,
  triangle: Triangle,
};

const COLORS: Record<string, string> = {
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  cyan: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  indigo: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export function TemplateIcon({
  icon,
  color,
  className,
}: {
  icon: string | null;
  color: string | null;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || NotebookPen;
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-xl",
        (color && COLORS[color]) || COLORS.slate,
        className,
      )}
    >
      <Icon className="size-6" aria-hidden />
    </span>
  );
}
