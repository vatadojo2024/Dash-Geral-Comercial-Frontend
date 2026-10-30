"use client";

import { useId, useState, type MouseEvent } from "react";
import { Archive, PencilLine, Plus } from "lucide-react";
import { STATUS_AULA, type AlunoDetalhe, type Aula, type CamposAula, type Config, type StatusAula } from "@/lib/educacional/contrato";
import { dataCurta, hojeEmBrasilia, ROTULO_STATUS_AULA, ROTULO_TIPO_RESPONSAVEL, TAG_STATUS_AULA } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { ConfirmarAcao } from "./Blocos";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { ativos } from "./dados";
import { CampoTexto, useFicha, useMarca } from "./Ficha";
import { alteracaoDaAula, alteracaoDeCampo, aulaArquivada, aulaNova, ID_NOVO, type AulaNaTela } from "./lote/alteracoes";
import { MenuDesfazer } from "./lote/MarcaPendente";

// ---------------------------------------------------------------------------
// Aulas do aluno (Entrega 2, M1), no layout da planilha do Vata: tabela com
// Aula, Data, Mentor e Status e, ao lado, o painel "Campos" com Total de Aulas
// (editável na ficha), Aulas Aplicadas e Saldo de Aulas. Criar, editar e
// arquivar fazem parte da ficha (vão no "Salvar ficha"). Aplicadas e saldo vêm
// da API: com aula ou total pendente, mostram o valor salvo e avisam que mudam
// ao salvar (o front não conta as aulas).
// ---------------------------------------------------------------------------

const tempNovo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const chave = (x: Aula) => `aula:${x.id}`;
const nova = (x: Aula) => x.id.startsWith(ID_NOVO);

type Mentor = NonNullable<Aula["mentor"]>;

// Responsáveis ativos, quem é do tipo Mentor primeiro (o mentor atual entra
// mesmo inativo, para não sumir da lista).
export function opcoesDeMentor(config: Config | undefined, atual: Aula["mentor"] | null): Mentor[] {
  const lista: Mentor[] = ativos(config?.responsaveis).map(({ id, nome, tipo }) => ({ id, nome, tipo }));
  if (atual && !lista.some((r) => r.id === atual.id)) lista.push(atual);
  return [...lista.filter((r) => r.tipo === "mentor"), ...lista.filter((r) => r.tipo !== "mentor")];
}

export function Aulas({ a, config }: { a: AlunoDetalhe; config?: Config }) {
  const f = useFicha();
  const [editando, setEditando] = useState<Aula | "nova" | null>(null);
  const [arquivar, setArquivar] = useState<Aula | null>(null);
  const pendentes = Object.keys(f.entrada?.alteracoes ?? {}).some((k) => k.startsWith("aula:") || k === "campo:total_aulas");

  // Status direto na linha (ficha em edição).
  function mudarStatus(x: Aula, status: StatusAula) {
    if (status === x.status) return;
    const base = f.entrada?.alteracoes[chave(x)];
    f.registrar(nova(x) ? aulaNova(x.id.slice(ID_NOVO.length), { status }, {}, base) : alteracaoDaAula(x, { status }, {}, base));
  }
  const confirmarArquivar = (x: Aula) => (nova(x) ? f.desfazer(chave(x)) : f.registrar(aulaArquivada(x)));

  return (
    <Card>
      <CardHeader
        title="Aulas"
        subtitle="Mudanças aqui vão no “Salvar ficha”."
        action={
          <Button variant="secondary" size="sm" disabled={f.bloqueada} onClick={() => setEditando("nova")}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nova aula
          </Button>
        }
      />
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
          {a.aulas.length === 0 ? (
            <p className="text-sm text-texto-sec">Nenhuma aula registrada.</p>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-painel text-left text-[11px] uppercase tracking-wide text-texto-sec">
                  <tr>
                    <th className="px-3 py-2 font-medium">Aula</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Mentor</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {a.aulas.map((x) => (
                    <LinhaDaAula
                      key={x.id}
                      aula={x}
                      onStatus={(s) => mudarStatus(x, s)}
                      onEditar={() => setEditando(x)}
                      onArquivar={() => setArquivar(x)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PainelCampos a={a} pendentes={pendentes} />
        </div>
      </CardContent>
      {editando && (
        <FormAula
          aluno={a}
          config={config}
          aula={editando === "nova" ? null : editando}
          onFechar={() => setEditando(null)}
        />
      )}
      <ConfirmarAcao
        aberto={arquivar !== null}
        titulo="Arquivar aula?"
        texto={`“${arquivar?.nome}” sai da lista de ${a.nome} quando você salvar a ficha. Continua no banco e no histórico.`}
        confirmar="Arquivar"
        onConfirmar={() => arquivar && confirmarArquivar(arquivar)}
        onFechar={() => setArquivar(null)}
      />
    </Card>
  );
}

// Linha com a marca de alteração pendente (fundo amarelo, "Antes: …" e
// "Desfazer" no botão direito) e o erro de validação embaixo.
function LinhaDaAula({
  aula: x,
  onStatus,
  onEditar,
  onArquivar,
}: {
  aula: Aula;
  onStatus: (s: StatusAula) => void;
  onEditar: () => void;
  onArquivar: () => void;
}) {
  const f = useFicha();
  const m = useMarca(chave(x));
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const aoMenu = (e: MouseEvent) => {
    if (!m.onDesfazer) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };
  return (
    <>
      <tr
        className={cn("align-middle", m.alteracao && "bg-amarelo/[0.12]", m.erro && "outline outline-1 outline-erro/70")}
        title={m.alteracao ? `Antes: ${m.alteracao.antes}${m.onDesfazer ? " · botão direito: Desfazer" : ""}` : undefined}
        onContextMenu={aoMenu}
        data-pendente={m.alteracao ? "" : undefined}
      >
        <td className="px-3 py-2 font-medium text-texto">
          <span className="inline-flex items-center gap-1.5">
            {m.alteracao && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amarelo" aria-hidden />}
            {x.nome}
            {m.alteracao && <span className="sr-only">Alteração não salva. Antes: {m.alteracao.antes}.</span>}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-texto">{x.data ? dataCurta(x.data) : <span className="text-texto-sec">—</span>}</td>
        <td className="px-3 py-2 text-texto">{x.mentor?.nome ?? <span className="text-texto-sec">Sem mentor</span>}</td>
        <td className="px-3 py-2">
          {f.editando ? (
            <select
              aria-label={`Status da ${x.nome}`}
              value={x.status}
              disabled={f.bloqueada}
              onChange={(e) => onStatus(e.target.value as StatusAula)}
              className={cn(CAMPO, "h-8 w-32")}
            >
              {STATUS_AULA.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS_AULA[s]}
                </option>
              ))}
            </select>
          ) : (
            <span className={cn("tag", TAG_STATUS_AULA[x.status])}>{ROTULO_STATUS_AULA[x.status]}</span>
          )}
        </td>
        <td className="px-2 py-1 text-right">
          <span className="inline-flex gap-0.5">
            <Button variant="ghost" size="sm" disabled={f.bloqueada} onClick={onEditar} aria-label={`Editar ${x.nome}`} title="Editar">
              <PencilLine className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" disabled={f.bloqueada} onClick={onArquivar} aria-label={`Arquivar ${x.nome}`} title="Arquivar">
              <Archive className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </span>
        </td>
      </tr>
      {m.erro && (
        <tr>
          <td colSpan={5} className="px-3 pb-2 text-[11px] leading-snug text-erro" role="alert">
            {m.erro}
          </td>
        </tr>
      )}
      {menu && m.onDesfazer && <MenuDesfazer pos={menu} onDesfazer={m.onDesfazer} onFechar={() => setMenu(null)} />}
    </>
  );
}

// Painel "Campos" (como na planilha): total editável na ficha; aplicadas e saldo da API.
function PainelCampos({ a, pendentes }: { a: AlunoDetalhe; pendentes: boolean }) {
  const f = useFicha();
  const numero = (v: number | null) => (v == null ? <span className="text-texto-sec">—</span> : v);
  return (
    <aside aria-label="Campos das aulas" className="h-fit space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-texto-sec">Campos</p>
      {f.editando ? (
        <CampoTexto
          chave="campo:total_aulas"
          rotulo="Total de Aulas"
          tipo="number"
          valor={a.total_aulas == null ? null : String(a.total_aulas)}
          onConfirmar={(v) => f.registrar(alteracaoDeCampo(a, "total_aulas", v == null ? null : Number(v)))}
        />
      ) : (
        <Numero rotulo="Total de Aulas">{numero(a.total_aulas)}</Numero>
      )}
      <Numero rotulo="Aulas Aplicadas">{numero(a.aulas_aplicadas)}</Numero>
      <Numero rotulo="Saldo de Aulas" destaque={a.saldo_aulas != null && a.saldo_aulas < 0}>
        {numero(a.saldo_aulas)}
      </Numero>
      {pendentes && <p className="text-xs text-texto-sec">Aplicadas e saldo são recalculados ao salvar a ficha.</p>}
    </aside>
  );
}

function Numero({ rotulo, destaque = false, children }: { rotulo: string; destaque?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-texto-sec">{rotulo}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", destaque ? "text-erro" : "text-texto")}>{children}</p>
    </div>
  );
}

// Formulário da aula: na ficha, "Aplicar" registra só o que mudou; "Adicionar"
// cria a aula nova (pendente). Nome sugerido: "Aula N" (N = próxima da lista).
function FormAula({ aluno, config, aula, onFechar }: { aluno: AlunoDetalhe; config?: Config; aula: Aula | null; onFechar: () => void }) {
  const id = useId();
  const f = useFicha();
  const criando = aula === null;
  const responsavelPadrao = aluno.responsavel && ativos(config?.responsaveis).some((r) => r.id === aluno.responsavel?.id) ? aluno.responsavel : null;
  const [nome, setNome] = useState(aula?.nome ?? `Aula ${aluno.aulas.length + 1}`);
  const [dia, setDia] = useState(aula ? (aula.data ?? "") : hojeEmBrasilia());
  const [mentorId, setMentorId] = useState(aula ? (aula.mentor?.id ?? "") : (responsavelPadrao?.id ?? ""));
  const [status, setStatus] = useState<StatusAula>(aula?.status ?? "agendada");
  const [erro, setErro] = useState<string | null>(null);
  const mentores = opcoesDeMentor(config, aula?.mentor ?? null);

  function aplicar() {
    if (!nome.trim()) return setErro("Informe o nome da aula (ex.: Aula 1).");
    const todos: CamposAula = { nome: nome.trim(), data: dia || null, mentor_id: mentorId || null, status };
    const mentor = mentores.find((r) => r.id === mentorId) ?? null;
    const tela: AulaNaTela = { mentor };
    if (criando || nova(aula)) {
      const temp = criando ? tempNovo() : aula.id.slice(ID_NOVO.length);
      f.registrar(aulaNova(temp, todos, tela, f.entrada?.alteracoes[`aula:${ID_NOVO}${temp}`]));
    } else {
      const atual: Record<string, unknown> = { nome: aula.nome, data: aula.data, mentor_id: aula.mentor?.id ?? null, status: aula.status };
      const campos = Object.fromEntries(Object.entries(todos).filter(([k, v]) => (atual[k] ?? null) !== v)) as CamposAula;
      if (Object.keys(campos).length) f.registrar(alteracaoDaAula(aula, campos, "mentor_id" in campos ? tela : {}, f.entrada?.alteracoes[chave(aula)]));
    }
    onFechar();
  }

  return (
    <Dialogo
      aberto
      titulo={criando ? "Nova aula" : `Editar aula · ${aula.nome}`}
      subtitulo={`${aluno.nome} · vai no “Salvar ficha”`}
      onFechar={onFechar}
      onEnviar={aplicar}
      rodape={
        <>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit">{criando ? "Adicionar" : "Aplicar"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${id}-nome`} rotulo="Aula" obrigatorio>
          <input id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
        </Campo>
        <Campo id={`${id}-data`} rotulo="Data">
          <input id={`${id}-data`} type="date" value={dia} onChange={(e) => setDia(e.target.value)} className={CAMPO} />
        </Campo>
        <Campo id={`${id}-mentor`} rotulo="Mentor">
          <select id={`${id}-mentor`} value={mentorId} onChange={(e) => setMentorId(e.target.value)} className={CAMPO}>
            <option value="">Sem mentor</option>
            {mentores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} · {ROTULO_TIPO_RESPONSAVEL[r.tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-status`} rotulo="Status">
          <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as StatusAula)} className={CAMPO}>
            {STATUS_AULA.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_AULA[s]}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <ErroDoEnvio texto={erro} />
    </Dialogo>
  );
}
