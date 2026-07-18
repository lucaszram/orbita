# App Store Metadata Draft - Órbita

> Borrador histórico iniciado el 2026-07-10. Para la metadata y los gates
> vigentes usar `docs/app-review-readiness.md`.

Estado: 2026-07-10.

Este documento junta benchmark, decisiones de posicionamiento y un primer borrador
de metadata para App Store. Es borrador: antes de enviar hay que confirmar que
la app publicada muestre exactamente las funciones prometidas.

## Datos recibidos de Lucas

- Nombre legal / copyright: `Lucas Ramos`.
- Telefono de contacto: `+54 11 70736894`.
- Email de contacto: `lucaszramos11@gmail.com`.
- iPad: Lucas esta abierto a incluirlo.
- Precios: pendiente.
- Web publica: RESUELTO. Se crearon paginas `/support` y `/privacy` en el export web
  (Vercel). Rutas: `app/support.tsx`, `app/privacy.tsx`; contenido en
  `src/components/web/orbita-legal.tsx`. URLs finales:
  `https://<dominio-produccion>/support` y `https://<dominio-produccion>/privacy`
  (falta confirmar dominio exacto de Vercel).
- Paises v1: LatAm hispanohablante.
- Tono: voseo argentino (voz de marca) aunque el locale sea es-MX.
- Sign-in required en App Review: OFF. La cuenta es opcional (`onSkip` en
  `AccountScreen`) y el paywall esta OFF (`PAYWALL_ENABLED = false`), asi que no hace
  falta demo account.
- Release: manual.

Uso recomendado:

- Para App Review: usar nombre, email y telefono anteriores.
- Para soporte publico: usar email; evaluar si conviene mostrar telefono en la web
  publica o reservarlo para App Review/cumplimiento.
- Copyright App Store: `2026 Lucas Ramos`.

## Benchmark App Store

Fuentes directas:

- Co-Star: `https://apps.apple.com/us/app/co-star-personalized-astrology/id1264782561`
- The Pattern: `https://apps.apple.com/us/app/the-pattern-astrology/id1071085727`
- CHANI: `https://apps.apple.com/us/app/chani-your-astrology-guide/id1532791252`
- Nebula: `https://apps.apple.com/us/app/nebula-spiritual-guidance/id1459969523`
- Apple metadata limits: `https://developer.apple.com/help/app-store-connect/reference/app-information/app-information`
- Apple product page metadata: `https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information`

### Tabla rapida

| App | Subtitulo visible | Categoria | Rating / volumen | Insight |
| --- | --- | --- | --- | --- |
| Co-Star | `Horoscopes from the Void` | Lifestyle | 4.8 / 205K | Voz fuerte, misterio, social/compatibilidad, daily personalized. Riesgo: claims NASA/AI no replicables para Órbita. |
| The Pattern | Self/relationship insight | Lifestyle | 3.9 / 14K | Menos jerga astrologica, foco en patrones personales y vinculos. Mucho contenido premium. |
| CHANI | Learn/reflect/grow | Lifestyle | 4.9 / 55K | Voz editorial y humana, aprendizaje + rituales + comunidad. Mas wellness; cuidar no copiar claims de sanacion. |
| Nebula | `Daily Horoscope & Astrology` | Lifestyle | 4.6 / 170K | SEO directo, muchas features y lectura comercial agresiva. Buen benchmark de keywords, no de tono Órbita. |

### Patrones que sirven para Órbita

- Categoria primaria: `Lifestyle`. Es la categoria comun de los referentes.
- Subtitulo: claro, de 30 caracteres maximo. Las mejores fichas dicen el beneficio
  en una frase corta, no una lista completa de features.
- Description: empieza con valor emocional, luego enumera funciones.
- Keywords: combinan terminos genericos de busqueda (`astrology`, `horoscope`,
  `birth chart`) con terminos de producto.
- Privacidad: las apps fuertes muestran email/soporte/politica en la ficha o en
  links claros.

### Patrones a evitar

- No prometer exactitud absoluta ni futuro garantizado.
- No usar `NASA/JPL` salvo que haya decision tecnica real y backing.
- No decir que la app reemplaza terapia, coaching, salud, dinero o decisiones legales.
- No inflar con features que en la version publica sigan mock o `Proximamente`.
- No copiar el tono de Co-Star literalmente; Órbita es mas sobria, local y editorial.

## Posicionamiento recomendado

Órbita no deberia competir como “la app mas mistica” ni como “la mas cientifica”.
La posicion mas propia es:

> Una lectura diaria y personal de tu carta natal, escrita con tono editorial,
> para entender el momento sin convertirlo en destino.

Promesa segura:

- Carta natal.
- Tránsitos del dia.
- Guia diaria breve.
- Lecturas profundas.
- Entretenimiento y autoconocimiento.

No prometer todavia:

- Compatibilidad/vinculos si no esta listo.
- Calendario completo si no esta listo.
- Predicciones de amor/trabajo/dinero.
- Consejos psicologicos o terapeuticos.

## Metadata propuesta

### Nombre

`Órbita`

### Subtitulo

Opcion recomendada:

`Carta natal y guía diaria`

Motivo: entra en 30 caracteres, comunica dos valores principales y no promete de mas.

Alternativas:

- `Astrología para tu día`
- `Carta natal y tránsitos`
- `Tu cielo diario`

### Promotional text

Opcion recomendada:

`Conocé tu carta natal, seguí los tránsitos del día y leé una guía breve para entender tu momento con más contexto.`

Alternativas:

- `Una lectura diaria de tu carta natal, tus tránsitos y el clima del momento. Astrología como contexto, no destino.`
- `Tu carta, tus tránsitos y una guía diaria escrita con tono claro, breve y personal.`

### Categoria

- Primaria: `Lifestyle`.
- Secundaria: `Entertainment` opcional.

Motivo: los benchmarks principales estan en Lifestyle y Órbita se posiciona como
autoconocimiento/ritmo diario. Evitar `Health & Fitness` para no disparar lecturas
de wellness/medical device y porque el producto no da consejos de salud.

### Keywords

Opcion recomendada, 91 bytes:

`astrologia,carta natal,horoscopo,luna,transitos,zodiaco,ascendente,signos,guia diaria,cielo`

Opcion mas corta, 73 bytes:

`astrologia,carta natal,horoscopo,luna,transitos,zodiaco,ascendente,signos`

Notas:

- No repetir `Órbita`; Apple ya busca por nombre de app y vendedor.
- No usar nombres de competidores.
- Sin acentos para ahorrar bytes y cubrir busquedas sin tilde.
- No usar `compatibilidad` hasta que la feature este lista.

### Descripcion

```text
Órbita es una app de astrología para leer tu carta natal y mirar cada día con más contexto.

Partimos de tus datos de nacimiento para construir una lectura personal: Sol, Luna, Ascendente, carta natal y tránsitos del momento. La idea no es decirte qué va a pasar. Es darte un mapa claro para entender qué temas están activos y cómo se siente el clima del día.

Qué podés encontrar en Órbita:

- Tu carta natal explicada en lenguaje claro.
- Sol, Luna y Ascendente como punto de partida.
- Tránsitos diarios personalizados.
- Una guía diaria con foco, energía y acciones simples.
- Lecturas más profundas para volver a mirar tu momento.
- Una experiencia oscura, editorial y tranquila, pensada para leer sin ruido.

Órbita usa la astrología como entretenimiento, autoconocimiento y contexto diario. No reemplaza asesoramiento profesional médico, psicológico, legal ni financiero.
```

### Notas App Review

```text
Órbita is an astrology and self-knowledge app for entertainment and daily context.

The app asks for birth date, birth time, and birth place to calculate a natal chart and personalized daily astrology content. It does not provide medical, psychological, legal, financial, or guaranteed predictive advice.

If a reviewer needs access to paid or account-gated content, please use the demo account provided in the review credentials section. Support contact: lucaszramos11@gmail.com.
```

Pendiente: crear demo account cuando el flujo de login/paywall quede cerrado.

## Privacidad: que significa declarar

En App Store Connect, “declarar datos” significa responder que tipos de datos
recolecta la app, para que se usan y si estan vinculados a la identidad del usuario.
Apple muestra eso como la ficha de privacidad de la app.

Para Órbita, la declaracion probable si usamos Clerk + Convex + RevenueCat/Apple IAP:

### Data Linked to You

- Contact Info:
  - Email Address.
  - Name, solo si se guarda nombre.
- User Content:
  - Notas, preguntas o contenido que escriba el usuario, si se guarda.
- Identifiers:
  - User ID.
  - Device ID o app instance ID, si se usa para sesion, compras, analytics o push.
- Purchases:
  - Suscripcion / entitlement / historial de compra si RevenueCat o Apple IAP lo exponen a la app/backend.
- Other Data:
  - Fecha de nacimiento.
  - Hora de nacimiento.
  - Lugar de nacimiento.
  - Datos derivados de carta natal.

Usos:

- App Functionality.
- Product Personalization.
- Analytics, solo si agregamos analytics.

### Data Not Linked to You

- Diagnostics:
  - Crash Data.
  - Performance Data.

Solo declarar esto si agregamos crash/error reporting o si una dependencia lo
recolecta en nuestro nombre.

### Cosas a confirmar antes de enviar

- Si usamos analytics: proveedor, eventos y si quedan vinculados al usuario.
- Si usamos push notifications: token y proposito.
- Si el lugar de nacimiento se declara como `Other Data` o `Location`; recomendacion
  actual: `Other Data`, porque no es ubicacion actual del dispositivo.
- Si se guarda journal/preguntas: declarar `User Content`.
- Si RevenueCat queda activo: declarar Purchases + Identifiers segun configuracion.

## Web minima necesaria

Necesitamos una web publica con al menos:

- `/support`: email de soporte, nombre legal, telefono o via de contacto, FAQ minima.
- `/privacy`: politica de privacidad.
- `/terms`: recomendable si hay suscripcion.

Opcion simple:

- Levantar una landing minima en el dominio actual de Órbita/Vercel.
- Hacerla sobria: logo, soporte, privacidad, terminos.
- No hace falta una landing marketinera grande para poder enviar App Store.

## Screenshot captions

Propuesta para 6 capturas:

1. `Tu cielo de hoy, explicado.`
2. `Carta natal clara, sin ruido.`
3. `Sol, Luna y Ascendente en contexto.`
4. `Tránsitos diarios personalizados.`
5. `Una guía breve para volver al día.`
6. `Astrología como contexto, no destino.`

Condicion: cada caption debe corresponder a una pantalla real de la build enviada.

## Pendientes de Lucas

- Confirmar si `Lucas Ramos` es el copyright final visible.
- Confirmar si el telefono puede aparecer en soporte publico o solo en App Review.
- Confirmar si arrancamos con `Lifestyle` + `Entertainment`.
- Confirmar paises de salida.
- Confirmar si iPad queda incluido en la primera version publica.
- Definir precios o decidir que el primer envio a review no cobra todavia.
- Elegir URL/dominio para soporte y privacidad.

## Pendientes de implementacion

- Configurar icono final en `app.json`.
- Crear o publicar web publica soporte/privacidad.
- Crear demo account.
- Configurar productos App Store si se lanza cobrando.
- Revisar que las pantallas mostradas en screenshots no sean mock ni features futuras.
