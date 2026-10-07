import type { Metadata } from "next";
import { Suspense } from "react";
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
