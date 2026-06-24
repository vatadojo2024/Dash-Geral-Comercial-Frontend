"use client";

import { useEffect, useState } from "react";
import { obterTokenSessao } from "./chatClient";

// Checagem de sessão (T-08 do chat / RF-07 do playbook): a aba só chama o serviço
// com token válido. Compartilhada por Chat e Playbook (mesmo serviço/token).
export type EstadoSessao = "verificando" | "ok" | "sem";

export function useSessaoChat(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>("verificando");
  useEffect(() => {
    let ativo = true;
    obterTokenSessao().then((t) => ativo && setEstado(t ? "ok" : "sem"));
    return () => {
      ativo = false;
    };
  }, []);
  return estado;
}
