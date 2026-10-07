import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  email: z.email("Escribe un correo válido.").transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72),
  code: z.string().trim().max(200).optional(),
});

function sameCode(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Registro con correo y contraseña, sin verificación por correo: la cuenta se crea ya
 * confirmada (service role) y el cliente entra con signInWithPassword. Si SIGNUP_CODE está
 * definido, solo se registra quien tenga ese código de invitación.
 * El trigger on_auth_user_created le crea su perfil, plantillas, tipos de muestra y
 * recordatorios; RLS separa su bitácora de la de los demás.
 */
export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const required = process.env.SIGNUP_CODE?.trim();
  if (required && !sameCode(body.data.code ?? "", required)) {
    return NextResponse.json(
      {
        error: body.data.code
          ? "El código de invitación no es correcto."
          : "Se necesita un código de invitación.",
        needsCode: true,
      },
      { status: 403 },
    );
  }

  const { error } = await createAdminClient().auth.admin.createUser({
    email: body.data.email,
    password: body.data.password,
    email_confirm: true,
  });
  if (error) {
    const exists =
      error.code === "email_exists" || /already|registered|exists/i.test(error.message);
    if (exists) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo. Entra con tu contraseña o con un enlace." },
        { status: 409 },
      );
    }
    if (error.code === "weak_password") {
      return NextResponse.json({ error: "La contraseña es demasiado débil." }, { status: 400 });
    }
    console.error("[signup]", error.code, error.message);
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
