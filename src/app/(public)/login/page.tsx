import { LoginForm } from "@/features/auth/LoginForm";
import type { AuthMode } from "@/lib/auth/authClient";

// Tela de login definitiva (7.1.5): e-mail/senha no visual final. O modo de
// autenticação fica no servidor (AUTH_MODE no .env): "mock" valida contra a
// lista de usuários; "supabase" usa o Supabase Auth real — a TELA é a mesma.
export default function LoginPage() {
  const authMode: AuthMode =
    process.env.AUTH_MODE === "supabase" ? "supabase" : "mock";
  return <LoginForm authMode={authMode} />;
}
