/**
 * Release gates P1 de V4.9.2.
 *
 * Estas pruebas cubren fallos de semántica y de alcance que una captura no
 * detecta: precisión temporal, reentradas asíncronas, aislamiento del producto
 * nativo y resolución real de módulos por plataforma. No fijan píxeles ni
 * snapshots del JSX.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { cumplelunaView } from "../src/domain/layers";
import { createRefreshQueue } from "../src/domain/refreshQueue";
import type { CumplelunaData } from "../src/services/layersApi";
import { savePerson } from "../convex/relationships";
import {
  ROOT,
  importsOf,
  reachableFrom,
  resolveEntryForPlatform
} from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const relativo = (absolute: string) => relative(ROOT, absolute);
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function seccion(source: string, desde: string, hasta?: string): string {
  const inicio = source.indexOf(desde);
  assert.ok(inicio >= 0, `no se encontró «${desde}»`);
  const fin = hasta ? source.indexOf(hasta, inicio + desde.length) : source.length;
  assert.ok(fin > inicio, hasta ? `no se encontró «${hasta}» después de «${desde}»` : desde);
  return source.slice(inicio, fin);
}

function rutasNativas(dir = join(ROOT, "app")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) return rutasNativas(absolute);
    if (!/\.(?:ts|tsx|js|jsx)$/.test(entry.name) || /\.web\.[^.]+$/.test(entry.name)) return [];
    return [relative(ROOT, absolute)];
  });
}

// ---------------------------------------------------------------------------
// Precisión visible

function cumplelunaConVentanas(): CumplelunaData {
  const previousExactAt = Date.UTC(2026, 7, 15, 3, 10);
  const nextExactAt = Date.UTC(2026, 8, 13, 16, 30);
  return {
    kind: "cumpleluna",
    natalElongationDegrees: 108,
    natalElongationRangeDegrees: { from: 106.2, to: 109.8 },
    currentElongationDegrees: 111,
    previousExactAt,
    nextExactAt,
    previousExactAtRange: {
      earliest: Date.UTC(2026, 7, 14, 18),
      latest: Date.UTC(2026, 7, 16, 12)
    },
    nextExactAtRange: {
      earliest: Date.UTC(2026, 8, 12, 21),
      latest: Date.UTC(2026, 8, 14, 10)
    },
    daysRemaining: 28.77,
    daysRemainingRange: { from: 28.1, to: 29.7 },
    cycleDay: 0.78,
    cycleDayRange: { from: 0.1, to: 1.8 },
    cycleLengthDays: 29.55,
    cycleLengthDaysRange: { from: 29.3, to: 29.8 },
    progress: 0.026,
    progressRange: { from: 0.004, to: 0.061 },
    summary: "Fixture de precisión visible."
  };
}

test("Cumpleluna sólo publica una hora cuando la precisión del sobre es exacta", () => {
  const data = cumplelunaConVentanas();
  const nowMs = Date.UTC(2026, 7, 16, 18);

  const exacta = cumplelunaView(data, "exact", nowMs, "UTC");
  assert.match(exacta.nextExact, /\b16:30\b/, "una raíz exacta sí puede decir su hora");

  for (const precision of ["estimated", "range"] as const) {
    const vista = cumplelunaView(data, precision, nowMs, "UTC");
    assert.match(vista.nextExact, /entre el/i, `${precision}: debe decir la ventana entera`);
    assert.doesNotMatch(
      `${vista.nextWhen} ${vista.nextExact}`,
      /\b\d{1,2}:\d{2}\b/,
      `${precision}: los bordes del rango no son una hora exacta del evento`
    );
  }

  // El canon renombró la tarjeta a `CumplelunaBloque` —Hoy dejó de usar tarjetas—
  // y quitó `capitalize`; el ancla se mueve, la garantía no.
  const hoy = seccion(
    sinComentarios(leer("src/screens/v492/HoyScreen.tsx")),
    "function CumplelunaBloque",
    "\nfunction cumplelunaCuando"
  );
  const exactFlag = /const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*precision\s*===\s*["']exact["']/.exec(hoy)?.[1];
  const localTime = /const\s+horaDeHoy\s*=([\s\S]{0,360}?)\bformatLocalTime\s*\(/.exec(hoy)?.[1] ?? "";
  assert.ok(
    /precision\s*===\s*["']exact["']/.test(localTime) ||
      (exactFlag !== undefined && new RegExp(`\\b${exactFlag}\\b`).test(localTime)),
    "la tarjeta de Hoy no puede convertir el centro de una ventana estimada en una hora puntual"
  );
});

test("Tu momento no verbaliza un porcentaje puntual cuando el sobre está estimado o en rango", () => {
  const source = sinComentarios(leer("src/screens/v492/TransitosLayersScreen.tsx"));
  const estacion = seccion(source, "function EstacionVital", "function anoDeFase");

  // El componente recibe la precisión y distingue la rama acotada. La garantía
  // es la misma de antes —ningún porcentaje puntual fuera de la rama exacta—
  // pero se verifica sobre la variable que realmente lo produce, en vez de sobre
  // un nombre de helper (`progreso`, `acotado`) que el rediseño renombró.
  const exactFlag = /const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*precision\s*===\s*["']exact["']/.exec(
    estacion
  )?.[1];
  assert.ok(exactFlag, "la estación necesita una rama visible para la precisión exacta");

  const puntual = new RegExp(
    `const\\s+([A-Za-z][A-Za-z0-9]*)\\s*=\\s*[\\s\\S]{0,80}?\\b${exactFlag}\\b\\s*&&`
  ).exec(estacion)?.[1];
  assert.ok(puntual, "el avance puntual tiene que colgar de la precisión exacta");

  const puntualesImpresos = [
    ...estacion.matchAll(new RegExp(`formatPercent\\s*\\(\\s*${puntual}\\s*\\)`, "g"))
  ];
  assert.ok(puntualesImpresos.length > 0, "el avance exacto sí se muestra cuando existe");
  for (const match of puntualesImpresos) {
    const antes = estacion.slice(Math.max(0, match.index - 500), match.index);
    assert.match(
      antes,
      new RegExp(`${puntual}\\s*!==\\s*null`),
      "cada porcentaje visible de la estación debe quedar detrás de la rama exacta"
    );
  }
  // Y la rama imprecisa publica un INTERVALO, con el motivo al lado.
  assert.match(estacion, /progressRange/);
  assert.match(
    estacion,
    /AVANCE ENTRE[\s\S]{0,140}SIN HORA NO HAY UN PUNTO/i,
    "la rama imprecisa necesita una descripción no puntual"
  );

  const montajeMandala = /<Mandala\b[\s\S]{0,240}?precision=\{temporalMandala\.precision\}/.test(source);
  const mandala = seccion(source, "function Mandala", "const styles");
  assert.ok(montajeMandala, "el Mandala necesita la precisión de su propio sobre");
  // La precisión llega hasta el disco, que es el único que la necesita: es lo
  // que decide si un anillo dibuja un punto o la franja donde ese punto puede
  // caer. La leyenda de abajo ya no imprime NINGÚN avance —ni puntual ni
  // acotado—, así que no puede verbalizar un porcentaje que el sobre no
  // sostiene: la garantía pasó de "separar las ramas" a "no tener ninguna".
  assert.match(mandala, /<TemporalMandalaDial[\s\S]{0,120}?precision=\{precision\}/);
  assert.doesNotMatch(mandala, /formatPercent|progress/i);
});

// ---------------------------------------------------------------------------
// Reentradas e idempotencia

function refsConMutex(source: string): string[] {
  const refs = [...source.matchAll(/const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*useRef(?:<[^;=()]+>)?\s*\(/g)].map(
    (match) => match[1]
  );
  return refs.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const guard = new RegExp(`if\\s*\\([^)]*\\b${escaped}\\.current\\b[^)]*\\)\\s*(?:\\{\\s*)?return`).test(source);
    const take = new RegExp(`\\b${escaped}\\.current\\s*=\\s*(?:true|[^;\\n]*(?:Promise|refreshForDate|savePerson))`).test(source);
    const release = new RegExp(`\\b${escaped}\\.current\\s*=\\s*(?:false|null|undefined)`).test(source);
    return guard && take && release;
  });
}

test("useLayers mantiene un solo refreshForDate en vuelo", async () => {
  // La clave de request evita repetir un pedido IDÉNTICO, pero no alcanza: hace
  // falta un single-flight que también bloquee intentos nuevos mientras la
  // action anterior sigue viva. Vive en `src/domain/refreshQueue.ts`, así que se
  // prueba corriéndolo —contando acciones— en vez de buscando un ref.
  const corridas: Array<() => void> = [];
  const cola = createRefreshQueue({
    run: () => new Promise<void>((resolve) => corridas.push(resolve)),
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: () => undefined
  });
  cola.request({ localDate: "2026-08-17", timezone: "UTC" });
  cola.request({ localDate: "2026-08-18", timezone: "UTC" });
  cola.request({ localDate: "2026-08-19", timezone: "UTC" });
  assert.equal(corridas.length, 1, "tres pedidos distintos, una sola action viva");

  corridas[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(corridas.length, 2, "al terminar corre lo pendiente…");
  corridas[1]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(corridas.length, 2, "…y sólo lo último, no una fila de tres");

  // Y el hook usa ESA cola, sin abrir ningún camino paralelo a la action.
  const source = seccion(
    sinComentarios(leer("src/hooks/useLayers.tsx")),
    "function LayersProviderInner",
    "export function useNatalBase"
  );
  assert.match(source, /createRefreshQueue\(/, "el single-flight es el compartido");
  assert.equal(
    (source.match(/refreshForDate\s*\(/g) ?? []).length,
    0,
    "ninguna llamada directa a la action fuera de la cola"
  );
});

type MemoryDoc = Record<string, unknown> & { _id: string };

function memoryMutationContext() {
  const tables = new Map<string, MemoryDoc[]>();
  tables.set("users", [
    {
      _id: "user-1",
      tokenIdentifier: "token-1",
      locale: "es-AR",
      createdAt: 1,
      updatedAt: 1
    }
  ]);
  let serial = 0;

  const rows = (table: string) => {
    const existing = tables.get(table);
    if (existing) return existing;
    const created: MemoryDoc[] = [];
    tables.set(table, created);
    return created;
  };

  const db = {
    query(table: string) {
      let filters: Array<[string, unknown]> = [];
      let direction: "asc" | "desc" = "asc";
      const chain = {
        withIndex(_name: string, callback: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) {
          const q = {
            eq(field: string, value: unknown) {
              filters.push([field, value]);
              return q;
            }
          };
          callback(q);
          return chain;
        },
        filter(callback: (q: { eq: (left: unknown, right: unknown) => boolean; field: (field: string) => unknown }) => boolean) {
          // Suficiente para los filtros de igualdad que podría usar la
          // deduplicación; los índices siguen siendo el camino preferido.
          const probe = {
            eq(left: unknown, right: unknown) {
              return left === right;
            },
            field(field: string) {
              return { __field: field };
            }
          };
          const before = rows(table);
          const accepted = before.filter((doc) =>
            callback({
              ...probe,
              field(field: string) {
                return doc[field];
              }
            })
          );
          filters = [["_id", new Set(accepted.map((doc) => doc._id))]];
          return chain;
        },
        order(next: "asc" | "desc") {
          direction = next;
          return chain;
        },
        async collect() {
          const found = rows(table).filter((doc) =>
            filters.every(([field, value]) =>
              value instanceof Set ? value.has(doc._id) : doc[field] === value
            )
          );
          return direction === "desc" ? [...found].reverse() : found;
        },
        async first() {
          return (await chain.collect())[0] ?? null;
        },
        async unique() {
          const found = await chain.collect();
          if (found.length > 1) throw new Error("Expected at most one row");
          return found[0] ?? null;
        }
      };
      return chain;
    },
    async insert(table: string, value: Record<string, unknown>) {
      const doc = { ...value, _id: `${table}-${++serial}` };
      rows(table).push(doc);
      return doc._id;
    },
    async get(id: string) {
      for (const table of tables.values()) {
        const found = table.find((doc) => doc._id === id);
        if (found) return found;
      }
      return null;
    },
    async patch(id: string, value: Record<string, unknown>) {
      const doc = await db.get(id);
      if (!doc) throw new Error(`Missing ${id}`);
      Object.assign(doc, value);
    },
    normalizeId(_table: string, id: string) {
      return id;
    }
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () => ({ tokenIdentifier: "token-1", subject: "subject-1" })
      },
      db
    },
    tables
  };
}

test("Guardar persona usa mutex sincrónico y una clave idempotente de extremo a extremo", async () => {
  const screen = seccion(
    sinComentarios(leer("src/screens/v492/VinculosConnectScreen.tsx")),
    "function ConnectForm",
    "const styles"
  );
  const saveBlock = seccion(screen, "const save = async", "const nivel");
  const mutexes = refsConMutex(screen);
  assert.ok(mutexes.length > 0, "saving es estado del render siguiente; el primer renglón del handler necesita un ref/mutex");

  const firstAwait = saveBlock.indexOf("await ");
  assert.ok(firstAwait >= 0, "Guardar debe persistir mediante una operación asíncrona");
  assert.ok(
    mutexes.some((name) => saveBlock.indexOf(`${name}.current = true`) >= 0 && saveBlock.indexOf(`${name}.current = true`) < firstAwait),
    "el mutex se toma sincrónicamente antes del primer await"
  );
  assert.match(saveBlock, /\bidempotencyKey\b/, "la mutation debe recibir la clave de este intento lógico");

  const backend = sinComentarios(leer("convex/relationships.ts"));
  assert.match(
    seccion(backend, "const savePersonArgs", "const relationshipPlacementWireValidator"),
    /\bidempotencyKey\s*:\s*v\.string\s*\(/,
    "la idempotencia forma parte del contrato público tipado"
  );

  // Prueba el resultado, no la tabla elegida para implementarlo: dos entregas
  // secuenciales de la misma intención deben devolver la misma persona y dejar
  // una sola fila personal.
  const { ctx, tables } = memoryMutationContext();
  const args = {
    idempotencyKey: "vinculo-fixture-2026-08-16",
    name: "Martina",
    birthTimePrecision: "unknown" as const,
    zodiacSign: "virgo"
  };
  const first = await (savePerson as any)._handler(ctx, args);
  const repeated = await (savePerson as any)._handler(ctx, args);
  assert.equal(repeated.profileId, first.profileId);
  assert.equal(tables.get("relationshipProfiles")?.length, 1);
});

// ---------------------------------------------------------------------------
// Producto nativo y rutas por plataforma

const LEGACY_WRAPPERS = [
  ["app/reading/calendario.tsx", "src/routes/v492/reading-calendario"],
  ["app/reading/carta.tsx", "src/routes/v492/reading-carta"],
  ["app/reading/deep-dive.tsx", "src/routes/v492/reading-deep-dive"],
  ["app/reading/long-read.tsx", "src/routes/v492/reading-long-read"],
  ["app/reading/luna.tsx", "src/routes/v492/reading-luna"],
  ["app/reading/rueda.tsx", "src/routes/v492/reading-rueda"],
  ["app/reading/saved.tsx", "src/routes/v492/reading-saved"],
  ["app/reading/topic.tsx", "src/routes/v492/reading-topic"],
  ["app/reading/transito.tsx", "src/routes/v492/reading-transito"],
  ["app/reading/transitos.tsx", "src/routes/v492/reading-transitos"],
  ["app/reading/valores.tsx", "src/routes/v492/reading-valores"],
  ["app/reading/vinculo-result.tsx", "src/routes/v492/reading-vinculo-result"],
  ["app/carta-full.tsx", "src/routes/v492/carta-full"],
  ["app/transito.tsx", "src/routes/v492/transito"],
  ["app/valores.tsx", "src/routes/v492/valores"]
] as const;

test("las rutas legadas son wrappers neutros y sus fallbacks nativos sólo redirigen", () => {
  for (const [entry, base] of LEGACY_WRAPPERS) {
    const wrapper = sinComentarios(leer(entry)).trim();
    const spec = "@/" + base.replace(/^src\//, "");
    assert.equal(wrapper, `export { default } from "${spec}";`, entry);

    const nativeImpl = relativo(resolveEntryForPlatform(entry, "native"));
    const webImpl = relativo(resolveEntryForPlatform(entry, "web"));
    assert.equal(nativeImpl, `${base}.tsx`, `${entry} nativo`);
    assert.equal(webImpl, `${base}.web.tsx`, `${entry} web`);
    assert.notEqual(nativeImpl, webImpl, `${entry}: las plataformas no pueden compartir la rama legacy`);

    const nativeSource = sinComentarios(leer(nativeImpl));
    assert.match(nativeSource, /<Redirect\s+href=["'][^"']+["']\s*\/>/, `${nativeImpl}: fallback explícito`);
    assert.doesNotMatch(nativeSource, /process\.env\.EXPO_OS|\bIS_WEB\b/);
    assert.deepEqual(
      importsOf(join(ROOT, nativeImpl)).filter((spec) => spec.startsWith("@/") || spec.startsWith(".")),
      [],
      `${nativeImpl}: un redirect nativo no debe arrastrar módulos del ritual legado`
    );
  }
});

test("la raíz de Tránsitos también delega a módulos platform-resolved", () => {
  const entry = "app/(tabs)/transitos/index.tsx";
  const wrapper = sinComentarios(leer(entry)).trim();
  assert.equal(wrapper, 'export { default } from "@/routes/v492/transitos-index";');
  assert.equal(relativo(resolveEntryForPlatform(entry, "native")), "src/routes/v492/transitos-index.tsx");
  assert.equal(relativo(resolveEntryForPlatform(entry, "web")), "src/routes/v492/transitos-index.web.tsx");

  const nativeGraph = reachableFrom([entry], "native");
  const webGraph = reachableFrom([entry], "web");
  assert.ok(nativeGraph.has("src/screens/v492/TransitosLayersScreen.tsx"));
  assert.ok(!webGraph.has("src/screens/v492/TransitosLayersScreen.tsx"));
  assert.ok(webGraph.has("src/screens/TransitosScreen.tsx"));
});

test("todo el grafo de rutas nativas V4.9.2 excluye Tarot, Diario y el checkout web", () => {
  // Expo Router registra todas las rutas de app/, no sólo la pestaña que una
  // persona abre primero. Auditar siete entradas ocultaba dependencias web que
  // Metro igualmente incorporaba por deep links históricos.
  //
  // Comercio nativo (2026-08-18): `/paywall` dejó de ser sinónimo de "embudo
  // web". La ruta se resuelve por plataforma —nativo abre la compra con
  // RevenueCat, web abre el checkout alojado de Stripe—, así que la garantía
  // que importa ya no es "ningún módulo nombra /paywall" sino que el grafo
  // NATIVO no alcance la implementación web ni su checkout: vender fuera de
  // la compra dentro de la app es exactamente lo que Apple rechaza.
  const graph = reachableFrom(rutasNativas(), "native");
  const forbiddenModules = [
    "src/screens/HomeScreen.tsx",
    "src/screens/DiarioScreen.tsx",
    "src/components/home/CartaDelDia.tsx",
    "src/components/diario/DiarioStrip.tsx",
    "src/components/diario/TarotStrip.tsx",
    "src/content/tarotDeck.ts",
    "src/content/tarotCatalog.ts",
    "src/domain/readingEngine.ts",
    "src/routes/v492/paywall.web.tsx",
    "src/components/web/orbita-paywall.tsx"
  ];
  for (const rel of forbiddenModules) {
    assert.ok(!graph.has(rel), `${rel}: módulo ajeno alcanzable desde una ruta nativa`);
  }
  for (const rel of graph) {
    if (!/\.(?:ts|tsx|js|jsx)$/.test(rel)) continue;
    const source = sinComentarios(leer(rel));
    // Declarar la firma en `appRefs` no vende nada; LLAMARLA sí. El grafo
    // nativo no puede tener ningún consumidor del checkout alojado.
    assert.doesNotMatch(
      source,
      /useAction\(\s*proposedApi\.createCheckoutSession/,
      `${rel}: checkout web alcanzable desde una ruta nativa`
    );
    assert.doesNotMatch(source, /\bTarot\b/i, `${rel}: promesa ajena al producto astrológico nativo`);
  }

  // La contraparte: en nativo, `/paywall` ES la compra con RevenueCat.
  assert.ok(graph.has("src/routes/v492/paywall.tsx"));
  assert.ok(graph.has("src/screens/v492/PlusPaywallScreen.tsx"));
});

test("la TabBar permite Dynamic Type sin reducir el tamaño elegido por la persona", () => {
  const source = sinComentarios(leer("src/components/orbita/TabBar.tsx"));
  assert.match(source, /accessibilityRole=["']tablist["']/);
  assert.match(source, /accessibilityRole=["']tab["']/);
  assert.doesNotMatch(source, /allowFontScaling=\{false\}/);
  assert.doesNotMatch(source, /\badjustsFontSizeToFit\b/);
  assert.doesNotMatch(source, /\bminimumFontScale\b/);
  assert.doesNotMatch(source, /numberOfLines=\{1\}/, "un label ampliado necesita poder ocupar dos líneas");

  const cap = /maxFontSizeMultiplier=\{([0-9.]+)\}/.exec(source);
  if (cap) {
    assert.ok(Number(cap[1]) >= 2, `el tope ${cap[1]}× no alcanza el tamaño accesible de iOS`);
  }
  assert.match(source, /minHeight:\s*44\b/, "cada tab conserva el objetivo táctil mínimo");
});
