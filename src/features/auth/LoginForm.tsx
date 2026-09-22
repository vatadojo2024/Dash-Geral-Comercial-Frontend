"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, Flame, Lock, Mail } from "lucide-react";
import { AuthError, loginComEmailSenha, type AuthMode } from "@/lib/auth/authClient";
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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      {/* Hero em camadas do DS: card base com glow atrás (deslocado) e o modal
          de vidro na frente, com bordas em gradiente. */}
      <div className="relative w-full max-w-md">
        <div
          aria-hidden
          className="glow absolute inset-x-8 top-16 -z-10 h-2/3 translate-x-8 translate-y-10 rounded-modal bg-azul/30"
        />
        <form
          onSubmit={entrar}
          className="modal-surface modal-border relative flex w-full flex-col rounded-modal shadow-layered"
        >
          <div className="flex items-center gap-4 pb-0 pl-6 pr-6 pt-6">
            <span className="icon-circle shadow-layered">
              <Flame className="h-5 w-5 text-violeta" aria-hidden />
            </span>
            <div>
              <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">Mapa de Calor</h1>
              <p className="text-sm opacity-80">Mesa de decisão comercial — Vata Dojo</p>
            </div>
          </div>
          <div className="space-y-4 p-6">
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
                className="h-10 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-3 text-sm text-texto transition-colors placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
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
                className="h-10 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-10 text-sm text-texto transition-colors placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="icon-button absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
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
              className="flex items-start gap-2 rounded-xl border border-erro-forte/30 bg-erro-forte/20 px-3 py-2 text-xs text-erro"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          </div>
          {/* Action bar do modal: p-6 pt-0, borda superior white/10 */}
          <div className="border-t border-white/10 p-6 pt-0">
            <Button type="submit" loading={entrando} className="mt-6 w-full">
              Entrar
            </Button>
          </div>
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
