import type { MetadataRoute } from "next";

// Web App Manifest (§6.1.14): permite instalar la app en la pantalla de inicio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bitácora de laboratorio",
    short_name: "Bitácora",
    description: "Bitácora de laboratorio digital",
    lang: "es-MX",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nueva entrada", url: "/entrada/nueva" },
      { name: "Bandeja de entrada", url: "/bandeja" },
    ],
  };
}
