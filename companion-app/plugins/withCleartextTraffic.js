// `usesCleartextTraffic` is not a recognized top-level Expo config field -
// expo prebuild silently ignores it. The actual way to set
// android:usesCleartextTraffic="true" on the generated AndroidManifest.xml
// is a config plugin that edits it directly.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application.$["android:usesCleartextTraffic"] = "true";
    return config;
  });
};
