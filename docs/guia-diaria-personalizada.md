# Guía diaria personalizada — motor de análisis (spec backend)

## Problema

Hoy la guía diaria de la Home sale de un **banco de frases fijas por signo**
(`src/content/signHomeBank.ts`, ej. "Estructura con ventana"). Son genéricas y
**sin contexto** — no analizan nada de la persona. Lucas: tiene que ser un
**análisis real, personalizado por usuario y por día**, descriptivo y con
contexto (nombrando el tránsito real sobre el placement real).

**Restricción clave (Lucas):** la API de astrología **no** entrega el análisis
diario por persona. Da posiciones planetarias; **cómo afecta a esta carta lo
tenemos que calcular e interpretar nosotros.** Es, efectivamente, un análisis
diario por cada usuario que entra.

## Qué hay que construir

Un motor que, por usuario y por día, produzca la guía diaria:

```
cielo de hoy (efemérides)  +  carta natal del usuario
        │                              │
        └──────────── aspectos tránsito → natal ───────────┘
                              │
                     ranking de relevancia
                              │
                     interpretación (LLM)
                              │
                  DailyGuidePayload (lo consume la Home)
```

### 1. Posiciones del día (efemérides) — compartidas entre usuarios
- Longitud eclíptica de cada planeta transitante HOY (Sol, Luna, Mercurio, Venus,
  Marte, Júpiter, Saturno; opcional Urano/Neptuno/Plutón).
- Fuente: AstrologyAPI (endpoint de posiciones/`planets`) **o** una lib de
  efemérides server-side (ej. `astronomy-engine`, sin API externa). La Luna se
  mueve ~13°/día → conviene recalcular por día (cachear por `localDate` global,
  no por usuario: es el mismo cielo para todos).

### 2. Aspectos tránsito → natal — por usuario
- Para cada planeta transitante, buscar aspectos a cada punto natal del usuario
  (Sol, Luna, Ascendente, MC, planetas): conjunción(0°)/oposición(180°)/
  trígono(120°)/cuadratura(90°)/sextil(60°), con orbe (≈ 3–6° según planeta).
- Reusar la matemática de aspectos que ya existe para la carta natal
  (`buildChartWheelData`/`mainAspects` en `convex/lib/orbita.ts`) — es el mismo
  cálculo, pero un set es "hoy" y el otro es la carta.
- **Ranking de relevancia**: priorizar aspectos a planetas personales (Sol/Luna/
  Asc), orbe ajustado (más apretado = más fuerte), y planetas rápidos (Luna/Sol/
  Venus/Mercurio → "el clima de hoy"; lentos → contexto de fondo). Tomar el
  **tránsito destacado** (1) + 2–3 secundarios.

### 3. Interpretación (LLM) — por usuario, cacheada 1/día
- Prompt con: los aspectos rankeados (ej. "Venus en Leo conjunción tu Sol natal en
  Leo, orbe 1°") + el contexto natal → generar la lectura **analítica y
  descriptiva** (el *por qué*, en criollo, voseo).
- Reusar el gateway ya probado (`convex/lib/aiGateway.ts`, patrón de `void.ask`/
  personalidad). Guardrails duros (AGENTS.md): entretenimiento + autoconocimiento,
  sin destino/salud/dinero/legal, voseo, sin inglés. Fallback determinístico si el
  LLM está off (composición a partir del aspecto destacado).
- **Cache**: 1 generación por `(userId, localDate)` (tabla nueva `dailyGuides`,
  índice `by_user_date`, patrón de `voidAnswers`). Costo controlado: efemérides
  compartidas + 1 LLM por usuario por día.

### 4. Payload que consume la Home
Forma sugerida (mapea a las secciones actuales de la Home — `SignalTop` +
`DailyGuide`):
```ts
type DailyGuidePayload = {
  headline: string;      // "Venus pasa por tu Sol"
  body: string;          // el análisis descriptivo (2–4 frases)
  clima: string;         // one-liner de clima
  destacado: { aspecto: string; lectura: string };   // el tránsito principal
  secundarios: Array<{ aspecto: string; lectura: string }>;  // trabajo/vínculos/energía
  hace?: string; evita?: string; energia?: string;   // opcional, si se mantiene la guía
  basadoEn: string[];    // ej. ["VENUS EN LEO △ TU SOL", ...] (transparencia)
  disclaimer: string;
};
```

### 5. Función pública
- `daily.getGuide({ localDate, timezone })` → `DailyGuidePayload` (action:
  genera+cachea, patrón `transits.getToday`). Read-path opcional `query` después.
- Env: las mismas del gateway (`ORBITA_LLM_ENABLED`, `AI_GATEWAY_API_KEY`,
  `ORBITA_LLM_MODEL`) + credenciales AstrologyAPI si se usa su endpoint de
  posiciones.

## Frontend (Claude)
- La Home consume `daily.getGuide` (live) con fallback al banco local para
  invitado/sin-LLM. `SignalTop` (headline/body/clima) y `DailyGuide` toman el
  payload. Mismo patrón `useLiveApp` + `useAction` + fallback que el resto.
- Contrato tipado en `src/services/appRefs.ts` (o `skyRefs.ts`) como
  `DailyGuidePayload`, consumido vía `anyApi` mientras el backend no esté deployado.

## Notas de costo / escala
- Efemérides: 1 cálculo por día global (no por usuario).
- Aspectos: baratos (matemática local, sin API).
- LLM: 1 por usuario por día, cacheado. Es el costo real → ok con cache.
- Sin sesión (invitado): se puede correr el mismo motor sobre `chartMock` + el
  cielo de hoy para una demo analítica (sin LLM, composición determinística).

## Verificación
- Dos usuarios distintos, mismo día → guías distintas (personalizadas).
- Mismo usuario, dos días → guías distintas (el cielo se movió).
- El texto nombra el tránsito real sobre el placement real (no genérico).
- Guardrails OK. Cache: 2da llamada del día no re-genera.
