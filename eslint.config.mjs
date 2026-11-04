import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // aave.com/: captura de site usada só como referência visual (ver docs/VISUAL_BRIEF.md)
  globalIgnores([".next/**", "coverage/**", "src/generated/**", "next-env.d.ts", "aave.com/**"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: "Não use parseFloat para dinheiro — use parseMoney() (centavos em bigint).",
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**", "src/shared/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/*", "@prisma/*", "next", "next/*", "react", "@/shared/infrastructure/*"],
              message: "O domínio deve ser puro (sem I/O, framework ou ORM).",
            },
            {
              group: ["**/application/*", "**/infrastructure/*", "**/ui/*"],
              message: "O domínio não depende de outras camadas.",
            },
          ],
        },
      ],
    },
  },
]);
