"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";

const emailSchema = z.email("Escribe un correo válido.");
const codeSchema = z.string().regex(/^\d{6,10}$/, "El código son solo dígitos (6 o más).");

type Step = "email" | "code";

/** Entrar con enlace o código por correo (opción secundaria; útil si no recuerdas la contraseña). */
export function MagicLinkForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const linkError = searchParams.get("error");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? "El enlace no es válido o ya expiró. Pide uno nuevo." : null,
  );

  async function sendLink(e?: FormEvent) {
    e?.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setPending(true);
    setError(null);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await createClient().auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);

    if (error) return setError(error.message);
    setStep("code");
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    const parsed = codeSchema.safeParse(code.trim());
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setPending(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: parsed.data,
      type: "email",
    });

    if (error) {
      setPending(false);
      return setError("Código incorrecto o expirado.");
    }
    router.replace(next);
    router.refresh();
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Enviamos un enlace a <span className="font-medium text-foreground">{email}</span>. Ábrelo
          en este dispositivo, o escribe aquí el código del correo (útil si instalaste la app en el
          teléfono y el enlace se abre en el navegador).
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-12 text-center font-mono text-lg tracking-[0.3em]"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending} className="h-12 text-base">
          {pending ? "Verificando…" : "Entrar"}
        </Button>
        <div className="flex justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-12"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Cambiar correo
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-12"
            disabled={pending}
            onClick={() => sendLink()}
          >
            Reenviar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendLink} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 text-base"
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="h-12 text-base">
        {pending ? "Enviando…" : "Enviar enlace de acceso"}
      </Button>
    </form>
  );
}
