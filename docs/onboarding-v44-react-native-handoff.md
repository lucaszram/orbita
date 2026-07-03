# Órbita Onboarding V4.4 - React Native Handoff

Fecha: 2026-07-03  
Estado: beta visual lista para empezar implementación en Expo/React Native.

## Fuente

- Figma file: `BEB5v6SbgJn2Nipm8Qa0wE`.
- Página visual vigente para codear: `UX V4.4 - Órbita Onboarding Immersive Pass`.
- Página base de copy original: `UX V4.3 - Órbita Onboarding Copy`.
- App target: reemplazar el onboarding legacy de [app/onboarding.tsx](/Users/lucas/Documents/horoscopo/app/onboarding.tsx).

Nota importante: el onboarding anterior de la app todavía era un flujo heredado, con 8 pasos y otra estética. Para esta beta conviene tratar `app/onboarding.tsx` como reemplazable.

## Dirección

- Mantener flujo `01-15`.
- Una idea por pantalla.
- Copy editable en React Native, nunca dentro de imágenes.
- Usar assets como fondos, texturas o diagramas integrados.
- Evitar que cualquier asset principal se lea como foto cuadrada pegada.
- Tono: Órbita, voseo argentino, sobrio, editorial, premium.
- Framing: entretenimiento, autoconocimiento y contexto. No prometer destino, resultados garantizados, salud, dinero ni decisiones de riesgo.

## Implementación Recomendada

- Expo SDK 51, React Native `0.74.5`.
- Usar `ImageBackground`, `Image`, `Pressable`, `ScrollView`, `KeyboardAvoidingView` y `expo-linear-gradient`.
- Usar `resizeMode="cover"` para fondos full-bleed.
- Encima de cada imagen usar overlays oscuros/claros con `LinearGradient` o views absolutas.
- Crear componentes locales para esta pantalla si los componentes heredados quedan demasiado atados al MVP anterior:
  - `OnboardingShell`
  - `OnboardingProgress`
  - `PrimaryCTA`
  - `PlanSelector`
  - `WheelPicker`
  - `OrbitaMark`
- La pantalla `07` debe usar teclado nativo real. El teclado dibujado en Figma es solo estado visual.
- El pago puede quedar stub en beta: selector de plan + CTA `Continuar`; no bloquear implementación por StoreKit/Play Billing.

Desde `app/onboarding.tsx`, los imports de assets pueden hacerse con `require("../assets/...")`. Si se mueve lógica a `src/features/onboarding/`, ajustar rutas relativas.

Ejemplo:

```ts
const onboardingAssets = {
  dailyTextureB: require("../assets/orbita/core/orbita_daily_texture_b.png"),
  sunEmblem: require("../assets/orbita/higgsfield/archive-10/selected/planetary-symbols/archive10_planet_sun_copper_corona__idx25__hf_20260703_003922_ccda12d2-b2c4-49b7-8d8b-98e39f7ca57b.png"),
  ascendantHorizon: require("../assets/orbita/higgsfield/archive-10/selected/planetary-symbols/archive10_point_ascendant_horizon__idx27__hf_20260703_003935_22932911-5789-4448-86d9-01581b18136e.png"),
  orbitalChart: require("../assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_chart_orbital_ring_system__idx15__hf_20260703_003620_1a5dde8e-83bb-4467-92aa-05390062a68b.png"),
  paymentBg: require("../assets/orbita/higgsfield/archive-7/selected/onboarding/15-payment/onboarding_15_payment__idx62__hf_20260702_230605_4349256f-bc12-482c-b48e-863d13ca7b0f.png")
};
```

## Assets Principales

Todos estos archivos ya están en el repo local.

| Uso | Ruta | Nota |
| --- | --- | --- |
| Textura clara para `05`, `07`, `09` | `assets/orbita/core/orbita_daily_texture_b.png` | PNG `1254x1254`, RGB. Usar muy suave, como wallpaper. |
| Carta natal / diagrama para `11` | `assets/orbita/core/orbita_carta_natal_diagram_a.png` | PNG `1254x1254`, RGB. Sirve como diagrama integrado. |
| Sol para `06` | `assets/orbita/higgsfield/archive-10/selected/planetary-symbols/archive10_planet_sun_copper_corona__idx25__hf_20260703_003922_ccda12d2-b2c4-49b7-8d8b-98e39f7ca57b.png` | PNG `2048x2048`, RGB. Usar como emblema/fondo, no sticker. |
| Horizonte ascendente para `08` | `assets/orbita/higgsfield/archive-10/selected/planetary-symbols/archive10_point_ascendant_horizon__idx27__hf_20260703_003935_22932911-5789-4448-86d9-01581b18136e.png` | PNG `2048x2048`, RGB. Full-bleed/crop amplio. |
| Anillos/carta para `09`, `10`, `11` | `assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_chart_orbital_ring_system__idx15__hf_20260703_003620_1a5dde8e-83bb-4467-92aa-05390062a68b.png` | PNG `2048x2048`, RGB. Apoyo sutil. |
| Cálculo/tránsitos para `12` | `assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_transits_dynamic_orbital_body__idx30__hf_20260703_004042_c574180f-254d-49ef-9530-8bfcddc126f2.png` | PNG `2048x2048`, RGB. Fondo dark inmersivo. |
| Fondo logo/onboarding alternativo | `assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_ringed_planet_orbital_backplate__idx34__hf_20260703_004145_9eff4a2f-00b4-4198-9f34-61c94e0a2e50.png` | PNG `2048x2048`, RGB. Buena opción para `01` o `02`. |
| Before/after símbolos | `assets/orbita/higgsfield/archive-7/selected/onboarding/13-before-after/onboarding_13_before_after__idx53__hf_20260702_230421_2a16c0db-f3c2-453e-b3f5-ea07317ed327.png` | PNG `1856x2304`, RGB. Usar como fondo/símbolo integrado. |
| Before/after símbolos | `assets/orbita/higgsfield/archive-7/selected/onboarding/13-before-after/onboarding_13_before_after__idx81__hf_20260702_231014_3cf0aab5-0749-4be2-8ac3-b114028201b3.png` | PNG `1856x2304`, RGB. Alternativa para after/premium. |
| Paywall `15` | `assets/orbita/higgsfield/archive-7/selected/onboarding/15-payment/onboarding_15_payment__idx62__hf_20260702_230605_4349256f-bc12-482c-b48e-863d13ca7b0f.png` | PNG `1856x2304`, RGB. Usar full-bleed en toda la pantalla. |

## Carpetas Útiles

- Core seleccionados: `assets/orbita/core/`
- Onboarding Archive 7: `assets/orbita/higgsfield/archive-7/selected/onboarding/`
- Guardas Archive 10: `assets/orbita/higgsfield/archive-10/selected/`
- Referencias Archive 9: `assets/orbita/higgsfield/archive-9/style-reference/`
- Contact sheets Archive 7: `assets/orbita/higgsfield/archive-7/contact-sheets/`
- Contact sheets Archive 10: `assets/orbita/higgsfield/archive-10/contact-sheets/`

No usar como fuente directa:

- `inbox/`, salvo exploración.
- `rejected/`.
- `figma-previews/`, `figma-mini-previews/`, `figma-import-previews/`; son previews JPG, no assets finales.

## Estado Global

Datos mínimos a capturar:

```ts
type OnboardingData = {
  identity?: "ella" | "el" | "prefiero_no_decirlo";
  birthDate?: {
    day: number;
    month: number;
    year: number;
  };
  birthPlace?: {
    label: string;
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  birthTime?: {
    hour: number;
    minute: number;
    period: "AM" | "PM";
    unknown?: boolean;
  };
  selectedPlan?: "weekly" | "annual";
};
```

Valores de ejemplo usados en Figma:

- Fecha: `15 de enero de 1996`.
- Signo: `Capricornio`.
- Elemento: `Tierra`.
- Lugar: `Buenos Aires, Argentina`.
- Hora: `08:30 AM`.

En app, esos textos tienen que salir del estado real del usuario.

## Pantallas

### 01 / Logo Splash

Rol: entrada de marca.

Copy:

- `Órbita`
- `tu astróloga personal`

Visual:

- Fondo dark inmersivo.
- Usar `archive10_ringed_planet_orbital_backplate__idx34...png` o una textura dark equivalente.
- El logo debe ser editable/dibujado en RN: círculo/orbe negro, línea orbital cobre, punto pequeño. No usar logo cuadrado como imagen.

### 02 / Align With Universe

Rol: promesa general.

Copy:

- `Alineate con el ritmo del universo`
- `Descifrá amor, trabajo y camino personal desde tu carta.`
- Tiles: `Influencia lunar`, `Guía personal`, `Práctica diaria`, `Decisiones`
- Nota: `Órbita ordena señales, no dicta destino.`
- CTA: `Empezar el viaje`

Visual:

- Fondo con `orbita_daily_texture_b.png` o `archive10_ringed_planet_orbital_backplate__idx34...png`.
- Tiles con imágenes integradas, radios sobrios, sin efecto juguete.

### 03 / Identify

Rol: personalización de tono.

Copy:

- `¿Cómo te identificás?`
- `Vamos a personalizar tu experiencia y tus prácticas.`
- Opciones: `Ella`, `Él`, `Prefiero no decirlo`
- Nota: `Solo cambia el tono de tus lecturas.`
- CTA: `Continuar`

Visual:

- Puede ser claro o dark suave.
- Usar textura sutil, no competir con las opciones.

### 04 / Daily Guidance

Rol: mostrar valor antes de pedir datos.

Copy:

- `Guía diaria, ajustada a vos`
- `Micro-rituales, insights y señales para este momento.`
- Badges: `Amor`, `Cuidado`, `Decisiones`, `Energía`
- Dentro del teléfono: `Tu energía se mueve suave` y `Una acción pequeña ordena el día.`
- CTA: `Estoy en órbita`

Visual:

- Dark premium.
- Dibujar teléfono y elementos orbitales en RN.
- Usar backplates de `assets/orbita/higgsfield/archive-7/selected/onboarding/04-daily-guidance-*` solo como fondo integrado.

### 05 / Birthdate Empty

Rol: pedir fecha.

Copy:

- `¿Cuándo naciste?`
- `Tu fecha ubica el Sol en tu carta.`
- Privacidad: `La usamos para calcular tu carta natal. Nunca vendemos ni compartimos tus datos.`
- CTA: `Continuar`

Visual:

- Fondo claro `orbita_daily_texture_b.png` con opacidad baja.
- Picker editable. No usar screenshot de picker.

### 06 / Birthdate Selected

Rol: confirmar fecha y Sol.

Copy dinámico:

- `Sol en Capricornio.`
- `15 de enero de 1996`
- `SOL`
- `Capricornio`
- `ELEMENTO`
- `Tierra`
- `Cambiar fecha`
- Privacidad igual a `05`.
- CTA: `Continuar`

Visual:

- Usar `archive10_planet_sun_copper_corona__idx25...png`.
- Integrarlo como emblema/fondo, con overlay. No ponerlo en un cuadrado.

### 07 / Birthplace Search

Rol: pedir ciudad.

Copy:

- `¿Dónde naciste?`
- `La ciudad ajusta el horizonte de tu carta.`
- Label: `CIUDAD`
- Placeholder/valor ejemplo: `Buenos`
- Resultados ejemplo:
  - `Buenos Aires, Argentina`
  - `Buenos Aires Province, Argentina`
  - `Buenos Aires, Costa Rica`
- Privacidad: `La usamos para precisar tu carta natal. Nunca vendemos ni compartimos tus datos.`

Visual:

- Mismo sistema claro de `05`.
- En app usar teclado nativo. La pantalla debe funcionar con `KeyboardAvoidingView`.

### 08 / Birthplace Selected

Rol: confirmar horizonte/lugar.

Copy:

- `Horizonte definido.`
- `Buenos Aires, Argentina`
- `El lugar ayuda a calcular tu ascendente y las casas.`
- Privacidad igual a `07`.
- CTA: `Continuar`

Visual:

- Usar `archive10_point_ascendant_horizon__idx27...png` como full-bleed/crop amplio.
- Texto sobre zonas tranquilas, con overlay si hace falta.

### 09 / Birth Time Picker

Rol: pedir hora.

Copy:

- `¿A qué hora naciste?`
- `La hora afina tu ascendente y tus casas.`
- Botón secundario full-width:
  - `No sé la hora`
  - `Usamos una carta aproximada.`
- Nota: `Podés continuar sin hora exacta. La lectura será menos precisa.`
- CTA: `Continuar`

Visual:

- Fondo claro `orbita_daily_texture_b.png`.
- Opcional: `archive10_chart_orbital_ring_system__idx15...png` muy sutil.
- AM/PM es UI editable, no bitmap.

### 10 / Birth Time Selected

Rol: confirmar hora.

Copy:

- `Ascendente afinado.`
- `08:30 AM`
- `La hora ordena las casas de tu carta.`
- `HORA`
- `08:30 AM`
- `Podés volver atrás si necesitás cambiar la hora.`
- CTA: `Continuar`

Visual:

- Usar anillos/carta `archive10_chart_orbital_ring_system__idx15...png` o una textura integrada.
- No usar cuadro central.

### 11 / Your Base Chart

Rol: resumen antes de calcular.

Copy:

- `Estos son tus puntos de partida.`
- `FECHA` / `15 Ene 1996`
- `LUGAR` / `Buenos Aires`
- `HORA` / `08:30 AM`
- `Con esto calculamos tu Sol, ascendente y casas.`
- CTA: `Calcular mi carta`

Visual:

- Usar `orbita_carta_natal_diagram_a.png` o `archive10_chart_orbital_ring_system__idx15...png`.
- Diagrama grande integrado detrás o entre título y tabla.

### 12 / Personalizing

Rol: cálculo/progreso.

Copy:

- `Calculando tu cielo...`
- `Carta natal en proceso.`
- `Carta natal` / `59%`
- `Tránsitos del día` / `0%`
- `Usamos tus datos para ordenar tus posiciones.`

Visual:

- Dark.
- Usar `archive10_transits_dynamic_orbital_body__idx30...png` como fondo full-bleed.
- Progress bars sobrias, cobre sutil.

### 13 / Before After / Órbita

Rol: before/after seguro.

Copy:

- `Antes y después de Órbita`
- `Una guía diaria puede cambiar cómo mirás tu día.`
- Antes:
  - `Vivía en automático`
  - `No sabía qué priorizar`
  - `Dudaba de lo que quería`
  - `Me sentía agotada`
  - `Vínculos poco claros`
- Después:
  - `Con calma y confianza`
  - `Conozco mis fortalezas y límites`
  - `Centrada y enfocada en lo importante`
  - `Confío más en mi intuición`
  - `Me vinculo con más claridad`
- Footer: `No resuelve por vos. Te devuelve contexto.`
- CTA: `Continuar`

Visual:

- Dark premium.
- Usar `onboarding_13_before_after__idx53...png` y/o `idx81...png` como símbolos/fondo, no como burbujas decorativas sueltas.

### 14 / Create Account

Rol: cuenta para guardar carta.

Copy:

- `Guardá tu carta.`
- `Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta.`
- `EMAIL`
- Ejemplo: `mica@email.com`
- CTA email: `Continuar`
- Separador: `O seguir con`
- `Continuar con Apple`
- `Continuar con Google`

Visual:

- Mantener funcional.
- Fondo mínimo, sin cargar de assets.
- En beta puede quedar como pantalla visual o saltar auth real si todavía no está conectado.

### 15 / Onboarding Payment / Scroll

Rol: pago de onboarding.

Copy base:

- Marca: `Órbita` + `PLUS`
- `Restaurar`
- Hero: `Tu cielo, todos los días.`
- Subcopy: `Carta natal, guía diaria y lecturas más profundas.`
- Planes:
  - `Semanal`
  - `$5`
  - `por semana`
  - `Flexible para probar`
  - `Anual`
  - `$30`
  - `por año`
  - `$0.58 por semana`
  - `MEJOR VALOR`
- Legal: `Cancelás cuando quieras. Entretenimiento y autoconocimiento.`
- CTA: `Continuar`

Copy recomendado para reemplazar el bloque viejo de Figma:

- Título de sección: `Todo lo que desbloqueás`
- Beneficios:
  - `Carta natal completa`
  - `Guía diaria personalizada`
  - `Tránsitos en tu carta`
  - `Preguntale a Órbita`
  - `Sueños, vínculos y calendario`
- Título de pasos: `Cómo te acompaña`
- Paso 01:
  - `Tu carta completa`
  - `Sol, Luna, ascendente, casas y aspectos en lenguaje claro.`
- Paso 02:
  - `Tu día con contexto`
  - `Lecturas y tránsitos personalizados según tu mapa.`
- Paso 03:
  - `Preguntas más profundas`
  - `Consultas, sueños y vínculos conectados con tu cielo.`

No usar en app beta:

- `Calculamos tu carta`
- `Leemos los tránsitos`
- `Cruzamos tu mapa con el cielo del día.`
- `Te damos una acción`

Visual:

- Usar `onboarding_15_payment__idx62...png` como fondo de toda la pantalla.
- Overlay oscuro en zona comercial.
- Selector anual seleccionado por default.
- Radios chicos, filas sobrias, borde cobre en anual.
- CTA crema/cobre con radio menor, no pill infantil.

Guardrail: no escribir `24/7 astrologer chat` si no hay chat humano real. Para beta, `Preguntale a Órbita` es más seguro y más propio.

## Colores Base

Tomar como punto de partida:

```ts
const orbitaColors = {
  warmBg: "#F7F5EF",
  ink: "#111111",
  charcoal: "#0D0E12",
  charcoal2: "#14161D",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F1E7DA",
  line: "#D8D3C8",
  muted: "#8E8A82"
};
```

## Estados Mínimos

- `currentStep`
- `identity`
- `birthDate`
- `birthPlaceSearch`
- `birthPlace`
- `birthTime`
- `birthTimeUnknown`
- `selectedPlan`, default `annual`
- loading/progress fake para `12`

## Pendientes No Bloqueantes

- Autocomplete real de ciudades.
- Zona horaria real.
- Cálculo real de ascendente/casas.
- Auth real con Clerk.
- Compra real con StoreKit/Play Billing.
- Persistencia en Convex.

Para la primera beta visual, se puede avanzar con estados locales y datos mockeados.

## Verificación Para La Implementación

- Revisar en iPhone pequeño y grande.
- Validar que ningún asset quede como cuadrado pegado.
- Validar que el texto no tape zonas importantes del fondo.
- Validar teclado real en `07`.
- Validar scroll completo en `15` y CTA accesible.
- Buscar textos legacy visibles: nombre anterior, señal sin tilde, señal si no corresponde, y claims transit-heavy.
