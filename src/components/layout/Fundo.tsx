import Image from "next/image";
import logo from "@/assets/SimboloSuavizado2.png";

// Fundo fixo do app: a logo Vata (vermelho + símbolo branco) atrás de tudo, com
// um véu escuro em gradiente por cima. É o que o vidro (backdrop-blur) desfoca
// — sem uma imagem com cor e forma ao fundo, o glass não aparece.
export function Fundo() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-noite">
      <Image
        src={logo}
        alt=""
        priority
        fill
        sizes="100vw"
        className="object-cover object-center opacity-[0.16]"
      />
      {/* Véu grafite pesado: a logo é um detalhe de elegância, não concorre com
          o painel. O brilho da marca é só um toque no canto do símbolo. */}
      <div className="absolute inset-0 bg-gradient-to-br from-noite/95 via-noite/94 to-noite/97" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(196_60_68_/_0.08),transparent_50%)]" />
    </div>
  );
}
