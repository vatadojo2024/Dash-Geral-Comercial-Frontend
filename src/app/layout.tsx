import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapa de Calor — Vata Dojo",
  description: "Mesa de decisão comercial: leads ranqueados por score.",
};

// Aplica o tema salvo ANTES da pintura, evitando flash do tema errado.
// Default = "azul"; só usa o salvo se for um dos três temas válidos.
const SCRIPT_ANTI_FLASH = `(function(){try{var v=localStorage.getItem('mdc-theme');var t=(v==='dark'||v==='light'||v==='azul')?v:'azul';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='azul';}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ANTI_FLASH }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
