import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    // Os módulos testados correm no Worker, sobre APIs web (fetch, Web Crypto,
    // Headers), pelo que o ambiente Node puro é o mais próximo do real.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
