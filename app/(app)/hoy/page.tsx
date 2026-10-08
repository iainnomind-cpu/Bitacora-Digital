import type { Metadata } from "next";
import Link from "next/link";
import { Beaker, Plus } from "lucide-react";
import { CaptureBar } from "@/components/attachments/capture-bar";
import { PageHeader } from "@/components/layout/page-header";
import { GettingStarted, GuideBanner } from "@/components/onboarding/guide";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { TodayDate } from "@/components/today/today-date";
import { InboxLink } from "@/components/today/inbox-link";
import { TodayEntries } from "@/components/today/today-entries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hoy" };

export default function HoyPage() {
  return (
    <>
      <PageHeader title="Hoy">
        <TodayDate />
      </PageHeader>
      <div className="-mt-4 mb-3">
        <ProjectSwitcher />
      </div>

      <GettingStarted />

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
        <GuideBanner task="captura" />
        <CaptureBar entryId={null} />
        <InboxLink />
        <Link
          href="/calculadora"
          className="flex min-h-12 items-center gap-2 rounded-xl px-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Beaker className="size-4" aria-hidden />
          <span className="flex-1">Calculadora de soluciones</span>
        </Link>
      </section>

      <TodayEntries />
    </>
  );
}
