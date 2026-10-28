"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { AlunoDetalhe, CampoAjustavel } from "@/lib/educacional/contrato";
import { dataHoraBr } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useSession } from "@/features/session/SessionProvider";
import { cn } from "@/lib/utils/cn";
import { campoDe, formatarValor } from "./campos";
import { Dialogo } from "./Dialogo";
import { useFichaOpcional } from "./Ficha";
import { FormAjuste } from "./FormAjuste";
import { alteracaoDoAjuste } from "./lote/alteracoes";
import { MarcaPendente } from "./lote/MarcaPendente";

// ---------------------------------------------------------------------------
// Peças do Raio-X (spec Fase 2, seção 5; Fase 3, 6.1): bloco, campo calculado
// com selo "Ajustado" e valor automático, e confirmação de ação.
// ---------------------------------------------------------------------------

// Bloco do Raio-X: cartão com título e ações. A edição é da ficha inteira
// (Fase 3, 6.1): o conteúdo muda conforme `editando`.
export function Bloco({
  titulo,
  subtitulo,
  acoes,
  className,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acoes?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader title={titulo} subtitle={subtitulo} action={acoes} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Campo calculado: valor efetivo, selo "Ajustado" (quem, quando, por quê),
// valor automático logo abaixo, "Ajustar" e "Voltar ao automático". Fora da
// ficha em edição, grava na hora; na ficha, vira alteração pendente (o motivo
// vai junto), com a marca.
export function CampoCalculadoView({
  aluno,
  campo,
  rotulo,
  exibir,
  className,
}: {
  aluno: AlunoDetalhe;
  campo: CampoAjustavel;
  rotulo: string;
  exibir?: ReactNode; // apresentação própria do valor (padrão: texto formatado)
  className?: string;
}) {
  const [form, setForm] = useState<"ajustar" | "voltar" | null>(null);
  const user = useSession();
  const ficha = useFichaOpcional();
  const pendente = ficha?.editando ? ficha : null;
  const chave = `ajuste:${campo}`;
  const alteracao = pendente?.entrada?.alteracoes[chave];
  const erro =
    pendente?.entrada?.erro?.tipo === "validacao" && pendente.entrada.erro.chave === chave ? pendente.entrada.erro.mensagem : null;
  const c = campoDe(aluno, campo);
  if (!c) return null;
  return (
    <MarcaPendente
      alteracao={alteracao}
      erro={erro}
      onDesfazer={alteracao && pendente && !pendente.bloqueada ? () => pendente.desfazer(chave) : undefined}
      className={cn(alteracao || erro ? "p-1" : undefined)}
    >
      <div className={cn("min-w-0", className)}>
        <p className="text-xs text-texto-sec">{rotulo}</p>
        <div className="mt-0.5">{exibir ?? <span className="text-texto">{formatarValor(campo, c.valor)}</span>}</div>
        {c.ajuste ? (
          <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-texto-sec">
            <span className="tag tag-warning">Ajustado</span>
            <p>
              {c.ajuste.ajustado_por.nome} · {dataHoraBr(c.ajuste.ajustado_em)}
            </p>
            <p className="italic">“{c.ajuste.motivo}”</p>
            <p>Automático: {c.automatico == null ? "sem cálculo" : formatarValor(campo, c.automatico)}</p>
          </div>
        ) : null}
        <div className={cn("mt-1.5 flex flex-wrap gap-x-3 gap-y-1", pendente?.bloqueada && "pointer-events-none opacity-50")}>
          <button type="button" onClick={() => setForm("ajustar")} className="text-xs font-medium text-azul-claro hover:underline">
            Ajustar
          </button>
          {c.ajuste && (
            <button
              type="button"
              onClick={() => setForm("voltar")}
              className="inline-flex items-center gap-1 text-xs font-medium text-texto-sec hover:text-texto hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Voltar ao automático
            </button>
          )}
        </div>
        {form && (
          <FormAjuste
            aluno={aluno}
            campo={campo}
            iniciarVoltando={form === "voltar"}
            onFechar={() => setForm(null)}
            aoConfirmar={pendente ? (r) => pendente.registrar(alteracaoDoAjuste(aluno, campo, r, { id: user.id, nome: user.nome })) : undefined}
          />
        )}
      </div>
    </MarcaPendente>
  );
}

export function ConfirmarAcao({
  aberto,
  titulo,
  texto,
  confirmar,
  perigo = false,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean;
  titulo: string;
  texto: ReactNode;
  confirmar: string;
  perigo?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  return (
    <Dialogo
      aberto={aberto}
      titulo={titulo}
      onFechar={onFechar}
      onEnviar={() => {
        onFechar();
        onConfirmar();
      }}
      largura="max-w-md"
      rodape={
        <>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" className={perigo ? "bg-erro-forte hover:bg-erro-forte/90" : undefined}>
            {confirmar}
          </Button>
        </>
      }
    >
      <p className="text-sm text-texto">{texto}</p>
    </Dialogo>
  );
}
