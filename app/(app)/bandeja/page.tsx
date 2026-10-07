import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { InboxView } from "@/components/inbox/inbox-view";

export const metadata: Metadata = { title: "Bandeja de entrada" };

export default function BandejaPage() {
  return (
    <>
      <PageHeader title="Bandeja de entrada">
        <p className="text-sm text-muted-foreground">
          Fotos, audios y notas capturados sin entrada.
        </p>
      </PageHeader>
      <InboxView />
    </>
  );
}
