import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Beaker, ChevronRight, FlaskConical, LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AccountCard } from "@/components/settings/account-card";
import { InstallCard } from "@/components/settings/install-card";
import { LabCard } from "@/components/settings/lab-card";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { RemindersCard } from "@/components/settings/reminders-card";
import { ThemePicker } from "@/components/settings/theme-picker";

export const metadata: Metadata = { title: "Ajustes" };

export default function AjustesPage() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="flex flex-col gap-6">
        <section aria-labelledby="apariencia">
          <h2 id="apariencia" className="mb-3 font-heading text-lg font-semibold">
            Apariencia
          </h2>
          <ThemePicker />
        </section>
        <section aria-labelledby="laboratorio">
          <h2 id="laboratorio" className="mb-1 font-heading text-lg font-semibold">
            Mi laboratorio
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            La IA usa esto para entender tus técnicas, siglas y reactivos.
          </p>
          <LabCard />
        </section>
        <section aria-labelledby="bitacora">
          <h2 id="bitacora" className="mb-3 font-heading text-lg font-semibold">
            Bitácora
          </h2>
          <div className="flex flex-col gap-2">
            <Link
              href="/plantillas"
              className="flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 transition-colors hover:bg-muted/50"
            >
              <LayoutTemplate className="size-5 text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">Plantillas</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
            <Link
              href="/muestras/tipos"
              className="flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 transition-colors hover:bg-muted/50"
            >
              <FlaskConical className="size-5 text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">Tipos de muestra</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
            <Link
              href="/calculadora"
              className="flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 transition-colors hover:bg-muted/50"
            >
              <Beaker className="size-5 text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">Calculadora de soluciones</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </div>
        </section>
        <section aria-labelledby="notificaciones">
          <h2 id="notificaciones" className="mb-3 font-heading text-lg font-semibold">
            Notificaciones
          </h2>
          <NotificationsCard />
        </section>
        <section aria-labelledby="recordatorios">
          <h2 id="recordatorios" className="mb-1 font-heading text-lg font-semibold">
            Recordatorios
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">En tu zona horaria.</p>
          <RemindersCard />
        </section>
        <section aria-labelledby="instalar">
          <h2 id="instalar" className="mb-3 font-heading text-lg font-semibold">
            Instalar la app
          </h2>
          <InstallCard />
        </section>
        <section aria-labelledby="cuenta">
          <h2 id="cuenta" className="mb-3 font-heading text-lg font-semibold">
            Cuenta
          </h2>
          <Suspense fallback={<div className="h-28 animate-pulse rounded-xl bg-muted" />}>
            <AccountCard />
          </Suspense>
        </section>
      </div>
    </>
  );
}
