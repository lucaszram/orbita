/**
 * Pestaña `Cuentas` del backoffice.
 *
 * Acá se junta todo: métricas por rango, búsqueda, filtro, orden, paginación por
 * cursor, detalle y las dos escrituras de Pro. La lógica que se puede probar sin
 * renderizar está en `src/domain/adminAccounts.ts`; este archivo es el cableado.
 *
 * Dos decisiones que no son cosméticas:
 *
 * 1. **`getDashboard` es la puerta.** Es la única query que sale sin
 *    condiciones, con `throwOnError: false`, así que un acceso denegado (fuera
 *    de la allowlist, gate apagado) se dibuja como panel en vez de explotar en
 *    el render. Todo lo demás —incluidas las dos `usePaginatedQuery`, que NO
 *    tienen forma de no tirar— queda en `"skip"` hasta que el dashboard
 *    responde OK.
 *
 * 2. **Después de una mutación se cuenta lo que devolvió el backend.** Revocar
 *    borra el grant manual de Órbita y nada más: si la cuenta paga por Stripe o
 *    RevenueCat sigue siendo Pro, y eso es lo que se dice, nombrando al
 *    proveedor. El mensaje sale de `effectiveAccess`, nunca de la intención del
 *    click.
 */
import { useMutation, usePaginatedQuery, useQuery_experimental as useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ADMIN_ACTIVITY_PAGE_SIZE,
  ADMIN_PAGE_SIZE,
  ADMIN_SEARCH_LIMIT,
  type AdminAccount,
  type AdminAccountDetail,
  type AdminDashboard,
  type AdminGrantRequest,
  type AdminMutationOutcome,
  type AdminQueryState,
  type AdminRange,
  type AdminSegment,
  type AdminSort,
  adminBackfillNotice,
  adminDashboardMetrics,
  adminProControls,
  adminQueriesUnlocked,
  adminSearchIsActive,
  describeAdminError,
  describeAdminGrantOutcome,
  describeAdminRevokeOutcome,
  gatedArgs,
  normalizeAdminSearch
} from "@/domain/adminAccounts";
import { adminAccountsApi } from "@/services/adminAccountsRefs";

import { AdminButton, AdminEmpty, AdminLoading, AdminNotice, AdminPanel, AdminStat, backofficeColors as c } from "../kit";
import { AccountDetailPanel } from "./AccountDetailPanel";
import { AccountsFilters } from "./AccountsFilters";
import { AccountsList } from "./AccountsList";
import { GrantProDialog, RevokeProDialog } from "./ProAccessDialogs";

/** Lo que tarda el texto en convertirse en query. Escribir no es buscar. */
const SEARCH_DEBOUNCE_MS = 250;

export function AccountsWorkspace({ wide }: { wide: boolean }) {
  const [range, setRange] = useState<AdminRange>("30d");
  const [segment, setSegment] = useState<AdminSegment>("all");
  const [sort, setSort] = useState<AdminSort>("newest");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [dialog, setDialog] = useState<"grant" | "revoke" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | undefined>(undefined);
  const [outcome, setOutcome] = useState<AdminMutationOutcome | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const dashboardState = useQuery({
    query: adminAccountsApi.getDashboard,
    args: { range },
    throwOnError: false
  }) as AdminQueryState<AdminDashboard>;

  const unlocked = adminQueriesUnlocked(dashboardState.status);
  const searching = adminSearchIsActive(debouncedSearch);
  const selectedUserId = selected?.userId ?? null;

  const list = usePaginatedQuery(
    adminAccountsApi.listAccounts,
    gatedArgs(unlocked && !searching, { segment, sort }),
    { initialNumItems: ADMIN_PAGE_SIZE }
  );

  const searchState = useQuery({
    query: adminAccountsApi.searchAccounts,
    args: gatedArgs(unlocked && searching, {
      query: normalizeAdminSearch(debouncedSearch),
      segment,
      limit: ADMIN_SEARCH_LIMIT
    }),
    throwOnError: false
  }) as AdminQueryState<AdminAccount[]>;

  const detailState = useQuery({
    query: adminAccountsApi.getAccount,
    args: gatedArgs(unlocked, selectedUserId ? { userId: selectedUserId } : null),
    throwOnError: false
  }) as AdminQueryState<AdminAccountDetail | null>;

  const activity = usePaginatedQuery(
    adminAccountsApi.listActivity,
    gatedArgs(unlocked, selectedUserId ? { userId: selectedUserId } : null),
    { initialNumItems: ADMIN_ACTIVITY_PAGE_SIZE }
  );

  const grantPro = useMutation(adminAccountsApi.grantPro);
  const revokePro = useMutation(adminAccountsApi.revokePro);

  const now = Date.now();
  const dashboard = dashboardState.status === "success" ? dashboardState.data : null;
  const proControls = adminProControls(dashboard?.canManagePro ?? false);
  const accounts = searching
    ? searchState.status === "success"
      ? searchState.data
      : []
    : list.results;
  const listLoading = searching ? searchState.status === "pending" : list.status === "LoadingFirstPage";
  const metrics = useMemo(() => (dashboard ? adminDashboardMetrics(dashboard) : []), [dashboard]);

  async function runMutation(action: () => Promise<AdminMutationOutcome>) {
    setSubmitting(true);
    setMutationError(undefined);
    try {
      setOutcome(await action());
      setDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(describeAdminError(message).detail);
    } finally {
      setSubmitting(false);
    }
  }

  function handleGrant(args: AdminGrantRequest) {
    void runMutation(async () => describeAdminGrantOutcome(await grantPro(args)));
  }

  function handleRevoke(args: { userId: string; reason: string }) {
    void runMutation(async () => describeAdminRevokeOutcome(await revokePro(args)));
  }

  if (dashboardState.status === "pending") {
    return (
      <View style={styles.centered}>
        <AdminLoading label="Cargando el panel de cuentas…" />
      </View>
    );
  }

  if (dashboardState.status === "error") {
    const copy = describeAdminError(dashboardState.error.message);
    return (
      <View style={styles.centered}>
        <AdminPanel title={copy.denied ? "Acceso denegado" : "No se pudo cargar"}>
          <AdminNotice tone="danger" title={copy.title}>
            {copy.detail}
          </AdminNotice>
        </AdminPanel>
      </View>
    );
  }

  const backfill = dashboard ? adminBackfillNotice(dashboard.backfillStatus) : null;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.page}>
      {outcome ? (
        <AdminNotice tone={outcome.tone === "ok" ? "ok" : "warning"} title={outcome.title}>
          {outcome.detail}
        </AdminNotice>
      ) : null}
      {backfill ? (
        <AdminNotice tone="warning" title="Backfill">
          {backfill}
        </AdminNotice>
      ) : null}

      <View style={styles.stats}>
        {metrics.map((metric) => (
          <AdminStat detail={metric.detail} key={metric.key} label={metric.label} value={metric.value} />
        ))}
      </View>

      <AdminPanel title="Filtros">
        <AccountsFilters
          onRangeChange={setRange}
          onSearchChange={setSearch}
          onSegmentChange={setSegment}
          onSortChange={setSort}
          range={range}
          search={search}
          segment={segment}
          sort={sort}
          sortDisabled={searching}
        />
      </AdminPanel>

      <View style={[styles.split, wide && styles.splitWide]}>
        <View style={styles.listColumn}>
          <AdminPanel title={searching ? "Resultados" : "Cuentas"}>
            {listLoading ? (
              <AdminLoading label="Buscando cuentas…" />
            ) : searching && searchState.status === "error" ? (
              <AdminNotice tone="danger" title={describeAdminError(searchState.error.message).title}>
                {describeAdminError(searchState.error.message).detail}
              </AdminNotice>
            ) : accounts.length === 0 ? (
              <AdminEmpty>
                {searching
                  ? "Ninguna cuenta coincide con esa búsqueda."
                  : "No hay cuentas en este segmento."}
              </AdminEmpty>
            ) : (
              <AccountsList
                accounts={accounts}
                now={now}
                onSelect={(account) => {
                  setSelected(account);
                  setOutcome(null);
                  setMutationError(undefined);
                }}
                selectedUserId={selectedUserId}
                wide={wide}
              />
            )}
            {!searching && (list.status === "CanLoadMore" || list.status === "LoadingMore") ? (
              <AdminButton
                disabled={list.status === "LoadingMore"}
                label={list.status === "LoadingMore" ? "Cargando…" : "Cargar más cuentas"}
                onPress={() => list.loadMore(ADMIN_PAGE_SIZE)}
              />
            ) : null}
            {searching ? (
              <Text style={styles.hint}>La búsqueda devuelve hasta {ADMIN_SEARCH_LIMIT} coincidencias, sin paginar.</Text>
            ) : null}
          </AdminPanel>
        </View>

        <View style={styles.detailColumn}>
          {selected ? (
            <AccountDetailPanel
              activity={{ loadMore: () => activity.loadMore(ADMIN_ACTIVITY_PAGE_SIZE), results: activity.results, status: activity.status }}
              onGrant={() => {
                setMutationError(undefined);
                setDialog("grant");
              }}
              onRevoke={() => {
                setMutationError(undefined);
                setDialog("revoke");
              }}
              proControls={proControls}
              state={detailState}
            />
          ) : (
            <AdminPanel title="Cuenta">
              <AdminEmpty>Elegí una cuenta del listado para ver su acceso, su actividad y sus preguntas del Umbral.</AdminEmpty>
            </AdminPanel>
          )}
        </View>
      </View>

      {selected ? (
        <>
          <GrantProDialog
            account={selected}
            canManagePro={!proControls.disabled}
            disabledExplanation={proControls.explanation}
            error={mutationError}
            onClose={() => setDialog(null)}
            onSubmit={handleGrant}
            submitting={submitting}
            visible={dialog === "grant"}
          />
          <RevokeProDialog
            account={selected}
            canManagePro={!proControls.disabled}
            disabledExplanation={proControls.explanation}
            error={mutationError}
            onClose={() => setDialog(null)}
            onSubmit={handleRevoke}
            submitting={submitting}
            visible={dialog === "revoke"}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: c.background,
    flex: 1
  },
  content: {
    alignSelf: "center",
    gap: 16,
    maxWidth: 1280,
    padding: 20,
    paddingBottom: 48,
    width: "100%"
  },
  centered: {
    backgroundColor: c.background,
    flex: 1,
    gap: 16,
    padding: 20
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  split: {
    flexDirection: "column",
    gap: 16
  },
  splitWide: {
    alignItems: "flex-start",
    flexDirection: "row"
  },
  listColumn: {
    flex: 1.3,
    minWidth: 0
  },
  detailColumn: {
    flex: 1,
    minWidth: 0
  },
  hint: {
    color: c.muted,
    fontSize: 12,
    lineHeight: 17
  }
});
