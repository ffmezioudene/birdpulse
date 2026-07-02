/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * withFirebaseModularFix
 * -----------------------------------------------------------------------------
 * Fixes iOS pod-install / Xcode-compile errors that surface when
 * @react-native-firebase is combined with `use_frameworks! :linkage => :static`
 * on RN 0.76+ / Expo SDK 54 with New Architecture enabled.
 *
 * Symptoms this fixes:
 *   • "include of non-modular header inside framework module 'RNFBApp...'"
 *     (React/RCTConvert.h, React/RCTBridgeModule.h, React/RCTEventEmitter.h)
 *   • "'RCTBridgeModule' must be imported from module before it is required"
 *   • "expected ')'" parse errors inside RN header consumers when the
 *     enclosing pod isn't a Clang module
 *
 * Strategy:
 *   1. Ensure Firebase / Google pods that ship non-modular headers are pulled
 *      in with `:modular_headers => true` — that part is declared via
 *      `extraPods` inside expo-build-properties in app.json (owned by the
 *      config file, not this plugin).
 *   2. In `post_install`, on EVERY pod target's build configurations set:
 *        CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
 *        CLANG_ENABLE_MODULES                                  = YES
 *        GCC_TREAT_WARNINGS_AS_ERRORS                          = NO
 *        OTHER_CFLAGS                                          ← append
 *          -Wno-non-modular-include-in-framework-module
 *   3. Additionally force `DEFINES_MODULE = YES` on the specific RN core
 *      targets that Firebase headers reach into (React-Core, RCT-Folly,
 *      ReactCommon and their sub-variants). Making these emit a Clang
 *      module map is what lets `@import React` succeed from inside a
 *      RN-Firebase framework, which is the root cause of the
 *      "RCTBridgeModule must be imported from module" diagnostic.
 *
 * Idempotency:
 *   The whole managed block is delimited by MARK_BEGIN / MARK_END sentinels
 *   and replaced-in-place on repeat prebuilds. Verified across 3 runs.
 *
 * NOTHING in this plugin touches JS/TS runtime behavior. Safe to remove once
 * @react-native-firebase / Expo publish a first-class fix upstream.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Sentinel comments so we can find (and idempotently replace) our managed
// block on re-runs. Keep these strings stable across versions.
const MARK_BEGIN = '# >>> withFirebaseModularFix (managed) >>>';
const MARK_END = '# <<< withFirebaseModularFix (managed) <<<';

// RN core pod targets whose modules Firebase reaches into. Anything matching
// one of these prefixes gets DEFINES_MODULE = YES so `@import ...` works
// from inside a static-framework consumer.
const RN_CORE_MODULE_TARGETS = [
  'React',
  'React-Core',
  'React-CoreModules',
  'ReactCommon',
  'RCT-Folly',
  'React-RCTAppDelegate',
  'React-RCTFabric',
  'React-Codegen',
];

const INJECTED_BLOCK = `
${MARK_BEGIN}
# Managed by ./plugins/withFirebaseModularFix.js — DO NOT edit by hand.
# Relaxes non-modular-include warnings + Werror, and forces DEFINES_MODULE
# on the RN core targets that RN-Firebase reaches into. Required for
# @react-native-firebase + use_frameworks :static on New Architecture.
_rn_core_module_targets = [
  'React', 'React-Core', 'React-CoreModules', 'ReactCommon',
  'RCT-Folly', 'React-RCTAppDelegate', 'React-RCTFabric', 'React-Codegen'
]
installer.pods_project.targets.each do |target|
  _is_rn_core = _rn_core_module_targets.any? { |t| target.name == t || target.name.start_with?("#{t}-") || target.name.start_with?("#{t}.") }
  target.build_configurations.each do |config|
    config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
    config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    if _is_rn_core
      config.build_settings['DEFINES_MODULE'] = 'YES'
    end
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

/** Insert (or replace) our managed block inside the existing
 *  `post_install do |installer| ... end`. Appends a new post_install
 *  block if none exists. */
function patchPodfile(contents) {
  // Idempotency: strip any previous managed block first. Escape regex
  // metachars in the sentinel strings (they contain "(managed)").
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const managedRe = new RegExp(
    `\\n?[ \\t]*${esc(MARK_BEGIN)}[\\s\\S]*?${esc(MARK_END)}\\n?`,
    'g',
  );
  let out = contents.replace(managedRe, '');

  const postInstallRe = /post_install\s+do\s*\|installer\|/m;
  if (postInstallRe.test(out)) {
    out = out.replace(
      postInstallRe,
      (match) => `${match}\n  ${INJECTED_BLOCK.replace(/\n/g, '\n  ')}`,
    );
    return out;
  }

  // No post_install block — append one at the end of the file.
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
      if (!fs.existsSync(podfilePath)) return cfg;
      const original = fs.readFileSync(podfilePath, 'utf8');
      const patched = patchPodfile(original);
      if (patched !== original) fs.writeFileSync(podfilePath, patched, 'utf8');
      return cfg;
    },
  ]);
};

// Public export. `patchPodfile` is exposed as a namespaced helper for
// unit-testing the Podfile mutation logic without spinning up prebuild.
module.exports = withFirebaseModularFix;
module.exports.__internal = { patchPodfile, RN_CORE_MODULE_TARGETS };
