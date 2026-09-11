import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode, command }) => {
  // O Vite substitui import.meta.env.VITE_* só no bundle do cliente. Como o
  // mesmo código corre em SSR dentro do Worker, as variáveis são declaradas
  // explicitamente para valerem nos dois lados.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([chave, valor]) => [
      `import.meta.env.${chave}`,
      JSON.stringify(valor),
    ]),
  );

  return {
    define,
    resolve: {
      alias: { "@": `${raiz}src` },
      // Duas cópias de React (ou do React Query) partilhariam o mesmo ecrã com
      // contextos distintos e partiriam os hooks.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Falha o build se código de src/server (ou marcado server-only) for
        // arrastado para o bundle do cliente: é onde vivem a service role key
        // e os segredos de webhook.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // O Nitro só entra no build; em dev o servidor é o do próprio Vite.
      //
      // `defaultPreset` e não `preset`: é um fallback, não uma imposição. O Nitro
      // autodetecta a plataforma pelo ambiente (VERCEL, NETLIFY, …) e só recorre
      // ao Cloudflare quando não reconhece nenhuma — que é o caso em local e no
      // CI. Forçar `preset` aqui faz o build entregar um Worker a plataformas que
      // não o sabem servir, e o deploy falha.
      ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
      viteReact(),
    ],
  };
});
