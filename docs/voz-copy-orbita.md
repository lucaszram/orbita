# Voz Copy Órbita

## Iteración 1

La voz de Órbita le habla a la persona, no del tema. Usa español LATAM rioplatense, voseo, tildes y signos de apertura.

## Reglas

- Hablarle a `vos`: `tu`, `te`, `elegís`, `querés`, `podés`, `sentís`.
- Usar tildes y signos de apertura en preguntas y exclamaciones: `¿Qué...?`, `¿Dónde...?`, `¡...!`.
- Evitar frases abstractas impersonales.
- Mantener guardrails: entretenimiento, autoconocimiento y contexto; sin destino, salud, dinero, legal, psicología clínica ni resultados garantizados.
- Aplicar la voz en headline, temas, tránsito, long-read y pregunta del día.

## Before / After

| Hoy P0 | Objetivo |
| --- | --- |
| `El deseo pide claridad antes que intensidad.` | `Hoy tu deseo busca claridad antes que intensidad.` |
| `Que queres cuidar sin sobreactuar?` | `¿Qué estás queriendo cuidar sin sobreactuar?` |
| `Una prioridad bien elegida ordena el dia.` | `Si elegís bien una prioridad, se te ordena el día.` |
| `Que tarea vuelve mas liviano el resto del dia?` | `¿Qué tarea te aliviana el resto del día?` |

## Loop

1. Backend baja la voz a prompts y builders.
2. Se regenera un día real.
3. Se revisa en `/home`, `/valores`, `/personalidad` y `/transito`.
4. Se marca qué chirría y se refina.

## Iteración 2

Problema detectado: el subtítulo de Home repetía el mismo contenido que el módulo `Energía`, porque backend usaba `home.energy` como `header.subheadline`.

Regla nueva:

- `headline`: frase principal del día.
- `subheadline`: abre contexto, no repite el módulo.
- `energy`: tono/área activa para el bloque Energía.

Ejemplo:

| Campo | Objetivo |
| --- | --- |
| `headline` | `Saturno en cuadratura con tu Sol: hoy tenés contexto para mirar tu día sin apurarlo.` |
| `subheadline` | `Tu Sol en casa 1 queda en primer plano; vos elegís cómo responder.` |
| `energy` | `Casa 1: identidad y forma de entrar al mundo.` |

Nunca usar `energy` como subtítulo de Home.
