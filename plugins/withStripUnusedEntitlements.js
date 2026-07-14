/**
 * Config plugin que elimina entitlements que agregan otros plugins pero que la
 * app NO usa, y que la API key de App Store Connect no puede sincronizar en el
 * provisioning profile:
 *   - com.apple.developer.applesignin  (lo mete @clerk/expo; no usamos Apple login)
 *   - aps-environment                  (lo mete expo-notifications; solo usamos
 *                                       notificaciones LOCALES, que no requieren push)
 *
 * Debe ir PRIMERO en el array de plugins de app.json: los mods de entitlements
 * corren en orden inverso al del array, así que el primero se ejecuta al final,
 * después de que Clerk/expo-notifications agregan los suyos.
 * Cuando se necesite push remoto o Apple login, sacar la key de acá y hacer un
 * build/credenciales con login Apple ID (username+2FA), no con API key.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withStripUnusedEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    if (config.modResults) {
      delete config.modResults['com.apple.developer.applesignin'];
      delete config.modResults['aps-environment'];
    }
    return config;
  });
};
