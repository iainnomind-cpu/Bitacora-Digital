import type { Metadata } from "next";
import { Suspense } from "react";
import { EntrySkeleton } from "@/components/entry/entry-editor";
import { EntryHistory } from "@/components/entry/entry-history";

export const metadata: Metadata = { title: "Historial" };

export default function HistorialPage({ params }: PageProps<"/entrada/[id]/historial">) {
  return (
    <Suspense fallback={<EntrySkeleton />}>
      <EntryHistory params={params} />
    </Suspense>
  );
}
