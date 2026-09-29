const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const crypto = require("crypto");
const Models = require("../models");


const PLANOS = Object.freeze({
  // TEMPORARIO PRA TESTE: valor real era 1990 (R$ 19,90) - reduzido pra
  // 100 (R$ 1,00) so pra validar o fluxo completo com credenciais de
  // producao de verdade, sem arriscar muito dinheiro.
  mensal: {
   rotulo: "Premium - 30 dias",
   diasPremium: 30,
   valorCentavos: 100,
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

    
    const usaAmbienteDeTeste = process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith("TEST-");
    const urlCheckout = usaAmbienteDeTeste
      ? resultado.sandbox_init_point || resultado.init_point
      : resultado.init_point;

    return { urlCheckout };
  },

  
  async confirmarPagamento(idPagamentoGateway) {
    const detalhe = await new Payment(client()).get({ id: idPagamentoGateway });
    return {
      referenciaExterna: detalhe.external_reference,
      status: detalhe.status, // approved | pending | rejected | cancelled | refunded | in_process
      idTransacaoGateway: String(detalhe.id),
    };
  },


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
