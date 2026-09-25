const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const REGEX_SVG_RAIZ = /<svg[\s>]/i;

// Filtro CSS calculado (nao chutado) rodando o motor de filtro real do
// canvas contra a cor roxa do site (#7b74a0), buscando os parametros que
// minimizam a distancia RGB. Resultado: rgb(123,117,160) vs alvo
// rgb(123,116,160) - erro de 1 num canal, praticamente identico. So
// funciona bem em icone simples (linha/preto sobre transparente); em
// imagem colorida ou foto o resultado fica esquisito - limitacao
// inerente de recolorir raster via filtro, nao tem como ser exato.
const FILTRO_RECOLORIR_ICONE_RASTER =
  "invert(50%) sepia(29%) saturate(400%) hue-rotate(208deg) brightness(90%) contrast(96%)";

// So cobre os vetores de XSS mais comuns em SVG (script, handlers de
// evento, foreignObject, href com javascript:) - suficiente pra um
// upload feito por admin (ja e um papel de confianca no sistema), nao e
// um sanitizador robusto o bastante pra aceitar SVG de qualquer usuario
// anonimo da internet.
function sanitizarSvg(svgTexto) {
  let svg = svgTexto
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(xlink:href|href)\s*=\s*"\s*javascript:[^"]*"/gi, '$1=""')
    .replace(/(xlink:href|href)\s*=\s*'\s*javascript:[^']*'/gi, "$1=''");

  return svg;
}

// Troca fill/stroke fixos (atributo ou style inline) por "currentColor",
// pra herdar a cor do CSS do elemento pai - e assim que os icones
// desenhados a mao do carrossel ja funcionam. "none" nunca e trocado
// (fill="none" e comum de proposito, pra icone so-contorno).
function recolorirSvg(svgTexto) {
  return svgTexto
    .replace(/(\sfill\s*=\s*)"(?!\s*none\s*")[^"]*"/gi, '$1"currentColor"')
    .replace(/(\sfill\s*=\s*)'(?!\s*none\s*')[^']*'/gi, "$1'currentColor'")
    .replace(/(\sstroke\s*=\s*)"(?!\s*none\s*")[^"]*"/gi, '$1"currentColor"')
    .replace(/(\sstroke\s*=\s*)'(?!\s*none\s*')[^']*'/gi, "$1'currentColor'")
    .replace(/fill\s*:\s*(?!none\b)[^;"']+/gi, "fill:currentColor")
    .replace(/stroke\s*:\s*(?!none\b)[^;"']+/gi, "stroke:currentColor");
}

// Remove width/height fixos da tag <svg> raiz, pra deixar o CSS do site
// (".slide a svg { width:32px; height:32px }") controlar o tamanho -
// mesma regra que ja se aplica aos 9 icones desenhados a mao.
function removerTamanhoFixo(svgTexto) {
  let jaTrocou = false;
  return svgTexto.replace(/<svg([^>]*)>/i, (match, atributos) => {
    if (jaTrocou) return match;
    jaTrocou = true;
    const semTamanho = atributos
      .replace(/\s(width|height)\s*=\s*"[^"]*"/gi, "")
      .replace(/\s(width|height)\s*=\s*'[^']*'/gi, "");
    return `<svg${semTamanho}>`;
  });
}

const UploadService = Object.freeze({
  async enviarArquivo(bufferArquivo, pasta = "primia", resourceType = "auto") {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: pasta, resource_type: resourceType },
        (erro, resultado) => {
          if (erro) return reject(erro);
          resolve(resultado.secure_url);
        }
      );
      stream.end(bufferArquivo);
    });
  },

  async enviarImagem(bufferArquivo, pasta = "primia") {
    return UploadService.enviarArquivo(bufferArquivo, pasta, "image");
  },

  // Diploma e dado sensivel: sobe como "authenticated" (URL publica nao
  // funciona). Guarda so uma referencia curta na coluna; o admin ve por
  // URL assinada (urlDiploma).
  async enviarDiploma(bufferArquivo) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "primia/diplomas", resource_type: "auto", type: "authenticated" },
        (erro, r) => {
          if (erro) return reject(erro);
          resolve(`${r.resource_type}|${r.public_id}|${r.format || ""}`);
        }
      );
      stream.end(bufferArquivo);
    });
  },

  // Best-effort: se falhar, sobra um arquivo orfao no Cloudinary, mas nunca
  // derruba a aprovacao/recusa que ja foi gravada no banco.
  async apagarDiploma(referencia) {
    const [resourceType, publicId] = String(referencia || "").split("|");
    if (!resourceType || !publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: "authenticated" });
    } catch (erro) {
      console.error("Erro ao apagar diploma no Cloudinary:", erro);
    }
  },

  urlDiploma(referencia) {
    const [resourceType, publicId, format] = String(referencia || "").split("|");
    if (!resourceType || !publicId) return null;
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      sign_url: true,
      secure: true,
      ...(format ? { format } : {}),
    });
  },

  ehSvg(mimetype, bufferArquivo) {
    if (mimetype === "image/svg+xml") return true;
    const inicio = bufferArquivo.toString("utf8", 0, 300);
    return REGEX_SVG_RAIZ.test(inicio);
  },

  // Retorna o markup do SVG pronto pra embutir inline (sanitizado,
  // recolorivel via currentColor, sem tamanho fixo), ou null se o
  // arquivo nao parecer um SVG valido.
  processarIconeSvg(bufferArquivo) {
    let svg = bufferArquivo.toString("utf8").trim().replace(/^﻿/, "");

    if (!REGEX_SVG_RAIZ.test(svg)) {
      return null;
    }

    svg = sanitizarSvg(svg);

    if (!REGEX_SVG_RAIZ.test(svg)) {
      return null;
    }

    svg = recolorirSvg(svg);
    svg = removerTamanhoFixo(svg);

    return svg;
  },

  FILTRO_RECOLORIR_ICONE_RASTER,
});

module.exports = UploadService;
