"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Guía de primeros pasos: tareas reales que se marcan solas cuando se cumplen. Cada una lleva
// a su pantalla con `?guia=<clave>`, donde un recuadro muestra los pasos numerados.

export type GuideTask = {
  key: string;
  title: string;
  summary: string;
  href: string;
  steps: string[];
};

export const GUIDE_TASKS: GuideTask[] = [
  {
    key: "laboratorio",
    title: "Describe tu laboratorio",
    summary: "Para que la IA entienda tus técnicas y siglas.",
    href: "/ajustes?guia=laboratorio#laboratorio",
    steps: [
      "En «Mi laboratorio», escribe tu área y técnicas. Ejemplo: «Neurobiología: perfusión, histología e inmunohistoquímica en ratones 3xTg».",
      "En «Vocabulario» agrega siglas, reactivos o nombres que dictas seguido (IBA1, DAB, PFA…).",
      "Toca «Guardar».",
    ],
  },
  {
    key: "muestra",
    title: "Registra tu primera muestra",
    summary: "Un animal, tejido, línea celular… lo que rastreas.",
    href: "/muestras/nueva?guia=muestra",
    steps: [
      "Elige el tipo de muestra (por ejemplo, Animal).",
      "Escribe su código: el mismo que usas en tus etiquetas (por ejemplo, 3xTg-M-001).",
      "Si quieres, llena sus datos (genotipo, sexo, fecha de nacimiento…). Son opcionales.",
      "Toca «Registrar muestra». La verás en Muestras.",
    ],
  },
  {
    key: "entrada",
    title: "Registra una actividad con esa muestra",
    summary: "Elige la muestra de la lista; no hay que escribirla.",
    href: "/entrada/nueva?guia=entrada",
    steps: [
      "Elige la plantilla de lo que vas a hacer (por ejemplo, Perfusión / fijación), o escribe «voy a…» y toca «Sugerir plantilla».",
      "En el campo de la muestra (por ejemplo, Animal) toca «Elegir animal» y selecciona la que registraste.",
      "Si la actividad produce algo (por ejemplo, «Tejidos obtenidos»), toca «Agregar tejido producido» → «Nuevo tejido de…»: se crea ya ligado a su origen.",
      "Llena lo demás: se guarda solo. Puedes dictar un audio y tocar «Llenar con IA».",
      "Cuando termines, toca «Cerrar entrada».",
    ],
  },
  {
    key: "derivada",
    title: "Relaciona muestras",
    summary: "Animal → tejido → bloque: cada una sabe de dónde viene.",
    href: "/muestras?guia=derivada",
    steps: [
      "Abre una muestra de la lista (por ejemplo, tu animal).",
      "Toca «Agregar derivada» y registra lo que salió de ella (un tejido, un bloque…).",
      "En la muestra nueva verás su «Cadena»: de dónde viene y en qué entradas se usó.",
      "Atajo: dentro de una entrada, en los campos de lo producido, «Nuevo … de» hace lo mismo.",
    ],
  },
  {
    key: "captura",
    title: "Haz una captura rápida",
    summary: "Foto, audio o nota sin elegir nada; la IA la ordena.",
    href: "/hoy?guia=captura",
    steps: [
      "Toca Foto, Audio o Nota (aquí abajo).",
      "Captura algo, aunque sea de prueba: una foto de tu mesa o una nota.",
      "Abre la «Bandeja de entrada»: la IA propone a qué entrada va. Acepta, cambia o rechaza.",
    ],
  },
  {
    key: "calculadora",
    title: "Prueba la calculadora",
    summary: "Escala una receta de un protocolo a tu volumen.",
    href: "/calculadora?guia=calculadora&herramienta=protocolo",
    steps: [
      "En «Desde protocolo», toma una foto de una receta o pega su texto.",
      "Toca «Leer soluciones del protocolo».",
      "Cambia «Quiero preparar» al volumen que necesitas: verás cuánto usar de cada cosa y la cuenta.",
      "¿Dudas? Escríbelas en «¿Tienes una duda?».",
    ],
  },
  {
    key: "notificaciones",
    title: "Instala la app y activa avisos",
    summary: "Recordatorios del día y alarmas de los temporizadores.",
    href: "/ajustes?guia=notificaciones#instalar",
    steps: [
      "En «Instalar la app» sigue los pasos para tu teléfono.",
      "Abre la app desde su ícono en la pantalla de inicio.",
      "En «Notificaciones» toca «Activar» y luego «Probar».",
    ],
  },
];

const CALC_KEY = "bitacora:calculadora-usada";
const ACTIVE_KEY = "bitacora:guia-activa";

/** Tarea de la guía en curso (sigue activa al navegar entre pantallas). */
export function getActiveGuide() {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}
export function setActiveGuide(key: string | null) {
  try {
    if (key) sessionStorage.setItem(ACTIVE_KEY, key);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {}
}
const HIDE_KEY = "bitacora:guia-oculta";

export function markCalculatorUsed() {
  try {
    localStorage.setItem(CALC_KEY, "1");
  } catch {}
}

export function guideHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}
export function setGuideHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(HIDE_KEY, "1");
    else localStorage.removeItem(HIDE_KEY);
  } catch {}
}

/** Qué tareas ya se cumplieron, según los datos reales de la cuenta. */
export function useGuideProgress(poll = false) {
  return useQuery({
    queryKey: ["guia"],
    staleTime: 30_000,
    // Mientras hay una guía abierta, revisar seguido para marcar la tarea al cumplirse.
    refetchInterval: poll ? 4000 : false,
    queryFn: async () => {
      const db = createClient();
      const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => (r.count ?? 0) > 0);
      const head = { count: "exact" as const, head: true };
      const [profile, muestra, derivada, entrada, captura, notificaciones] = await Promise.all([
        db.from("profiles").select("ai_context").maybeSingle(),
        count(db.from("samples").select("id", head)),
        count(db.from("samples").select("id", head).not("parent_id", "is", null)),
        count(db.from("entry_samples").select("entry_id", head)),
        count(db.from("attachments").select("id", head)),
        count(db.from("push_subscriptions").select("id", head)),
      ]);
      let calculadora = false;
      try {
        calculadora = localStorage.getItem(CALC_KEY) === "1";
      } catch {}
      const done: Record<string, boolean> = {
        laboratorio: Boolean(profile.data?.ai_context?.trim()),
        muestra,
        entrada,
        derivada,
        captura,
        calculadora,
        notificaciones,
      };
      return done;
    },
  });
}
