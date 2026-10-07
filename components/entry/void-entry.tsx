"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Anular una entrada (§3): la oculta de la vista normal, la conserva y exige motivo. */
export function VoidEntry({
  onConfirm,
  pending,
  error,
}: {
  onConfirm: (reason: string) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <Button variant="ghost" className="h-12 text-muted-foreground" onClick={() => setOpen(true)}>
        <Ban className="size-4" aria-hidden />
        Anular entrada
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-4">
      <p className="text-sm">
        La entrada se ocultará de la vista normal, pero no se borra: queda en el historial con el
        motivo.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="void-reason">Motivo</Label>
        <Textarea
          id="void-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. entrada duplicada, se creó por error…"
          className="min-h-20 text-base"
          autoFocus
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          className="h-12"
          disabled={pending || reason.trim() === ""}
          onClick={() => onConfirm(reason.trim())}
        >
          {pending ? "Anulando…" : "Anular"}
        </Button>
      </div>
    </div>
  );
}
