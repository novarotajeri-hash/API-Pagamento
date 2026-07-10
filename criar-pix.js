// Passeio em Jeri - Backend Mercado Pago - PIX (Checkout Transparente)
// Cria pagamento PIX com o VALOR EXATO e retorna QR Code + copia-e-cola.
// Confirmacao automatica via /api/webhook. Caminho: /api/criar-pix

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

function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }

export default async function handler(req, res) {
  Object.entries(CORS).forEach(function (e) { res.setHeader(e[0], e[1]); });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });

  try {
    const b = req.body || {};
    const id = b.id, pessoas = b.pessoas || 1, cupom = b.cupom || '';
    const nome = b.nome || '', email = b.email || '', cpf = b.cpf || '';
    const data = b.data || '', telefone = b.telefone || '', pousada = b.pousada || '', direcao = b.direcao || '';

    const p = PASSEIOS[id];
    if (!p) return res.status(400).json({ erro: 'Passeio invalido' });

    const cpfNum = soDigitos(cpf);
    if (cpfNum.length !== 11) return res.status(400).json({ erro: 'CPF invalido' });
    if (!email) return res.status(400).json({ erro: 'E-mail obrigatorio' });

    const qtd = p.porPessoa ? Math.max(1, Math.min(20, parseInt(pessoas) || 1)) : 1;
    let total = p.preco * qtd;
    if (p.transfer && String(direcao).trim().toLowerCase() === 'ida e volta') total *= 2;

    const info = PARCEIROS[String(cupom).trim().toUpperCase()];
    if (info && info.desconto) total = Math.round(total * (1 - info.desconto));
    const comissao = info ? Math.round(total * 0.10) : 0;

    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    const firstName = partes[0] || 'Cliente';
    const lastName = partes.slice(1).join(' ') || '.';

    let titulo = p.nome + (p.porPessoa ? ' (' + qtd + ' pessoa(s))' : '');
    if (p.transfer && direcao) titulo += ' - ' + direcao;
    const externalRef = (p.transfer ? 'transfer' : 'passeio') + '-' + id + '-' + Date.now();

    const pagamento = {
      transaction_amount: Number(total),
      description: titulo,
      payment_method_id: 'pix',
      payer: { email: email, first_name: firstName, last_name: lastName, identification: { type: 'CPF', number: cpfNum } },
      external_reference: externalRef,
      notification_url: process.env.WEBHOOK_URL || undefined,
      metadata: {
        produto_id: id, produto_nome: p.nome, pessoas: qtd,
        direcao: p.transfer ? direcao : undefined,
        data: data, pousada: pousada, nome: nome, email: email, telefone: telefone,
        cupom: cupom || undefined,
        parceiro: info ? info.parceiro : undefined,
        parceiro_email: info ? (info.email || undefined) : undefined,
        comissao: comissao || undefined, total: total,
      },
    };

    const resp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN,
        'X-Idempotency-Key': externalRef + '-' + total,
      },
      body: JSON.stringify(pagamento),
    });
    const d = await resp.json();
    if (!resp.ok) return res.status(502).json({ erro: 'Erro no Mercado Pago', detalhe: d });

    const tx = d.point_of_interaction && d.point_of_interaction.transaction_data;
    if (!tx || !tx.qr_code) return res.status(502).json({ erro: 'PIX nao gerado', detalhe: d });

    return res.status(200).json({
      payment_id: d.id, status: d.status, total: total,
      copia_cola: tx.qr_code, qr_base64: tx.qr_code_base64, ticket_url: tx.ticket_url,
    });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha interna', detalhe: String(e) });
  }
}
