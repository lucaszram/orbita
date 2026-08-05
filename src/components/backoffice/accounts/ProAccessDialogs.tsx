/**
 * Los dos diálogos que escriben entitlements: dar Pro manual y sacarlo.
 *
 * Reglas que la UI no puede relajar:
 *  · la razón queda en auditoría, así que se valida ANTES de llamar al backend;
 *  · revocar se advierte en el propio diálogo — no cancela Stripe ni RevenueCat;
 *  · si `canManagePro` es falso, los controles quedan deshabilitados CON el
 *    motivo a la vista, no escondidos.
 *
 * La validación es pura y vive en `src/domain/adminAccounts.ts`; acá sólo se
 * junta el formulario y se muestra lo que ese módulo decide.
 */
import { useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";

import {
  ADMIN_GRANT_PRESETS,
  ADMIN_REASON_MAX,
  ADMIN_REVOKE_WARNING,
  type AdminAccount,
  type AdminGrantPreset,
  type AdminGrantRequest,
  adminAccountName,
  buildAdminGrantDraft,
  checkAdminReason,
  resolveAdminGrantWindow,
  formatAdminDateTime
} from "@/domain/adminAccounts";

import { AdminDialog } from "../AdminDialog";
import { AdminButton, AdminChoiceGroup, AdminField, AdminInput, AdminNotice, backofficeColors as c } from "../kit";

export function GrantProDialog({
  visible,
  account,
  canManagePro,
  disabledExplanation,
  submitting,
  error,
  onClose,
  onSubmit
}: {
  visible: boolean;
  account: AdminAccount;
  canManagePro: boolean;
  disabledExplanation?: string;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (args: AdminGrantRequest) => void;
}) {
  const [preset, setPreset] = useState<AdminGrantPreset>("7d");
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  // Cada apertura arranca limpia: un formulario que recuerda la razón del
  // usuario anterior es la forma más fácil de auditar mal un grant.
  useEffect(() => {
    if (!visible) return;
    setPreset("7d");
    setCustomDate("");
    setReason("");
    setErrors([]);
  }, [visible]);

  const preview = resolveAdminGrantWindow({ preset, customDate, now: Date.now() });
  const previewText = !preview.ok
    ? preview.error
    : preview.mode === "permanent"
      ? "Pro sin vencimiento, hasta que se revoque a mano."
      : `Pro hasta ${formatAdminDateTime(preview.expiresAt)}.`;

  function handleSubmit() {
    const draft = buildAdminGrantDraft({
      userId: account.userId,
      preset,
      customDate,
      reason,
      now: Date.now()
    });
    if (!draft.ok) {
      setErrors(draft.errors);
      return;
    }
    setErrors([]);
    onSubmit(draft.args);
  }

  return (
    <AdminDialog
      description={`Acceso Pro manual para ${adminAccountName(account)}. Queda auditado con tu usuario y la razón.`}
      onClose={onClose}
      title="Dar Pro manual"
      visible={visible}
      footer={
        <>
          <AdminButton label="Cancelar" onPress={onClose} variant="secondary" />
          <AdminButton
            accessibilityHint={canManagePro ? undefined : disabledExplanation}
            disabled={!canManagePro || submitting}
            label={submitting ? "Aplicando…" : "Dar Pro"}
            onPress={handleSubmit}
            variant="primary"
          />
        </>
      }
    >
      {canManagePro ? null : (
        <AdminNotice tone="warning" title="Escrituras deshabilitadas">
          {disabledExplanation ?? ""}
        </AdminNotice>
      )}
      {error ? (
        <AdminNotice tone="danger" title="El backend rechazó el grant">
          {error}
        </AdminNotice>
      ) : null}
      {errors.length > 0 ? (
        <AdminNotice tone="danger" title="Falta completar">
          <View style={styles.errorList}>
            {errors.map((message) => (
              <Text key={message} selectable style={styles.errorText}>
                · {message}
              </Text>
            ))}
          </View>
        </AdminNotice>
      ) : null}

      <AdminField label="Duración">
        <AdminChoiceGroup
          disabled={!canManagePro}
          label="Duración del grant"
          onChange={setPreset}
          options={ADMIN_GRANT_PRESETS}
          value={preset}
        />
      </AdminField>

      {preset === "custom" ? (
        <AdminField hint="La fecha vence al final de ese día, hora UTC." label="Vence el (AAAA-MM-DD)">
          <AdminInput
            editable={canManagePro}
            label="Fecha de vencimiento del grant, formato AAAA-MM-DD"
            onChangeText={setCustomDate}
            placeholder="2026-12-31"
            value={customDate}
          />
        </AdminField>
      ) : null}

      <AdminNotice tone="neutral" title="Resultado esperado">
        {previewText}
      </AdminNotice>

      <AdminField hint={`${reason.trim().length}/${ADMIN_REASON_MAX} caracteres.`} label="Razón (queda en auditoría)">
        <AdminInput
          editable={canManagePro}
          label="Razón del grant Pro"
          multiline
          onChangeText={setReason}
          placeholder="Soporte: cuenta con cobro fallido en revisión."
          value={reason}
        />
      </AdminField>
    </AdminDialog>
  );
}

export function RevokeProDialog({
  visible,
  account,
  canManagePro,
  disabledExplanation,
  submitting,
  error,
  onClose,
  onSubmit
}: {
  visible: boolean;
  account: AdminAccount;
  canManagePro: boolean;
  disabledExplanation?: string;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (args: { userId: string; reason: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setReason("");
    setErrors([]);
  }, [visible]);

  function handleSubmit() {
    const check = checkAdminReason(reason);
    if (!check.ok) {
      setErrors([check.error]);
      return;
    }
    setErrors([]);
    onSubmit({ userId: account.userId, reason: check.reason });
  }

  return (
    <AdminDialog
      description={`Sacar el grant Pro manual de ${adminAccountName(account)}.`}
      onClose={onClose}
      title="Revocar Pro manual"
      visible={visible}
      footer={
        <>
          <AdminButton label="Cancelar" onPress={onClose} variant="secondary" />
          <AdminButton
            accessibilityHint={canManagePro ? undefined : disabledExplanation}
            disabled={!canManagePro || submitting}
            label={submitting ? "Revocando…" : "Revocar"}
            onPress={handleSubmit}
            variant="danger"
          />
        </>
      }
    >
      {canManagePro ? null : (
        <AdminNotice tone="warning" title="Escrituras deshabilitadas">
          {disabledExplanation ?? ""}
        </AdminNotice>
      )}
      <AdminNotice tone="warning" title="Esto no cancela ningún cobro">
        {ADMIN_REVOKE_WARNING}
      </AdminNotice>
      {error ? (
        <AdminNotice tone="danger" title="El backend rechazó la revocación">
          {error}
        </AdminNotice>
      ) : null}
      {errors.length > 0 ? (
        <AdminNotice tone="danger" title="Falta completar">
          <View style={styles.errorList}>
            {errors.map((message) => (
              <Text key={message} selectable style={styles.errorText}>
                · {message}
              </Text>
            ))}
          </View>
        </AdminNotice>
      ) : null}
      <AdminField hint={`${reason.trim().length}/${ADMIN_REASON_MAX} caracteres.`} label="Razón (queda en auditoría)">
        <AdminInput
          editable={canManagePro}
          label="Razón de la revocación"
          multiline
          onChangeText={setReason}
          placeholder="El grant de soporte ya no corresponde."
          value={reason}
        />
      </AdminField>
    </AdminDialog>
  );
}

const styles = StyleSheet.create({
  errorList: {
    gap: 3
  },
  errorText: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 19
  }
});
