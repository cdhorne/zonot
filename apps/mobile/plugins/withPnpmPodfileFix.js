/**
 * Config plugin: iOS build fixes for pnpm monorepos + RN 0.85 + op-sqlite
 * (lifted from Fathom; cert-pinning/TrustKit dropped — Zonot has none).
 *
 * Fix 1 — op-sqlite's pod install fails because op-sqlite.podspec navigates
 * `../../../package.json` from its real path inside the pnpm virtual store and
 * lands in the wrong directory. CocoaPods evaluates the podspec while loading
 * the Podfile (inside use_native_modules!), so the fix must be inline Ruby at
 * the top of the Podfile — a pre_install hook runs too late.
 *
 * Fix 2 — `folly/coro/Coroutine.h` not found because Folly coroutine headers
 * require C++20. CocoaPods allows one post_install hook, so we inject into the
 * one expo prebuild already generates.
 */

// @expo/config-plugins is not hoisted by pnpm. Resolve it through expo's
// location in the virtual store, where it is always a sibling package.
const expoDir = require
  .resolve('expo/package.json', { paths: [`${__dirname}/..`] })
  .replace(/[\\/]package\.json$/, '');
const { withDangerousMod } = require(require.resolve('@expo/config-plugins', { paths: [expoDir] }));
const path = require('node:path');
const fs = require('node:fs');

// Runs at Podfile evaluation time (before use_native_modules!). The Podfile is at
// apps/mobile/ios/Podfile, so the pnpm workspace root is three levels up.
const PNPM_OP_SQLITE_FIX = `
workspace_root = File.expand_path("../../..", __dir__)
app_pkg = File.join(__dir__, "../package.json")
Dir.glob(File.join(workspace_root, "node_modules/.pnpm/@op-engineering+op-sqlite*/node_modules/@op-engineering/op-sqlite")).each do |pkg_dir|
  target = File.join(pkg_dir, "../../..")
  pkg_json = File.join(target, "package.json")
  File.write(pkg_json, File.read(app_pkg)) unless File.exist?(pkg_json)
end
`;

// Injected inside the existing post_install block (not as a new one).
const CPP20_FIX = `
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings["CLANG_CXX_LANGUAGE_STANDARD"] = "c++20"
    end
  end`;

module.exports = function withPnpmPodfileFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        console.warn('[withPnpmPodfileFix] Podfile not found, skipping.');
        return config;
      }
      let contents = fs.readFileSync(podfilePath, 'utf-8');
      if (contents.includes('PNPM_OP_SQLITE_FIX')) return config; // already applied

      contents = `# PNPM_OP_SQLITE_FIX\n${PNPM_OP_SQLITE_FIX}\n${contents.replace(
        /^(post_install do \|installer\|)/m,
        `$1\n${CPP20_FIX}`,
      )}`;

      fs.writeFileSync(podfilePath, contents);
      console.log('[withPnpmPodfileFix] Patched Podfile.');
      return config;
    },
  ]);
};
