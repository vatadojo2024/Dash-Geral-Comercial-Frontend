import {
  MensagemSchema,
  type Autor,
  type Mensagem,
  type StatusMensagem,
} from "./tipos";

// ---------------------------------------------------------------------------
// Lógica PURA da conversa (sem React, sem rede) — fácil de testar isolada.
// O hook useConversa apenas amarra ids/timestamps e a chamada à fonte de
// respostas em cima destas funções.
// ---------------------------------------------------------------------------

export function novaMensagem(params: {
  id: string;
  conversa_id: string;
  autor: Autor;
  conteudo: string;
  status: StatusMensagem;
  criada_em: string;
}): Mensagem {
  // `anexos` previsto e VAZIO nesta etapa (contrato, sem upload).
  return { ...params, anexos: [] };
}

// Conclui a mensagem da IA: recebe o conteúdo e vira `pronta`.
export function aplicarConteudo(
  mensagens: Mensagem[],
  id: string,
  conteudo: string,
): Mensagem[] {
  return mensagens.map((m) =>
    m.id === id ? { ...m, conteudo, status: "pronta" } : m,
  );
}

// Marca a mensagem da IA com um status. Ao voltar para `pendente` (tentar
// novamente) o conteúdo é limpo para reexibir o "pensando…".
export function aplicarStatus(
  mensagens: Mensagem[],
  id: string,
  status: StatusMensagem,
): Mensagem[] {
  return mensagens.map((m) =>
    m.id === id
      ? { ...m, status, conteudo: status === "pendente" ? "" : m.conteudo }
      : m,
  );
}

// Tolerância item-a-item (RF-08): valida cada item contra o contrato; a
// mensagem malformada é DESCARTADA e REGISTRADA, sem derrubar a lista inteira.
// Aceita `unknown[]` de propósito — vale tanto para o estado local quanto para
// dados vindos do serviço real na Etapa 5.
export function mensagensValidas(itens: unknown[]): Mensagem[] {
  const validas: Mensagem[] = [];
  for (const item of itens) {
    const r = MensagemSchema.safeParse(item);
    if (r.success) {
      validas.push(r.data);
    } else {
      console.warn(
        "[chat] mensagem malformada descartada (tolerância item-a-item):",
        r.error.issues,
      );
    }
  }
  return validas;
}

// Ordena cronologicamente (mais recentes embaixo) — RF-04.
export function ordenarCronologico(itens: Mensagem[]): Mensagem[] {
  return [...itens].sort((a, b) => a.criada_em.localeCompare(b.criada_em));
}
