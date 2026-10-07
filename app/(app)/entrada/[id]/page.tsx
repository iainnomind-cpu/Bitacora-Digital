import type { Metadata } from "next";
import { Suspense } from "react";
import { EntryEditor, EntrySkeleton } from "@/components/entry/entry-editor";

export const metadata: Metadata = { title: "Entrada" };

export default function EntradaPage({ params }: PageProps<"/entrada/[id]">) {
  return (
    <Suspense fallback={<EntrySkeleton />}>
      <EntryEditor params={params} />
    </Suspense>
  );
}
