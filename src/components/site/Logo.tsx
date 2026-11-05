import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/qicond-mark.png";
import logoCompleto from "@/assets/qicond-lockup.png";

export function Logo({
  size = "md",
  inverse = false,
}: {
  size?: "sm" | "md" | "lg";
  inverse?: boolean;
}) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <Link to="/" className="flex items-center gap-2.5 group" aria-label="QiCond">
      {/* A marca traz o seu próprio quadrado verde arredondado. O invólucro
          que havia aqui — fundo `primary-soft` com recuo — desenhava um
          segundo quadrado à volta do primeiro. */}
      <img
        src={logoMark}
        alt="QiCond"
        width={44}
        height={44}
        className={`${dims} object-contain group-hover:scale-[1.03] transition-transform`}
      />
      <span
        className={`font-display font-extrabold tracking-tight ${text} ${inverse ? "text-white" : "text-foreground"}`}
      >
        QiCond
      </span>
    </Link>
  );
}

/**
 * O logótipo composto: emblema, nome e assinatura.
 *
 * ONDE ENTRA, E PORQUÊ SÓ AQUI
 *
 * A assinatura tem 20px de altura num ficheiro de 900px. Medido e não
 * adivinhado: a 280px de largura as maiúsculas ficam com 6,2px e viram uma
 * mancha; a 400px ficam com 8,9px e lêem-se. Daí o tecto de 400px e a troca
 * pelo símbolo com o nome ao lado abaixo de `sm:`, onde não cabem 400px.
 *
 * É também por isso que não está na barra lateral da aplicação: a 36px não se
 * lê nada dela, e um logótipo que não se lê é ruído, não é marca.
 */
export function LogoCompleto({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-block ${className}`} aria-label="QiCond">
      <img
        src={logoCompleto}
        alt="QiCond — gestão inteligente de condomínios"
        width={900}
        height={340}
        className="hidden sm:block w-full max-w-[400px]"
      />
      <span className="sm:hidden flex items-center gap-2.5">
        <img src={logoMark} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
        <span className="font-display font-extrabold tracking-tight text-xl text-foreground">
          QiCond
        </span>
      </span>
    </Link>
  );
}
