Pod::Spec.new do |s|
  s.name           = 'OrbitaOfferCodes'
  s.version        = '1.0.0'
  s.summary        = 'Presenta la hoja nativa de canje de códigos de oferta de Apple.'
  s.description    = 'Puente mínimo hacia StoreKit: una sola función asíncrona que ' \
                     'presenta la UI de canje que Apple controla. No lee, valida ni ' \
                     'transporta el código, y no concede ningún acceso.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  # Sólo iOS: ni `AppStore.presentOfferCodeRedeemSheet(in:)` ni
  # `presentCodeRedemptionSheet` existen en tvOS, watchOS, macOS o Mac Catalyst.
  # El piso sigue en 15.1 —el mismo que declara ExpoModulesCore en SDK 54— y NO
  # sube a 16 aunque la API vigente sea la de StoreKit 2: la franja 15.1–15.x se
  # cubre en runtime con `#available` y el fallback de StoreKit 1.
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
