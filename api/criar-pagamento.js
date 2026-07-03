// ============================================================
//  Passeio em Jeri — Backend Mercado Pago (Checkout / Cartão) — ATUALIZADO
//  Cria a "preferência" de pagamento com o VALOR EXATO da reserva.
//  Inclui PASSEIOS (1–11) e TRANSFERS (21–24, com dobra ida-e-volta).
//  Agora VALIDA CUPOM DE PARCEIRO no servidor (desconto + comissão).
//  O Access Token fica SÓ aqui (variável de ambiente), nunca no site.
//  Caminho: /api/criar-pagamento
// ============================================================

const PASSEIOS = {
  // --- Passeios ---
  1:  { nome: 'Leste Compartilhado (Jardineira)', preco: 89,  porPessoa: true  },
  2:  { nome: 'Leste de Buggy',                    preco: 499, porPessoa: false },
  3:  { nome: 'Leste de Quadriciclo',              preco: 499, porPessoa: false },
  4:  { nome: 'Oeste Compartilhado (Jardineira)',  preco: 89,  porPessoa: true  },
  5:  { nome: 'Oeste de Buggy',                    preco: 499, porPessoa: false },
  6:  { nome: 'Oeste de Quadriciclo',              preco: 499, porPessoa: false },
  7:  { nome: 'Pôr do Sol de Buggy',               preco: 220, porPessoa: false },
  8:  { nome: 'Pôr do Sol de Quadriciclo',         preco: 220, porPessoa: false },
  9:  { nome: 'Privativo Oeste',                   preco: 599, porPessoa: false },
  10: { nome: 'Privativo Leste',                   preco: 599, porPessoa: false },
  11: { nome: 'Extremo Leste',                     preco: 599, porPessoa: false },
  // --- Transfers (preço por TRECHO; ida e volta = 2×) ---
  21: { nome: 'Transfer Aeroporto de Fortaleza ↔ Jeri (Privativo)',        preco: 1499, porPessoa: false, transfer: true },
  22: { nome: 'Transfer Aeroporto de Fortaleza ↔ Jeri (Compartilhado)',    preco: 449,  porPessoa: true,  transfer: true },
  23: { nome: 'Transfer Aeroporto de Jericoacoara ↔ Jeri (Privativo)',     preco: 349,  porPessoa: false, transfer: true },
  24: { nome: 'Transfer Aeroporto de Jericoacoara ↔ Jeri (Compartilhado)', preco: 89,   porPessoa: true,  transfer: true },
};

// Parceiros / cupons — FONTE DA VERDADE do dinheiro.
// O MESMO código precisa existir no site (array `cupons`) e no criar-pix.js.
// desconto = fração (0.10 = 10% off ao cliente). O parceiro é comissionado.
const PARCEIROS = {
  'PARCEIRO10': { desconto: 0.10, parceiro: 'Parceiro Exemplo', email: '' },
  // Adicione novos parceiros aqui. O `email` é para onde vai o aviso de comissão. Ex.:
  // 'MARIA': { desconto: 0.10, parceiro: 'Maria Silva (@perfil)', email: 'maria@email.com' },
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

    // Cupom de parceiro (validado no servidor)
    const info = PARCEIROS[String(cupom).trim().toUpperCase()];
    const desconto = info ? info.desconto : 0;
    if (desconto) total = Math.round(total * (1 - desconto));
    const comissao = info ? Math.round(total * 0.10) : 0; // 10% sobre o total já com desconto

    const SITE = process.env.SITE_URL || 'https://passeioemjeri.com.br';

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
        parceiro: info ? info.parceiro : undefined, // só para o seu controle (não vai para o cliente)
        parceiro_email: info ? (info.email || undefined) : undefined,
        comissao: comissao || undefined,
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
      sandb