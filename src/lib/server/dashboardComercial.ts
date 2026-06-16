// ---------------------------------------------------------------------------
// Acesso SERVER-SIDE à Dashboard Comercial (api.infradojo.pro) — fonte real de
// VENDAS e atividade de SDR/Closer. A chave NUNCA vai ao navegador; vive só nos
// route handlers. É a MESMA API e credencial do Dashboard SDR, então reusamos
// as envs SDR_DASHBOARD_* (e o mesmo switch de modo) — vendas e produtividade
// vêm da mesma origem.
// ---------------------------------------------------------------------------

export function modoComercial(): "api" | "mock" {
  return process.env.SDR_DASHBOARD_MODE === "api" ? "api" : "mock";
}

export function configComercial(): { base: string; chave: string } | null {
  const base = process.env.SDR_DASHBOARD_API_URL;
  const chave = process.env.SDR_DASHBOARD_API_KEY;
  if (!base || !chave) return null;
  return { base: base.replace(/\/$/, ""), chave };
}

export function headersComercial(chave: string): HeadersInit {
  // A API aceita tanto X-API-Key quanto Authorization: Bearer — mandamos os dois.
  return { "X-API-Key": chave, Authorization: `Bearer ${chave}` };
}

// "YYYY-MM" → janela [1º dia, último dia] no formato YYYY-MM-DD. A API ignora
// `periodo` quando data_inicio/data_fim são informados (regra documentada).
export function janelaDoMes(mes: string): { data_inicio: string; data_fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const ultimo = new Date(ano, m, 0).getDate(); // dia 0 do mês seguinte = último deste
  return {
    data_inicio: `${ano}-${mm}-01`,
    data_fim: `${ano}-${mm}-${String(ultimo).padStart(2, "0")}`,
  };
}

export function mesCorrente(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
