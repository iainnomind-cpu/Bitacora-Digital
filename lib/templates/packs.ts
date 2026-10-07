// Paquetes de plantillas por disciplina (para usar la bitácora en cualquier laboratorio).
// Son puntos de partida: los tiempos de los pasos son típicos y cada laboratorio los ajusta en
// el editor de plantillas (o crea la suya desde la foto de su protocolo).
import type { FieldDef } from "./fields";

type Extra = { required?: boolean; help?: string };
const text = (key: string, label: string, x: Extra & { expected?: string } = {}): FieldDef => ({
  key,
  label,
  type: "text",
  required: false,
  ...x,
});
const long = (key: string, label: string, x: Extra = {}): FieldDef => ({
  key,
  label,
  type: "longtext",
  required: false,
  ...x,
});
const num = (
  key: string,
  label: string,
  unit?: string,
  x: Extra & { expected?: number } = {},
): FieldDef => ({ key, label, type: "number", required: false, ...(unit ? { unit } : {}), ...x });
const dur = (key: string, label: string, x: Extra & { expected?: number } = {}): FieldDef => ({
  key,
  label,
  type: "duration",
  required: false,
  ...x,
});
const sel = (key: string, label: string, options: string[], x: Extra = {}): FieldDef => ({
  key,
  label,
  type: "select",
  options,
  required: false,
  ...x,
});
const multi = (key: string, label: string, options: string[], x: Extra = {}): FieldDef => ({
  key,
  label,
  type: "multiselect",
  options,
  required: false,
  ...x,
});
const bool = (key: string, label: string, x: Extra = {}): FieldDef => ({
  key,
  label,
  type: "boolean",
  required: false,
  ...x,
});
const rating = (key: string, label: string, x: Extra = {}): FieldDef => ({
  key,
  label,
  type: "rating",
  required: false,
  ...x,
});
const time = (key: string, label: string, x: Extra = {}): FieldDef => ({
  key,
  label,
  type: "time",
  required: false,
  ...x,
});
const sample = (
  key: string,
  label: string,
  sample_type: string,
  x: Extra & { multiple?: boolean; role?: "usada" | "producida" } = {},
): FieldDef => ({
  key,
  label,
  type: "sample_ref",
  sample_type,
  multiple: x.multiple ?? false,
  role: x.role ?? "usada",
  required: x.required ?? false,
  ...(x.help ? { help: x.help } : {}),
});
const reagent = (key: string, label: string, x: Extra & { multiple?: boolean } = {}): FieldDef => ({
  key,
  label,
  type: "reagent",
  multiple: x.multiple ?? false,
  required: x.required ?? false,
});
const steps = (key: string, label: string, list: [string, number?][]): FieldDef => ({
  key,
  label,
  type: "steps",
  required: false,
  expected: list.map(([l, s]) => ({ label: l, ...(s != null ? { planned_seconds: s } : {}) })),
});
const MIN = 60;
const H = 3600;

export type PackTemplate = {
  name: string;
  activity_type: string;
  description: string;
  icon: string;
  color: string;
  fields: FieldDef[];
};

export type PackSampleType = {
  key: string;
  label: string;
  parent_keys: string[];
  metadata_keys: string[];
};

export type TemplatePack = {
  key: string;
  name: string;
  description: string;
  icon: string;
  sampleTypes: PackSampleType[];
  templates: PackTemplate[];
};

export const TEMPLATE_PACKS: TemplatePack[] = [
  {
    key: "biologia_molecular",
    name: "Biología molecular",
    description: "Ácidos nucleicos, PCR, geles, Western blot y clonación.",
    icon: "dna",
    sampleTypes: [
      {
        key: "muestra_rna",
        label: "Muestra de RNA",
        parent_keys: ["tejido", "linea_celular"],
        metadata_keys: ["concentración ng/µL", "A260/280", "RIN"],
      },
      {
        key: "muestra_dna",
        label: "Muestra de DNA",
        parent_keys: ["tejido", "linea_celular", "cepa_bacteriana"],
        metadata_keys: ["concentración ng/µL", "A260/280"],
      },
      {
        key: "cdna",
        label: "cDNA",
        parent_keys: ["muestra_rna"],
        metadata_keys: ["ng de RNA de entrada"],
      },
      {
        key: "plasmido",
        label: "Plásmido",
        parent_keys: ["cepa_bacteriana"],
        metadata_keys: ["inserto", "resistencia", "concentración ng/µL", "secuenciado"],
      },
      {
        key: "cepa_bacteriana",
        label: "Cepa bacteriana",
        parent_keys: [],
        metadata_keys: ["especie", "genotipo", "resistencia", "glicerol a −80 °C"],
      },
      {
        key: "lisado_proteina",
        label: "Lisado de proteína",
        parent_keys: ["tejido", "linea_celular"],
        metadata_keys: ["buffer de lisis", "concentración µg/µL"],
      },
    ],
    templates: [
      {
        name: "Extracción de RNA",
        activity_type: "extraccion_rna",
        description: "RNA total (TRIzol o columna).",
        icon: "test-tube",
        color: "sky",
        fields: [
          sample("muestras", "Muestras de origen", "tejido", { multiple: true, required: true }),
          sel("metodo", "Método", ["TRIzol", "Columna (kit)", "Otro"]),
          reagent("kit", "Kit / reactivo"),
          bool("dnasa", "Tratamiento con DNasa"),
          sample("rna", "RNA obtenido", "muestra_rna", { multiple: true, role: "producida" }),
          num("concentracion", "Concentración promedio", "ng/µL"),
          num("a260_280", "A260/280", undefined, { expected: 2 }),
          num("a260_230", "A260/230"),
          text("almacenamiento", "Almacenamiento", { expected: "−80 °C" }),
        ],
      },
      {
        name: "Extracción de DNA / miniprep",
        activity_type: "extraccion_dna",
        description: "DNA genómico o plasmídico.",
        icon: "test-tube",
        color: "teal",
        fields: [
          sample("origen", "Origen", "cepa_bacteriana", { multiple: true, required: true }),
          sel("tipo", "Tipo", ["Plásmido (miniprep)", "Plásmido (midi/maxi)", "Genómico"]),
          reagent("kit", "Kit"),
          num("volumen_cultivo", "Volumen de cultivo", "mL"),
          sample("producto", "DNA obtenido", "plasmido", { multiple: true, role: "producida" }),
          num("concentracion", "Concentración", "ng/µL"),
          num("a260_280", "A260/280", undefined, { expected: 1.8 }),
          num("volumen_elucion", "Volumen de elución", "µL"),
        ],
      },
      {
        name: "PCR",
        activity_type: "pcr",
        description: "PCR punto final.",
        icon: "dna",
        color: "violet",
        fields: [
          sample("templado", "Templado", "muestra_dna", { multiple: true, required: true }),
          text("cebadores", "Cebadores (F/R)", { required: true }),
          reagent("polimerasa", "Polimerasa / master mix"),
          num("volumen_reaccion", "Volumen de reacción", "µL", { expected: 25 }),
          num("tm_alineamiento", "Temperatura de alineamiento", "°C"),
          dur("extension", "Tiempo de extensión"),
          num("ciclos", "Ciclos", undefined, { expected: 35 }),
          text("termociclador", "Termociclador"),
          text("tamano_esperado", "Tamaño esperado (pb)"),
          bool("control_negativo", "Control sin templado"),
        ],
      },
      {
        name: "qPCR",
        activity_type: "qpcr",
        description: "PCR cuantitativa / RT-qPCR.",
        icon: "activity",
        color: "indigo",
        fields: [
          sample("cdna", "cDNA", "cdna", { multiple: true, required: true }),
          text("genes", "Genes blanco", { required: true }),
          text("referencia", "Gen(es) de referencia"),
          reagent("master_mix", "Master mix (SYBR/TaqMan)"),
          sel("formato", "Formato de placa", ["96 pozos", "384 pozos"]),
          num("replicas", "Réplicas técnicas", undefined, { expected: 3 }),
          text("equipo", "Equipo"),
          bool("curva_fusion", "Curva de fusión"),
          num("eficiencia", "Eficiencia", "%"),
          text("archivo", "Archivo de corrida"),
        ],
      },
      {
        name: "Gel de agarosa",
        activity_type: "gel_agarosa",
        description: "Electroforesis de ácidos nucleicos.",
        icon: "layers",
        color: "slate",
        fields: [
          sample("muestras", "Muestras", "muestra_dna", { multiple: true }),
          num("agarosa", "Agarosa", "%", { expected: 1 }),
          text("buffer", "Buffer", { expected: "TAE 1X" }),
          text("marcador", "Marcador de peso molecular"),
          reagent("tincion", "Tinción (SYBR Safe, BrEt…)"),
          num("voltaje", "Voltaje", "V"),
          dur("duracion", "Duración"),
          long("bandas", "Bandas observadas"),
        ],
      },
      {
        name: "Western blot",
        activity_type: "western_blot",
        description: "SDS-PAGE, transferencia e inmunodetección.",
        icon: "layers",
        color: "pink",
        fields: [
          sample("lisados", "Lisados", "lisado_proteina", { multiple: true, required: true }),
          num("proteina_carril", "Proteína por carril", "µg"),
          num("acrilamida", "Gel de acrilamida", "%"),
          sel("membrana", "Membrana", ["PVDF", "Nitrocelulosa"]),
          sel("transferencia", "Transferencia", ["Húmeda", "Semiseca", "Rápida"]),
          text("bloqueo", "Bloqueo", { expected: "Leche 5 % en TBST" }),
          reagent("primario", "Anticuerpo primario", { multiple: true, required: true }),
          reagent("secundario", "Anticuerpo secundario"),
          sel("deteccion", "Detección", ["ECL", "Fluorescencia", "Colorimétrica"]),
          steps("pasos", "Pasos", [
            ["Electroforesis", 90 * MIN],
            ["Transferencia", 60 * MIN],
            ["Bloqueo", 60 * MIN],
            ["Primario (4 °C, toda la noche)", 16 * H],
            ["Lavados TBST 3 × 10 min", 30 * MIN],
            ["Secundario", 60 * MIN],
            ["Lavados TBST 3 × 10 min", 30 * MIN],
            ["Revelado"],
          ]),
          text("imagen", "Imagen / archivo"),
        ],
      },
      {
        name: "Transformación bacteriana",
        activity_type: "transformacion",
        description: "Choque térmico o electroporación.",
        icon: "bug",
        color: "lime",
        fields: [
          sample("plasmido", "Plásmido", "plasmido", { required: true }),
          sample("cepa", "Cepa competente", "cepa_bacteriana"),
          sel("metodo", "Método", ["Choque térmico", "Electroporación"]),
          num("dna", "DNA", "ng"),
          text("seleccion", "Antibiótico de selección"),
          num("colonias", "Colonias obtenidas"),
          sample("clones", "Clones seleccionados", "cepa_bacteriana", {
            multiple: true,
            role: "producida",
          }),
        ],
      },
    ],
  },
  {
    key: "inmunologia",
    name: "Inmunología",
    description: "ELISA, citometría de flujo e inmunización.",
    icon: "droplet",
    sampleTypes: [
      {
        key: "suero",
        label: "Suero / plasma",
        parent_keys: ["animal"],
        metadata_keys: ["volumen µL", "anticoagulante", "alícuotas"],
      },
      {
        key: "suspension_celular",
        label: "Suspensión celular",
        parent_keys: ["animal", "tejido", "linea_celular"],
        metadata_keys: ["células/mL", "viabilidad %"],
      },
      {
        key: "placa",
        label: "Placa",
        parent_keys: [],
        metadata_keys: ["formato", "mapa de placa"],
      },
    ],
    templates: [
      {
        name: "ELISA",
        activity_type: "elisa",
        description: "ELISA sándwich o indirecto.",
        icon: "grid-3x3",
        color: "amber",
        fields: [
          sample("muestras", "Muestras", "suero", { multiple: true, required: true }),
          text("analito", "Analito", { required: true }),
          reagent("kit", "Kit"),
          sample("placa", "Placa", "placa", { role: "producida" }),
          text("diluciones", "Dilución de muestras"),
          text("curva", "Curva estándar (rango)"),
          steps("pasos", "Pasos", [
            ["Recubrimiento / captura", 2 * H],
            ["Bloqueo", 60 * MIN],
            ["Muestras y estándares", 2 * H],
            ["Detección", 60 * MIN],
            ["Enzima / estreptavidina-HRP", 30 * MIN],
            ["Sustrato TMB", 15 * MIN],
            ["Lectura"],
          ]),
          num("longitud_onda", "Longitud de onda", "nm", { expected: 450 }),
          num("r2", "R² de la curva"),
          text("archivo", "Archivo del lector"),
        ],
      },
      {
        name: "Citometría de flujo",
        activity_type: "citometria",
        description: "Tinción de superficie / intracelular y adquisición.",
        icon: "waves",
        color: "violet",
        fields: [
          sample("muestras", "Muestras", "suspension_celular", { multiple: true, required: true }),
          long("panel", "Panel (marcador – fluorocromo)", { required: true }),
          reagent("anticuerpos", "Anticuerpos", { multiple: true }),
          bool("viabilidad", "Colorante de viabilidad"),
          bool("fc_block", "Bloqueo Fc"),
          bool("fijacion", "Fijación/permeabilización"),
          text("controles", "Controles (FMO, isotipo, compensación)"),
          text("citometro", "Citómetro"),
          num("eventos", "Eventos adquiridos"),
          text("archivo", "Carpeta de archivos FCS"),
        ],
      },
      {
        name: "Inmunización",
        activity_type: "inmunizacion",
        description: "Esquema de inmunización de animales.",
        icon: "syringe",
        color: "red",
        fields: [
          sample("animales", "Animales", "animal", { multiple: true, required: true }),
          text("antigeno", "Antígeno", { required: true }),
          reagent("adyuvante", "Adyuvante"),
          num("dosis", "Dosis", "µg"),
          sel("via", "Vía", [
            "Subcutánea",
            "Intraperitoneal",
            "Intramuscular",
            "Intranasal",
            "Otra",
          ]),
          sel("numero", "Número de dosis", ["Primaria", "Refuerzo 1", "Refuerzo 2", "Refuerzo 3"]),
          long("observaciones_animal", "Observaciones de los animales"),
        ],
      },
      {
        name: "Aislamiento de células",
        activity_type: "aislamiento_celulas",
        description: "PBMC, esplenocitos u otras suspensiones.",
        icon: "droplets",
        color: "orange",
        fields: [
          sample("origen", "Origen", "animal", { multiple: true, required: true }),
          sel("tipo", "Tipo", ["PBMC", "Esplenocitos", "Médula ósea", "Ganglio", "Otro"]),
          text("metodo", "Método (Ficoll, lisis de eritrocitos…)"),
          sample("suspension", "Suspensión obtenida", "suspension_celular", {
            multiple: true,
            role: "producida",
          }),
          num("rendimiento", "Células totales", "×10⁶"),
          num("viabilidad", "Viabilidad", "%"),
        ],
      },
    ],
  },
  {
    key: "conducta",
    name: "Conducta",
    description: "Pruebas conductuales en roedores.",
    icon: "rat",
    sampleTypes: [
      {
        key: "video",
        label: "Video de sesión",
        parent_keys: ["animal"],
        metadata_keys: ["archivo", "software de análisis"],
      },
      {
        key: "cohorte",
        label: "Cohorte",
        parent_keys: [],
        metadata_keys: ["edad", "grupos", "n por grupo"],
      },
    ],
    templates: [
      {
        name: "Campo abierto",
        activity_type: "campo_abierto",
        description: "Actividad locomotora y ansiedad.",
        icon: "rat",
        color: "emerald",
        fields: [
          sample("animal", "Animal", "animal", { required: true }),
          text("grupo", "Grupo / tratamiento"),
          dur("duracion", "Duración de la sesión", { expected: 10 * MIN }),
          num("iluminacion", "Iluminación", "lux"),
          time("hora", "Hora de la prueba"),
          num("distancia", "Distancia recorrida", "cm"),
          num("tiempo_centro", "Tiempo en el centro", "s"),
          num("rearing", "Levantamientos (rearing)"),
          sample("video", "Video", "video", { role: "producida" }),
          long("incidencias", "Incidencias"),
        ],
      },
      {
        name: "Laberinto acuático de Morris",
        activity_type: "morris",
        description: "Aprendizaje y memoria espacial.",
        icon: "waves",
        color: "sky",
        fields: [
          sample("animal", "Animal", "animal", { required: true }),
          sel(
            "fase",
            "Fase",
            ["Habituación", "Adquisición", "Prueba (probe)", "Plataforma visible", "Reversa"],
            { required: true },
          ),
          num("dia", "Día"),
          num("ensayos", "Ensayos", undefined, { expected: 4 }),
          num("temperatura_agua", "Temperatura del agua", "°C", { expected: 22 }),
          num("latencia", "Latencia promedio", "s"),
          num("tiempo_cuadrante", "Tiempo en cuadrante blanco", "%"),
          num("cruces", "Cruces por la plataforma"),
          num("velocidad", "Velocidad de nado", "cm/s"),
          sample("video", "Video", "video", { role: "producida" }),
        ],
      },
      {
        name: "Laberinto de Barnes",
        activity_type: "barnes",
        description: "Memoria espacial en seco.",
        icon: "grid-3x3",
        color: "teal",
        fields: [
          sample("animal", "Animal", "animal", { required: true }),
          sel("fase", "Fase", ["Habituación", "Adquisición", "Prueba", "Reversa"], {
            required: true,
          }),
          num("dia", "Día"),
          num("latencia", "Latencia primaria", "s"),
          num("errores", "Errores primarios"),
          sel("estrategia", "Estrategia", ["Directa", "Serial", "Aleatoria"]),
          sample("video", "Video", "video", { role: "producida" }),
        ],
      },
      {
        name: "Reconocimiento de objeto novedoso",
        activity_type: "nor",
        description: "Memoria de reconocimiento.",
        icon: "eye",
        color: "amber",
        fields: [
          sample("animal", "Animal", "animal", { required: true }),
          sel("fase", "Fase", ["Habituación", "Familiarización", "Prueba"], { required: true }),
          dur("intervalo", "Intervalo de retención"),
          text("objetos", "Objetos (familiar / novedoso)"),
          num("exploracion_familiar", "Exploración del familiar", "s"),
          num("exploracion_novedoso", "Exploración del novedoso", "s"),
          num("indice", "Índice de discriminación"),
          sample("video", "Video", "video", { role: "producida" }),
        ],
      },
      {
        name: "Laberinto en Y",
        activity_type: "laberinto_y",
        description: "Alternancia espontánea.",
        icon: "triangle",
        color: "indigo",
        fields: [
          sample("animal", "Animal", "animal", { required: true }),
          dur("duracion", "Duración", { expected: 8 * MIN }),
          num("entradas", "Entradas a brazos"),
          num("alternancias", "Alternancias"),
          num("porcentaje", "Alternancia espontánea", "%"),
          sample("video", "Video", "video", { role: "producida" }),
        ],
      },
      {
        name: "Rotarod",
        activity_type: "rotarod",
        description: "Coordinación motora.",
        icon: "activity",
        color: "red",
        fields: [
          sample("animal", "Animal", "animal", { required: true }),
          sel("protocolo", "Protocolo", ["Velocidad fija", "Aceleración"]),
          text("velocidad", "Velocidad / rampa (rpm)"),
          num("ensayos", "Ensayos", undefined, { expected: 3 }),
          num("latencia_caida", "Latencia de caída promedio", "s"),
        ],
      },
    ],
  },
  {
    key: "cultivo_celular",
    name: "Cultivo celular",
    description: "Mantenimiento, congelación, transfección y tratamientos.",
    icon: "flask-round",
    sampleTypes: [
      {
        key: "linea_celular",
        label: "Línea celular",
        parent_keys: [],
        metadata_keys: ["origen", "medio", "pasaje", "micoplasma"],
      },
      {
        key: "frasco_cultivo",
        label: "Frasco / placa de cultivo",
        parent_keys: ["linea_celular"],
        metadata_keys: ["formato", "pasaje", "confluencia"],
      },
      {
        key: "vial_congelado",
        label: "Vial congelado",
        parent_keys: ["linea_celular", "frasco_cultivo"],
        metadata_keys: ["células/vial", "pasaje", "caja / posición"],
      },
    ],
    templates: [
      {
        name: "Pasaje celular",
        activity_type: "pasaje",
        description: "Subcultivo.",
        icon: "flask-round",
        color: "emerald",
        fields: [
          sample("linea", "Línea celular", "linea_celular", { required: true }),
          num("pasaje", "Pasaje", undefined, { required: true }),
          num("confluencia", "Confluencia previa", "%"),
          reagent("disociacion", "Disociación (tripsina…)"),
          num("conteo", "Células contadas", "×10⁶/mL"),
          num("viabilidad", "Viabilidad", "%"),
          text("dilucion", "Dilución de siembra (1:X)"),
          reagent("medio", "Medio"),
          sample("frascos", "Frascos sembrados", "frasco_cultivo", {
            multiple: true,
            role: "producida",
          }),
          bool("contaminacion", "¿Contaminación?"),
        ],
      },
      {
        name: "Descongelación",
        activity_type: "descongelacion",
        description: "Arranque desde vial congelado.",
        icon: "thermometer",
        color: "orange",
        fields: [
          sample("vial", "Vial", "vial_congelado", { required: true }),
          reagent("medio", "Medio"),
          bool("centrifugado", "Centrifugado para retirar DMSO"),
          sample("frasco", "Frasco", "frasco_cultivo", { role: "producida" }),
          num("viabilidad", "Viabilidad", "%"),
        ],
      },
      {
        name: "Congelación",
        activity_type: "congelacion",
        description: "Stock en nitrógeno o −80 °C.",
        icon: "snowflake",
        color: "sky",
        fields: [
          sample("origen", "Origen", "frasco_cultivo", { multiple: true, required: true }),
          num("pasaje", "Pasaje"),
          reagent("medio_congelacion", "Medio de congelación"),
          num("celulas_vial", "Células por vial", "×10⁶"),
          sample("viales", "Viales", "vial_congelado", { multiple: true, role: "producida" }),
          text("ubicacion", "Ubicación (tanque / caja)"),
        ],
      },
      {
        name: "Transfección",
        activity_type: "transfeccion",
        description: "Lipofección, electroporación o transducción.",
        icon: "pipette",
        color: "violet",
        fields: [
          sample("celulas", "Células", "frasco_cultivo", { multiple: true, required: true }),
          sample("plasmido", "Plásmido / construcción", "plasmido", { multiple: true }),
          reagent("reactivo", "Reactivo de transfección"),
          num("dna", "DNA por pozo", "µg"),
          text("relacion", "Relación reactivo:DNA"),
          dur("tiempo_expresion", "Tiempo de expresión"),
          num("eficiencia", "Eficiencia", "%"),
        ],
      },
      {
        name: "Tratamiento de células",
        activity_type: "tratamiento_celulas",
        description: "Compuestos, estímulos o condiciones.",
        icon: "beaker",
        color: "pink",
        fields: [
          sample("celulas", "Células", "frasco_cultivo", { multiple: true, required: true }),
          text("compuesto", "Compuesto / estímulo", { required: true }),
          text("concentraciones", "Concentraciones"),
          text("vehiculo", "Vehículo / control"),
          dur("duracion", "Duración del tratamiento"),
          num("replicas", "Réplicas"),
          long("observaciones_celulas", "Morfología / observaciones"),
        ],
      },
    ],
  },
  {
    key: "histologia",
    name: "Histología (adicionales)",
    description: "Además de las plantillas iniciales: inmunofluorescencia, H-E, Nissl y cortes.",
    icon: "microscope",
    sampleTypes: [],
    templates: [
      {
        name: "Inmunofluorescencia",
        activity_type: "inmunofluorescencia",
        description: "IF en cortes o células.",
        icon: "microscope",
        color: "indigo",
        fields: [
          sample("cortes", "Cortes / laminillas", "laminilla", { multiple: true, required: true }),
          text("bloqueo", "Bloqueo"),
          reagent("primarios", "Anticuerpos primarios", { multiple: true, required: true }),
          reagent("secundarios", "Anticuerpos secundarios", { multiple: true }),
          bool("dapi", "DAPI / Hoechst"),
          text("montaje", "Medio de montaje"),
          steps("pasos", "Pasos", [
            ["Permeabilización / bloqueo", 60 * MIN],
            ["Primario (4 °C, toda la noche)", 16 * H],
            ["Lavados PBS 3 × 10 min", 30 * MIN],
            ["Secundario", 2 * H],
            ["Lavados PBS 3 × 10 min", 30 * MIN],
            ["Contratinción y montaje"],
          ]),
          text("microscopio", "Microscopio / objetivos"),
        ],
      },
      {
        name: "Hematoxilina-eosina",
        activity_type: "he",
        description: "Tinción H-E.",
        icon: "droplets",
        color: "pink",
        fields: [
          sample("laminillas", "Laminillas", "laminilla", { multiple: true, required: true }),
          steps("pasos", "Pasos", [
            ["Desparafinar e hidratar"],
            ["Hematoxilina", 5 * MIN],
            ["Diferenciación / azuleo"],
            ["Eosina", 1 * MIN],
            ["Deshidratar y aclarar"],
            ["Montaje"],
          ]),
          rating("calidad", "Calidad de la tinción"),
        ],
      },
      {
        name: "Tinción de Nissl",
        activity_type: "nissl",
        description: "Violeta de cresilo / azul de toluidina.",
        icon: "brain",
        color: "violet",
        fields: [
          sample("laminillas", "Laminillas", "laminilla", { multiple: true, required: true }),
          reagent("colorante", "Colorante"),
          dur("tiempo_tincion", "Tiempo de tinción"),
          rating("calidad", "Calidad de la tinción"),
        ],
      },
      {
        name: "Corte en criostato / vibratomo",
        activity_type: "criocorte",
        description: "Cortes de tejido fijado.",
        icon: "slice",
        color: "cyan",
        fields: [
          sample("tejido", "Tejido", "tejido", { required: true }),
          sel("equipo", "Equipo", ["Criostato", "Vibratomo", "Micrótomo"]),
          num("grosor", "Grosor", "µm"),
          num("temperatura", "Temperatura de cámara", "°C"),
          text("region", "Región / coordenadas"),
          sel("destino", "Destino de los cortes", [
            "Flotantes en PBS",
            "Laminillas",
            "Crioprotector −20 °C",
          ]),
          sample("laminillas", "Laminillas producidas", "laminilla", {
            multiple: true,
            role: "producida",
          }),
          multi("problemas", "Problemas", ["rayas", "rotura", "enrollado", "grosor irregular"]),
        ],
      },
    ],
  },
];
