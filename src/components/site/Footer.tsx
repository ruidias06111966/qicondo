import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import {
  CNPJ,
  EMAIL,
  ENDERECO_LINHA,
  RAZAO_SOCIAL,
  TELEFONE_FORMATADO,
  WHATSAPP,
} from "@/lib/empresa";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface mt-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-14 grid gap-10 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            Gestão de condomínio pelo WhatsApp. Simples, acessível e feito para síndicos de pequenos
            condomínios brasileiros.
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-success animate-pulse" />
            Todos os sistemas operacionais
          </div>

          <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <a href={`mailto:${EMAIL.contato}`} className="hover:text-primary transition-colors">
                {EMAIL.contato}
              </a>
              <span className="text-xs"> · comercial</span>
            </li>
            <li>
              <a href={`mailto:${EMAIL.suporte}`} className="hover:text-primary transition-colors">
                {EMAIL.suporte}
              </a>
              <span className="text-xs"> · suporte</span>
            </li>
            <li>
              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                {TELEFONE_FORMATADO}
              </a>
              <span className="text-xs"> · WhatsApp</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">
            Produto
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link
                to="/recursos"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Recursos
              </Link>
            </li>
            <li>
              <Link
                to="/precos"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Preços
              </Link>
            </li>
            <li>
              <Link
                to="/blog"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Blog
              </Link>
            </li>
            <li>
              <Link
                to="/status"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Status
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">
            Empresa
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link
                to="/sobre"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Sobre
              </Link>
            </li>
            <li>
              <Link
                to="/contato"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Contato
              </Link>
            </li>
            <li>
              <Link
                to="/ajuda"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Central de ajuda
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">Legal</h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link
                to="/termos"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Termos de uso
              </Link>
            </li>
            <li>
              <Link
                to="/privacidade"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Privacidade
              </Link>
            </li>
            <li>
              <Link
                to="/lgpd"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                LGPD
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-5 text-xs text-muted-foreground space-y-1.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>© {year} QiCond · Gestão de condomínio pelo WhatsApp</div>
            <div>Feito no Brasil 🇧🇷</div>
          </div>
          <div>
            {RAZAO_SOCIAL} · CNPJ {CNPJ}
          </div>
          <div>{ENDERECO_LINHA}</div>
        </div>
      </div>
    </footer>
  );
}
