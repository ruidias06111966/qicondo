import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", ".wrangler", "src/routeTree.gen.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Dívida herdada: ~150 ocorrências vindas do código gerado, sobretudo nos
      // módulos financeiros e no bot de WhatsApp. Fica como aviso para não travar
      // o CI, mas deve ser reduzida à medida que cada módulo for tocado — não
      // acrescentar novas.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Ficheiros de servidor e de teste correm em Node, não no browser.
    files: ["**/*.test.ts", "src/server/**/*.ts", "vite.config.ts", "vitest.config.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  eslintPluginPrettier,
);
