# App Review — fuente de verdad

Estado: 2026-07-18. Este documento reemplaza las suposiciones operativas viejas de
`app-store-launch-pack.md` y `app-store-metadata-draft.md` cuando haya conflicto.

## Objetivo

Enviar Órbita 1.0 a App Review con **liberación manual**. Primero se valida el
mismo binario en TestFlight; aprobar la review no debe publicar automáticamente.

## Estado técnico confirmado

- App: `Órbita` — bundle `com.lucasssram.orbita` — App Store Connect
  `6788918249`.
- Release Candidate: `1.0.0 (17)`, generado desde `main`
  `d6a2b021077536a358e9908d886c5dec41701caf` y válido en TestFlight.
- iPhone-only (`supportsTablet: false`), orientación vertical e ícono configurado.
- `ITSAppUsesNonExemptEncryption: false` configurado.
- EAS `production` usa environment/channel de producción y tiene credenciales de
  App Store Connect configuradas.
- La app requiere cuenta. No existe Home invitada ni “seguir sin cuenta”.
- Primera versión gratuita: no debe mostrar Plus, precios, compras ni suscripciones.
- Soporte: https://orbitaastrologia.xyz/support (HTTP 200 verificado 2026-07-18).
- Privacidad: https://orbitaastrologia.xyz/privacy (HTTP 200 verificado 2026-07-18).

## Estado del Release Candidate

- [x] Backend de eliminación completo y carrera de lecturas corregidos en `main`.
- [x] Backend desplegado en Convex producción `exciting-bat-311`.
- [x] Frontend de cumplimiento mergeado: eliminar cuenta, Legal visible y Plus oculto.
- [x] Eliminación verificada con dos cuentas descartables; vuelve a la entrada.
- [x] Typecheck, suite `340/340`, export iOS y diff limpio.
- [x] IPA `1.0.0 (17)` generado localmente desde el commit exacto, firmado para App Store.
- [x] Build 17 recibido por Apple con estado `VALID`.
- [ ] Pasada física completa del build 17 en TestFlight.
- [ ] Cuenta dedicada de Apple creada y probada en instalación limpia.
- [ ] Metadata, privacidad, rating, screenshots y contacto completos en App Store Connect.
- [ ] Aprobación explícita de Lucas antes de “Add for Review”.

## Pasada obligatoria en TestFlight

- Instalación limpia: entrada con Crear cuenta / Iniciar sesión, sin Home invitada.
- Alta completa: email, contraseña, código, datos natales y Home real.
- Login por contraseña y alternativa por código; aviso de Spam y reenvío funcionan.
- Carta diaria aparece rápido, gira, conserva orientación y lectura al reabrir.
- Carta natal larga, Tránsitos, Umbral, Diario, guardadas y Editar datos funcionan.
- Logout/login conserva los datos de la misma cuenta.
- Soporte y Privacidad abren las URLs públicas.
- Plus, precios y suscripción no aparecen.
- Eliminar cuenta: cancelar no hace nada; confirmar borra Convex + Clerk + local y
  vuelve a la entrada; el mismo email puede iniciar un alta nueva.
- Sin mocks, datos ficticios, botones muertos, banners dev ni errores visibles.

## Cuenta de App Review

Crear **después** de que el Release Candidate use producción y antes de enviar:

- Email exclusivo controlado por Lucas; no guardar credenciales en Git.
- Contraseña estable y suficientemente fuerte.
- Email ya verificado y onboarding terminado.
- Datos natales de prueba completos.
- Carta diaria revelada y carta natal larga ya generada para evitar esperas del
  reviewer.
- No usar un código universal (`111111`) ni depender de un OTP para el acceso
  principal. Apple entra con email + contraseña.
- Probar las credenciales en una instalación limpia del mismo build enviado.

Las credenciales se cargan solamente en App Store Connect → App Review
Information → Sign-in required.

## Metadata propuesta

- Nombre: `Órbita`
- Subtítulo: `Carta natal y guía diaria`
- Categoría primaria: `Lifestyle`
- Categoría secundaria: `Entertainment`
- Copyright: `2026 Lucas Ramos`
- Support URL: https://orbitaastrologia.xyz/support
- Privacy Policy URL: https://orbitaastrologia.xyz/privacy
- Release: manual; sin phased release en la primera publicación.

### Descripción

Órbita es una app de astrología para leer tu carta natal y mirar cada día con
más contexto.

Partimos de tus datos de nacimiento para construir una lectura personal: Sol,
Luna, Ascendente, carta natal, tránsitos y una carta diaria. La idea no es decirte
qué va a pasar. Es darte un mapa claro para entender qué temas están activos y
cómo se siente el momento.

En Órbita podés encontrar:

- Tu carta natal explicada en lenguaje claro.
- Sol, Luna y Ascendente como punto de partida.
- Una carta diaria con lectura completa.
- Tránsitos diarios personalizados.
- Un diario para volver a tus lecturas.

Órbita usa la astrología como entretenimiento, autoconocimiento y contexto
diario. No reemplaza asesoramiento profesional médico, psicológico, legal ni
financiero.

### Keywords

`astrologia,carta natal,horoscopo,luna,transitos,zodiaco,ascendente,tarot,guia diaria`

## Privacidad a declarar en App Store Connect

Confirmar contra la build final, pero el mínimo probable es:

- Contact Info: email y nombre, vinculados al usuario, para funcionalidad.
- Identifiers: user ID, vinculado al usuario, para autenticación y funcionalidad.
- User Content: notas/preguntas guardadas, si continúan disponibles en la build.
- Other Data: fecha, hora y lugar de nacimiento y datos astrológicos derivados,
  vinculados al usuario, para personalización y funcionalidad.
- Purchases: **no declarar** si Plus/IAP/RevenueCat quedan completamente fuera de
  la primera versión y no se recolectan eventos de compra.
- Tracking: no, salvo que la build final agregue un SDK o uso que lo contradiga.

El lugar de nacimiento no es ubicación actual ni geolocalización del dispositivo.

## Screenshots

Capturar desde el Release Candidate real, sin Figma ni mocks, como mínimo:

1. Home + carta diaria: “Una carta para abrir el día.”
2. Ritual revelado: “Una lectura completa para tu momento.”
3. Carta natal: “Tu cielo de nacimiento, explicado.”
4. Tránsitos: “Entendé qué se mueve hoy.”
5. Diario: “Volvé a tus cartas y lecturas.”

Como la app es iPhone-only, no se preparan screenshots de iPad.

## Notas para App Review

```text
Órbita is an astrology and self-knowledge app for entertainment and daily
context. The app requires an account because birth data, the natal chart, daily
cards and saved readings are tied to the user's identity.

Use the demo credentials provided in the Sign-in Information section. The demo
account is already verified and has completed onboarding, so no email code is
required. Sign in with email and password.

Account deletion is available in Profile > Delete my account. The app also
provides visible links to its Privacy Policy and Support page in Profile.

Órbita does not provide medical, psychological, legal, financial or guaranteed
predictive advice. Support contact: lucaszramos11@gmail.com.
```

## Decisiones de Lucas pendientes

- Territorios exactos de disponibilidad inicial.
- Confirmar `Lifestyle` + `Entertainment`.
- Confirmar el email que se usará para la cuenta demo de Apple.
- Aprobar screenshots y metadata antes de cargarlos.

## Evidencia del build 17

- App Store Connect build ID: `43482860-b3d4-4a8f-b574-cef833631de5`.
- Estado Apple: `VALID`; versión `17`; mínimo iOS `17.0`.
- IPA: `/private/tmp/orbita-1.0.0-17.ipa` (artefacto local temporal).
- SHA-256: `b57aa7df5786b6b14e395746a04ac37bc852be421ca6dd08142eb9bbe687f666`.
- Verificado dentro del binario: Convex producción presente, Convex dev ausente y
  Clerk live presente.

## Definición de listo para “Add for Review”

- Backend y frontend App Review mergeados en `main`.
- Convex producción desplegado con aprobación explícita. **Cumplido.**
- Build candidato aprobado en TestFlight por Lucas.
- Cuenta demo probada en instalación limpia.
- URLs, privacidad, rating, territorios, screenshots, descripción y contacto
  completos en App Store Connect.
- Release configurado como manual.
