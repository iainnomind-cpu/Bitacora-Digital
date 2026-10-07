"use client";

import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { useInbox } from "@/lib/queries/attachments";

/** Acceso a la bandeja de entrada con el número de elementos sin asignar. */
export function InboxLink() {
  const { data } = useInbox();
  const count = data?.length ?? 0;
  return (
    <Link
      href="/bandeja"
      className="flex min-h-12 items-center gap-2 rounded-xl px-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <Inbox className="size-4" aria-hidden />
      <span className="flex-1">Bandeja de entrada</span>
      {count > 0 && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          {count}
        </span>
      )}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}
