// Expo config-plugin: разрешает приложению видеть установленные приложения,
// чтобы автоопределять их (Linking.canOpenURL по URL-схемам).
// Добавляет QUERY_ALL_PACKAGES + <queries> со схемами из каталога.
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const SCHEMES = [
  'whatsapp', 'tg', 'sgnl', 'viber', 'googlechrome', 'firefox', 'yandexbrowser',
  'googlegmail', 'notion', 'obsidian', 'vlc', 'comgooglemaps',
];

module.exports = function withInstalledAppsQuery(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // QUERY_ALL_PACKAGES
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const has = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.QUERY_ALL_PACKAGES',
    );
    if (!has) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.QUERY_ALL_PACKAGES' },
      });
    }

    // <queries> со схемами (на случай ограничений QUERY_ALL_PACKAGES)
    manifest.queries = manifest.queries || [{}];
    const q = manifest.queries[0];
    q.intent = q.intent || [];
    for (const scheme of SCHEMES) {
      q.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      });
    }
    return cfg;
  });
};
