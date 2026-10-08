"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { markCalculatorUsed } from "@/lib/onboarding/guide";
import { chipClass } from "@/components/entry/fields/inputs";
import { cn } from "@/lib/utils";
import {
  ConvertCalc,
  DilutionCalc,
  FactorCalc,
  MasterMixCalc,
  MolarityCalc,
  PercentCalc,
  SerialCalc,
} from "./calculators";
import { ProtocolScaler } from "./protocol-scaler";
import { ReagentLibrary } from "./reagent-library";
import { Recipes } from "./recipes";

const TOOLS = [
  {
    key: "protocolo",
    label: "Desde protocolo",
    help: "Sube la foto o el PDF de un protocolo o receta: te digo cuánto usar de cada cosa para el volumen que quieras, y resuelvo tus dudas.",
  },
  {
    key: "molaridad",
    label: "Molaridad",
    help: "Cuánto pesar para una concentración molar (o qué concentración da una masa).",
  },
  {
    key: "dilucion",
    label: "C1·V1 = C2·V2",
    help: "Cuánto stock tomar para una concentración final; acepta unidades distintas.",
  },
  {
    key: "factor",
    label: "1:X",
    help: "Diluciones por factor (anticuerpos, colorantes), para una o varias muestras.",
  },
  { key: "porcentaje", label: "%", help: "Soluciones en % p/v (sólidos) o % v/v (líquidos)." },
  { key: "seriada", label: "Seriadas", help: "Curvas estándar y diluciones en serie." },
  {
    key: "receta",
    label: "Recetas",
    help: "Soluciones de varios componentes (PBS, RIPA, Tris-HCl…), guardables y escalables.",
  },
  {
    key: "mezcla",
    label: "Mezcla maestra",
    help: "Volúmenes por muestra × número de muestras + excedente.",
  },
  { key: "convertir", label: "Convertir", help: "Entre M, mM, µM, mg/mL, µg/mL y %." },
  { key: "reactivos", label: "Reactivos", help: "Pesos moleculares: los tuyos y los comunes." },
] as const;
type Tool = (typeof TOOLS)[number]["key"];

/** Calculadora para preparar soluciones. `?herramienta=factor&dilucion=1:500` abre una directo. */
export function CalculatorView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("herramienta");
  const tool: Tool = TOOLS.some((t) => t.key === requested) ? (requested as Tool) : "protocolo";
  const current = TOOLS.find((t) => t.key === tool)!;
  useEffect(() => markCalculatorUsed(), []);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="tablist"
        aria-label="Herramientas"
      >
        {TOOLS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tool === t.key}
            onClick={() =>
              router.replace(
                `${pathname}?herramienta=${t.key}${params.get("guia") ? `&guia=${params.get("guia")}` : ""}`,
                { scroll: false },
              )
            }
            className={cn(chipClass(tool === t.key), "shrink-0")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{current.help}</p>
      <div role="tabpanel">
        {tool === "protocolo" && <ProtocolScaler />}
        {tool === "molaridad" && <MolarityCalc />}
        {tool === "dilucion" && <DilutionCalc />}
        {tool === "factor" && <FactorCalc initialFactor={params.get("dilucion")} />}
        {tool === "porcentaje" && <PercentCalc />}
        {tool === "seriada" && <SerialCalc />}
        {tool === "receta" && <Recipes />}
        {tool === "mezcla" && <MasterMixCalc />}
        {tool === "convertir" && <ConvertCalc />}
        {tool === "reactivos" && <ReagentLibrary />}
      </div>
    </div>
  );
}
