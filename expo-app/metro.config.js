const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Required for the Firebase JS SDK (v9+) to resolve correctly under Metro.
// Without this, the app can crash immediately on launch with errors like
// "Component auth has not been registered yet" or similar module resolution failures.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
