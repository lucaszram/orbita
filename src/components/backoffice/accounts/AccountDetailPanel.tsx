/**
 * Detalle de una cuenta: acceso efectivo, métricas, actividad y Umbral.
 *
 * Es puramente presentacional — las queries las gobierna el workspace — y todo
 * lo que muestra viene del backend:
 *  · el acceso que se lee es `effectiveAccess`, no el grant manual;
 *  · la actividad es la autoritativa (`source: "backend"`), paginada por cursor;
 *  · las preguntas del Umbral se muestran EXACTAS, sin recortar ni parafrasear,
 *    porque son el dato que la retención de 90 días va a borrar.
 */
import { StyleSheet, Text, View } from "react-native";

import {
  type AdminAccountDetail,
  type AdminActivityEvent,
  type AdminProControls,
  type AdminQueryState,
  adminAccountName,
  adminEventLabel,
  describeAdminAccess,
  describeAdminError,
  describeAdminManualGrant,
  formatAdminDate,
  formatAdminDateTime
} from "@/domain/adminAccounts";

import { AdminButton, AdminEmpty, AdminLoading, AdminNotice, AdminPanel, backofficeColors as c } from "../kit";

export type ActivityFeed = {
  results: AdminActivityEvent[];
  /** El estado tal cual lo devuelve `usePaginatedQuery`. */
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: () => void;
};

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text selectable style={styles.dataValue}>
        {value}
      </Text>
    </View>
  );
}

export function AccountDetailPanel({
  state,
  activity,
  proControls,
  onGrant,
  onRevoke
}: {
  state: AdminQueryState<AdminAccountDetail | null>;
  activity: ActivityFeed;
  proControls: AdminProControls;
  onGrant: () => void;
  onRevoke: () => void;
}) {
  if (state.status === "pending") {
    return (
      <AdminPanel title="Cuenta">
        <AdminLoading label="Cargando la cuenta…" />
      </AdminPanel>
    );
  }

  if (state.status === "error") {
    const copy = describeAdminError(state.error.message);
    return (
      <AdminPanel title="Cuenta">
        <AdminNotice tone="danger" title={copy.title}>
          {copy.detail}
        </AdminNotice>
      </AdminPanel>
    );
  }

  const detail = state.data;
  if (!detail) {
    return (
      <AdminPanel title="Cuenta">
        <AdminEmpty>Esta cuenta no tiene proyección de backoffice todavía. Corré el backfill o esperá su próxima actividad.</AdminEmpty>
      </AdminPanel>
    );
  }

  const { account, effectiveAccess, manualGrant, recentVoid } = detail;
  const access = describeAdminAccess(effectiveAccess);

  return (
    <View style={styles.stack}>
      <AdminPanel title={adminAccountName(account)}>
        <View style={styles.identity}>
          <Text selectable style={styles.identityLine}>
            {account.email ?? "Sin email"}
          </Text>
          <Text selectable style={styles.identityMeta}>
            Clerk {account.clerkUserId}
          </Text>
          <Text selectable style={styles.identityMeta}>
            Convex {account.userId}
          </Text>
        </View>
        <View style={styles.dataGrid}>
          <DataRow label="Alta" value={formatAdminDateTime(account.createdAt)} />
          <DataRow
            label="Alta completada"
            value={account.onboardingCompletedAt ? formatAdminDateTime(account.onboardingCompletedAt) : "No"}
          />
          <DataRow label="Racha actual" value={String(account.currentStreak)} />
          <DataRow label="Racha máxima" value={String(account.longestStreak)} />
          <DataRow label="Días activos" value={String(account.activeDayCount)} />
          <DataRow label="Contenido creado" value={String(account.contentCreatedCount)} />
          <DataRow
            label="Última actividad"
            value={account.lastActivityAt ? formatAdminDateTime(account.lastActivityAt) : "Sin actividad"}
          />
          <DataRow label="Día local" value={account.lastActivityDate ?? "—"} />
        </View>
      </AdminPanel>

      <AdminPanel
        title="Acceso efectivo"
        action={
          <View style={styles.actions}>
            <AdminButton
              accessibilityHint={proControls.explanation}
              disabled={proControls.disabled}
              label="Dar Pro"
              onPress={onGrant}
              variant="primary"
            />
            <AdminButton
              accessibilityHint={proControls.explanation}
              disabled={proControls.disabled}
              label="Revocar"
              onPress={onRevoke}
              variant="danger"
            />
          </View>
        }
      >
        <View style={styles.accessHead}>
          <Text style={[styles.accessLabel, access.isPro && styles.accessPro]}>{access.label}</Text>
          <Text selectable style={styles.accessDetail}>
            {access.detail}
          </Text>
        </View>
        <Text selectable style={styles.body}>
          {describeAdminManualGrant(manualGrant)}
        </Text>
        {proControls.explanation ? (
          <AdminNotice tone="warning" title="Sin permiso de escritura">
            {proControls.explanation}
          </AdminNotice>
        ) : null}
      </AdminPanel>

      <AdminPanel title="Actividad">
        {activity.status === "LoadingFirstPage" ? (
          <AdminLoading label="Cargando la actividad…" />
        ) : activity.results.length === 0 ? (
          <AdminEmpty>Sin eventos autoritativos registrados.</AdminEmpty>
        ) : (
          <View style={styles.events}>
            {activity.results.map((event) => (
              <View key={event.eventId} style={styles.event}>
                <Text style={styles.eventName}>
                  {adminEventLabel(event.eventName)}
                  {event.backfilled ? " · backfill" : ""}
                </Text>
                <Text selectable style={styles.eventMeta}>
                  {formatAdminDateTime(event.occurredAt)} · {event.localDate}
                  {event.entryPoint ? ` · ${event.entryPoint}` : ""}
                </Text>
                {event.question ? (
                  <Text selectable style={styles.eventQuestion}>
                    “{event.question}”
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
        {activity.status === "CanLoadMore" || activity.status === "LoadingMore" ? (
          <AdminButton
            disabled={activity.status === "LoadingMore"}
            label={activity.status === "LoadingMore" ? "Cargando…" : "Cargar más actividad"}
            onPress={activity.loadMore}
          />
        ) : null}
      </AdminPanel>

      <AdminPanel title="Umbral · preguntas conservadas">
        <Text style={styles.hint}>
          Se muestran textuales y sólo mientras duran: el backend borra las respuestas del Umbral a los 90 días.
        </Text>
        {recentVoid.length === 0 ? (
          <AdminEmpty>Sin preguntas dentro de la ventana de retención.</AdminEmpty>
        ) : (
          <View style={styles.events}>
            {recentVoid.map((answer) => (
              <View key={answer.voidAnswerId} style={styles.event}>
                <Text selectable style={styles.eventQuestion}>
                  “{answer.question}”
                </Text>
                <Text selectable style={styles.eventMeta}>
                  {answer.localDate} · {formatAdminDate(answer.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </AdminPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  identity: {
    gap: 3
  },
  identityLine: {
    color: c.ink,
    fontSize: 14
  },
  identityMeta: {
    color: c.muted,
    fontSize: 12
  },
  dataGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  dataRow: {
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: 2,
    minWidth: 150,
    padding: 10
  },
  dataLabel: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  dataValue: {
    color: c.ink,
    fontSize: 14
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  accessHead: {
    gap: 4
  },
  accessLabel: {
    color: c.muted,
    fontSize: 20,
    fontWeight: "800"
  },
  accessPro: {
    color: c.copper
  },
  accessDetail: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 19
  },
  body: {
    color: c.ink,
    fontSize: 13,
    lineHeight: 19
  },
  hint: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 18
  },
  events: {
    gap: 8
  },
  event: {
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    padding: 10
  },
  eventName: {
    color: c.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  eventMeta: {
    color: c.muted,
    fontSize: 12
  },
  eventQuestion: {
    color: c.ink,
    fontSize: 13,
    lineHeight: 19
  }
});
