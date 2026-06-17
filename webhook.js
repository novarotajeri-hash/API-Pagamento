// ============================================================
//  Webhook (OPCIONAL) — confirmação automática de pagamento
//  Caminho: /api/webhook
//  Configure essa URL como WEBHOOK_URL no servidor e o Mercado Pago
//  avisa aqui toda vez que um pagamento muda de status.
// ============================================================

export default async function handler(req, res) {
  try {
    const tipo = req.query.type || req.query.topic || (req.body && req.body.type);
    const pagamentoId =
      (req.body && req.body.data && req.body.data.id) ||
      req.query['data.id'] || req.query.id;

    if (tipo === 'payment' && pagamentoId) {
      const r = await fetch('https://api.mercadopago.com/v1/payments/' + pagamentoId, {
        headers: { 'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN },
      });
      const pg = await r.json();

      // pg.status: 'approved' | 'pending' | 'rejected'
      // pg.external_reference: 'passeio-<id>-<timestamp>' (pra cruzar com a reserva)
      console.log('Pagamento', pagamentoId, '->', pg.status, '| ref:', pg.external_reference);

      // TODO (opcional): se pg.status === 'approved', dispare aqui um
      // e-mail/WhatsApp/registro confirmando a reserva.
    }

    // Responda sempre 200 pro Mercado Pago não ficar reenviando.
    return res.status(200).send('ok');
  } catch (e) {
    return res.status(200).send('ok');
  }
}
