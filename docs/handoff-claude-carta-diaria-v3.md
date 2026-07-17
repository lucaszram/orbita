# Handoff a Claude — Home con carta ritual v3

**Fecha:** 2026-07-17  
**Backend:** PR #22, rama `codex/daily-card-ritual`  
**Frontend de trabajo:** `feature/carta-ritual`  
**Estado:** contrato backend implementado y validado; todavía no desplegado.

## Objetivo

Cambiar la lectura de la carta diaria para que, después de `Te salió {carta}.`, la app explique **la carta misma**. Este bloque deja de mezclar la carta con tránsitos, cielo del día o carta natal.

La carta puede salir **al derecho** o **invertida**. La orientación es parte del sorteo diario, queda estable para esa persona y ese día, y debe conservarse en la tira y el Diario.

La captura del 2026-07-17 muestra correctamente:

- imagen y nombre de la carta;
- `Te salió La Sacerdotisa.`;
- `SALIÓ AL DERECHO`;
- una esencia breve;
- `EL CONSEJO`.

Pero esa captura **no es una versión final aprobable**: es el mock parcial de `guestCardOfTheDay`, que manda las facetas, `enTuDia` y el cierre vacíos. Por eso se saltea el cuerpo central y la lectura queda rara. La pantalla live debe mostrarse completa o no mostrarse todavía; nunca debe degradar a esencia + consejo.

La fuente visual y editorial es Figma, sección 14, frame `727:127`.

## Corrección importante respecto del handoff anterior

El handoff anterior quedó desactualizado en dos puntos:

1. El mazo final es de **78 cartas**, no de 22.
2. El frontend no puede resolver imágenes con `majorById`. Debe usar el catálogo completo ya integrado en `main` (`cardById` / `TAROT_CATALOG`, según el export vigente).

No volver a limitar el dominio a `0–21`: los ids válidos son `0–77`.

## Contrato exacto del backend

`daily.getGuide()` pasa a `orbita-daily-guide-v3`. Dentro de `carta`, desaparece `beats` y entran `orientacion` + `ritual`:

```ts
export type DailyOrientacion = "derecho" | "invertida";

export type DailyRitualFaceta = {
  titulo: string;
  texto: string;
};

export type DailyRitual = {
  esencia: string;
  significadoGeneral: DailyRitualFaceta[]; // siempre 3
  enTuDia: string;
  consejo: string;
  cierre: {
    pregunta: string;
    umbralSeed?: string;
  };
};

export type DailyCarta = {
  id: number; // 0–77
  nombre: string;
  correspondencia: string;
  orientacion: DailyOrientacion;
  ritual: DailyRitual;
};
```

`daily.getStrip()` devuelve por día:

```ts
{
  localDate: string;
  cartaId: number | null;
  orientacion: "derecho" | "invertida" | null;
  revealed: boolean;
}
```

El backend garantiza:

- mazo completo de 78;
- sin repetición durante los seis días anteriores (puede volver a salir al octavo día);
- 50% de probabilidad de invertida usando una segunda semilla determinística;
- misma persona + misma fecha = misma carta y misma orientación;
- ritual intrínseco a la carta, sin cruce astrológico inventado;
- fallback completo si falla el LLM;
- regeneración de caches v2 preservando `revealedAt`.

## Formato canónico exacto de Figma

No alcanza con conservar los labels: también hay que respetar el ritmo del texto. Este es el ejemplo literal aprobado en el frame `727:127`:

```text
Te salió La Luna.

SALIÓ AL DERECHO

Que te salga La Luna —Arcano Mayor XVIII— es una invitación a explorar
tu intuición: simboliza el mundo de los sueños, lo inconsciente y las
verdades ocultas.

SIGNIFICADO GENERAL

Confusión y misterio — no ves todo con claridad, como caminar de noche;
hay incertidumbre.

Intuición — no te guíes solo por la lógica: seguí lo que sentís y tus
corazonadas.

Miedos y sombras — un llamado a mirar de frente los temores o lo que te
genera ansiedad.

EN TU DÍA

En los vínculos, mirá lo que se dice a medias; en el trabajo, no cierres
ni firmes sin tener toda la información; en lo creativo, tu sensibilidad
está afinada como pocas veces.

EL CONSEJO

Confiá en tu intuición por encima del miedo. Hoy no es día de decisiones
apuradas: observá y dejá que esa luz interior te oriente.

¿Querés leerla para algo puntual —el amor, una decisión, el trabajo?

PREGUNTARLE AL UMBRAL ›
```

Reglas editoriales derivadas de este ejemplo:

- La esencia es un párrafo explicativo de 1–2 frases; no una sucesión telegráfica de frases cortadas.
- `SIGNIFICADO GENERAL` tiene **exactamente tres facetas**, cada una en su propia línea/párrafo: `título — explicación`.
- `EN TU DÍA` teje vínculos, trabajo y creatividad/decisiones en un solo párrafo. No usa tres cards ni tres labels internos.
- `EL CONSEJO` tiene 1–2 frases completas en voseo.
- La pregunta final es serif y funciona como cierre editorial; el CTA cobre va debajo.
- No usar frases defensivas como `no predice`, `no define el día` o `no es una orden` en el texto visible.
- No usar el copy del screenshot parcial (`Lo que se sabe sin decirse todavía. Pide leer antes de actuar…`) como plantilla de estructura: puede servir como materia editorial, pero debe entrar dentro de los cinco bloques completos.

## Orden visual y de contenido

Renderizar el bloque en este orden:

```text
TU CARTA DE HOY

[imagen de la carta]

Te salió {nombre}.

SALIÓ AL DERECHO | SALIÓ INVERTIDA

{ritual.esencia}

SIGNIFICADO GENERAL
{faceta 1.titulo} — {faceta 1.texto}
{faceta 2.titulo} — {faceta 2.texto}
{faceta 3.titulo} — {faceta 3.texto}

EN TU DÍA
{ritual.enTuDia}

EL CONSEJO
{ritual.consejo}

{ritual.cierre.pregunta}
PREGUNTARLE AL UMBRAL →
```

Reglas:

- Si `orientacion === "invertida"`, rotar **solo la ilustración** 180°. El marco, el nombre y el texto quedan derechos.
- Mostrar el tag de orientación en ambos casos.
- El CTA de Umbral abre `/vacio`; si `umbralSeed` existe, usarlo como pregunta inicial. Si todavía no está conectado el prefill, navegar sin inventar otro texto.
- No reintroducir `EL CIELO DE HOY`, `EL CRUCE DE HOY`, `CÓMO INFLUYE HOY` ni `CÓMO SE CONECTA CON TU CIELO` dentro de esta carta.
- Tránsitos y guía diaria siguen existiendo en sus superficies; solamente dejan de formar parte de la lectura de la carta.

## Archivos frontend a adaptar

### `src/services/appRefs.ts`

- Copiar el contrato anterior exactamente.
- Cambiar los comentarios `0–21` por `0–77`.
- Eliminar `beats` de `DailyCarta`.
- Sumar `orientacion` a la forma tipada de la tira.

### `src/components/home/CartaDelDia.tsx`

- Resolver la imagen con el catálogo de 78, nunca con `majorById`.
- Si el id no existe localmente, mostrar `CARD_BACK`; nunca dejar un marco vacío ni elegir otra carta.
- Rotar la ilustración cuando salga invertida.
- Mostrar el tag `SALIÓ AL DERECHO` / `SALIÓ INVERTIDA`.
- Reutilizar `RitualReading` para la lectura completa.

### `src/components/home/RitualReading.tsx`

- Componente compartido por Home y Diario.
- Mantener el orden de secciones definido arriba.
- **Eliminar la regla actual de “cada sección se oculta si viene vacía” para la superficie live.** Esa regla es la que produjo la captura parcial de La Sacerdotisa. Validar el ritual completo antes de renderizarlo.
- El backend v3 siempre manda un ritual completo. Si falta durante una transición de contrato, no completar con mocks ni con copy viejo: mostrar carga/error honesto hasta recibir v3.
- El cierre a Umbral es parte del componente.

### `app/(tabs)/index.tsx`

- No pasar `daily.destacado` ni otro dato del cielo a `CartaDelDia`.
- Durante carga de sesión o de `daily.getGuide`, conservar la pantalla mínima ya aprobada. Nunca mostrar una carta mock antes de la real.
- El reveal sigue siendo irreversible y server-side.

### `src/components/diario/DiarioStrip.tsx`

- Resolver imágenes de ids `0–77`.
- Conservar `orientacion` en la entrada seleccionada.
- En miniaturas, decidir una sola convención visual consistente. Recomendación: rotar también la ilustración invertida para que el archivo sea fiel.

### `app/reading/diario.tsx`

- Resolver la carta con el catálogo de 78.
- Mostrar su orientación original.
- Reutilizar `RitualReading`; no mantener una segunda versión del copy.
- Si el backend todavía está cargando, no usar `guestCardOfTheDay` ni datos viejos como reemplazo.

### `src/content/tarotDeck.ts` / catálogo vigente

- Preservar el catálogo de 78 que ya está en `main`.
- No volver a introducir `majorById` en consumidores.
- El mock guest ya no debe aparecer en una Home autenticada ni durante carga. Si queda exportado por compatibilidad, no usarlo como fallback live.
- El objeto actual con `significadoGeneral: []`, `enTuDia: ""` y `cierre.pregunta: ""` **no es válido para `RitualReading`** y no puede usarse para aprobar la pantalla.

## Estados de pantalla

La regla de #17 sigue vigente:

- sesión sin resolver → carga mínima;
- sesión real + guía pendiente → carga mínima;
- error real → error + reintentar;
- invitado confirmado → estado honesto de acceso, nunca una carta inventada;
- guía v3 lista → carta real + ritual completo.

No mostrar primero La Luna, La Sacerdotisa u otra carta mock y luego reemplazarla por la carta real.

## Checklist manual conjunto

Probar frontend + PR #22 en Convex **dev**, en este orden:

1. Carta al derecho: imagen normal, tag correcto y las cinco partes visibles (esencia, tres facetas, en tu día, consejo y cierre/Umbral).
2. Carta invertida: ilustración a 180°, marco/textos derechos y ritual correspondiente a invertida.
3. Arcano menor (por ejemplo Ocho de Oros): imagen correcta en Home, tira y detalle de Diario.
4. Estabilidad: cerrar y abrir la app el mismo día conserva carta y orientación.
5. Historial: abrir una carta del Diario conserva la orientación con la que salió.
6. No repetición: revisar siete días de fixtures/tests; ninguna carta se repite dentro de la ventana.
7. Cache viejo: un payload v2 regenera v3 sin volver a cerrar una carta ya revelada.
8. Error LLM: aparece el fallback ritual completo, nunca los beats viejos.
9. Carga lenta: se ve carga mínima, nunca un flash de mock.
10. CTA Umbral: abre la pantalla correcta y no pierde el texto de cierre.

## Orden de integración y publicación

1. Claude termina el frontend en un PR puntual, preservando el soporte de 78 cartas.
2. Integrar temporalmente frontend + PR #22 en un worktree limpio.
3. Codex despliega PR #22 **solo a Convex dev**.
4. Lucas hace la pasada manual del checklist.
5. Recién con la pasada aprobada se mergean ambos lados y se prepara TestFlight.

**No desplegar PR #22 solo contra el TestFlight actual:** ese cliente espera `carta.beats` y no entiende el contrato v3.

## Fuera de alcance

- No tocar Figma desde este cambio.
- No modificar autenticación, onboarding ni lectura natal.
- No cambiar el resto de la Home o Tránsitos.
- No generar TestFlight ni desplegar a producción hasta completar la integración conjunta.
