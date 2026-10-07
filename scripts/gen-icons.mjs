// Genera los íconos de la PWA en public/icons a partir del ícono del libro (lucide
// "book-open-text") que se usa en la pantalla de login. Uso: node scripts/gen-icons.mjs
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BG = "#171717";
const FG = "#fafafa";
const PATHS = [
  "M12 5v16",
  "M16 13h2",
  "M16 9h2",
  "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z",
  "M6 13h2",
  "M6 9h2",
];

/** `iconScale`: fracción del lado que ocupa el libro. `radius`: esquinas (0 = cuadrado). */
function svg(size, { iconScale, radius }) {
  const icon = size * iconScale;
  const offset = (size - icon) / 2;
  const s = icon / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${s})" fill="none" stroke="${FG}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${PATHS.map((d) => `<path d="${d}"/>`).join("\n    ")}
  </g>
</svg>`;
}

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });

const targets = [
  // "any": esquinas redondeadas, el sistema no recorta.
  { file: "icon-192.png", size: 192, iconScale: 0.55, radius: 0.22 },
  { file: "icon-512.png", size: 512, iconScale: 0.55, radius: 0.22 },
  // "maskable": fondo a sangre y el libro dentro de la zona segura (80 % central).
  { file: "maskable-512.png", size: 512, iconScale: 0.45, radius: 0 },
  // iOS redondea las esquinas por su cuenta y no admite transparencia.
  { file: "apple-touch-icon.png", size: 180, iconScale: 0.55, radius: 0 },
  // Insignia monocroma para la barra de notificaciones de Android.
  { file: "badge-96.png", size: 96, iconScale: 0.8, radius: 0, badge: true },
];

for (const t of targets) {
  let image = sharp(Buffer.from(svg(t.size, t)));
  if (t.badge) {
    // Solo la silueta blanca sobre transparente.
    image = sharp(
      Buffer.from(
        svg(t.size, t)
          .replace(`fill="${BG}"`, 'fill="none"')
          .replace(`stroke="${FG}"`, 'stroke="#ffffff"'),
      ),
    );
  }
  await image.png().toFile(fileURLToPath(new URL(t.file, out)));
  console.log(`public/icons/${t.file}`);
}
