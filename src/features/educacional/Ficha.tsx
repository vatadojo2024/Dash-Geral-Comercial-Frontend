"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AlunoDetalhe } from "@/lib/educacional/contrato";
import { cn } from "@/lib/utils/cn";
import { CAMPO } from "./Dialogo";
import { MarcaPendente } from "./lote/MarcaPendente";
import type { Alteracao, Entrada } from "./lote/pendencias";

// ---------------------------------------------------------------------------
// Ficha do Raio-X em lote (Fase 3, 6.1): em modo de edição, todos os blocos
// ficam editáveis e cada campo confirmado (sair do campo, Enter, escolher na
// lista) vira alteração pendente do aluno, com a mesma marca da aba Alunos.
// O contexto leva o aluno (com as pendências por cima) e as ações.
// ---------------------------------------------------------------------------

export type Ficha = {
  editando: boolean;
  aluno: AlunoDetalhe; // com as pendências por cima
  entrada: Entrada | undefined;
  bloqueada: boolean; // aluno em envio
  registrar: (alt: Alteracao | null) => void;
  desfazer: (chave: string) => void;
};

const Contexto = createContext<Ficha | null>(null);
export const ProvedorFicha = Contexto.Provider;

// Fora do Raio-X (ou antes de carregar), null.
export const useFichaOpcional = () => useContext(Contexto);

export function useFicha(): Ficha {
  const f = useContext(Contexto);
  if (!f) throw new Error("Fora da ficha do Raio-X");
  return f;
}

// Marca e erro de validação da chave, com "Desfazer" no menu de contexto.
export function useMarca(chave: string) {
  const f = useFicha();
  const alteracao = f.entrada?.alteracoes[chave];
  const erro = f.entrada?.erro?.tipo === "validacao" && f.entrada.erro.chave === chave ? f.entrada.erro.mensagem : null;
  return {
    alteracao,
    erro,
    onDesfazer: alteracao && !f.bloqueada ? () => f.desfazer(chave) : undefined,
  };
}

export function Marcado({ chave, className, children }: { chave: string; className?: string; children: ReactNode }) {
  const m = useMarca(chave);
  return (
    <MarcaPendente {...m} className={cn(m.alteracao || m.erro ? "p-1" : undefined, className)}>
      {children}
    </MarcaPendente>
  );
}

// Nome acessível explícito: o <label> em volta de um <select> somaria o texto das opções.
const nomeAcessivel = (rotulo: string) => rotulo.replace(/\s*\*$/, "");

function Rotulo({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-texto-sec", className)}>
      {rotulo}
      {children}
    </label>
  );
}

// Texto, data ou texto longo: confirma ao sair do campo (ou Enter, fora do
// texto longo). Obrigatório vazio volta ao valor de antes.
export function CampoTexto({
  chave,
  rotulo,
  valor,
  onConfirmar,
  tipo = "text",
  area = false,
  obrigatorio = false,
  className,
}: {
  chave: string;
  rotulo: string;
  valor: string | null;
  onConfirmar: (v: string | null) => void;
  tipo?: "text" | "date";
  area?: boolean;
  obrigatorio?: boolean;
  className?: string;
}) {
  const f = useFicha();
  const [v, setV] = useState(valor ?? "");
  const focado = useRef(false);
  // Valor mudou por fora (Desfazer, Reaplicar): acompanha, menos enquanto digita.
  useEffect(() => {
    if (!focado.current) setV(valor ?? "");
  }, [valor]);

  const confirmar = () => {
    focado.current = false;
    const t = v.trim();
    if (t === (valor ?? "")) return setV(valor ?? "");
    if (obrigatorio && !t) return setV(valor ?? "");
    onConfirmar(t || null);
  };
  const comum = {
    "aria-label": nomeAcessivel(rotulo),
    value: v,
    disabled: f.bloqueada,
    onFocus: () => (focado.current = true),
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: confirmar,
  };
  return (
    <Marcado chave={chave} className={className}>
      <Rotulo rotulo={rotulo}>
        {area ? (
          <textarea {...comum} rows={3} className={cn(CAMPO, "h-auto py-2")} />
        ) : (
          <input
            {...comum}
            type={tipo}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
            className={CAMPO}
          />
        )}
      </Rotulo>
    </Marcado>
  );
}

// Lista: confirma ao escolher.
export function CampoLista({
  chave,
  rotulo,
  valor,
  opcoes,
  vazio,
  onConfirmar,
  className,
}: {
  chave: string;
  rotulo: string;
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  vazio?: string;
  onConfirmar: (v: string) => void;
  className?: string;
}) {
  const f = useFicha();
  return (
    <Marcado chave={chave} className={className}>
      <Rotulo rotulo={rotulo}>
        <select
          aria-label={nomeAcessivel(rotulo)}
          value={valor}
          disabled={f.bloqueada}
          onChange={(e) => onConfirmar(e.target.value)}
          className={CAMPO}
        >
          {vazio != null && <option value="">{vazio}</option>}
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </Rotulo>
    </Marcado>
  );
}
