// Passeio em Jeri - Backend Mercado Pago - Checkout/Cartao
// Cria a preferencia de pagamento com o VALOR EXATO. Valida cupom no servidor.
// Caminho: /api/criar-pagamento

const PASSEIOS = {
  1:  { nome: 'Leste Compartilhado (Jardineira)', preco: 89,  porPessoa: true  },
  2:  { nome: 'Leste de Buggy',                    preco: 499, porPessoa: false },
  3:  { nome: 'Leste de Quadriciclo',              preco: 499, porPessoa: false },
  4:  { nome: 'Oeste Compartilhado (Jardineira)',  preco: 89,  porPessoa: true  },
  5:  { nome: 'Oeste de Buggy',                    preco: 499, porPessoa: false },
  6:  { nome: 'Oeste de Quadriciclo',              preco: 499, porPessoa: false },
  7:  { nome: 'Por do Sol de Buggy',               preco: 220, porPessoa: false },
  8:  { nome: 'Por do Sol de Quadriciclo',         preco: 220, porPessoa: false },
  9:  { nome: 'Privativo Oeste',                   preco: 599, porPessoa: false },
  10: { nome: 'Privativo Leste',                   preco: 599, porPessoa: false },
  11: { nome: 'Extremo Leste',                     preco: 599, porPessoa: false },
  12: { nome: 'Guia Motorista no Seu Carro (Estacionamento incluso)', preco: 150, porPessoa: false },
  13: { nome: 'Estacione em Jijoca + Transfer para Jeri',             preco: 60,  porPessoa: true  },
  14: { nome: 'Transpasseio (Buggy ou Jardineira privativo)',         preco: 599, porPessoa: false },
  21: { nome: 'Transfer Fortaleza - Jeri (Privativo)',        preco: 1499, porPessoa: false, transfer: true },
  22: { nome: 'Transfer Fortaleza - Jeri (Compartilhado)',    preco: 449,  porPessoa: true,  transfer: true },
  23: { nome: 'Transfer Jericoacoara - Jeri (Privativo)',     preco: 349,  porPessoa: false, transfer: true },
  24: { nome: 'Transfer Jericoacoara - Jeri (Compartilhado)', preco: 89,   porPessoa: true,  transfer: true },
};

const PARCEIROS = {
  'PARCEIRO10': { desconto: 0.10, parceiro: 'Parceiro Exemplo', email: '' },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(function (e) { res.setHeader(e[0], e[1]); });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });

  try {
    const b = req.body || {};
    const id = b.id, pessoas = b.pessoas || 1, cupom = b.cupom || '';
    const nome = b.nome || '', email = b.email || '';
    const data = b.data || '', telefone = b.telefone || '', pousada = b.pousada || '', horario = b.horario || '';
    const direcao = b.direcao || '', voo = b.voo || '', horario_chegada = b.horario_chegada || '';

    const p = PASSEIOS[id];
    if (!p) return res.status(400).json({ erro: 'Passeio invalido' });

    const qtd = p.porPessoa ? Math.max(1, Math.min(20, parseInt(pessoas) || 1)) : 1;
    let total = p.preco * qtd;
    if (p.transfer && String(direcao).trim().toLowerCase() === 'ida e volta') total *= 2;

    const info = PARCEIROS[String(cupom).trim().toUpperCase()];
    if (info && info.desconto) total = Math.round(total * (1 - info.desconto));
    const comissao = info ? Math.round(total * 0.10) : 0;

    const SITE = process.env.SITE_URL || 'https://passeioemjeri.com.br';

    let titulo = p.nome + (p.porPessoa ? ' (' + qtd + ' pessoa(s))' : '');
    if (p.transfer && direcao) titulo += ' - ' + direcao;

    const desc = [];
    if (data) desc.push('Data: ' + data);
    if (horario) desc.push('Horario: ' + horario);
    if (p.transfer && voo) desc.push('Voo: ' + voo);
    if (p.transfer && horario_chegada) desc.push('Chegada: ' + horario_chegada);
    if (pousada) desc.push('Pousada: ' + pousada);
    if (nome) desc.push('Cliente: ' + nome);
    if (telefone) desc.push('Tel: ' + telefone);

    const preferencia = {
      items: [{ title: titulo, description: desc.join(' | ').slice(0, 240) || undefined, quantity: 1, unit_price: total, currency_id: 'BRL' }],
      payer: { name: nome, email: email },
      back_urls: { success: SITE + '/?pago=sucesso', pending: SITE + '/?pago=pendente', failure: SITE + '/?pago=falha' },
      auto_return: 'approved',
      external_reference: (p.transfer ? 'transfer' : 'passeio') + '-' + id + '-' + Date.now(),
      metadata: {
        produto_id: id, produto_nome: p.nome, pessoas: qtd,
        direcao: p.transfer ? direcao : undefined,
        voo: p.transfer ? voo : undefined,
        horario_chegada: p.transfer ? horario_chegada : undefined,
        data: data, horario: horario, pousada: pousada, nome: nome, email: email, telefone: telefone,
        cupom: cupom || undefined,
        parceiro: info ? info.parceiro : undefined,
        parceiro_email: info ? (info.email || undefined) : undefined,
        comissao: comissao || undefined, total: total,
      },
      notification_url: process.env.WEBHOOK_URL || undefined,
    };

    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN },
      body: JSON.stringify(preferencia),
    });
    const dr = await resp.json();
    if (!resp.ok) return res.status(502).json({ erro: 'Erro no Mercado Pago', detalhe: dr });

    return res.status(200).json({ url: dr.init_point, sandbox: dr.sandbox_init_point, total: total });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha interna', detalhe: String(e) });
  }
}
