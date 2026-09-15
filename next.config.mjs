/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      // Ações e Agenda saíram do produto (spec set/2026, 2.1): links antigos
      // caem na home por papel. /sdr virou /produtividade-sdr (sub-abas com rota).
      { source: "/acoes", destination: "/", permanent: false },
      { source: "/agenda", destination: "/", permanent: false },
      { source: "/sdr", destination: "/produtividade-sdr", permanent: false },
    ];
  },
};

export default nextConfig;
