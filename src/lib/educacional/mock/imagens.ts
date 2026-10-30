import { LIMITE_IMAGEM_MURAL, TIPOS_IMAGEM_MURAL } from "../contrato";

// ---------------------------------------------------------------------------
// Imagem do mural no modo demonstração (Entrega 2, M2): vira um data URL para
// caber no banco do navegador. No navegador, reduz para até 1280 px (WEBP);
// GIF fica como veio (animação). No modo api a imagem vai inteira para o backend.
// ---------------------------------------------------------------------------

const LADO_MAXIMO = 1280;

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function imagemParaDemonstracao(f: File): Promise<string> {
  // Fora do permitido o servidor do mock recusa: não vale a pena converter.
  if (!(TIPOS_IMAGEM_MURAL as readonly string[]).includes(f.type) || f.size > LIMITE_IMAGEM_MURAL) return "";
  if (f.type !== "image/gif" && typeof createImageBitmap === "function" && typeof document !== "undefined") {
    try {
      const bmp = await createImageBitmap(f);
      const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * escala));
      c.height = Math.max(1, Math.round(bmp.height * escala));
      c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      return c.toDataURL("image/webp", 0.85);
    } catch {
      // Sem decodificar: guarda como veio.
    }
  }
  return `data:${f.type};base64,${base64(new Uint8Array(await f.arrayBuffer()))}`;
}
