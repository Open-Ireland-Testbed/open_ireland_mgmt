const path = require('path');

module.exports = function override(config, env) {
  // Force .jsx resolution before .js
  config.resolve.extensions = ['.jsx', '.js', '.json', '.wasm'];

  // Add alias
  config.resolve.alias = {
    ...config.resolve.alias,
    '@tcdona/ui': path.resolve(__dirname, '../packages/ui/src'),
  };

  // Remove ModuleScopePlugin
  const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
  config.resolve.plugins = config.resolve.plugins.filter(
    plugin => !(plugin instanceof ModuleScopePlugin)
  );

  const oneOfRule = config.module.rules.find((rule) => rule.oneOf);
  // In Docker container, packages/ui is mounted at /app/packages/ui
  // In local dev, it's at ../packages/ui relative to inventory/frontend
  const uiPackagePath = path.resolve(__dirname, '../packages/ui');
  // Also try absolute path for Docker container
  const uiPackagePathAbsolute = '/app/packages/ui';

  if (oneOfRule && oneOfRule.oneOf) {
    // Step 1: Create a dedicated rule for packages/ui that runs FIRST
    // This rule must come before any other JS/JSX rules
    // Include both relative and absolute paths to handle both local dev and Docker
    const uiRule = {
      test: /\.(js|jsx|mjs|cjs|ts|tsx)$/,
      include: [
        uiPackagePath,
        uiPackagePathAbsolute,
        // Also match any path containing packages/ui
        /packages[\\/]ui[\\/]src/,
      ],
      exclude: [
        /node_modules/,
        /\.(test|spec)\.(js|jsx|ts|tsx)$/,
      ],
      use: [
        {
          loader: require.resolve('babel-loader'),
          options: {
            presets: [require.resolve('babel-preset-react-app')],
            cacheDirectory: true,
            cacheCompression: false,
          },
        },
      ],
    };

    // Insert at the very beginning - this ensures it matches first
    oneOfRule.oneOf.unshift(uiRule);

    // Step 2: Exclude packages/ui from ALL other rules
    oneOfRule.oneOf.forEach((rule, index) => {
      // Skip our custom rule
      if (index === 0) return;

      // For any rule that could match JS/JSX files
      if (rule.test) {
        const testStr = rule.test.toString();
        const matchesJS = testStr.includes('js') || testStr.includes('ts');
        const matchesJSX = testStr.includes('jsx') || testStr.includes('tsx');

        if (matchesJS || matchesJSX) {
          // Build exclude array
          let excludeArray = [];

          if (Array.isArray(rule.exclude)) {
            excludeArray = [...rule.exclude];
          } else if (rule.exclude) {
            excludeArray = [rule.exclude];
          }

          // Add packages/ui exclusions (both relative and absolute paths)
          const uiExclusions = [
            uiPackagePath,
            uiPackagePathAbsolute,
            /packages[\\/]ui/,
            /node_modules[\\/]@tcdona[\\/]ui/,
            new RegExp(uiPackagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            new RegExp(uiPackagePathAbsolute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          ];

          uiExclusions.forEach(exclusion => {
            const alreadyExcluded = excludeArray.some(ex => {
              if (ex === exclusion) return true;
              if (ex && exclusion && ex.toString && exclusion.toString) {
                return ex.toString() === exclusion.toString();
              }
              return false;
            });
            if (!alreadyExcluded) {
              excludeArray.push(exclusion);
            }
          });

          // Set the exclude (single item or array)
          if (excludeArray.length === 1) {
            rule.exclude = excludeArray[0];
          } else if (excludeArray.length > 1) {
            rule.exclude = excludeArray;
          }
        }
      }
    });
  }

  return config;
};
