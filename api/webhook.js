// ============================================================
//  Webhook (Mercado Pago) — aviso imediato de pagamento
//  Caminho: /api/webhook
//  A lógica dos e-mails (cliente, parceiro e equipe) fica em
//  api/_notificar.js, compartilhada com /api/confirmar-reserva
//  e /api/conciliar.
// ============================================================
import { processarPagamento } from './_notificar.js';

export default async function handler(req, res) {
  try {
    const tipo = req.query.type || req.query.topic || (req.body && req.body.type);
    const pagamentoId =
      (req.body && req.body.data && req.body.data.id) ||
      req.query['data.id'] || req.query.id;

    console.log('Webhook recebido:', tipo || '(sem tipo)', pagamentoId || '(sem id)');
    if (tipo === 'payment' && pagamentoId) {
      await processarPagamento(String(pagamentoId), { origem: 'webhook' });
    }
    // Responda sempre 200 pro Mercado Pago não reenviar.
    return res.status(200).send('ok');
  } catch (e) {
    console.log('Erro no webhook:', String(e));
    return res.status(200).send('ok');
  }
}
