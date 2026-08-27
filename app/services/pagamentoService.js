const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const crypto = require("crypto");
const Models = require("../models");

// Planos hardcoded por enquanto (mesmo espirito de DIFICULDADES_VALIDAS
// em iaService.js) - se precisar virar editavel pelo admin depois, da
// pra migrar pra Configuracao_Plataforma, que ja existe.
const PLANOS = Object.freeze({
  mensal: { 
   rotulo: "Premium - 30 dias", 
   diasPremium: 30, 
   valorCentavos: 1990 ,
},
  
  trimestral: {
    rotulo: "Premium - 3 meses",
    diasPremium: 90,
    valorCentavos: 4990,
  },

  semestral: {
    rotulo: "Premium - 6 meses",
    diasPremium: 180,
    valorCentavos: 8990,
  },

  anual: {
    rotulo: "Premium - 1 ano",
    diasPremium: 365,
    valorCentavos: 14990,
  },
});


function client() {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("Pagamento nao configurado (MERCADOPAGO_ACCESS_TOKEN ausente).");
  }
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
}

const PagamentoService = Object.freeze({
  listarPlanos() {
    return Object.entries(PLANOS).map(([slug, plano]) => ({ slug, ...plano }));
  },

  async criarCheckout({ idUsuario, planoSlug, urlBase }) {
    const plano = PLANOS[planoSlug];
    if (!plano) {
      throw new Error("Plano invalido.");
    }

    const referenciaExterna = crypto.randomUUID();

    // A preferencia e criada no Mercado Pago ANTES de gravar qualquer
    // coisa no banco - se der erro aqui (chave ausente, API fora, plano
    // invalido, etc.) nao sobra um registro "pendente" orfao, que nunca
    // seria resolvido (nao existe cobranca nenhuma do lado do Mercado
    // Pago pra um webhook confirmar depois).
    const preference = new Preference(client());
    const resultado = await preference.create({
      body: {
        items: [
          {
            title: plano.rotulo,
            quantity: 1,
            unit_price: plano.valorCentavos / 100,
            currency_id: "BRL",
          },
        ],
        external_reference: referenciaExterna,
        back_urls: {
          success: `${urlBase}/premium/retorno?status=approved`,
          failure: `${urlBase}/premium/retorno?status=failure`,
          pending: `${urlBase}/premium/retorno?status=pending`,
        },
        notification_url: `${urlBase}/webhooks/mercadopago`,
        auto_return: "approved",
      },
    });

    await Models.pagamentos.criar({
      idUsuario,
      referenciaExterna,
      valorCentavos: plano.valorCentavos,
      diasPremium: plano.diasPremium,
    });

    return { urlCheckout: resultado.sandbox_init_point || resultado.init_point };
  },

  // Nunca confia no corpo do webhook sozinho - sempre rebusca o
  // pagamento de verdade na API do Mercado Pago antes de conceder
  // premium (pratica recomendada pelo proprio Mercado Pago).
  async confirmarPagamento(idPagamentoGateway) {
    const detalhe = await new Payment(client()).get({ id: idPagamentoGateway });
    return {
      referenciaExterna: detalhe.external_reference,
      status: detalhe.status, // approved | pending | rejected | cancelled | refunded | in_process
      idTransacaoGateway: String(detalhe.id),
    };
  },

  // Formato do header x-signature: "ts=...,v1=...". O manifest e
  // reconstruido e comparado via HMAC-SHA256 com o segredo configurado
  // no dashboard do Mercado Pago - impede que qualquer um poste no
  // endpoint do webhook fingindo ser o Mercado Pago.
  validarAssinaturaWebhook({ xSignature, xRequestId, dataId }) {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret || !xSignature) {
      return false;
    }

    const partes = Object.fromEntries(
      xSignature.split(",").map((parte) => parte.trim().split("="))
    );

    if (!partes.ts || !partes.v1) {
      return false;
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${partes.ts};`;
    const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    return hmac === partes.v1;
  },
});

module.exports = PagamentoService;
