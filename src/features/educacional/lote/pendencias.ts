import { z } from "zod";
import type { AjusteLote, AlunoDetalhe, AlunoNoLote, ItemLote, PedidoLote, RespostaLote } from "@/lib/educacional/contrato";

// ---------------------------------------------------------------------------
// Alterações pendentes (Fase 3, seções 4 e 6.1): o que a pessoa editou na aba
// Alunos ou na ficha do Raio-X e ainda não salvou. Puro (sem React), para
// testar; o provedor do módulo guarda o estado e chama estas funções. Nada
// aqui calcula regra de negócio: a tela só sobrepõe o que foi digitado ao
// aluno do servidor.
//
// Uma entrada por aluno, com uma alteração por "chave" (célula ou item):
//   campo:<nome>                 campo direto (PATCH)
//   ajuste:<campo>               ajuste manual de campo calculado
//   checkpoint:<id>              mudança ou arquivamento de um checkpoint
//   checkpoint:novo:<temp>       checkpoint avulso novo
//   intervencao:<id> / intervencao:novo:<temp>   idem, intervenção
// `anterior` é o valor do servidor na PRIMEIRA edição; editar de novo troca só
// o valor (vale a última). Se o valor voltar ao anterior, a alteração some.
// ---------------------------------------------------------------------------

export type PedidoDaAlteracao =
  | { tipo: "campos"; campos: Record<string, unknown> }
  | { tipo: "ajuste"; ajuste: AjusteLote }
  | { tipo: "checkpoint"; item: ItemLote }
  | { tipo: "intervencao"; item: ItemLote };

// Como a alteração aparece na tela, por cima do aluno do servidor. Operações
// (e não o objeto pronto) para duas alterações no mesmo grupo não se apagarem.
export type Sobreposicao =
  | { tipo: "campo"; campo: string; valor: unknown }
  | { tipo: "dentro"; campo: string; chave: string; valor: unknown } // sinais.upgrade, progresso.consumiu
  | { tipo: "item"; lista: string; id: string; campos: Record<string, unknown> }
  | { tipo: "novo"; lista: string; item: Record<string, unknown> }
  | { tipo: "remover"; lista: string; id: string };

export type Alteracao = {
  chave: string;
  valor: unknown; // comparável com `anterior`
  anterior: unknown;
  antes: string; // texto do valor anterior (marca da célula)
  depois: string;
  pedido: PedidoDaAlteracao;
  sobrepor: Sobreposicao[];
  afetaTotais?: boolean;
};

export type ErroDaEntrada =
  | { tipo: "versao"; atual: AlunoDetalhe }
  | { tipo: "validacao"; campo: string; mensagem: string; chave: string | null }
  | { tipo: "rede"; mensagem: string };

export type EstadoDaEntrada = "pendente" | "salvando" | "erro" | "revisar";

export type Entrada = {
  aluno_id: string;
  nome: string;
  versao: number;
  alteracoes: Record<string, Alteracao>;
  estado: EstadoDaEntrada;
  erro?: ErroDaEntrada;
};

export type Pendencias = Readonly<Record<string, Entrada>>;
export const SEM_PENDENCIAS: Pendencias = Object.freeze({});

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// Igualdade para "voltou ao valor do servidor": em objeto, ausente = null.
export function iguais(a: unknown, b: unknown): boolean {
  if (ehObjeto(a) && ehObjeto(b)) {
    const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...chaves].every((k) => iguais(a[k] ?? null, b[k] ?? null));
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function semAluno(p: Pendencias, alunoId: string): Pendencias {
  const { [alunoId]: _, ...resto } = p;
  return resto;
}

export function contar(p: Pendencias): { alteracoes: number; alunos: number } {
  const entradas = Object.values(p);
  return { alteracoes: entradas.reduce((n, e) => n + Object.keys(e.alteracoes).length, 0), alunos: entradas.length };
}

// Registra (ou troca) uma alteração. Aluno em envio não aceita edição.
export function registrar(p: Pendencias, aluno: { id: string; nome: string; versao: number }, alt: Alteracao): Pendencias {
  const e = p[aluno.id];
  if (e?.estado === "salvando") return p;
  const ja = e?.alteracoes[alt.chave];
  // O anterior da 1ª edição vale; num item, campos editados depois somam o deles.
  const anterior = ja && ehObjeto(ja.anterior) && ehObjeto(alt.anterior) ? { ...alt.anterior, ...ja.anterior } : ja ? ja.anterior : alt.anterior;
  const nova: Alteracao = ja ? { ...alt, anterior, antes: ja.antes } : alt;
  const alteracoes = { ...(e?.alteracoes ?? {}) };
  if (iguais(nova.valor, nova.anterior)) delete alteracoes[alt.chave];
  else alteracoes[alt.chave] = nova;
  if (!Object.keys(alteracoes).length) return semAluno(p, aluno.id);
  // Editar de novo tira o erro de validação/rede; o de versão espera a escolha.
  const manterErro = e?.erro?.tipo === "versao";
  return {
    ...p,
    [aluno.id]: {
      aluno_id: aluno.id,
      nome: e?.nome ?? aluno.nome,
      versao: e?.versao ?? aluno.versao,
      alteracoes,
      estado: manterErro ? "erro" : e?.estado === "revisar" ? "revisar" : "pendente",
      ...(manterErro ? { erro: e.erro } : {}),
    },
  };
}

export function desfazer(p: Pendencias, alunoId: string, chave: string): Pendencias {
  const e = p[alunoId];
  if (!e || e.estado === "salvando" || !e.alteracoes[chave]) return p;
  const { [chave]: _, ...alteracoes } = e.alteracoes;
  if (!Object.keys(alteracoes).length) return semAluno(p, alunoId);
  const erroDaCelula = e.erro?.tipo === "validacao" && e.erro.chave === chave;
  return { ...p, [alunoId]: { ...e, alteracoes, ...(erroDaCelula ? { estado: "pendente", erro: undefined } : {}) } };
}

// "Descartar" apaga tudo, menos o que está em envio.
export function descartar(p: Pendencias): Pendencias {
  return Object.fromEntries(Object.entries(p).filter(([, e]) => e.estado === "salvando"));
}

export function descartarAluno(p: Pendencias, alunoId: string): Pendencias {
  return p[alunoId]?.estado === "salvando" ? p : semAluno(p, alunoId);
}

// O que entra no próximo "Salvar" (todos, ou só os alunos pedidos, como o
// "Salvar ficha"): menos o que já está em envio e o 409 que espera a escolha.
export function paraEnviar(p: Pendencias, apenas?: readonly string[]): Entrada[] {
  return Object.values(p).filter(
    (e) => e.estado !== "salvando" && e.erro?.tipo !== "versao" && (!apenas || apenas.includes(e.aluno_id)),
  );
}

export function montarPedido(entradas: Entrada[]): PedidoLote {
  return {
    alunos: entradas.map((e): AlunoNoLote => {
      const campos: Record<string, unknown> = {};
      const ajustes: AjusteLote[] = [];
      const itens = { checkpoint: new Map<string, ItemLote>(), intervencao: new Map<string, ItemLote>() };
      for (const a of Object.values(e.alteracoes)) {
        if (a.pedido.tipo === "campos") Object.assign(campos, a.pedido.campos);
        else if (a.pedido.tipo === "ajuste") ajustes.push(a.pedido.ajuste);
        else {
          // Item novo não tem id: a chave da alteração o identifica.
          const mapa = itens[a.pedido.tipo];
          const k = a.pedido.item.novo ? a.chave : String(a.pedido.item.id);
          mapa.set(k, { ...mapa.get(k), ...a.pedido.item });
        }
      }
      return {
        aluno_id: e.aluno_id,
        versao: e.versao,
        ...(Object.keys(campos).length ? { campos } : {}),
        ...(ajustes.length ? { ajustes } : {}),
        ...(itens.checkpoint.size ? { checkpoints: [...itens.checkpoint.values()] } : {}),
        ...(itens.intervencao.size ? { intervencoes: [...itens.intervencao.values()] } : {}),
      };
    }),
  };
}

export function marcarSalvando(p: Pendencias, ids: string[]): Pendencias {
  const novo = { ...p };
  for (const id of ids) if (novo[id]) novo[id] = { ...novo[id], estado: "salvando", erro: undefined };
  return novo;
}

// Célula do erro de validação: a alteração cujo pedido tem o campo devolvido.
export function chaveDoCampo(e: Entrada, campo: string): string | null {
  const alts = Object.values(e.alteracoes);
  const lista = campo === "checkpoints" ? "checkpoint" : campo === "intervencoes" ? "intervencao" : null;
  const achada =
    alts.find((a) => a.pedido.tipo === "campos" && campo in a.pedido.campos) ??
    alts.find((a) => a.pedido.tipo === "ajuste" && a.pedido.ajuste.campo === campo) ??
    alts.find((a) => (a.pedido.tipo === "checkpoint" || a.pedido.tipo === "intervencao") && campo in a.pedido.item) ??
    (lista ? alts.find((a) => a.pedido.tipo === lista) : undefined) ??
    // "motivo"/"valor" sem dizer o campo: é de um ajuste (o primeiro do aluno).
    (campo === "motivo" || campo === "valor" ? alts.find((a) => a.pedido.tipo === "ajuste") : undefined);
  return achada?.chave ?? null;
}

export type Apuracao = {
  pendencias: Pendencias;
  gravados: AlunoDetalhe[];
  salvas: number; // alterações gravadas
  comErro: number; // alterações dos alunos com erro (D5)
  afetaTotais: boolean;
};

// Resultado do lote, aluno a aluno: gravado sai das pendências; erro continua
// pendente com o motivo.
export function aplicarResposta(p: Pendencias, enviados: Entrada[], resposta: RespostaLote): Apuracao {
  const novo: Record<string, Entrada> = { ...p };
  const gravados: AlunoDetalhe[] = [];
  let salvas = 0;
  let comErro = 0;
  let afetaTotais = false;
  enviados.forEach((enviado, i) => {
    const r = resposta.resultados.find((x) => x.aluno_id === enviado.aluno_id) ?? resposta.resultados[i];
    const n = Object.keys(enviado.alteracoes).length;
    const e = novo[enviado.aluno_id] ?? enviado;
    if (r?.ok) {
      salvas += n;
      gravados.push(r.aluno);
      afetaTotais ||= Object.values(enviado.alteracoes).some((a) => a.afetaTotais);
      delete novo[enviado.aluno_id];
      return;
    }
    comErro += n;
    const erro: ErroDaEntrada =
      r && r.error === "versao"
        ? { tipo: "versao", atual: r.aluno }
        : {
            tipo: "validacao",
            campo: r?.campo ?? "",
            mensagem: r?.mensagem || "Não foi possível salvar este aluno.",
            chave: chaveDoCampo(e, r?.campo ?? ""),
          };
    novo[enviado.aluno_id] = { ...e, estado: "erro", erro };
  });
  return { pendencias: novo, gravados, salvas, comErro, afetaTotais };
}

// O lote inteiro falhou (rede, 500): nada se perde; tudo volta como erro de rede.
export function aplicarFalha(p: Pendencias, ids: string[], mensagem: string): Pendencias {
  const novo = { ...p };
  for (const id of ids) if (novo[id]) novo[id] = { ...novo[id], estado: "erro", erro: { tipo: "rede", mensagem } };
  return novo;
}

// "Reaplicar minhas alterações" depois do 409: a versão passa a ser a atual, o
// `anterior` de cada alteração é relido do servidor, o que ficou igual sai e o
// que o servidor não tem mais (checkpoint ou intervenção arquivados) sai com
// aviso. O aluno fica em "revisar" até a pessoa salvar de novo. Nada é enviado.
export type LeituraDoServidor = (alt: Alteracao, atual: AlunoDetalhe) => { anterior: unknown; antes: string } | null;

export function reaplicar(
  p: Pendencias,
  alunoId: string,
  ler: LeituraDoServidor,
): { pendencias: Pendencias; removidas: Alteracao[] } {
  const e = p[alunoId];
  if (!e || e.erro?.tipo !== "versao") return { pendencias: p, removidas: [] };
  const atual = e.erro.atual;
  const alteracoes: Record<string, Alteracao> = {};
  const removidas: Alteracao[] = [];
  for (const a of Object.values(e.alteracoes)) {
    const lido = ler(a, atual);
    if (!lido) {
      removidas.push(a);
      continue;
    }
    if (iguais(a.valor, lido.anterior)) continue;
    alteracoes[a.chave] = { ...a, anterior: lido.anterior, antes: lido.antes };
  }
  if (!Object.keys(alteracoes).length) return { pendencias: semAluno(p, alunoId), removidas };
  return {
    pendencias: { ...p, [alunoId]: { aluno_id: alunoId, nome: atual.nome, versao: atual.versao, alteracoes, estado: "revisar" } },
    removidas,
  };
}

// Ação imediata feita por ESTA aba (arquivar, trocar programa, ajustar fora da
// ficha, "Nova intervenção" do Cockpit) gravou por cima da versão das
// pendências: elas passam para a versão que a resposta trouxe, com o anterior
// relido. Só quando a aba enviou a versão das pendências e a resposta veio com
// a seguinte. Versão nova vinda de outro lugar (outra aba, outra pessoa,
// recarga da lista) nunca passa por aqui: continua indo para o 409.
export function rebasear(
  p: Pendencias,
  { aluno, versaoEnviada }: { aluno: AlunoDetalhe; versaoEnviada: number },
  ler: LeituraDoServidor,
): Pendencias {
  const e = p[aluno.id];
  if (!e || e.estado === "salvando" || e.erro?.tipo === "versao") return p;
  if (e.versao !== versaoEnviada || aluno.versao !== versaoEnviada + 1) return p;
  const r = reaplicar({ ...p, [aluno.id]: { ...e, erro: { tipo: "versao", atual: aluno } } }, aluno.id, ler);
  const n = r.pendencias[aluno.id];
  if (!n) return r.pendencias;
  return { ...r.pendencias, [aluno.id]: { ...n, nome: e.nome, estado: e.estado === "erro" ? "pendente" : e.estado, erro: undefined } };
}

function aplicar(o: Record<string, unknown>, s: Sobreposicao): void {
  switch (s.tipo) {
    case "campo":
      o[s.campo] = s.valor;
      return;
    case "dentro":
      if (ehObjeto(o[s.campo])) o[s.campo] = { ...(o[s.campo] as Record<string, unknown>), [s.chave]: s.valor };
      return;
    case "item": {
      const lista = o[s.lista];
      if (Array.isArray(lista)) o[s.lista] = lista.map((x: { id?: unknown }) => (x.id === s.id ? { ...x, ...s.campos } : x));
      // O próximo checkpoint (linha da tabela) acompanha o item da timeline.
      const proximo = o.proximo_checkpoint as { id?: unknown } | null | undefined;
      if (s.lista === "checkpoints" && proximo?.id === s.id) o.proximo_checkpoint = { ...proximo, ...s.campos };
      return;
    }
    case "novo":
      if (Array.isArray(o[s.lista])) o[s.lista] = [...(o[s.lista] as unknown[]), s.item];
      return;
    case "remover":
      if (Array.isArray(o[s.lista])) o[s.lista] = (o[s.lista] as { id?: unknown }[]).filter((x) => x.id !== s.id);
  }
}

// O aluno do servidor (linha ou detalhe) com as alterações digitadas por cima.
// Sem alteração, devolve o MESMO objeto (as linhas memorizadas não redesenham).
export function comPendencias<T extends object>(aluno: T, e: Entrada | undefined): T {
  if (!e) return aluno;
  const o = { ...aluno } as Record<string, unknown>;
  for (const a of Object.values(e.alteracoes)) for (const s of a.sobrepor) aplicar(o, s);
  return o as T;
}

// ---------------------------------------------------------------------------
// Guardado no sessionStorage (sobrevive a recarregar a aba). Validado ao ler:
// entrada inválida sai; pendências de outro usuário no mesmo navegador são
// ignoradas; envio interrompido volta a "pendente".
// ---------------------------------------------------------------------------

export const CHAVE_SESSAO = "mdc_edu_pendencias_v1";
const FORMATO = 2;

const Item = z.object({}).passthrough();
const AlteracaoGuardada = z.object({
  chave: z.string(),
  valor: z.unknown(),
  anterior: z.unknown(),
  antes: z.string(),
  depois: z.string(),
  pedido: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("campos"), campos: z.record(z.string(), z.unknown()) }),
    z.object({ tipo: z.literal("ajuste"), ajuste: z.object({ campo: z.string() }).passthrough() }),
    z.object({ tipo: z.literal("checkpoint"), item: Item }),
    z.object({ tipo: z.literal("intervencao"), item: Item }),
  ]),
  sobrepor: z.array(z.object({ tipo: z.enum(["campo", "dentro", "item", "novo", "remover"]) }).passthrough()),
  afetaTotais: z.boolean().optional(),
});
const EntradaGuardada = z.object({
  aluno_id: z.string().min(1),
  nome: z.string(),
  versao: z.number().int(),
  alteracoes: z.record(z.string(), AlteracaoGuardada),
  estado: z.enum(["pendente", "salvando", "erro", "revisar"]),
  erro: z.unknown().optional(),
});

export function serializar(p: Pendencias, usuarioId: string): string {
  return JSON.stringify({ formato: FORMATO, usuario: usuarioId, entradas: p });
}

export function lerGuardado(texto: string | null, usuarioId: string): Pendencias {
  if (!texto) return SEM_PENDENCIAS;
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return SEM_PENDENCIAS;
  }
  const b = bruto as { formato?: unknown; usuario?: unknown; entradas?: unknown } | null;
  if (!b || b.formato !== FORMATO || b.usuario !== usuarioId || !ehObjeto(b.entradas)) return SEM_PENDENCIAS;
  const saida: Record<string, Entrada> = {};
  for (const [id, valor] of Object.entries(b.entradas)) {
    const r = EntradaGuardada.safeParse(valor);
    if (!r.success || r.data.aluno_id !== id || !Object.keys(r.data.alteracoes).length) continue;
    const e = r.data as unknown as Entrada;
    // Envio interrompido (recarregou no meio): volta a pendente; um 409 guardado continua.
    const erroValido = ehObjeto(e.erro) && "tipo" in e.erro ? e.erro : undefined;
    saida[id] =
      e.estado === "salvando" || (e.estado === "erro" && !erroValido)
        ? { ...e, estado: "pendente", erro: undefined }
        : { ...e, erro: erroValido };
  }
  return saida;
}
