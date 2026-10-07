"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { FlaskConical, Home, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/hoy", label: "Hoy", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/entrada/nueva", label: "Nueva", icon: Plus, primary: true },
  { href: "/muestras", label: "Muestras", icon: FlaskConical },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

// usePathname es dato de tiempo de ejecución en rutas dinámicas (cacheComponents): la lista
// sin elemento activo sirve de fallback mientras llega.
export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80"
    >
      <Suspense fallback={<NavList pathname={null} />}>
        <ActiveNavList />
      </Suspense>
    </nav>
  );
}

function ActiveNavList() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="mx-auto grid max-w-lg grid-cols-5">
      {items.map(({ href, label, icon: Icon, ...rest }) => {
        const active = pathname != null && (pathname === href || pathname.startsWith(`${href}/`));
        const primary = "primary" in rest;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors",
                active && "text-foreground",
              )}
            >
              {primary ? (
                <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Icon className="size-6" aria-hidden />
                </span>
              ) : (
                <Icon className="size-6" aria-hidden />
              )}
              <span className={cn(primary && "sr-only")}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
