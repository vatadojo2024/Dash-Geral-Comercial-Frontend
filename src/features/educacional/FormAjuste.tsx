"use client";

import { useEffect, useId, useState } from "react";
import { ajustarCampo, EducacionalError, voltarAoAutomatico } from "@/lib/educacional/apiEducacional";
import { MOTIVO_MINIMO, type AlunoDetalhe, type AlunoLinha, type CampoAjustavel } from "@/lib/educacional/contrato";
import { dataHoraBr } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/features/session/SessionProvider";
import { cn } from "@/lib/utils/cn";
import { AJUSTE_AFETA_TOTAIS, campoDe, comCampo, EDITOR_DO_CAMPO, formatarValor, rotuloDoCampo } from "./campos";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Ajuste manual de campo calculado (spec Fase 2, 5.1): novo valor + motivo
// (obrigatório, mín. 5 caracteres) → PUT /alunos/:id/ajustes/:campo. "Voltar
// ao automático" pede confirmação → DELETE. Mostra o valor automático e o
// ajuste ativo (quem, quando, por quê).
// ---------------------------------------------------------------------------

export function FormAjuste({
  aluno,
  campo,
  onFechar,
  iniciarVoltando = false,
}: {
  aluno: AlunoLinha | AlunoDetalhe;
  campo: CampoAjustavel | null;
  onFechar: () => void;
  // Abre direto na confirmação de "Voltar ao automático".
  iniciarVoltando?: boolean;
}) {
  const id = useId();
  const user = useSession();
  const gravar = useGravacao();
  const atual = campo ? campoDe(aluno, campo) : null;
  const editor = campo ? EDITOR_DO_CAMPO[campo] : null;
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<{ valor?: string; motivo?: string; envio?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const [confirmarVolta, setConfirmarVolta] = useState(false);

  useEffect(() => {
    if (!campo) return;
    const v = atual?.valor;
    setValor(v == null ? "" : String(v));
    setMotivo("");
    setErros({});
    setConfirmarVolta(iniciarVoltando);
    // Só ao abrir: mudanças vindas de fora não apagam o que se digita.
  }, [campo]);

  if (!campo || !editor) return null;
  const nome = rotuloDoCampo(campo);

  function lerValor(): { ok: true; v: unknown } | { ok: false; erro: string } {
    if (!editor) return { ok: false, erro: "Campo inválido." };
    if (valor === "") return { ok: false, erro: "Informe o novo valor." };
    switch (editor.tipo) {
      case "numero": {
        const n = Number(valor.replace(",", "."));
        if (!Number.isFinite(n)) return { ok: false, erro: "Use um número." };
        if (n < editor.min || (editor.max != null && n > editor.max)) {
          return { ok: false, erro: editor.max != null ? `Use um número de ${editor.min} a ${editor.max}.` : `Use ${editor.min} ou mais.` };
        }
        return { ok: true, v: n };
      }
      case "booleano":
        return { ok: true, v: valor === "true" };
      default:
        return { ok: true, v: valor };
    }
  }

  async function salvar() {
    if (!campo) return;
    const lido = lerValor();
    const novos: typeof erros = {};
    if (!lido.ok) novos.valor = lido.erro;
    if (motivo.trim().length < MOTIVO_MINIMO) novos.motivo = `Explique o motivo (pelo menos ${MOTIVO_MINIMO} caracteres).`;
    setErros(novos);
    if (!lido.ok || novos.motivo) return;
    const ajuste = { valor: lido.v, motivo: motivo.trim(), ajustado_por: { id: user.id, nome: user.nome }, ajustado_em: new Date().toISOString() };
    const novo = { valor: lido.v, automatico: atual?.automatico ?? null, ajuste };
    setSalvando(true);
    const r = await gravar({
      alunoId: aluno.id,
      versao: aluno.versao,
      executar: (v) => ajustarCampo(aluno.id, v, campo, lido.v, motivo.trim()),
      noAluno: (a) => comCampo(a, campo, novo),
      naLinha: (l) => comCampo(l, campo, novo),
      afetaTotais: AJUSTE_AFETA_TOTAIS.has(campo),
    });
    setSalvando(false);
    if (r.ok) onFechar();
    else if (r.erro instanceof EducacionalError && r.erro.status === 400) {
      setErros({ envio: r.erro.corpo.mensagem ?? r.erro.message });
    } else onFechar();
  }

  async function voltar() {
    if (!campo) return;
    const novo = { valor: atual?.automatico ?? null, automatico: atual?.automatico ?? null, ajuste: null };
    setSalvando(true);
    const r = await gravar({
      alunoId: aluno.id,
      versao: aluno.versao,
      executar: (v) => voltarAoAutomatico(aluno.id, v, campo),
      noAluno: (a) => comCampo(a, campo, novo),
      naLinha: (l) => comCampo(l, campo, novo),
      afetaTotais: AJUSTE_AFETA_TOTAIS.has(campo),
    });
    setSalvando(false);
    if (r.ok || !(r.erro instanceof EducacionalError && r.erro.status === 400)) onFechar();
  }

  return (
    <Dialogo
      aberto
      titulo={`Ajustar ${nome.toLowerCase()}`}
      subtitulo={aluno.nome}
      onFechar={onFechar}
      onEnviar={salvar}
      largura="max-w-md"
      rodape={
        confirmarVolta ? (
          <>
            <span className="mr-auto self-center text-sm text-texto">Voltar ao valor automático?</span>
            <Button type="button" variant="ghost" onClick={() => setConfirmarVolta(false)}>
              Não
            </Button>
            <Button type="button" loading={salvando} onClick={voltar}>
              Sim, voltar
            </Button>
          </>
        ) : (
          <>
            {atual?.ajuste && (
              <Button type="button" variant="outline" className="mr-auto" onClick={() => setConfirmarVolta(true)}>
                Voltar ao automático
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" loading={salvando}>
              Salvar ajuste
            </Button>
          </>
        )
      }
    >
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-texto-sec">
        <p>
          Automático: <span className="text-texto">{formatarValor(campo, atual?.automatico)}</span>
        </p>
        {atual?.ajuste && (
          <p className="mt-1">
            Ajustado para <span className="text-texto">{formatarValor(campo, atual.ajuste.valor)}</span> por{" "}
            {atual.ajuste.ajustado_por.nome} em {dataHoraBr(atual.ajuste.ajustado_em)} — “{atual.ajuste.motivo}”
          </p>
        )}
      </div>

      <Campo id={`${id}-valor`} rotulo="Novo valor" obrigatorio erro={erros.valor}>
        {editor.tipo === "lista" || editor.tipo === "booleano" ? (
          <select id={`${id}-valor`} value={valor} onChange={(e) => setValor(e.target.value)} className={CAMPO}>
            <option value="">Escolha…</option>
            {(editor.tipo === "lista"
              ? editor.opcoes
              : [
                  { valor: "true", rotulo: "Sim" },
                  { valor: "false", rotulo: "Não" },
                ]
            ).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <input
              id={`${id}-valor`}
              type={editor.tipo === "data" ? "date" : "number"}
              inputMode={editor.tipo === "numero" ? "decimal" : undefined}
              min={editor.tipo === "numero" ? editor.min : undefined}
              max={editor.tipo === "numero" ? editor.max : undefined}
              step={editor.tipo === "numero" ? (editor.passo ?? 1) : undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={cn(CAMPO, editor.tipo === "numero" && "max-w-[10rem]")}
            />
            {editor.tipo === "numero" && editor.sufixo && <span className="text-xs text-texto-sec">{editor.sufixo}</span>}
          </div>
        )}
      </Campo>

      <Campo id={`${id}-motivo`} rotulo="Motivo" obrigatorio erro={erros.motivo}>
        <textarea
          id={`${id}-motivo`}
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por que o valor automático não vale para este aluno"
          className={cn(CAMPO, "h-auto py-2")}
        />
      </Campo>
      <ErroDoEnvio texto={erros.envio} />
    </Dialogo>
  );
}
