import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicKey, supabaseUrl } from "./env";

// Rutas accesibles sin sesión.
const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  // Si Supabase no acepta el redirect_to, manda el enlace a la Site URL (normalmente "/").
  // Reenviarlo a /auth/confirm para no perder el código ni el error.
  const { pathname: path, searchParams } = request.nextUrl;
  if (!path.startsWith("/auth/")) {
    if (searchParams.has("code") || searchParams.has("token_hash")) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/confirm";
      return NextResponse.redirect(url);
    }
    if (searchParams.has("error_code") && path !== "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=link";
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // No poner código entre createServerClient y getClaims: refresca la sesión.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/hoy";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
