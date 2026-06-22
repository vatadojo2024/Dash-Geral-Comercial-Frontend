import { describe, expect, it } from "vitest";
import { brParaQuebras } from "./texto";

describe("brParaQuebras", () => {
  it("converte <br/>, <br> e <br /> em quebra de linha real", () => {
    expect(brParaQuebras("Resumo:<br/>linha 2<br>linha 3<br />fim")).toBe(
      "Resumo:\nlinha 2\nlinha 3\nfim",
    );
  });

  it("é tolerante a caixa (BR/Br) e espaços internos", () => {
    expect(brParaQuebras("a<BR>b<Br  />c")).toBe("a\nb\nc");
  });

  it("não injeta HTML: outras tags ficam como texto literal (escapado pelo React)", () => {
    // Só os <br> são trocados; <b>/<script> seguem como texto cru, sem virar HTML.
    expect(brParaQuebras("<b>negrito</b><br><script>x</script>")).toBe(
      "<b>negrito</b>\n<script>x</script>",
    );
  });

  it("texto sem <br> passa intacto", () => {
    expect(brParaQuebras("sem quebras")).toBe("sem quebras");
  });
});
