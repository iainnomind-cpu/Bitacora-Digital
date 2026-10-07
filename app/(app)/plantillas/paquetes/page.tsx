import type { Metadata } from "next";
import { PacksView } from "@/components/templates/packs-view";

export const metadata: Metadata = { title: "Plantillas por disciplina" };

export default function PaquetesPage() {
  return <PacksView />;
}
