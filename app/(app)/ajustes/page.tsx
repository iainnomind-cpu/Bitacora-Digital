import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AccountCard } from "@/components/settings/account-card";
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
        <section aria-labelledby="bitacora">
          <h2 id="bitacora" className="mb-3 font-heading text-lg font-semibold">
            Bitácora
          </h2>
          <Link
            href="/plantillas"
            className="flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 transition-colors hover:bg-muted/50"
          >
            <LayoutTemplate className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1 font-medium">Plantillas</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
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
