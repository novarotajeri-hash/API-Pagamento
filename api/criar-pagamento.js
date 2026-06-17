// ============================================================
//  Passeio em Jeri — Backend Mercado Pago (Plano B)
//  Cria a "preferência" de pagamento com o VALOR EXATO da reserva.
//  O Access Token fica SÓ aqui (variável de ambiente), nunca no site.
//  Roda como função serverless (ex.: Vercel) no caminho /api/criar-pagamento
// ============================================================

// Catálogo NO SERVIDOR = fonte da verdade do preço.
// (Nunca confie no preço que o navegador manda — sempre recalcule aqui.)
const PASSEIOS = {
  1:  { nome: 'Leste Compartilhado (Jardineira)', preco: 80,  porPessoa: true  },
  2:  { nome: 'Leste de Buggy',                    preco: 450, porPessoa: false },
  3:  { nome: 'Leste de Quadriciclo',              preco: 450, porPessoa: false },
  4:  { nome: 'Oeste Compartilhado (Jardineira)',  preco: 80,  porPessoa: true  },
  5:  { nome: 'Oeste de Buggy',                    preco: 450, porPessoa: false },
  6:  { nome: 'Oeste de Quadriciclo',              preco: 450, porPessoa: false },
  7:  { nome: 'Pôr do Sol de Buggy',               preco: 200, porPessoa: false },
  8:  { nome: 'Pôr do Sol de Quadriciclo',         preco: 200, porPessoa: false },
  9:  { nome: 'Privativo Oeste',                   preco: 600, porPessoa: false },
  10: { nome: 'Privativo Leste',                   preco: 600, porPessoa: false },
  11: { nome: 'Extremo Leste',                     preco: 590, porPessoa: false },
};

// Cupons válidos (desconto em fração). Sincronize com os cupons dos parceiros.
const CUPONS = {
  // 'CODIGODOPARCEIRO': 0.10,
};

const CORS = {
  // Em produção, troque '*' pelo seu domínio: 'https://passeioemjeri.com.br'
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const { id, pessoas = 1, cupom = '', nome = '', email = '' } = req.body || {};
    const p = PASSEIOS[id];
    if (!p) return res.status(400).json({ erro: 'Passeio inválido' });

    // --- Calcula o total AQUI, no servidor ---
    const qtd = p.porPessoa ? Math.max(1, Math.min(11, parseInt(pessoas) || 1)) : 1;
    let total = p.preco * qtd;
    const desconto = CUPONS[String(cupom).trim().toUpperCase()] || 0;
    if (desconto) total = Math.round(total * (1 - desconto));

    const SITE = process.env.SITE_URL || 'https://passeioemjeri.com.br';

    const preferencia = {
      items: [{
        title: p.nome + (p.porPessoa ? ` (${qtd} pessoa(s))` : ''),
        quantity: 1,
        unit_price: total,
        currency_id: 'BRL',
      }],
      payer: { name: nome, email },
      back_urls: {
        success: SITE + '/?pago=sucesso',
        pending: SITE + '/?pago=pendente',
        failure: SITE + '/?pago=falha',
      },
      auto_return: 'approved',
      external_reference: `passeio-${id}-${Date.now()}`,
      // Webhook opcional para confirmação automática (veja webhook.js):
      notification_url: process.env.WEBHOOK_URL || undefined,
    };

    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN,
      },
      body: JSON.stringify(preferencia),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ erro: 'Erro no Mercado Pago', detalhe: data });

    // init_point = link de produção | sandbox_init_point = link de teste
    return res.status(200).json({
      url: data.init_point,
      sandbox: data.sandbox_init_point,
      total,
    });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha interna', detalhe: String(e) });
  }
}
