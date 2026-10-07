import {
  Activity,
  Atom,
  Beaker,
  Biohazard,
  Box,
  Brain,
  Bug,
  Camera,
  ClipboardList,
  Dna,
  Droplet,
  Droplets,
  Eye,
  FlaskConical,
  FlaskRound,
  Grid3x3,
  HeartPulse,
  Layers,
  Leaf,
  Magnet,
  Microscope,
  NotebookPen,
  Pill,
  Pipette,
  Rat,
  Scale,
  Scan,
  Slice,
  Snowflake,
  Syringe,
  TestTube,
  TestTubes,
  Thermometer,
  Timer,
  Triangle,
  Video,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// templates.icon y templates.color guardan nombres; aquí se traducen a componentes y clases
// estáticas (Tailwind solo genera las clases que aparecen literalmente en el código).
export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  "notebook-pen": NotebookPen,
  "flask-conical": FlaskConical,
  "flask-round": FlaskRound,
  beaker: Beaker,
  "test-tube": TestTube,
  "test-tubes": TestTubes,
  pipette: Pipette,
  droplet: Droplet,
  droplets: Droplets,
  dna: Dna,
  microscope: Microscope,
  scan: Scan,
  layers: Layers,
  slice: Slice,
  triangle: Triangle,
  "grid-3x3": Grid3x3,
  box: Box,
  syringe: Syringe,
  pill: Pill,
  rat: Rat,
  brain: Brain,
  "heart-pulse": HeartPulse,
  activity: Activity,
  eye: Eye,
  video: Video,
  camera: Camera,
  bug: Bug,
  biohazard: Biohazard,
  leaf: Leaf,
  atom: Atom,
  magnet: Magnet,
  waves: Waves,
  thermometer: Thermometer,
  snowflake: Snowflake,
  timer: Timer,
  scale: Scale,
  "clipboard-list": ClipboardList,
};

export const TEMPLATE_COLORS: Record<string, string> = {
  slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  lime: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  cyan: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  indigo: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
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
  const Icon = (icon && TEMPLATE_ICONS[icon]) || NotebookPen;
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-xl",
        (color && TEMPLATE_COLORS[color]) || TEMPLATE_COLORS.slate,
        className,
      )}
    >
      <Icon className="size-6" aria-hidden />
    </span>
  );
}
