import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import { Fundo } from "@/components/layout/Fundo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapa de Calor — Vata Dojo",
  description: "Mesa de decisão comercial: leads ranqueados por score.",
};

// Tipografia do design system: Inter no corpo, Plus Jakarta Sans nos títulos.
// Servidas pelo next/font — sem request externo em runtime e sem flash de fonte.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        <Fundo />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
