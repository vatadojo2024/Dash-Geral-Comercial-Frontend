"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import type { Role } from "@/lib/api/contracts";
import { useSession } from "@/features/session/SessionProvider";
import { ChatConversa } from "./ChatConversa";

const EH_DEV = process.env.NODE_ENV !== "production";

const PAPEIS: { valor: Role; label: string }[] = [
  { valor: "admin", label: "Admin (Vata/Cindy)" },
  { valor: "closer", label: "Closer" },
  { valor: "sdr", label: "SDR" },
];

// Seletor de papel — APENAS em desenvolvimento (RF-09/T-10). Em produção este
// bloco não é renderizado e o papel vem só da sessão.
function SeletorPapelDev({
  papel,
  onChange,
}: {
  papel: Role;
  onChange: (p: Role) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-dashed border-borda bg-painel-claro px-3 py-1.5 text-xs text-texto-sec">
      <FlaskConical className="h-3.5 w-3.5 text-laranja" aria-hidden />
      <span>Pré-visualizar papel (dev):</span>
      <select
        aria-label="Papel exibido (apenas desenvolvimento)"
        value={papel}
        onChange={(e) => onChange(e.target.value as Role)}
        className="rounded-md border border-borda bg-painel px-2 py-1 text-texto"
      >
        {PAPEIS.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ChatView() {
  // Papel real do usuário — MESMA fonte que o painel já usa (useSession).
  const { role } = useSession();
  // Em dev, o seletor pode sobrepor o papel exibido sem tocar na sessão.
  const [papelExibido, setPapelExibido] = useState<Role>(role);
  const papel = EH_DEV ? papelExibido : role;

  return (
    <div className="space-y-3">
      {EH_DEV && (
        <SeletorPapelDev papel={papelExibido} onChange={setPapelExibido} />
      )}
      {/* key={papel}: trocar de agente recomeça a conversa do zero. */}
      <ChatConversa key={papel} papel={papel} />
    </div>
  );
}
