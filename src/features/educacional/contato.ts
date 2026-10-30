// ---------------------------------------------------------------------------
// Contato do aluno (Entrega 1): E-mail, Número e Discord. Obrigatórios no
// cadastro. Aqui só o formato mínimo, para avisar antes de enviar; quem decide
// é o backend (a mensagem dele aparece se recusar).
// ---------------------------------------------------------------------------

export const CAMPOS_CONTATO = ["email", "telefone", "discord"] as const;
export type CampoContato = (typeof CAMPOS_CONTATO)[number];

export const ROTULO_CONTATO: Record<CampoContato, string> = {
  email: "E-mail",
  telefone: "Número",
  discord: "Discord",
};

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function erroDoContato(campo: CampoContato, valor: string): string | null {
  const t = valor.trim();
  if (!t) {
    if (campo === "email") return "Informe o e-mail.";
    if (campo === "telefone") return "Informe o número, com DDD.";
    return "Informe o usuário do Discord.";
  }
  if (campo === "email" && !RE_EMAIL.test(t)) return "E-mail inválido. Use o formato nome@dominio.com.";
  if (campo === "telefone") {
    const digitos = t.replace(/\D/g, "").length;
    if (digitos < 10 || digitos > 15) return "Número inválido. Use DDD e número, de 10 a 15 dígitos.";
  }
  return null;
}
