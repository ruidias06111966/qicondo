import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";

const links = [
  { to: "/recursos", label: "Recursos" },
  { to: "/precos", label: "Preços" },
  { to: "/sobre", label: "Sobre" },
  { to: "/blog", label: "Blog" },
  { to: "/ajuda", label: "Ajuda" },
  { to: "/contato", label: "Contato" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Logo />

        <ul className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                activeProps={{ className: "text-primary" }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex items-center gap-2">
          <Link
            to="/contato"
            className="px-4 py-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            Entrar
          </Link>
          <Link
            to="/contato"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:bg-[var(--color-primary-deep)] transition-colors"
          >
            Começar grátis
          </Link>
        </div>

        <button
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {open && (
        <div className="lg:hidden border-t border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-foreground rounded-lg hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 pt-3 border-t border-border flex flex-col gap-2">
              <Link
                to="/contato"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm font-semibold text-foreground rounded-lg hover:bg-muted"
              >
                Entrar
              </Link>
              <Link
                to="/contato"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-center text-sm font-semibold rounded-lg bg-primary text-primary-foreground"
              >
                Começar grátis
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
