// ============================================================
//  Passeio em Jeri — Consulta de status de pagamento
//  O site chama este endpoint de tempos em tempos para saber
//  se o PIX já foi pago (sem depender só do webhook/e-mail).
//  Caminho: /api/status-pagamento?id=<payment_id>
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ erro: 'id ausente' });

    const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(id), {
      headers: { 'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN },
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ erro: 'Erro no Mercado Pago', detalhe: d });

    // status: 'pending' | 'approved' | 'rejected' | 'cancelled' | ...
    return res.status(200).json({
      status: d.status,
      status_detail: d.status_detail,
      total: d.transaction_amount,
    });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha interna', detalhe: String(e) });
  }
}
