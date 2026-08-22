/**
 * Config plugin que elimina entitlements que agregan otros plugins pero que la
 * app NO usa, y que la API key de App Store Connect no puede sincronizar en el
 * provisioning profile:
 *   - aps-environment                  (lo mete expo-notifications; solo usamos
 *                                       notificaciones LOCALES, que no requieren push)
 *
 * Debe ir PRIMERO en el array de plugins de app.json: los mods de entitlements
 * corren en orden inverso al del array, así que el primero se ejecuta al final,
 * después de que Clerk/expo-notifications agregan los suyos.
 * Sign in with Apple sí se usa: su entitlement debe sobrevivir hasta el
 * archive final. Cuando se necesite push remoto, sacar aps-environment de acá
 * y regenerar las credenciales correspondientes.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withStripUnusedEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    if (config.modResults) {
      delete config.modResults['aps-environment'];
    }
    return config;
  });
};
