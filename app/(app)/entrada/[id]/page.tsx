import type { Metadata } from "next";
import { Suspense } from "react";
import { EntryEditor, EntrySkeleton } from "@/components/entry/entry-editor";
import { GuideBanner } from "@/components/onboarding/guide";

export const metadata: Metadata = { title: "Entrada" };

export default function EntradaPage({ params }: PageProps<"/entrada/[id]">) {
  return (
    <>
      <GuideBanner task="entrada" />
      <Suspense fallback={<EntrySkeleton />}>
        <EntryEditor params={params} />
      </Suspense>
    </>
  );
}
