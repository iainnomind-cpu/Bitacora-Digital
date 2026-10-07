import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export async function AccountCard() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <p className="text-sm text-muted-foreground">Sesión iniciada como</p>
        <p className="font-medium break-all">{email ?? "—"}</p>
      </div>
      <SignOutButton />
    </div>
  );
}
