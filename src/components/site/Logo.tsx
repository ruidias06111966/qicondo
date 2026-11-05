import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/qicond-mark.png";
import logoCompleto from "@/assets/qicond-lockup.png";
import logoHero from "@/assets/qicond-hero.webp";

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

/**
 * O logótipo inteiro — emblema, nome, assinatura e os cinco blocos — para o
 * topo da página pública.
 *
 * ATÉ ONDE ENCOLHE
 *
 * Os rótulos dos blocos têm 18px de altura de maiúscula num ficheiro de
 * 1400px. Medido, não adivinhado:
 *
 *   860px de largura → 11,1px   confortável
 *   768px            →  9,9px   lê-se
 *   704px            →  9,1px   lê-se (é o que sobra num ecrã de 768px)
 *   608px            →  7,8px   mancha
 *
 * Daí o tecto em 860px e a troca abaixo de `md:`, onde já não cabem 704px.
 *
 * ABAIXO DE `md:` VOLTA A FRASE
 *
 * O que se perde ao encolher não é o desenho, são as cinco palavras que dizem
 * o que o sistema faz. Num telemóvel elas voltam como texto, que é onde ele
 * tem de funcionar: a frase é o que vende, e um logótipo ilegível não vende
 * nada.
 *
 * O `alt` da imagem é a frase inteira. Assim o `h1` continua a dizer o mesmo
 * a quem não vê a imagem — leitor de ecrã ou motor de busca — mesmo quando o
 * que está no ecrã é só o desenho.
 */
export function LogoHero() {
  return (
    <>
      <img
        src={logoHero}
        alt="QiCond — gestão completa do seu condomínio, pelo WhatsApp"
        width={1400}
        height={527}
        fetchPriority="high"
        className="hidden md:block mx-auto h-auto w-full max-w-[860px]"
      />

      <span className="md:hidden">
        {/* Decorativa: a frase a seguir já diz o que esta imagem diria. */}
        <img
          src={logoCompleto}
          alt=""
          width={900}
          height={340}
          className="mx-auto hidden h-auto w-full max-w-[400px] sm:block"
          fetchPriority="high"
        />
        <img
          src={logoMark}
          alt=""
          width={88}
          height={88}
          className="mx-auto h-20 w-20 object-contain sm:hidden"
          fetchPriority="high"
        />
        {/* Um grau abaixo do que era antes: agora há o emblema por cima, e a
            `text-4xl` partia a frase em seis linhas num ecrã de 390px. */}
        <span className="mt-6 block font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Gestão completa do seu condomínio,{" "}
          <span className="text-gradient-brand">pelo WhatsApp</span>
        </span>
      </span>
    </>
  );
}
