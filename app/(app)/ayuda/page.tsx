import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TourButton } from "@/components/onboarding/tour-button";
import { APP_TERMS, SAMPLE_TYPE_HELP } from "@/lib/help/glossary";
import { SAMPLE_TYPE_LABELS } from "@/lib/templates/fields";
import { TEMPLATE_PACKS } from "@/lib/templates/packs";

export const metadata: Metadata = { title: "Ayuda" };

const LABELS: Record<string, string> = {
  ...Object.fromEntries(TEMPLATE_PACKS.flatMap((p) => p.sampleTypes.map((t) => [t.key, t.label]))),
  ...SAMPLE_TYPE_LABELS,
};

export default function AyudaPage() {
  return (
    <>
      <PageHeader title="Ayuda">
        <p className="text-sm text-muted-foreground">Qué significa cada cosa en la app.</p>
      </PageHeader>
      <div className="flex flex-col gap-6">
        <TourButton />

        <section
          aria-labelledby="como-funciona"
          className="flex flex-col gap-2 rounded-xl border bg-card p-4"
        >
          <h2 id="como-funciona" className="font-heading text-lg font-semibold">
            Cómo funciona, en 3 pasos
          </h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>
              <strong>Registra tus muestras</strong> (Muestras): el animal, el tejido… cada una con
              su código.
            </li>
            <li>
              <strong>Registra cada actividad</strong> (botón ➕): eliges la plantilla, eliges las
              muestras de la lista y llenas los datos (o dictas un audio y «Llenar con IA»).
            </li>
            <li>
              <strong>Ciérrala</strong> al terminar. Todo queda en Hoy, el Calendario y Buscar.
            </li>
          </ol>
        </section>

        <section aria-labelledby="terminos" className="flex flex-col gap-2">
          <h2 id="terminos" className="font-heading text-lg font-semibold">
            Términos de la app
          </h2>
          <dl className="flex flex-col divide-y rounded-xl border bg-card">
            {APP_TERMS.map((t) => (
              <div key={t.term} className="p-3">
                <dt className="font-medium">{t.term}</dt>
                <dd className="text-sm text-muted-foreground">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="muestras-ayuda" className="flex flex-col gap-2">
          <h2 id="muestras-ayuda" className="font-heading text-lg font-semibold">
            Tipos de muestra
          </h2>
          <p className="text-sm text-muted-foreground">
            Ejemplo de cadena: animal → cerebro → hipocampo (tejidos) → cortes de 50 µm → subículo
            microdisecado (tejido) → bloque en resina → laminillas de 1 µm (microscopio de luz) o
            rejillas (microscopio electrónico). Puedes crear tus propios tipos en Muestras → Tipos
            de muestra.
          </p>
          <dl className="flex flex-col divide-y rounded-xl border bg-card">
            {Object.entries(SAMPLE_TYPE_HELP).map(([key, meaning]) => (
              <div key={key} className="p-3">
                <dt className="font-medium">{LABELS[key] ?? key}</dt>
                <dd className="text-sm text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
