# App Review — Órbita 1.0.0 (41)

Fuente de verdad del reenvío tras el rechazo por la norma 5.6. Reemplaza, para
este envío, a `docs/app-review-readiness.md` (evidencia histórica del build 17) y
complementa a `docs/native-commerce-release-checklist.md`.

Tarjetas: CORE-1042 (binario sin actualizaciones remotas), CORE-1043 (reglas
Free/Plus), CORE-1044 (textos de Plus), CORE-1045 (este paquete).

Nada de este documento se carga en App Store Connect ni se envía a Apple sin
orden explícita de Lucas.

## Qué pasó

- **Enviado:** iOS 1.0.0 (30), el 31/08/2026, junto con el grupo «Órbita Plus» y
  la suscripción «Órbita Plus Mensual».
- **Rechazado:** 04/09/2026, norma 5.6 (Developer Code of Conduct): «the app
  contains features that appear to have been intentionally hidden during the
  review process». Apple no identificó la función.
- **Submission ID:** `2170b331-66b2-4921-a180-980fdc4a0948`.

Apple no dijo la causa, así que no se da ninguna por demostrada. Lo que sí está
comprobado sobre el build 30 y su envío:

| Hecho comprobado | Evidencia | Cómo queda en el 41 |
|---|---|---|
| El binario incluía `expo-updates` con canal `production`: podía recibir JavaScript nuevo sin pasar por revisión. | `8fc5cc4:app.json`, `8fc5cc4:eas.json` | Sin `expo-updates`, URL, runtime ni canales. Test `test/easRuntimeProfiles.test.ts`. |
| Los documentos de envío del repo describían una primera versión gratuita, sin Plus ni compras; el binario tenía paywall, suscripción y canje de códigos. | `docs/app-review-readiness.md` (líneas históricas), borrador de notas del 13/08 | Notas y ficha nuevas (abajo) declaran Free y Plus. |
| La cuenta demo tenía Plus activo por Sandbox desde el 26/08: con Plus activo no se ven paywall ni bloqueos. | `ad5ac90:CURRENT_TASK.md` 245-266 | Cuenta de revisión Free, sin compra previa. |
| El acceso a Plus de quien revisa dependía de una lista de cuentas en el servidor que se cargaba antes de la revisión y se vaciaba después. | `convex/lib/revenueCatEvents.ts`, checklist de comercio | Producción acepta Sandbox de cualquier cuenta; no hay lista que abrir ni cerrar (CORE-1043). |
| Un botón al portal de facturación web aparecía sólo para cuentas con suscripción web y según un interruptor del servidor. | `src/components/orbita/ManageSubscription.tsx` en `main` | Quitado de la app nativa (CORE-1042). |
| Un salto de pasos del alta (`debugStep`) seguía cableado detrás de una variable de compilación. | `src/services/internalTools.ts` en `main` | Apagado en nativo sin mirar la variable (CORE-1042). |
| El build salió de un commit local sin push, fuera de `main`. | `ad5ac90:CURRENT_TASK.md` 54-90 | El 41 sale de `main`, commit identificado, worktree limpio. |

Falta, y sólo lo tiene Lucas: el texto de su respuesta a Apple del 07/09/2026 y
las notas de revisión efectivamente cargadas con el build 30.

## Qué tiene la app (regla única, igual a la web)

| Sección | Free | Plus |
|---|---|---|
| Hoy | abierto | abierto |
| Tránsitos (panorama y detalle) | bloqueado, lleva al paywall | abierto |
| Tu momento (estación vital, tema del año, cuatro ritmos) | bloqueado, lleva al paywall | abierto |
| Vínculos | 1 persona, 3 contactos visibles | sin tope |
| Carta | rueda y tríada | carta completa: casas, aspectos y capítulos |
| El Umbral | 3 preguntas por día | 5 preguntas por día |

Fuera de iOS 1.0: Tarot, Diario y calendario. No se nombran en la ficha, las
capturas ni las notas.

Plus: un solo producto, `orbita_plus_monthly` (1 mes, 7 días de prueba),
entitlement `orbita_pro`, comprado con la compra dentro de la app de Apple.

## Notas para App Review (texto a cargar)

```text
Órbita is an astrology and self-knowledge app for entertainment and daily
context. It requires an account because birth data and the natal chart are tied
to the user.

WHAT CHANGED SINCE THE PREVIOUS SUBMISSION (1.0.0 build 30, guideline 5.6)
- The over-the-air update library (expo-updates) was removed. This binary does
  not download or execute any code after installation; every change ships as a
  new build through App Review.
- A link to an external web billing portal that was shown only to accounts with
  a web subscription was removed from the app.
- An internal onboarding inspection parameter was disabled in the native app.
- The free and paid tiers are described below exactly as they work in this
  build. Nothing in the app is enabled, disabled or changed remotely for
  specific accounts, dates or regions.

FREE AND PAID FEATURES
Free: Hoy (daily view), natal chart wheel and Sun/Moon/Rising, Vínculos with
one person and three visible contacts, and three questions per day in El
Umbral.
Órbita Plus (auto-renewable monthly subscription, 7-day free trial): Tránsitos,
Tu momento, the full natal chart (houses, aspects and chapters), Vínculos
without limits, and five questions per day in El Umbral.

WHERE TO FIND THE PAYWALL AND THE IN-APP PURCHASE
1. At the end of onboarding for a new account (it can be skipped with
   "Seguir gratis").
2. Tránsitos tab: a free account sees a locked state with a button to Órbita
   Plus.
3. Carta tab > Carta completa: locked state with a button to Órbita Plus.
4. Carta tab > gear icon (Ajustes) > "ACTIVAR ÓRBITA PLUS".
Restore purchases and subscription management are in Ajustes, under "TU PLAN".

DEMO ACCOUNT
The demo account in the Sign-in Information section is a FREE account with
onboarding completed and no previous purchase, so every locked state and the
paywall are visible. Sign in with email and password; no email code is needed.
You can also create a new account: the full onboarding and its paywall will be
shown. Sandbox purchases unlock Órbita Plus for any account.

ACCOUNT DELETION
Carta tab > gear icon (Ajustes) > "Eliminar mi cuenta". Privacy Policy and
Support links are in the same screen; Terms are linked from the paywall.

Órbita does not provide medical, psychological, legal, financial or guaranteed
predictive advice. Support contact: soporte@orbitaastrologia.xyz
```

Antes de cargarlas: recorrer el build final y confirmar que cada ruta y cada
rótulo citado existe tal cual. Si un rótulo cambió, se corrige la nota, no el
recuerdo.

## Cuenta de revisión

- Cuenta nueva, exclusiva, con email y contraseña; alta completa y datos
  natales cargados.
- **Free, sin ninguna compra Sandbox previa.** No reutilizar la cuenta `demo`
  anterior, que tuvo Plus activo.
- Probada en instalación limpia del mismo binario que se envía.
- Las credenciales van sólo en App Store Connect; no se guardan en Git ni en
  Linear.

## Ficha de tienda

- Nombre: `Órbita` · Subtítulo: `Carta natal y tránsitos` · Categorías:
  Lifestyle / Entertainment · Liberación manual.
- Keywords: `astrologia,carta natal,horoscopo,luna,transitos,zodiaco,ascendente,sinastria,signos`
  (sin `tarot` ni `guia diaria`).

### Descripción

```text
Órbita es una app de astrología para leer tu carta natal y mirar cada día con
más contexto.

Partimos de tus datos de nacimiento para construir una lectura personal. La
idea no es decirte qué va a pasar: es darte un mapa claro para entender qué
temas están activos y cómo se siente el momento.

Gratis:
- Hoy: lo principal del día sobre tu carta y la Luna.
- Tu carta: la rueda y tu Sol, Luna y Ascendente.
- Vínculos: compará tu carta con la de una persona.
- El Umbral: tres preguntas por día.

Con Órbita Plus:
- Tránsitos: los planetas de hoy sobre tu carta, con el detalle de cada uno.
- Tu momento: estación vital, tema del año y cuatro ritmos.
- Tu carta completa: las doce casas, los aspectos y sus capítulos.
- Vínculos sin tope de personas ni de contactos.
- Cinco preguntas por día en El Umbral.

Órbita Plus es una suscripción mensual con renovación automática y siete días
de prueba para quien la contrata por primera vez. Se gestiona y se cancela
desde tu cuenta de Apple.

Órbita usa la astrología como entretenimiento, autoconocimiento y contexto
diario. No reemplaza asesoramiento profesional médico, psicológico, legal ni
financiero.

Términos: https://orbitaastrologia.xyz/terminos
Privacidad: https://orbitaastrologia.xyz/privacy
```

### Capturas (del binario final, sin Figma ni mocks)

1. Hoy. 2. Carta (rueda y tríada). 3. Tránsitos (cuenta Plus). 4. Vínculos.
5. El Umbral. 6. Paywall de Órbita Plus con precio y prueba.

Captura de revisión de la suscripción: el paywall con el producto mensual.

## App Privacy (responder contra el binario final)

- Contact Info: email y nombre, vinculados, funcionalidad.
- Identifiers: user ID, vinculado, funcionalidad.
- **Purchases: historial de compras, vinculado, funcionalidad** (Apple IAP y
  RevenueCat).
- User Content: preguntas de El Umbral y personas de Vínculos, vinculado,
  funcionalidad.
- Other Data: fecha, hora y lugar de nacimiento y datos derivados, vinculado,
  funcionalidad y personalización.
- Usage Data: interacción con el producto (apertura de la app), vinculado,
  analítica propia.
- Tracking: no.

## Verificaciones antes de compilar

| Verificación | Estado |
|---|---|
| Entorno `production` de EAS tiene `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Verificado 04/10/2026 (sólo nombres) |
| Entorno `production` de EAS no tiene `EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS` | Verificado 04/10/2026 |
| Oferta vigente de RevenueCat: un único paquete mensual `P1M` | Pendiente (panel de RevenueCat, Lucas) |
| Suscripción mensual adjunta a la versión 1.0 en App Store Connect | Pendiente (Lucas) |
| Convex producción se resuelve como `production` (`ORBITA_ENVIRONMENT` o `COMMERCE_MODE=live`) | Pendiente (Lucas → Codex, sólo lectura) |
| Backend de CORE-1043 desplegado antes de instalar el binario | Pendiente (Lucas → Codex) |
| Páginas `/privacy`, `/terminos` y `/support` sin botón de compra web | Pendiente |

## Verificaciones del IPA final

Sobre el `.ipa` que se envía, no sobre el código:

- Sin `EXUpdates*` (salvo `EXUpdatesInterface`) ni `u.expo.dev`; `Expo.plist`
  con `EXUpdatesEnabled = false`.
- Sin `BackofficeLab`, `orbita-lab` ni emails de operadores en `main.jsbundle`.
- `CFBundleShortVersionString` 1.0.0 y `CFBundleVersion` igual a `app.json`.

El IPA de prueba del 04/10/2026 (commit `1415e55`) pasó las tres.

## Borrador de respuesta a Apple (lo envía Lucas)

```text
Hello,

Thank you for the review. We have gone through the app and our submission
against guideline 5.6 and made the following changes in build 41:

1. Removed the over-the-air update library. The previous build included
   expo-updates, which could deliver JavaScript changes outside App Review. It
   has been removed entirely: the binary no longer contains it and cannot load
   remote code.
2. Removed a link to an external web billing portal that was only shown to
   accounts with a subscription purchased on our website.
3. Disabled an internal onboarding inspection parameter in the native app.
4. Corrected our review notes. The previous notes did not describe the paid
   tier. The new notes list every free and paid feature and where the paywall
   and the in-app purchase are located.
5. Replaced the demo account. The previous one already had the subscription
   active, which hid the paywall and the locked states. The new demo account is
   a free account.

No feature in the app is enabled, disabled or changed remotely for specific
accounts, dates or regions. If there is a specific feature or behavior that
prompted this finding, we would appreciate knowing which one so we can address
it directly.

Thank you,
Lucas Ramos
```

Ajustar con lo que Lucas ya respondió el 07/09/2026 para no contradecirlo.

## Listo para «Add for Review»

- [ ] PR de CORE-1042, 1043, 1044 y 1045 en `main`, con checks verdes.
- [ ] Backend desplegado y verificado.
- [ ] IPA compilado desde `main` limpio e inspeccionado.
- [ ] Recorrido en dispositivo con cuenta Free nueva: alta, paywall, bloqueos,
      compra Sandbox, restauración, borrado de cuenta.
- [ ] Mismo recorrido en la web para comparar.
- [ ] Notas, ficha, capturas, App Privacy y cuenta de revisión cargadas.
- [ ] Aprobación explícita de Lucas.
