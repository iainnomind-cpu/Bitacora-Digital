"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";
import { cn } from "@/lib/utils";
import { MagicLinkForm } from "./magic-link-form";

type Mode = "entrar" | "registro" | "enlace";

const emailSchema = z.email("Escribe un correo válido.");

/**
 * Acceso con correo y contraseña. "Crear cuenta" no pide verificación por correo: la cuenta se
 * crea confirmada en el servidor y se entra de inmediato. Cada cuenta tiene su propia bitácora.
 */
export function AuthPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(params.get("error") === "link" ? "enlace" : "entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(
        /invalid login credentials/i.test(error.message)
          ? "Correo o contraseña incorrectos. Si entrabas con enlace, usa “Entrar con un enlace” y ponte una contraseña en Ajustes."
          : error.message,
      );
    }
    router.replace(next);
    router.refresh();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (mode === "registro") {
      if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
      if (password !== confirm) return setError("Las contraseñas no coinciden.");
    }
    setPending(true);
    try {
      if (mode === "registro") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: parsed.data, password, code: code || undefined }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (json.needsCode) setNeedsCode(true);
          throw new Error(json.error ?? "No se pudo crear la cuenta.");
        }
      }
      await enter();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  };

  if (mode === "enlace") {
    return (
      <div className="flex flex-col gap-4">
        <MagicLinkForm />
        <Button variant="ghost" className="h-12" onClick={() => setMode("entrar")}>
          Entrar con contraseña
        </Button>
      </div>
    );
  }

  const registering = mode === "registro";
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-muted p-1">
        {(["entrar", "registro"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "h-11 rounded-lg text-sm font-medium transition-colors",
              mode === m ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {m === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete={registering ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pr-12 text-base"
            />
            <button
              type="button"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow(!show)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
            >
              {show ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
          {registering && <p className="text-xs text-muted-foreground">Al menos 8 caracteres.</p>}
        </div>
        {registering && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Repite la contraseña</Label>
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12 text-base"
            />
          </div>
        )}
        {registering && needsCode && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite">Código de invitación</Label>
            <Input
              id="invite"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 text-base"
              autoFocus
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-12 text-base">
          {pending
            ? registering
              ? "Creando cuenta…"
              : "Entrando…"
            : registering
              ? "Crear cuenta y entrar"
              : "Entrar"}
        </Button>
      </form>

      <Button
        variant="ghost"
        className="h-12 text-muted-foreground"
        onClick={() => setMode("enlace")}
      >
        Entrar con un enlace por correo
      </Button>
    </div>
  );
}
