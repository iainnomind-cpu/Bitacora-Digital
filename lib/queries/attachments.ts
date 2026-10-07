"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { baseMimeType, extensionFor } from "@/lib/media/audio";
import { entryKeys } from "./entries";

export type Attachment = Tables<"attachments">;

export const attachmentKeys = {
  all: ["attachments"] as const,
  entry: (entryId: string) => ["attachments", "entry", entryId] as const,
  inbox: ["attachments", "inbox"] as const,
  urls: (paths: string[]) => ["attachments", "urls", ...paths] as const,
};

const BUCKET = "attachments";
const SIGNED_URL_SECONDS = 10 * 60;

/** Adjuntos de una entrada, en orden de captura (§7.6 "Orden dentro de la entrada"). */
export function useEntryAttachments(entryId: string) {
  return useQuery({
    queryKey: attachmentKeys.entry(entryId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("attachments")
        .select("*")
        .eq("entry_id", entryId)
        .order("captured_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Bandeja de entrada: lo capturado sin entrada (§6.3), lo más nuevo primero. */
export function useInbox() {
  return useQuery({
    queryKey: attachmentKeys.inbox,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("attachments")
        .select("*")
        .is("entry_id", null)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** URLs firmadas de corta duración para mostrar fotos y audios del bucket privado. */
export function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: attachmentKeys.urls(paths),
    enabled: paths.length > 0,
    staleTime: (SIGNED_URL_SECONDS / 2) * 1000,
    queryFn: async () => {
      const { data, error } = await createClient()
        .storage.from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (error) throw error;
      return new Map(data.map((d) => [d.path ?? "", d.signedUrl]));
    },
  });
}

export type NewCapture =
  | { kind: "foto" | "audio"; blob: Blob; durationSeconds?: number; capturedAt?: Date }
  | { kind: "texto"; text: string; capturedAt?: Date };

/**
 * Sube un archivo al bucket privado dentro de la carpeta del usuario: {user_id}/{folder}/{uuid}.{ext}.
 * Las políticas de Storage solo dejan escribir en la carpeta propia.
 */
export async function uploadToStorage(blob: Blob, folder: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("La sesión expiró. Vuelve a entrar.");

  const mime = baseMimeType(blob.type || "application/octet-stream");
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extensionFor(mime)}`;
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (upload.error) throw upload.error;
  return { path, mime };
}

/**
 * Sube un archivo directo a Storage (sin pasar por Vercel, §7.1) con la sesión del usuario —las
 * políticas solo dejan escribir en su carpeta— y registra el adjunto.
 * Ruta: {user_id}/{yyyy}/{mm}/{entry_id|inbox}/{uuid}.{ext}
 */
async function createAttachment(entryId: string | null, capture: NewCapture) {
  const supabase = createClient();
  const capturedAt = (capture.capturedAt ?? new Date()).toISOString();

  if (capture.kind === "texto") {
    const { data, error } = await supabase
      .from("attachments")
      .insert({
        entry_id: entryId,
        kind: "texto",
        text_content: capture.text,
        captured_at: capturedAt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const now = new Date();
  const folder = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    entryId ?? "inbox",
  ].join("/");
  const { path, mime } = await uploadToStorage(capture.blob, folder);

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      entry_id: entryId,
      kind: capture.kind,
      storage_path: path,
      mime_type: mime,
      size_bytes: capture.blob.size,
      duration_seconds: capture.durationSeconds ?? null,
      captured_at: capturedAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function useCreateAttachment(entryId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (capture: NewCapture) => createAttachment(entryId, capture),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: entryId ? attachmentKeys.entry(entryId) : attachmentKeys.inbox,
      }),
  });
}

export function useUpdateCaption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string | null }) => {
      const { error } = await createClient().from("attachments").update({ caption }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attachmentKeys.all }),
  });
}

/** Mueve adjuntos de la bandeja a una entrada en borrador. */
export async function assignAttachments(ids: string[], entryId: string) {
  const { error } = await createClient()
    .from("attachments")
    .update({ entry_id: entryId })
    .in("id", ids)
    .is("entry_id", null);
  if (error) throw error;
}

export function useAssignAttachments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, entryId }: { ids: string[]; entryId: string }) =>
      assignAttachments(ids, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: entryKeys.all });
    },
  });
}
