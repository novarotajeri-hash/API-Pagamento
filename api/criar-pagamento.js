// ============================================================
//  Passeio em Jeri — Backend Mercado Pago (Plano B) — ATUALIZADO
//  Cria a "preferência" de pagamento com o VALOR EXATO da reserva.
//  Inclui PASSEIOS (1–11) e TRANSFERS (21–24, com dobra ida-e-volta).
//  O Access Token fica SÓ aqui (variável de ambiente), nunca no site.
//  Roda como função serverless (ex.: Vercel) no caminho /api/criar-pagamento
// ============================================================

// Catálogo NO SERVIDOR = fonte da verdade do preço.
// (Nunca confie no preço que o navegador manda — sempre recalcule aqui.)
// Os preços DEVEM espelhar o front (index.html).
const PASSEIOS = {
  // --- Passeios ---
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
  // --- Transfers (preço por TRECHO; ida e volta = 2×) ---
  21: { nome: 'Transfer Aeroporto de Fortaleza ↔ Jeri (Privativo)',     preco: 1500, porPessoa: false, transfer: true },
  22: { nome: 'Transfer Aeroporto de Fortaleza ↔ Jeri (Compartilhado)', preco: 400,  porPessoa: true,  transfer: true },
  23: { nome: 'Transfer Aeroporto de Jericoacoara ↔ Jeri (Privativo)',  preco: 300,  porPessoa: false, transfer: true },
  24: { nome: 'Transfer Aeroporto de Jericoacoara ↔ Jeri (Compartilhado)', preco: 80, porPessoa: true,  transfer: true },
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
    const {
      id, pessoas = 1, cupom = '', nome = '', email = '',
      data = '', telefone = '', pousada = '', horario = '',
      direcao = '', voo = '', horario_chegada = '',
    } = req.body || {};

    const p = PASSEIOS[id];
    if (!p) return res.status(400).json({ erro: 'Passeio inválido' });

    // --- Calcula o total AQUI, no servidor ---
    const qtd = p.porPessoa ? Math.max(1, Math.min(20, parseInt(pessoas) || 1)) : 1;
    let total = p.preco * qtd;

    // Transfer ida e volta = 2× (ANTES do desconto), igual ao front.
    const idaEVolta = p.transfer && String(direcao).trim().toLowerCase() === 'ida e volta';
    if (idaEVolta) total *= 2;

    const desconto = CUPONS[String(cupom).trim().toUpperCase()] || 0;
    if (desconto) total = Math.round(total * (1 - desconto));

    const SITE = process.env.SITE_URL || 'https://misty-meadow-147d.novarotajeri.workers.dev';

    // Título e descrição que aparecem no painel do Mercado Pago.
    let titulo = p.nome + (p.porPessoa ? ` (${qtd} pessoa(s))` : '');
    if (p.transfer && direcao) titulo += ` — ${direcao}`;

    const partesDesc = [];
    if (data) partesDesc.push(`Data: ${data}`);
    if (horario) partesDesc.push(`Horário: ${horario}`);
    if (p.transfer && voo) partesDesc.push(`Voo: ${voo}`);
    if (p.transfer && horario_chegada) partesDesc.push(`Chegada: ${horario_chegada}`);
    if (pousada) partesDesc.push(`Pousada: ${pousada}`);
    if (nome) partesDesc.push(`Cliente: ${nome}`);
    if (telefone) partesDesc.push(`Tel: ${telefone}`);
    const descricao = partesDesc.join(' | ').slice(0, 240);

    const preferencia = {
      items: [{
        title: titulo,
        description: descricao || undefined,
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
      external_reference: `${p.transfer ? 'transfer' : 'passeio'}-${id}-${Date.now()}`,
      // Tudo isto aparece no painel do Mercado Pago (metadata da preferência):
      metadata: {
        produto_id: id,
        produto_nome: p.nome,
        pessoas: qtd,
        direcao: p.transfer ? direcao : undefined,
        voo: p.transfer ? voo : undefined,
        horario_chegada: p.transfer ? horario_chegada : undefined,
        data,
        horario,
        pousada,
        nome,
        email,
        telefone,
        cupom: cupom || undefined,
        total,
      },
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
    const dataResp = await resp.json();
    if (!resp.ok) return res.status(502).json({ erro: 'Erro no Mercado Pago', detalhe: dataResp });

    // init_point = link de produção | sandbox_init_point = link de teste
    return res.status(200).json({
      url: dataResp.init_point,
      sandbox: dataResp.sandbox_init_point,
      total,
    });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha interna', detalhe: String(e) });
  }
}
