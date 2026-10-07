// Notas de voz con MediaRecorder (§6.1.6). Safari graba audio/mp4; Chrome y Firefox, webm/ogg.

/**
 * Límite de grabación. A 64 kbps, 10 min ≈ 4.8 MB: muy por debajo del límite de archivo de la
 * API de transcripción y del tiempo máximo de una función en Vercel (§7.1).
 */
export const MAX_AUDIO_SECONDS = 10 * 60;
export const AUDIO_BITS_PER_SECOND = 64_000;

const CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

/** Formato soportado por este navegador; null si no hay MediaRecorder. */
export function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** "audio/webm;codecs=opus" → "audio/webm" (Storage compara el tipo sin parámetros). */
export function baseMimeType(mime: string) {
  return mime.split(";")[0].trim();
}

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extensionFor(mime: string) {
  return EXTENSIONS[baseMimeType(mime)] ?? "bin";
}
