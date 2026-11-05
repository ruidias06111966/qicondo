import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { URL_SITE } from "@/lib/site";
import logoMark from "@/assets/qicond-mark.png";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {/* Dizia "WC", das iniciais de WhatsCond — o nome anterior do
            sistema. Ficou para trás na mudança de nome. */}
        <img
          src={logoMark}
          alt="QiCond"
          width={64}
          height={64}
          className="mx-auto mb-6 h-16 w-16"
        />
        <h1 className="font-display text-7xl font-extrabold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--color-primary-deep)]"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "QiCond — Gestão de condomínio pelo WhatsApp" },
      {
        name: "description",
        content:
          "QiCond é o sistema de gestão para empresas e condomínios feito para o WhatsApp. Cobranças, reservas, encomendas e prestação de contas em um só lugar. Planos sob consulta.",
      },
      { name: "author", content: "QiCond" },
      { name: "theme-color", content: "#0B7A55" },
      { property: "og:title", content: "QiCond — Gestão de condomínio pelo WhatsApp" },
      {
        property: "og:description",
        content:
          "Cobranças automáticas, reservas e prestação de contas no WhatsApp. Planos sob consulta, sem fidelidade.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "QiCond" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      // Absoluto, porque quem lê isto é o WhatsApp, o Facebook ou o X a partir
      // de fora: um caminho relativo não resolve contra nada.
      { property: "og:image", content: `${URL_SITE}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "QiCond" },
      { property: "og:url", content: URL_SITE },
      { name: "twitter:image", content: `${URL_SITE}/og-image.png` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@600;700;800&display=swap",
      },
      // Era um SVG desenhado à mão dentro de um data URI — um balão de
      // conversa que nada tinha que ver com a marca.
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon-64.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { AuthProvider } from "@/auth/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
