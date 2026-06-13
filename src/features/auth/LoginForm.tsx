"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, Flame, Lock, Mail } from "lucide-react";
import { AuthError, loginComEmailSenha, type AuthMode } from "@/lib/auth/authClient";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";

function CampoLogin({
  id,
  rotulo,
  children,
}: {
  id: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-texto-sec">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

function FormContent({ authMode }: { authMode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha para entrar.");
      return;
    }
    setErro(null);
    setEntrando(true);
    try {
      await loginComEmailSenha(authMode, email, senha);
      const from = searchParams.get("from");
      router.replace(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof AuthError
          ? err.message
          : "Não foi possível entrar. Tente novamente.",
      );
      setEntrando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-noite px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rosa/90">
            <Flame className="h-6 w-6 text-noite" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-texto">Mapa de Calor</h1>
            <p className="text-sm text-texto-sec">Mesa de decisão comercial — Vata Dojo</p>
          </div>
        </div>

        <form
          onSubmit={entrar}
          className="space-y-4 rounded-2xl border border-borda bg-painel p-6"
        >
          <CampoLogin id="email" rotulo="E-mail">
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
                aria-hidden
              />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@vatadojo.com.br"
                className="h-10 w-full rounded-lg border border-borda bg-noite pl-9 pr-3 text-sm text-texto placeholder:text-texto-sec/60"
              />
            </div>
          </CampoLogin>

          <CampoLogin id="senha" rotulo="Senha">
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
                aria-hidden
              />
              <input
                id="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                className="h-10 w-full rounded-lg border border-borda bg-noite pl-9 pr-10 text-sm text-texto placeholder:text-texto-sec/60"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-texto-sec hover:text-texto"
              >
                {mostrarSenha ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </CampoLogin>

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rosa/30 bg-rosa/10 px-3 py-2 text-xs text-rosa"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          <Button type="submit" loading={entrando} className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}

export function LoginForm({ authMode }: { authMode: AuthMode }) {
  return (
    <Suspense>
      <FormContent authMode={authMode} />
    </Suspense>
  );
}
