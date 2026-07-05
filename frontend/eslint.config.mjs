import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      security,
      sonarjs,
    },
    rules: {
      ...security.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "node_modules/**",
    ".next/**",
    "out/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "*.min.js",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
