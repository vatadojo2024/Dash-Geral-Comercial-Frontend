"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CHAVE_MODULO_LEMBRADO } from "@/lib/auth/areas";

// Entrada pela home de quem tem os dois módulos: vai para o último escolhido
// no seletor (localStorage, que pode faltar ou falhar — aí, comercial).
export function EntradaLembrada({ comercial, educacional }: { comercial: string; educacional: string }) {
  const router = useRouter();
  useEffect(() => {
    let lembrado: string | null = null;
    try {
      lembrado = window.localStorage.getItem(CHAVE_MODULO_LEMBRADO);
    } catch {
      lembrado = null;
    }
    router.replace(lembrado === "educacional" ? educacional : comercial);
  }, [router, comercial, educacional]);
  return null;
}
