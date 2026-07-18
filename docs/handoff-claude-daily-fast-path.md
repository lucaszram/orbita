# Handoff frontend — carta inmediata y enriquecimiento progresivo

## Objetivo

Separar en la app la carta diaria, que ya está lista en la primera respuesta, de los módulos personalizados que pueden completarse después. Este handoff no autoriza cambios dentro del PR backend.

## Contrato compatible

`daily.getGuide()` conserva sus argumentos y el payload v3 para build 16. Suma metadata opcional:

```ts
enrichment?: {
  status: "pending" | "ready" | "fallback" | "error";
  requestedAt: number;
  completedAt?: number;
  retryAfter?: number;
  attempt: number;
};
```

`carta` sigue llegando completa en la primera respuesta: `id`, `nombre`, `correspondencia`, `orientacion`, `ritual` y `beats` de compatibilidad. `ritual` ya es la pieza editorial canónica del catálogo de 156 lecturas, no un placeholder ni una plantilla de palo/rango. Una actualización posterior jamás cambia esa carta, su orientación, su ritual o el estado de revelado.

Para build 17 usar la nueva action `daily.getCard({ localDate?, timezone? })`:

```ts
{
  card: { ...carta, revealed: boolean, revealedAt?: number },
  enrichment: { status, requestedAt, completedAt?, retryAfter?, attempt },
  personalized: { headline, body, clima, destacado, secundarios, basadoEn, disclaimer, tesis?, guia?, topics?, lecturaLarga?, cierre? }
}
```

## Comportamiento requerido para build 17

1. Consumir `daily.getCard()` y habilitar el flip apenas existe `card`; no esperar `personalized.guia`, `topics`, `lecturaLarga` ni `enrichment.status=ready`.
2. Mostrar de inmediato el ritual editorial base completo.
3. Tratar los módulos personalizados por separado:
   - `pending`: skeleton discreto solo en esos módulos;
   - `ready`: mostrar contenido enriquecido;
   - `fallback`: conservar el contenido base, sin error global;
   - `error`: conservar carta/ritual y ofrecer reintento únicamente para el enriquecimiento.
4. Eliminar el timeout global de 60 s de `dailyGuideStore`. La carta no puede pasar a error por una generación tardía.
5. Suscribirse/actualizar los módulos cuando el backend publique el payload enriquecido, sin volver a tapar ni animar la carta.
6. No mostrar mocks en ningún estado autenticado.

## Checklist conjunto en dev

- Usuario/día nuevo: carta disponible en menos de 2 s.
- Reapertura: menos de 500 ms y misma carta/orientación/reveal.
- Dos aperturas simultáneas: una fila y un job.
- AstrologyAPI lento o AI Gateway caído: carta usable; módulos quedan en fallback.
- Enriquecimiento tardío: no cambia carta, ritual ni orientación.
- Logout/login, reinstalación y actualización: tira y lecturas existentes intactas.

## No hacer todavía

- No desplegar el frontend desacoplado en este PR.
- No retirar `beats` mientras circule un build que lo consuma.
- No publicar producción hasta aprobar las métricas reales en Convex dev y una muestra representativa del catálogo editorial de 156 rituales.
