"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/** Poner o cambiar la contraseña (útil si la cuenta se creó entrando con enlace). */
export function PasswordCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const save = async () => {
    setMessage(null);
    if (password.length < 8) return setMessage({ text: "Al menos 8 caracteres.", error: true });
    if (password !== confirm)
      return setMessage({ text: "Las contraseñas no coinciden.", error: true });
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) return setMessage({ text: error.message, error: true });
    setPassword("");
    setConfirm("");
    setMessage({ text: "Contraseña guardada. Ya puedes entrar con tu correo y esta contraseña." });
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="nueva-pass">Nueva contraseña</Label>
        <Input
          id="nueva-pass"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nueva-pass-2">Repítela</Label>
        <Input
          id="nueva-pass-2"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-12 text-base"
        />
      </div>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={
            message.error
              ? "text-sm text-destructive"
              : "flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400"
          }
        >
          {!message.error && <Check className="size-4" aria-hidden />}
          {message.text}
        </p>
      )}
      <Button type="submit" className="h-12" disabled={pending || !password}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
