/**
 * En nativo no hay export estático: `isStaticRender()` es siempre `false` y la
 * cáscara pública nunca se monta. Esta variante existe para que el layout raíz
 * —que es COMPARTIDO— pueda importarla sin arrastrar la landing ni las páginas
 * legales de la web al bundle nativo, que es el mismo motivo por el que las
 * implementaciones de ruta viven en `src/routes/v492`.
 */
export function isStaticRender(): boolean {
  return false;
}

export function WebStaticDocument() {
  return null;
}
