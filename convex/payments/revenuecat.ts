import {
  httpActionGeneric as httpAction,
  internalMutationGeneric as internalMutation,
  makeFunctionReference
} from "convex/server";
import { v } from "convex/values";
import { PRO_ENTITLEMENT } from "../lib/entitlements";
import {
  constantTimeStringEqual,
  deriveRevenueCatEventDecision,
  guardLifetimePrecedence,
  hasCanonicalRevenueCatEntitlement,
  isRevenueCatEnvironmentAllowed,
  revenueCatEnvironment,
  revenueCatEventTimestamp,
  revenueCatTransferCandidates,
  revenueCatUserCandidates,
  sanitizeRevenueCatEvent,
  stripConvexReservedKeys,
  transferOverwritesTarget
} from "../lib/revenueCatEvents";
import { enqueueStoreReconcileJob } from "./revenuecatRest";
import { omitUndefined } from "../lib/users";

const applyEventRef = makeFunctionReference<"mutation">("payments/revenuecat:applyRevenueCatEvent");

// POST /webhooks/revenuecat — valida el secreto compartido y delega en una
// única mutation atómica. RevenueCat hace una cantidad acotada de reintentos
// ante respuestas no-2xx; se aprovecha ese mecanismo si Clerk todavía no creó
// la fila local, sin guardar el evento como procesado antes de tiempo.
export const revenuecatWebhook = httpAction(async (ctx, request) => {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const provided = request.headers.get("Authorization");
  if (!expected || !provided || !constantTimeStringEqual(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const event = body?.event;
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    return new Response("Bad Request", { status: 400 });
  }

  /**
   * Saneo ANTES de cruzar a la mutation.
   *
   * Convex valida los argumentos antes de entrar al handler y rechaza los
   * nombres de campo que empiezan con `$`. RevenueCat manda
   * `subscriber_attributes` con `$displayName`, `$email` e `$idfa`, así que el
   * evento crudo hacía fallar el webhook con 500 sin ejecutar una sola línea de
   * lógica. RevenueCat reintenta un rato y abandona: un `INITIAL_PURCHASE`
   * perdido deja en Free a alguien que pagó.
   *
   * Se quitan SÓLO las claves reservadas. El resto del evento viaja entero,
   * porque la mutation lo necesita para identidad, transfers y entitlements.
   */
  await ctx.runMutation(applyEventRef, { event: stripConvexReservedKeys(event) });
  return new Response(null, { status: 200 });
});

export const applyRevenueCatEvent = internalMutation({
  args: { event: v.any() },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
      throw new Error("Invalid RevenueCat event");
    }

    // La consulta y el insert ocurren en la misma mutation, por lo que dos
    // entregas simultáneas no pueden aplicar el evento dos veces.
    const seen = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q: any) => q.eq("provider", "revenuecat").eq("eventId", event.id))
      .first();
    if (seen) return null;

    const now = Date.now();
    const environment = revenueCatEnvironment(event);
    const eventTimestamp = revenueCatEventTimestamp(event);

    /**
     * Fuerza la lectura autoritativa contra la REST de RevenueCat.
     *
     * Es la red de seguridad de todo este archivo: cada camino en el que el
     * webhook NO puede decidir con certeza —entorno sin declarar, identidad
     * ambigua— termina acá en vez de adivinar. También corre detrás de los
     * eventos aplicados, para que un evento perdido antes de éste se repare.
     *
     * El scheduler es opcional a propósito: la mutation tiene que poder
     * aplicarse igual en un contexto que no lo tenga.
     */
    const scheduleReconcile = async (clerkUserIds: Array<string | undefined>) => {
      // Sin scheduler no hay watchdog que sostenga la reparación. Se mantiene
      // la semántica conservadora de siempre: no se encola nada, y la rama que
      // depende de esto (evento sin `environment`) lanza en vez de marcar como
      // procesada una reparación que no existe.
      if (!ctx.scheduler) return;
      for (const clerkUserId of [...new Set(clerkUserIds.filter(Boolean))]) {
        // DIRECTO, con el mismo `ctx`: la señal de reconciliación se persiste
        // en ESTA transacción, junto con el evento aplicado y su auditoría.
        // Agendarla como una mutation posterior dejaba un hueco en el que una
        // corrida en vuelo —con un snapshot anterior a este webhook— todavía
        // se veía a sí misma como vigente y podía reescribir el acceso.
        await enqueueStoreReconcileJob(ctx, clerkUserId as string, `webhook:${event.type}`);
      }
    };

    const recordEvent = async (clerkUserId?: string, outcome?: string) =>
      ctx.db.insert(
        "paymentEvents",
        omitUndefined({
          provider: "revenuecat" as const,
          eventId: event.id,
          eventType: event.type,
          clerkUserId,
          // El campo conserva el nombre histórico, pero el cuerpo ya está
          // reducido a datos de lifecycle sin aliases ni atributos personales.
          rawPayload: sanitizeRevenueCatEvent(event, outcome),
          processedAt: Date.now()
        })
      );

    const findUsers = async (candidates: string[]) => {
      const usersById = new Map<string, any>();
      for (const candidate of candidates) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", candidate))
          .first();
        if (user) usersById.set(String(user._id), user);
      }
      return [...usersById.values()];
    };

    const transferIds = revenueCatTransferCandidates(event);

    // `TRANSFER` y `TEMPORARY_ENTITLEMENT_GRANT` pueden llegar SIN `environment`.
    // Descartarlos ahí perdía la señal; leerlos como production sería peor. Se
    // difiere la decisión a la lectura autoritativa, que sí conoce el entorno.
    //
    // Lo que NO se puede diferir es la identidad. Antes esta rama agendaba
    // `allCandidates` en crudo: un `TEMPORARY_ENTITLEMENT_GRANT` de A con un
    // alias que apunta a la cuenta local B disparaba la reconciliación de A **y**
    // de B, y como los aliases devuelven el MISMO `CustomerInfo`, una sola
    // compra terminaba dándole Pro a las dos. La identidad se resuelve acá,
    // contra las filas locales, antes de agendar nada.
    if (!environment) {
      // Un TRANSFER nombra dos cuentas legítimamente distintas: cada lado se
      // resuelve por separado y cada uno tiene que ser inequívoco.
      const scopes = (
        event.type === "TRANSFER"
          ? [transferIds.from, transferIds.to]
          : [revenueCatUserCandidates(event)]
      ).filter((list) => list.length > 0);

      if (scopes.length === 0) {
        await recordEvent(undefined, "ignored_without_resolvable_user");
        return null;
      }

      const resolved: string[] = [];
      for (const scope of scopes) {
        const users = await findUsers(scope);
        // Cero matches sigue siendo RECUPERABLE: no se registra el evento como
        // procesado y el retry acotado de RevenueCat lo vuelve a traer cuando
        // termine la carrera entre Clerk y Convex.
        if (users.length === 0) throw new Error("RevenueCat user is not available yet");
        // Más de uno: CUARENTENA. No se reconcilia ninguno.
        if (users.length > 1) {
          await recordEvent(undefined, "ignored_ambiguous_identity");
          return null;
        }
        resolved.push(users[0].clerkUserId);
      }

      // La reparación es lo ÚNICO durable que deja esta rama. Marcar el evento
      // como procesado sin haberla podido agendar lo daría por resuelto para
      // siempre sin que nadie vuelva a mirar.
      if (!ctx.scheduler) throw new Error("RevenueCat reconcile is not schedulable");
      await scheduleReconcile(resolved);
      await recordEvent(resolved[0], "deferred_unknown_environment");
      return null;
    }
    // El corte de entorno NO se decide acá: los candidatos son strings crudos
    // del evento y cualquiera de ellos podía estar en la allowlist sin ser el
    // dueño de la fila local. Se decide más abajo, contra la ÚNICA identidad
    // local que el evento resuelve. Lo único que se descarta ahora es un
    // production imposible en un deployment que no lo acepta jamás.
    if (environment === "production" && !isRevenueCatEnvironmentAllowed("production")) {
      await recordEvent(
        [...revenueCatUserCandidates(event), ...transferIds.from, ...transferIds.to][0],
        "ignored_environment_mismatch"
      );
      return null;
    }
    if (eventTimestamp === undefined) {
      await recordEvent(undefined, "ignored_invalid_timestamp");
      return null;
    }

    /**
     * La fila de la tienda de un usuario en ESTE entorno.
     *
     * `first()` sobre (usuario, proveedor) era ambiguo desde que production y
     * sandbox conviven: una cuenta de review tiene las dos y el orden del índice
     * decidía cuál se leía o se pisaba. Son una o dos filas: se colectan y se
     * elige por entorno, que es la clave real de esta fila.
     */
    const revenueCatRowFor = async (userId: unknown) => {
      const rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_user_provider", (q: any) => q.eq("userId", userId).eq("provider", "revenuecat"))
        .collect();
      return rows.find((row: any) => row.environment === environment) ?? null;
    };

    if (event.type === "TRANSFER") {
      const candidates = transferIds;
      if (candidates.from.length === 0 || candidates.to.length === 0) {
        await recordEvent(undefined, "ignored_transfer_without_resolvable_ids");
        return null;
      }

      const sourceUsers = await findUsers(candidates.from);
      const targetUsers = await findUsers(candidates.to);

      // Un usuario que todavía no fue materializado en Convex es recuperable:
      // no se inserta paymentEvents y RevenueCat vuelve a entregar el evento.
      if (sourceUsers.length === 0 || targetUsers.length === 0) {
        throw new Error("RevenueCat transfer user is not available yet");
      }
      if (sourceUsers.length !== 1 || targetUsers.length !== 1) {
        await recordEvent(undefined, "ignored_ambiguous_transfer");
        return null;
      }

      const sourceUser = sourceUsers[0];
      const targetUser = targetUsers[0];
      if (String(sourceUser._id) === String(targetUser._id)) {
        await recordEvent(targetUser.clerkUserId, "ignored_self_transfer");
        return null;
      }

      // El MISMO corte de entorno por identidad que el camino ordinario, que
      // este camino no aplicaba: en un deployment de producción con la
      // allowlist vacía, un TRANSFER `SANDBOX` movía Órbita Plus de A a B con
      // un recibo que producción no acepta de nadie. Se exige sobre las DOS
      // puntas —no sólo sobre quien recibe— porque el mismo evento apaga la
      // fila de origen, y apagar acceso pago desde un recibo que este
      // deployment no consume es igual de grave que concederlo.
      const permitido = [sourceUser, targetUser].every((user) =>
        isRevenueCatEnvironmentAllowed(environment, { clerkUserId: user.clerkUserId })
      );
      if (!permitido) {
        await recordEvent(targetUser.clerkUserId, "ignored_environment_mismatch");
        return null;
      }

      // La fila que se transporta es la de ESTE entorno, no la primera del
      // índice: con una fila production y otra sandbox conviviendo, `first()`
      // hacía que un TRANSFER de sandbox se topara con la production y se
      // descartara entero —o, peor, que moviera la equivocada—.
      const source = await revenueCatRowFor(sourceUser._id);
      if (!source) {
        throw new Error("RevenueCat transfer source is not available yet");
      }
      if (source.lastEventAt && eventTimestamp < source.lastEventAt) {
        await recordEvent(targetUser.clerkUserId, "ignored_stale_transfer");
        return null;
      }

      const target = await revenueCatRowFor(targetUser._id);

      // PRECEDENCIA EN EL DESTINO. La transferencia copiaba la fila de origen
      // ENTERA, así que mover una compra destruía otra distinta: una fuente
      // vencida apagaba un destino vigente, un mensual corto acortaba uno
      // largo, un mensual borraba un lifetime, y un lifetime A reemplazaba al
      // lifetime B con todo y `productId`.
      const degradaríaElDestino = !transferOverwritesTarget(source, target);

      // Solo se transporta una fila server-side ya existente y un TRANSFER
      // inequívoco. El evento por sí solo nunca inventa un entitlement.
      if (!degradaríaElDestino && (!target?.lastEventAt || eventTimestamp >= target.lastEventAt)) {
        const transferredEntitlement =
          source.entitlement === PRO_ENTITLEMENT || source.entitlement === "plus"
            ? PRO_ENTITLEMENT
            : "free";
        const targetFields = omitUndefined({
          userId: targetUser._id,
          clerkUserId: targetUser.clerkUserId,
          entitlement: transferredEntitlement,
          status: source.status,
          provider: "revenuecat" as const,
          plan: source.plan,
          productId: source.productId,
          providerCustomerId: targetUser.clerkUserId,
          providerSubscriptionId: source.providerSubscriptionId,
          originalTransactionId: source.originalTransactionId,
          currentPeriodEnd: source.currentPeriodEnd,
          isLifetime: source.isLifetime,
          willRenew: source.willRenew,
          environment,
          lastEventAt: eventTimestamp,
          updatedAt: now
        });
        if (target) {
          await ctx.db.patch(target._id, targetFields);
        } else {
          await ctx.db.insert("subscriptions", targetFields);
        }
      }

      // La fuente deja de dar acceso en la misma transacción en la que el
      // destino recibe la fila —o en la que se decide preservarla—. Si algo
      // falla, Convex revierte ambos cambios.
      await ctx.db.patch(source._id, {
        entitlement: "free",
        status: "expired",
        isLifetime: false,
        willRenew: false,
        lastEventAt: eventTimestamp,
        updatedAt: now
      });
      // La fila del destino es AGREGADA: con el acceso más fuerte preservado,
      // la verdad de lo transferido no cabe ahí. Queda auditado y la lectura
      // autoritativa de abajo lo reconcilia contra la tienda.
      await recordEvent(
        targetUser.clerkUserId,
        degradaríaElDestino ? "applied_transfer_target_preserved" : "applied_transfer"
      );
      await scheduleReconcile([sourceUser.clerkUserId, targetUser.clerkUserId]);
      return null;
    }

    const candidates = revenueCatUserCandidates(event);
    if (!hasCanonicalRevenueCatEntitlement(event)) {
      await recordEvent(candidates[0], "ignored_unrelated_entitlement");
      return null;
    }
    if (candidates.length === 0) {
      await recordEvent(undefined, "ignored_without_resolvable_user");
      return null;
    }

    // Se resuelven TODOS los candidatos (app_user_id, original_app_user_id y
    // aliases), no el primero que exista: si dos apuntan a cuentas locales
    // distintas, elegir una es elegir a quién darle o quitarle el acceso.
    const matched = await findUsers(candidates);
    if (matched.length === 0) {
      // No registrar como procesado: el retry acotado de RevenueCat puede
      // encontrar la fila cuando termine la carrera entre Clerk y Convex.
      throw new Error("RevenueCat user is not available yet");
    }
    if (matched.length > 1) {
      // CUARENTENA. Reconciliar los dos sería peor que no hacer nada: los
      // aliases devuelven el MISMO `CustomerInfo`, así que una sola compra
      // dejaría Pro a las dos cuentas. Queda auditado para resolverlo a mano.
      await recordEvent(undefined, "ignored_ambiguous_identity");
      return null;
    }
    const user = matched[0];

    // A1 — recién ahora se sabe A QUIÉN autoriza este recibo.
    if (!isRevenueCatEnvironmentAllowed(environment, { clerkUserId: user.clerkUserId })) {
      await recordEvent(user.clerkUserId, "ignored_environment_mismatch");
      return null;
    }

    const existing = await revenueCatRowFor(user._id);

    if (existing?.lastEventAt && eventTimestamp < existing.lastEventAt) {
      await recordEvent(user.clerkUserId, "ignored_stale_event");
      return null;
    }

    const decision = guardLifetimePrecedence(
      deriveRevenueCatEventDecision(event, existing ?? undefined),
      existing ?? undefined
    );
    if (decision.kind === "ignore") {
      // La decisión LOCAL no alcanza (faltan datos, la fila no existe todavía),
      // pero la tienda sí sabe qué pasó. Con una identidad única y demostrada,
      // preguntarle es seguro; con identidad ambigua no se reconcilia nada.
      await recordEvent(user.clerkUserId, `ignored_${decision.reason}`);
      await scheduleReconcile([user.clerkUserId]);
      return null;
    }
    if (decision.kind === "transfer") {
      // TRANSFER ya fue tratado antes de resolver la identidad ordinaria.
      await recordEvent(user.clerkUserId, "ignored_invalid_transfer_shape");
      return null;
    }
    if (!existing && (!decision.allowCreate || !decision.patch.entitlement || !decision.patch.status)) {
      await recordEvent(user.clerkUserId, "ignored_missing_subscription");
      return null;
    }

    const base = omitUndefined({
      userId: user._id,
      clerkUserId: user.clerkUserId,
      provider: "revenuecat" as const,
      providerCustomerId: user.clerkUserId,
      originalTransactionId:
        typeof event.original_transaction_id === "string" ? event.original_transaction_id : undefined,
      environment,
      lastEventAt: eventTimestamp,
      updatedAt: now
    });
    const fields = {
      ...base,
      ...omitUndefined(decision.patch)
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("subscriptions", fields);
    }

    // Un evento que quiso bajar un lifetime que no demostró haber reembolsado
    // se aplica RECORTADO. Queda con su propio outcome para poder auditarlo, y
    // la lectura autoritativa de abajo lo reconcilia contra la tienda.
    await recordEvent(
      user.clerkUserId,
      decision.preservedLifetime ? "applied_lifetime_preserved" : "applied"
    );
    // Aunque este evento se haya aplicado bien, uno anterior pudo perderse. La
    // lectura autoritativa cierra ese hueco sin depender de más webhooks.
    await scheduleReconcile([user.clerkUserId]);
    return null;
  }
});
