# App Store Launch Pack - Órbita

Estado inicial: 2026-07-10.

Este documento organiza lo que hay que preparar para pasar de TestFlight/App Store
Connect a un lanzamiento publico en App Store.

## Contexto actual

- App: `Órbita`.
- iOS App Store Connect: `https://appstoreconnect.apple.com/apps/6788918249/testflight/ios`.
- Build subido: iOS `0.2.1 (6)`.
- `app.json` actual:
  - `name`: `Órbita`.
  - `bundleIdentifier`: `com.lucasssram.orbita`.
  - `supportsTablet`: `true`.
  - `ITSAppUsesNonExemptEncryption`: `false`.
  - Falta `icon` explicito para Expo/App Store.
- Producto: entretenimiento, autoconocimiento y contexto diario. No prometer destino,
  resultados garantizados, salud, dinero, decisiones legales ni consejo psicologico.

## Datos recibidos

- Nombre legal / copyright: `Lucas Ramos`.
- Telefono de contacto: `+54 11 70736894`.
- Email de contacto: `lucaszramos11@gmail.com`.
- iPad: Lucas esta abierto a incluirlo; preparar screenshots iPad si se mantiene
  `supportsTablet: true`.
- Precios: pendiente.
- Web publica de soporte/privacidad: RESUELTO. Paginas `/support` y `/privacy` en el
  export web (rutas `app/support.tsx`, `app/privacy.tsx`; contenido
  `src/components/web/orbita-legal.tsx`). URLs: `https://<dominio-produccion>/support`
  y `https://<dominio-produccion>/privacy` (confirmar dominio de Vercel).
- Paises v1: LatAm hispanohablante (setear en Availability).
- Sign-in required en App Review: OFF (cuenta opcional + paywall OFF; sin demo account).
- Release: manual.

Metadata y benchmark de trabajo: `docs/app-store-metadata-draft.md`.

## Fuentes Apple consultadas

- App Store Connect - Platform version information:
  `https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information`
- App Store Connect - Screenshot specifications:
  `https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications`
- App Store Connect - App privacy:
  `https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy`
- App Store Connect - Age ratings:
  `https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions`
- App Store Connect - App icon:
  `https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/`
- App Store Connect - Auto-renewable subscription information:
  `https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/auto-renewable-subscription-information`

## Pack obligatorio

### 1. Identidad publica

- Nombre de app: `Órbita`.
- Subtitulo: pendiente.
- Categoria primaria: pendiente. Candidatas: `Lifestyle` o `Entertainment`.
- Categoria secundaria: opcional.
- Copyright: pendiente. Formato esperado: `2026 Nombre legal`.
- Copyright recomendado con datos actuales: `2026 Lucas Ramos`.
- Rating de edad: pendiente de cuestionario Apple.

### 2. Copy de ficha App Store

Apple pide descripcion, keywords y support URL. Recomendado preparar:

- Promotional text: hasta 170 caracteres.
- Descripcion: hasta 4000 caracteres.
- Keywords: hasta 100 bytes, sin repetir `Órbita` ni nombres de competidores.
- Texto de novedades: no aplica para la primera version publica; si luego es update,
  hay que completarlo.
- Marketing URL: opcional.
- Support URL: obligatorio y debe tener forma real de contacto.

Primer enfoque de posicionamiento:

- `Tu carta natal y tu contexto diario, en una lectura clara.`
- `Astrologia como entretenimiento, autoconocimiento y ritmo diario.`
- Evitar en la ficha: `prediccion`, `destino`, `garantizado`, `salud`, `dinero`,
  `terapia`, `diagnostico`, `NASA/JPL`, `vedica`.

### 3. Imagenes

Apple pide entre 1 y 10 screenshots por dispositivo/localizacion. Para una ficha
seria, usar 5 o 6.

Como `supportsTablet` esta en `true`, Apple pide tambien screenshots de iPad.
Decision pendiente:

- Opcion A: lanzar universal y preparar iPhone + iPad.
- Opcion B: si el producto no esta listo para iPad, revisar si conviene desactivar
  tablet antes de release.

Tamaños principales a preparar:

- iPhone 6.9": `1290 x 2796`, `1320 x 2868` o `1260 x 2736` vertical.
- iPhone 6.5": requerido si no se provee 6.9"; tamaños `1284 x 2778` o
  `1242 x 2688`.
- iPad 13": requerido si app corre en iPad; tamaños `2064 x 2752` o
  `2048 x 2732`.

Storyboard recomendado para Órbita:

1. Inicio diario: `Tu cielo de hoy, explicado.`
2. Carta natal: `Sol, Luna y Ascendente en una sola lectura.`
3. Guia diaria: `Hacé, evitá y mirá el día con contexto.`
4. Tránsitos: `Entendé qué se mueve ahora.`
5. Lectura profunda / personalidad: `Una carta para volver a leerte.`
6. Paywall o privacidad: `Entretenimiento y autoconocimiento. Cancelás cuando quieras.`

Reglas visuales:

- Usar capturas reales de la app, no mockups que prometan features inexistentes.
- Mantener copy editable fuera de las imagenes fuente cuando se trabaje en Figma.
- No mostrar claims deterministas.
- No mostrar precio si todavia puede cambiar por territorio o App Store products.

### 4. Icono y splash

- Falta definir y configurar app icon en Expo.
- Requerimiento operativo: icono cuadrado final, sin transparencia, usable como app icon.
- Fuente visual: asset library de Órbita, idealmente una marca orbital sobria.
- El cambio de icono despues de publicar requiere nueva version y review.

### 5. Privacidad y legal

Apple pide Privacy Policy URL para todas las apps y declarar tipos de datos
recolectados.

Pendientes:

- URL de politica de privacidad.
- URL de soporte.
- URL opcional para opciones de privacidad / borrado de datos.
- Decidir datos declarados:
  - email / cuenta.
  - fecha, hora y lugar de nacimiento.
  - identificadores de compra/suscripcion.
  - crash/error logs si se agregan.
  - analytics si se instala.
- Flujo de borrar cuenta/datos: al menos tener una via de soporte clara para la
  primera version.

### 6. Review information

Apple pide contacto interno para review y, si la app requiere login, cuenta demo
que no expire.

Pendientes Lucas:

- Nombre de contacto.
- Email.
- Telefono.
- Demo account para App Review, si el onboarding/login bloquea contenido.
- Notas de review: explicar que Órbita es entretenimiento/autoconocimiento,
  no consejo profesional ni prediccion garantizada.

### 7. Suscripciones / monetizacion

Si se lanza cobrando:

- Crear productos en App Store Connect.
- Crear grupo de suscripcion.
- Confirmar nombres visibles, precios y duraciones.
- Revisar que coincidan con RevenueCat y con el paywall.
- Preparar screenshot de App Review para cada producto si Apple lo pide.

Producto vigente en diseño:

- Semanal: `$5` por semana.
- Anual: `$30` / `$0.58 por semana`.
- Default: anual.

Decision pendiente: confirmar si esos precios quedan para lanzamiento o si se
ajustan por pais/territorio.

## Que necesito que pase Lucas

- Acceso/estado de App Store Connect si hay campos ya cargados.
- Nombre legal/copyright.
- Email y telefono de soporte/review.
- Dominio o URL donde poner soporte y privacidad.
- Decision de categoria: Lifestyle vs Entertainment.
- Decision de disponibilidad: paises/territorios.
- Decision de iPad: universal o iPhone-only.
- Decision de precios reales.
- Confirmacion de datos recolectados y terceros: Clerk, Convex, RevenueCat,
  Apple IAP, analytics/crash si se agregan.

## Que puede armar Codex

- Borrador de metadata App Store: subtitulo, promotional text, descripcion,
  keywords, review notes.
- Checklist de privacidad segun dependencias reales.
- Plan de screenshots y captions.
- Documento de soporte/FAQ y politica de privacidad base, para revision legal.
- Handoff tecnico para configurar icono, envs, productos y review notes.

## Que deberia armar Claude / frontend

- Icono final y splash en assets.
- Capturas reales desde build/TestFlight.
- Si hace falta, pantalla por pantalla para que lo mostrado en screenshots sea real,
  no una promesa visual.
- Ajustes de UI visibles antes de captura final.

## Orden recomendado

1. Cerrar alcance de lanzamiento: MVP con Carta + Inicio + Tránsitos reales, y ocultar
   lo que siga mock.
2. Cerrar legal basico: soporte, privacidad, datos recolectados, categoria, edad.
3. Cerrar monetizacion: productos App Store, RevenueCat, restore, entitlement.
4. Generar icono + splash.
5. Capturar screenshots reales.
6. Escribir metadata final.
7. Crear cuenta demo y notas de App Review.
8. Subir a review con release manual, no automatico, para controlar la salida.
