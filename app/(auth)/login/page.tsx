import type { Metadata } from "next";
import { Suspense } from "react";
import { BookOpenText } from "lucide-react";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpenText className="size-7" aria-hidden />
        </span>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Bitácora</h1>
        <p className="text-sm text-muted-foreground">Bitácora de laboratorio digital</p>
      </div>
      <Suspense>
        <AuthPanel />
      </Suspense>
    </main>
  );
}
