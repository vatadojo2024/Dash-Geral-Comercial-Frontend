import { redirect } from "next/navigation";
import { EntradaLembrada } from "@/components/layout/EntradaLembrada";
import { homeDoModulo, homeDoUsuario } from "@/lib/auth/areas";
import { getServerSession } from "@/lib/auth/session";

// Home pós-login: a primeira área do usuário (GET /api/me → areas). Admin cai
// na Visão Geral; closer e SDR no Dashboard; marketing na Retenção;
// educacional no módulo Educacional.
// D1 (14/10): quem tem os dois módulos (admin) e NÃO acabou de logar volta ao
// módulo que escolheu por último no seletor (lembrado no navegador). Logo
// depois do login, sempre a home comercial.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ entrada?: string }>;
}) {
  const user = await getServerSession();
  if (!user) redirect("/login");
  const { entrada } = await searchParams;
  if (user.modulos.length > 1 && entrada !== "login") {
    return (
      <EntradaLembrada
        comercial={homeDoModulo(user, "comercial")}
        educacional={homeDoModulo(user, "educacional")}
      />
    );
  }
  redirect(homeDoUsuario(user));
}
