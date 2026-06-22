import { z } from "zod";
import { RoleSchema } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Contrato de dados do Chat IA (design.md §3) — CRÍTICO.
// O mock usa EXATAMENTE estes campos; na Etapa 5 o serviço real responde pelo
// mesmo contrato e a tela não muda. Nomes em português, separando `papel` (do
// usuário, reutiliza o RoleSchema do painel) de `autor` (da mensagem).
// ---------------------------------------------------------------------------

// `autor` = quem escreveu A MENSAGEM. Não confundir com `papel` (do usuário).
export const AutorSchema = z.enum(["usuario", "ia"]);
export type Autor = z.infer<typeof AutorSchema>;

// `status` habilita o "pensando…" (pendente) e o estado de erro (erro).
// Mensagem de `autor: usuario` nasce sempre `pronta`.
export const StatusMensagemSchema = z.enum(["pendente", "pronta", "erro"]);
export type StatusMensagem = z.infer<typeof StatusMensagemSchema>;

// Anexo: campo já PREVISTO para a etapa de arquivo, mas sem upload nesta etapa
// (array sempre vazio). Existe desde já para que a entrada de arquivo, lá na
// frente, não mude o contrato. Forma mínima/placeholder — a confirmar depois.
export const AnexoSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    tipo: z.string(),
  })
  .partial();
export type Anexo = z.infer<typeof AnexoSchema>;

// `papel` reutiliza RoleSchema (admin | closer | sdr) — mesma fonte do painel.
export const ConversaSchema = z.object({
  id: z.string(),
  papel: RoleSchema,
  titulo: z.string().optional(),
  criada_em: z.string(), // ISO
  atualizada_em: z.string(), // ISO
});
export type Conversa = z.infer<typeof ConversaSchema>;

export const MensagemSchema = z.object({
  id: z.string(),
  conversa_id: z.string(),
  autor: AutorSchema,
  conteudo: z.string(),
  status: StatusMensagemSchema,
  criada_em: z.string(), // ISO
  anexos: z.array(AnexoSchema), // vazio nesta etapa
});
export type Mensagem = z.infer<typeof MensagemSchema>;
