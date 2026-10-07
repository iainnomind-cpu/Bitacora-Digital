"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, FileText, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProtocolToTemplate } from "@/lib/queries/protocols";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;

/**
 * Crear una plantilla a partir de un protocolo (§7.7): fotos de las páginas, un PDF o el texto
 * pegado. La IA propone la plantilla y se abre en el editor para revisarla.
 */
export function ProtocolImport() {
  const router = useRouter();
  const convert = useProtocolToTemplate();
  // Cada archivo con su vista previa (URL local; se libera al quitarlo o al salir).
  const [items, setItems] = useState<{ file: File; url: string }[]>([]);
  const files = items.map((i) => i.file);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);

  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const add = (list: FileList | null) => {
    if (!list) return;
    const added = Array.from(list)
      .slice(0, MAX_FILES - items.length)
      .map((file) => ({
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      }));
    urlsRef.current.push(...added.map((a) => a.url).filter(Boolean));
    setItems((prev) => [...prev, ...added]);
  };
  const remove = (i: number) => {
    if (items[i]?.url) URL.revokeObjectURL(items[i].url);
    setItems(items.filter((_, j) => j !== i));
  };

  const run = () =>
    convert.mutate(
      { files, text, onProgress: setProgress },
      {
        onSuccess: ({ suggestion_id }) =>
          router.push(`/plantillas/nueva?sugerencia=${suggestion_id}`),
        onSettled: () => setProgress(null),
      },
    );

  const ready = files.length > 0 || text.trim().length > 20;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/plantillas"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1 self-start")}
      >
        <ChevronLeft className="size-5" aria-hidden />
        Plantillas
      </Link>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Plantilla desde protocolo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toma fotos de las páginas del protocolo, sube un PDF o pega el texto. La IA propone los
          campos, los reactivos y los pasos con sus tiempos; tú la revisas antes de guardarla.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cámara", icon: Camera, ref: camera },
          { label: "Fotos", icon: ImagePlus, ref: gallery },
          { label: "PDF", icon: FileText, ref: pdf },
        ].map(({ label, icon: Icon, ref }) => (
          <button
            key={label}
            type="button"
            disabled={convert.isPending || files.length >= MAX_FILES}
            onClick={() => ref.current?.click()}
            className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={pdf}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="relative aspect-[3/4] overflow-hidden rounded-xl border bg-muted"
            >
              {items[i].url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={items[i].url}
                  alt={`Página ${i + 1}`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs">
                  <FileText className="size-6" aria-hidden />
                  <span className="line-clamp-2 break-all">{f.name}</span>
                </span>
              )}
              <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 text-xs">
                {i + 1}
              </span>
              <button
                type="button"
                aria-label={`Quitar ${i + 1}`}
                disabled={convert.isPending}
                onClick={() => remove(i)}
                className="absolute top-1 right-1 flex size-10 items-center justify-center rounded-full bg-background/90"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="protocolo-texto">O pega el texto del protocolo</Label>
        <Textarea
          id="protocolo-texto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="1. Perfundir con PBS 0.1 M…"
          className="min-h-32 text-base"
          disabled={convert.isPending}
        />
      </div>

      {convert.error && (
        <p role="alert" className="text-sm text-destructive">
          {convert.error.message}
        </p>
      )}
      <Button className="h-14 text-base" disabled={!ready || convert.isPending} onClick={run}>
        {convert.isPending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-5" aria-hidden />
        )}
        {convert.isPending ? (progress ?? "Procesando…") : "Crear plantilla con IA"}
      </Button>
      {convert.isPending && (
        <p className="text-center text-xs text-muted-foreground">
          Leer varias páginas puede tardar hasta un minuto.
        </p>
      )}
    </div>
  );
}
