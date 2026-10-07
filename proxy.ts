import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Excluir estáticos, imágenes, manifest, service worker y rutas de API
    // (las rutas de API validan la sesión o CRON_SECRET por su cuenta).
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
