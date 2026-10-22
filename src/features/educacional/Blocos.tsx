"use client";

import { useState, type ReactNode } from "react";
import { PencilLine, RotateCcw } from "lucide-react";
import type { AlunoDetalhe, CampoAjustavel } from "@/lib/educacional/contrato";
import { dataHoraBr } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { campoDe, formatarValor } from "./campos";
import { Dialogo, ErroDoEnvio } from "./Dialogo";
import { FormAjuste } from "./FormAjuste";

// ---------------------------------------------------------------------------
// Peças do Raio-X editável (spec Fase 2, seção 5): bloco com Editar / Salvar /
// Cancelar, campo calculado com selo "Ajustado" e valor automático, e
// confirmação de ação.
// ---------------------------------------------------------------------------

export function BlocoEditavel({
  titulo,
  subtitulo,
  editando,
  salvando = false,
  erro,
  onEditar,
  onCancelar,
  onSalvar,
  leitura,
  edicao,
  acoes,
  className,
}: {
  titulo: string;
  subtitulo?: string;
  editando: boolean;
  salvando?: boolean;
  erro?: string | null;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvar: () => void;
  leitura: ReactNode;
  edicao: ReactNode;
  acoes?: ReactNode; // botões extras no cabeçalho (fora da edição)
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader
        title={titulo}
        subtitle={subtitulo}
        action={
          !editando && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {acoes}
              <Button variant="secondary" size="sm" onClick={onEditar} aria-label={`Editar ${titulo.toLowerCase()}`}>
                <PencilLine className="h-3.5 w-3.5" aria-hidden />
                Editar
              </Button>
            </div>
          )
        }
      />
      <CardContent>
        {editando ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onSalvar();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                onCancelar();
              }
            }}
            className="space-y-4"
          >
            {edicao}
            <ErroDoEnvio texto={erro} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancelar}>
                Cancelar
              </Button>
              <Button type="submit" loading={salvando}>
                Salvar
              </Button>
            </div>
          </form>
        ) : (
          leitura
        )}
      </CardContent>
    </Card>
  );
}

// Campo calculado: valor efetivo, selo "Ajustado" (quem, quando, por quê),
// valor automático logo abaixo, "Ajustar" e "Voltar ao automático".
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
  const c = campoDe(aluno, campo);
  if (!c) return null;
  return (
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
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
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
      {form && <FormAjuste aluno={aluno} campo={campo} iniciarVoltando={form === "voltar"} onFechar={() => setForm(null)} />}
    </div>
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
