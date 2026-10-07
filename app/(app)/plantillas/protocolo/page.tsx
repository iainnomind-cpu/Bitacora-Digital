import type { Metadata } from "next";
import { ProtocolImport } from "@/components/templates/protocol-import";

export const metadata: Metadata = { title: "Plantilla desde protocolo" };

export default function ProtocoloPage() {
  return <ProtocolImport />;
}
