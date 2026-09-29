// ---------------------------------------------------------------------------
// De onde vêm os dados da tela "Agendamentos — Primeira Call".
//
// Regra geral: segue LEADS_MODE, como as outras telas (mock | api).
// Exceção para TESTE LOCAL: AGENDAMENTOS_MODE=mock liga dados de demonstração
// SÓ nesta tela, mesmo com LEADS_MODE=api — as outras telas seguem na API real.
// Mesmo padrão do SDR_DASHBOARD_MODE (modo por módulo).
//
// Trava: no deploy (Vercel define VERCEL=1) o "mock" próprio é IGNORADO. Dado
// de demonstração nunca aparece em produção por engano de configuração.
// AGENDAMENTOS_MODE=api força a API real (útil com LEADS_MODE=mock).
// ---------------------------------------------------------------------------

export type ModoAgendamentos = {
  modo: "mock" | "api";
  // true = a tela está em mock por causa da exceção local (o resto do app está
  // na API real). A tela avisa, para ninguém confundir com dado real.
  mockLocal: boolean;
};

export function modoDosAgendamentos(env: {
  LEADS_MODE?: string;
  AGENDAMENTOS_MODE?: string;
  VERCEL?: string;
}): ModoAgendamentos {
  const geral = env.LEADS_MODE === "api" ? "api" : "mock";
  const proprio = (env.AGENDAMENTOS_MODE ?? "").trim().toLowerCase();
  const emDeploy = env.VERCEL === "1";

  if (proprio === "mock" && !emDeploy) return { modo: "mock", mockLocal: geral === "api" };
  if (proprio === "api") return { modo: "api", mockLocal: false };
  return { modo: geral, mockLocal: false };
}
