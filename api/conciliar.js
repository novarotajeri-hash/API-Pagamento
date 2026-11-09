// ============================================================
//  Conciliação diária — rede de segurança
//  Caminho: /api/conciliar   (a Vercel chama sozinha 1x por dia; ver vercel.json)
//  Busca no Mercado Pago os pagamentos APROVADOS dos últimos 3 dias
//  feitos pelo site e envia os e-mails que ainda não saíram
//  (nunca duplica: confere antes). Assim nenhuma venda fica sem aviso.
// ============================================================
import { processarPagamento } from './_notificar.js';

export default async function handler(req, res) {
  try {
    // Se existir CRON_SECRET na Vercel, só aceita a chamada autorizada.
    const segredo = process.env.CRON_SECRET;
    if (segredo && req.headers['authorization'] !== 'Bearer ' + segredo) {
      return res.status(401).json({ erro: 'não autorizado' });
    }
    const fim = new Date();
    const ini = new Date(Date.now() - 3 * 86400000);
    const url = 'https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50' +
      '&status=approved&range=date_created&begin_date=' + encodeURIComponent(ini.toISOString()) +
      '&end_date=' + encodeURIComponent(fim.toISOString());
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN } });
    const d = await r.json();
    if (!r.ok) {
      console.log('Conciliação: erro no Mercado Pago', r.status);
      return res.status(502).json({ erro: 'Erro no Mercado Pago' });
    }
    const lista = (d.results || []).filter(p => /^(passeio|transfer)-/.test(String(p.external_reference || '')));
    let enviados = 0;
    for (const p of lista) {
      const rr = await processarPagamento(String(p.id), { origem: 'conciliacao', soAprovado: true });
      if (rr.enviados && rr.enviados.length) enviados++;
    }
    console.log('Conciliação:', lista.length, 'vendas verificadas,', enviados, 'com e-mail reenviado');
    return res.status(200).json({ verificadas: lista.length, reenviadas: enviados });
  } catch (e) {
    console.log('Erro na conciliação:', String(e));
    return res.status(500).json({ erro: 'falha interna' });
  }
}
