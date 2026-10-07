import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CaptureBar } from "@/components/attachments/capture-bar";
import { PageHeader } from "@/components/layout/page-header";
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
        <CaptureBar entryId={null} />
        <InboxLink />
      </section>

      <TodayEntries />
    </>
  );
}
