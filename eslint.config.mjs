import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // 関数引数で意図的に使わないものは _ prefix を許容（callback の
      // シグネチャ統一のため引数だけ残すケース等）
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `any` は段階的に unknown 化していく方針。当面は warn に降格して
      // build を阻害しないようにする（catch 句は本体修正で順次解消）。
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
