import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Inbox, ListTodo, Mic, NotebookPen, Plus } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { TodayDate } from "@/components/today/today-date";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hoy" };

const quickCapture = [
  { label: "Audio", icon: Mic },
  { label: "Foto", icon: Camera },
  { label: "Nota", icon: NotebookPen },
] as const;

export default function HoyPage() {
  return (
    <>
      <PageHeader title="Hoy">
        <TodayDate />
      </PageHeader>

      <Link
        href="/entrada/nueva"
        className={cn(buttonVariants(), "h-14 w-full gap-2 rounded-xl text-base")}
      >
        <Plus className="size-5" aria-hidden />
        Nueva entrada
      </Link>

      <section aria-labelledby="captura-rapida" className="mt-4">
        <h2 id="captura-rapida" className="sr-only">
          Captura rápida
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {quickCapture.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              disabled
              title="Disponible en la etapa 5"
              className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-medium disabled:opacity-50"
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Inbox className="size-3.5" aria-hidden />
          Bandeja de entrada: disponible en la etapa 5
        </p>
      </section>

      <section aria-labelledby="linea-tiempo" className="mt-8">
        <h2 id="linea-tiempo" className="mb-3 font-heading text-lg font-semibold">
          Entradas del día
        </h2>
        <ComingSoon icon={ListTodo} title="Aún no hay entradas" stage="4">
          Aquí aparecerá la línea de tiempo de las entradas de hoy.
        </ComingSoon>
      </section>
    </>
  );
}
