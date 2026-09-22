/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pasta de saída alternativa (NEXT_DIST_DIR) para um build de verificação
  // conviver com o `next dev` aberto na mesma máquina, que segura o `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return [
      // Ações e Agenda saíram do produto (spec set/2026, 2.1): links antigos
      // caem na home por papel. /sdr virou /produtividade-sdr (sub-abas com rota).
      { source: "/acoes", destination: "/", permanent: false },
      { source: "/agenda", destination: "/", permanent: false },
      { source: "/sdr", destination: "/produtividade-sdr", permanent: false },
      // "Levantou a Mão" virou "Oportunidades do Evento" (set/2026).
      { source: "/produtividade-sdr/levantou-a-mao", destination: "/produtividade-sdr/oportunidades", permanent: false },
      { source: "/produtividade-sdr/levantou-a-mao/:recorte", destination: "/produtividade-sdr/oportunidades/:recorte", permanent: false },
    ];
  },
};

export default nextConfig;
