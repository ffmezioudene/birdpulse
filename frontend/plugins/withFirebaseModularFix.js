/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * withFirebaseModularFix
 * -----------------------------------------------------------------------------
 * Fixes iOS pod-install errors that surface when @react-native-firebase is
 * combined with `use_frameworks! :linkage => :static`. Under that combination
 * Xcode compiles pods with -Werror on non-modular includes, which causes the
 * build to fail with messages like:
 *
 *     include of non-modular header inside framework module 'RNFBApp...'
 *     (React/RCTConvert.h, React/RCTBridgeModule.h, React/RCTEventEmitter.h)
 *
 * The fix — recommended by both Firebase and RN-Firebase docs — is to relax
 * that specific warning on every pod target. We do this in a Podfile
 * `post_install` hook so it applies to every pod that CocoaPods produces on
 * a clean install, no matter how many transitive deps ship.
 *
 * The `extraPods` GoogleUtilities modular-headers entry lives in app.json
 * (via expo-build-properties) — this plugin is only responsible for the
 * per-target build-setting overrides.
 *
 * Applied build-setting overrides on every target:
 *   • CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
 *   • GCC_TREAT_WARNINGS_AS_ERRORS = NO
 *   • OTHER_CFLAGS  ← -Wno-non-modular-include-in-framework-module appended
 *
 * This is a build-config-only change. No JS/TS or app runtime behavior is
 * modified. Safe to remove once @react-native-firebase / Expo prebuild ship
 * a first-class fix upstream.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Sentinel comment so we can find (and idempotently replace) the block on
// re-runs of `expo prebuild`. Keep this string stable across versions.
const MARK_BEGIN = '# >>> withFirebaseModularFix (managed) >>>';
const MARK_END = '# <<< withFirebaseModularFix (managed) <<<';

const INJECTED_BLOCK = `
${MARK_BEGIN}
# Relax non-modular-include-in-framework-module warnings + Werror on every
# pod target. Required for @react-native-firebase + use_frameworks :static.
# Managed by ./plugins/withFirebaseModularFix.js — do not edit by hand.
installer.pods_project.targets.each do |target|
  target.build_configurations.each do |config|
    config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    existing_cflags = config.build_settings['OTHER_CFLAGS'] || '$(inherited)'
    if existing_cflags.is_a?(Array)
      unless existing_cflags.include?('-Wno-non-modular-include-in-framework-module')
        existing_cflags << '-Wno-non-modular-include-in-framework-module'
      end
      config.build_settings['OTHER_CFLAGS'] = existing_cflags
    else
      unless existing_cflags.include?('-Wno-non-modular-include-in-framework-module')
        config.build_settings['OTHER_CFLAGS'] = "#{existing_cflags} -Wno-non-modular-include-in-framework-module"
      end
    end
  end
end
${MARK_END}
`.trim();

/** Insert (or replace) our managed block inside the existing post_install
 *  do |installer| ... end. If no post_install block exists, append one. */
function patchPodfile(contents) {
  // 1) Idempotency: strip any previous managed block first. Escape regex
  //    metachars in the sentinels (they contain "(managed)").
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const managedRe = new RegExp(
    `\\n?[ \\t]*${esc(MARK_BEGIN)}[\\s\\S]*?${esc(MARK_END)}\\n?`,
    'g',
  );
  let out = contents.replace(managedRe, '');

  // 2) Find an existing post_install block and inject at its top.
  const postInstallRe = /post_install\s+do\s*\|installer\|/m;
  if (postInstallRe.test(out)) {
    out = out.replace(postInstallRe, (match) => `${match}\n  ${INJECTED_BLOCK.replace(/\n/g, '\n  ')}`);
    return out;
  }

  // 3) No post_install block — append one at the end of the file.
  const appended = `

post_install do |installer|
  ${INJECTED_BLOCK.replace(/\n/g, '\n  ')}
end
`;
  return `${out.trimEnd()}\n${appended}`;
}

const withFirebaseModularFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile',
      );
      if (!fs.existsSync(podfilePath)) {
        // Prebuild hasn't produced a Podfile yet — nothing to patch. Expo
        // will re-run our mods after prebuild; this branch shouldn't hit
        // under normal EAS flows but we guard just in case.
        return cfg;
      }
      const original = fs.readFileSync(podfilePath, 'utf8');
      const patched = patchPodfile(original);
      if (patched !== original) {
        fs.writeFileSync(podfilePath, patched, 'utf8');
      }
      return cfg;
    },
  ]);
};

module.exports = withFirebaseModularFix;
