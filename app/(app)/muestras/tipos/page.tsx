import type { Metadata } from "next";
import { SampleTypesView } from "@/components/samples/sample-types-view";

export const metadata: Metadata = { title: "Tipos de muestra" };

export default function TiposMuestraPage() {
  return <SampleTypesView />;
}
