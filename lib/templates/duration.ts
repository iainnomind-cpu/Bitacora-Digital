// Duraciones: se guardan en segundos y se muestran como h:mm:ss o mm:ss (§5).

export function splitDuration(seconds: number | null) {
  if (seconds == null) return { h: null, m: null, s: null };
  return { h: Math.floor(seconds / 3600), m: Math.floor((seconds % 3600) / 60), s: seconds % 60 };
}

export function joinDuration(h: number | null, m: number | null, s: number | null): number | null {
  if (h == null && m == null && s == null) return null;
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const { h, m, s } = splitDuration(seconds);
  const pad = (n: number | null) => String(n ?? 0).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
