// Explicaciones cortas de los términos de la app y de los tipos de muestra, para mostrarlas donde
// aparecen (formularios, ayuda) y que la app no se sienta enredada.

/** Qué es cada tipo de muestra inicial o de los paquetes. Los tipos propios no tienen texto. */
export const SAMPLE_TYPE_HELP: Record<string, string> = {
  animal: "El animal del que salen las demás muestras (p. ej. un ratón 3xTg-M-001).",
  tejido: "Lo que se obtiene del animal al disecar: cerebro, hemisferio, hipocampo, hígado…",
  bloque:
    "El tejido incluido en resina o parafina: un «cubito» duro para cortarlo en rebanadas finas.",
  navaja: "La cuchilla de vidrio o diamante con la que se corta el bloque en el ultramicrotomo.",
  rejilla:
    "Mallita de cobre (~3 mm) donde se pone un corte ultrafino para el microscopio electrónico.",
  laminilla:
    "Portaobjetos de vidrio con un corte montado, para teñirlo y verlo al microscopio de luz.",
  muestra_microct: "Tejido u órgano preparado (y a veces contrastado) para escanear en microCT.",
  otro: "Cualquier otra cosa que quieras rastrear con código.",
  muestra_rna: "RNA extraído de un tejido o células (con su concentración y pureza).",
  muestra_dna: "DNA extraído (genómico o plasmídico).",
  cdna: "cDNA obtenido por transcripción reversa a partir de RNA.",
  plasmido: "Plásmido (vector con inserto), normalmente purificado de una cepa bacteriana.",
  cepa_bacteriana: "Cepa o clon bacteriano (p. ej. E. coli DH5α con un plásmido), en glicerol.",
  lisado_proteina: "Extracto de proteínas de tejido o células, para Western blot u otros ensayos.",
  suero: "Suero o plasma de sangre, normalmente en alícuotas.",
  suspension_celular: "Células sueltas en suspensión (PBMC, esplenocitos…), con su conteo.",
  placa: "Placa de pozos (ELISA, cultivo…), con su mapa de muestras.",
  video: "Video de una sesión conductual, para analizarlo.",
  cohorte: "Grupo de animales que se estudia junto (edad, grupos, n).",
  linea_celular: "Línea celular (HEK293, SH-SY5Y…), con su medio y pasaje.",
  frasco_cultivo: "Frasco o placa de cultivo concreto, con su pasaje y confluencia.",
  vial_congelado: "Vial de células congeladas en nitrógeno o −80 °C.",
};

/** Términos de la app, para la página de ayuda. */
export const APP_TERMS: { term: string; meaning: string }[] = [
  {
    term: "Entrada",
    meaning:
      "El registro de una actividad que hiciste en un día (una perfusión, un corte, un ELISA). Es la página de tu bitácora.",
  },
  {
    term: "Plantilla",
    meaning:
      "El formulario de cada tipo de actividad: qué datos hay que anotar. Eliges una al crear la entrada.",
  },
  { term: "Borrador", meaning: "Entrada que aún puedes editar. Se guarda sola mientras escribes." },
  {
    term: "Cerrar entrada",
    meaning:
      "Firmarla: ya no se edita (como la tinta en una bitácora de papel). Si olvidaste algo, agregas una adenda.",
  },
  {
    term: "Adenda",
    meaning:
      "Nota que se agrega a una entrada ya cerrada, con fecha y hora, sin cambiar lo original.",
  },
  {
    term: "Anular",
    meaning:
      "Ocultar una entrada hecha por error. No se borra: queda en el historial con el motivo.",
  },
  {
    term: "Muestra",
    meaning:
      "Cualquier cosa que rastreas con un código (animal, tejido, plásmido…). Cada una sabe de dónde viene y en qué entradas se usó.",
  },
  {
    term: "Viene de / derivada",
    meaning:
      "La relación entre muestras: un tejido viene de un animal; un bloque, de un tejido. Así puedes seguir la cadena completa.",
  },
  {
    term: "Usada / producida",
    meaning:
      "En una entrada, las muestras que usaste (el bloque que cortaste) y las que salieron (las rejillas).",
  },
  {
    term: "Captura rápida",
    meaning: "Foto, audio o nota que guardas al instante, sin elegir entrada. Va a la bandeja.",
  },
  {
    term: "Bandeja de entrada",
    meaning:
      "Donde esperan las capturas rápidas. La IA propone a qué entrada va cada cosa; tú aceptas o cambias.",
  },
  {
    term: "Llenar con IA",
    meaning:
      "La IA lee tus audios y notas de la entrada y propone los valores de los campos. Tú eliges qué aplicar.",
  },
  {
    term: "Modo guiado",
    meaning:
      "Recorre los pasos de un protocolo uno por uno, con temporizador y aviso al terminar cada paso.",
  },
  {
    term: "Proyecto",
    meaning: "Agrupa entradas de un mismo experimento o línea de trabajo. El activo filtra Hoy.",
  },
  {
    term: "Tarea programada",
    meaning:
      "Algo que harás en el futuro (en el Calendario). Te avisa y, al empezar, crea la entrada.",
  },
];
