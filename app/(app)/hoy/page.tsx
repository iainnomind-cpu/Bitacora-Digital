import type { Metadata } from "next";
import Link from "next/link";
import {
  Beaker,
  CalendarPlus,
  CircleHelp,
  FlaskConical,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { CaptureBar } from "@/components/attachments/capture-bar";
import { TodayTasks } from "@/components/calendar/today-tasks";
import { PageHeader } from "@/components/layout/page-header";
import { GettingStarted, GuideBanner } from "@/components/onboarding/guide";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { TodayDate } from "@/components/today/today-date";
import { InboxLink } from "@/components/today/inbox-link";
import { TodayEntries } from "@/components/today/today-entries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hoy" };

// Lo que se hace más seguido, con una línea que explica para qué es cada cosa.
const ACTIONS: {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  primary?: boolean;
}[] = [
  {
    href: "/entrada/nueva",
    label: "Registrar actividad",
    hint: "Lo que hiciste o estás haciendo",
    icon: Plus,
    primary: true,
  },
  {
    href: "/muestras/nueva",
    label: "Nueva muestra",
    hint: "Un animal, tejido, plásmido…",
    icon: FlaskConical,
  },
  {
    href: "/calendario",
    label: "Programar",
    hint: "Agenda una tarea con aviso",
    icon: CalendarPlus,
  },
  { href: "/calculadora", label: "Calcular", hint: "Soluciones y diluciones", icon: Beaker },
];

export default function HoyPage() {
  return (
    <>
      <PageHeader title="Hoy">
        <TodayDate />
      </PageHeader>
      <Link
        href="/ayuda"
        aria-label="Ayuda"
        className="absolute top-5 right-4 flex size-12 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CircleHelp className="size-6" aria-hidden />
      </Link>
      <div className="-mt-4 mb-3">
        <ProjectSwitcher />
      </div>

      <GettingStarted />

      <section aria-labelledby="que-hacer">
        <h2 id="que-hacer" className="mb-2 text-sm font-medium text-muted-foreground">
          ¿Qué quieres hacer?
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          {ACTIONS.map(({ href, label, hint, icon: Icon, primary }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-24 flex-col justify-between rounded-xl border p-3 transition-colors",
                  primary
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card hover:bg-muted/50",
                )}
              >
                <Icon className="size-6" aria-hidden />
                <span>
                  <span className="block text-sm leading-tight font-semibold">{label}</span>
                  <span
                    className={cn(
                      "block text-xs leading-tight",
                      primary ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {hint}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="captura-rapida" className="mt-6">
        <h2 id="captura-rapida" className="font-heading text-lg font-semibold">
          Captura rápida
        </h2>
        <p className="mb-2 text-sm text-muted-foreground">
          En plena mesa: guarda una foto, un audio o una nota al instante. Después la ordenas desde
          la bandeja.
        </p>
        <GuideBanner task="captura" />
        <CaptureBar entryId={null} />
        <InboxLink />
      </section>

      <TodayTasks />
      <TodayEntries />
    </>
  );
}
