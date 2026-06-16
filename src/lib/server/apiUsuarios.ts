import type { Usuario } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Adapter do GET /api/usuarios REAL → contrato enxuto do app ({ id, nome }).
// A API real responde { id, nome, papel } por usuário, mas o envelope pode
// variar (array na raiz, { usuarios: [...] }, { data: [...] }) e os campos de
// nome podem vir com nomes alternativos. Normalizamos tudo num único ponto,
// tolerante item a item: um usuário fora do formato é logado e descartado,
// NUNCA derruba o diretório inteiro (o front cai no fallback id→id).
// ---------------------------------------------------------------------------

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// O diretório pode chegar como array puro ou embrulhado em chaves comuns.
function extrairLista(corpo: unknown): unknown[] | null {
  if (Array.isArray(corpo)) return corpo;
  if (corpo && typeof corpo === "object") {
    const obj = corpo as Record<string, unknown>;
    for (const chave of ["usuarios", "users", "data", "items"]) {
      if (Array.isArray(obj[chave])) return obj[chave] as unknown[];
    }
  }
  return null;
}

function mapApiUsuario(bruto: unknown): Usuario | null {
  if (!bruto || typeof bruto !== "object") return null;
  const raw = bruto as Record<string, unknown>;
  const id =
    texto(raw.id) ?? texto(raw.user_id) ?? texto(raw.uid) ?? texto(raw.sub);
  if (!id) return null;
  const email = texto(raw.email);
  const nome =
    texto(raw.nome) ??
    texto(raw.name) ??
    texto(raw.full_name) ??
    texto(raw.display_name) ??
    (email ? email.split("@")[0] : null) ??
    id; // sem nome utilizável → o id (mesmo fallback do front)
  return { id, nome };
}

export type AdaptUsuariosResult =
  | { ok: true; items: Usuario[] }
  | { ok: false; motivo: string };

/**
 * Converte o corpo (já parseado em JSON) do GET /api/usuarios real para o
 * contrato do app. Loga no console (server-side) o motivo de descartes.
 */
export function adaptApiUsuarios(corpo: unknown): AdaptUsuariosResult {
  const lista = extrairLista(corpo);
  if (!lista) {
    const motivo =
      "envelope inesperado (esperado array ou { usuarios: [...] })";
    console.error("[/api/usuarios] api 200 fora do contrato:", motivo, "| recebido:", corpo);
    return { ok: false, motivo };
  }

  const items: Usuario[] = [];
  lista.forEach((bruto, idx) => {
    const mapeado = mapApiUsuario(bruto);
    if (!mapeado) {
      console.error(`[/api/usuarios] usuário #${idx} descartado (sem id):`, bruto);
      return;
    }
    items.push(mapeado);
  });

  return { ok: true, items };
}
