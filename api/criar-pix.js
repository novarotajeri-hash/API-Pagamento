// ============================================================
//  Passeio em Jeri — Backend Mercado Pago
//  Cria um pagamento PIX (Checkout Transparente) com o VALOR EXATO.
//  Retorna QR Code + copia-e-cola. A confirmação é automática:
//  o Mercado Pago avisa o /api/webhook quando o pagamento é aprovado.
//  Caminho: /api/criar-pix
// ============================================================

// Catálogo NO SERVIDOR = fonte da verdade do preço.
// DEVE espelhar o catálogo do /api/criar-pagamento e do site.
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
  21: { nome: 'Transfer Aeroporto de Fortaleza ↔ Jeri (Privativo)',        preco: 1500, porPessoa: false, transfer: true },
  22: { nome: 'Transfer Aeroporto de Fortaleza ↔ Jeri (Compartilhado)',    preco: 400,  porPessoa: true,  transfer: true },
  23: { nome: 'Transfer Aeroporto de Jericoacoara ↔ Jeri (Privativo)',     preco: 300,  porPessoa: false, transfer: true },
  24: { nome: 'Transfer Aeroporto de Jericoacoara ↔ Jeri (Compartilhado)', preco: 80,   porPessoa: true,  transfer: true },
};

// Parceiros / cupons — FONTE DA VERDADE do dinheiro.
// O MESMO código precisa existir no site (array `cupons`).
// desconto = fração (0.10 = 10% off ao cliente). O parceiro é comissionado.
const PARCEIROS = {
  'PARCEIRO10': { desconto: 0.10, parceiro: 'Parceiro Exemplo', email: '' },
  // Adicione novos parceiros aqui. O `email` é para onde vai o aviso de comissão. Ex.:
  // 'MARIA': { desconto: 0.10, parceiro: 'Maria Silva (@perfil)', email: 'maria@email.com' },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function soDigitos(s) {
  return String(s || '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const {
      id, pessoas = 1, cupom = '', nome = '', email = '', cpf = '',
      data = '', telefone = '', pousada = '', direcao = '',
    } = req.body || {};

    const p = PASSEIOS[id];
    if (!p) return res.status(400).json({ erro: 'Passeio inválido' });

    const cpfNum = soDigitos(cpf);
    if (cpfNum.length !== 11) return res.status(400).json({ erro: 'CPF inválido' });
    if (!email) return res.status(400).json({ erro: 'E-mail obrigatório' });

    // --- Calcula o total AQUI, no servidor ---
    const qtd = p.porPessoa ? Math.max(1, Math.min(20, parseInt(pessoas) || 1)) : 1;
    let total = p.preco * qtd;

    const idaEVolta = p.transfer && String(direcao).trim().toLowerCase() === 'ida e volta';
    if (idaEVolta) total *= 2;

    const info = PARCEIROS[String(cupom).trim().toUpperCase()];
    const desconto = info ? info.desconto : 0;
    if (desconto) total = Math.round(total * (1 - desconto));
    const comissao = info ? Math.round(total * 0.10) : 0; // 10% sobre o total já com desconto

    // Nome do pagador (o MP exige first/last name no PIX)
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    const firstName = partes[0] || 'Cliente';
    const lastName = partes.slice(1).join(' ') || '.';

    let titulo = p.nome + (p.porPessoa ? ` (${qtd} pessoa(s))` : '');
    if (p.transfer && direcao) titulo += ` — ${direcao}`;

    const externalRef = `${p.transfer ? 'transfer' : 'passeio'}-${id}-${Date.now()}`;

    const pagamento = {
      transaction_amount: Number(total),
      description: titulo,
      payment_method_id: 'pix',
      payer: {
        email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: 'CPF', number: cpfNum },
      },
      external_reference: externalRef,
      notification_url: process.env.WEBHOOK_URL || undefined,
      // Tudo isto aparece no painel do MP e alimenta o e-mail de confirmação:
      metadata: {
        produto_id: id,
        produto_nome: p.nome,
        pessoas: qtd,
        direcao: p.transfer ? direcao : undefined,
        data,
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
    if (!tx || !tx.qr_code) return res.status(502).json({ erro: 'PIX não gerado', detalhe: d });

    return res.status(200).json({
      payment_id: d.id,
      status: d.status,
      total,
      copia_cola: tx.qr_code,        // texto do "copia-e-cola"
      qr_base64: tx.qr_code_base64,  // imagem PNG do QR em base64
      ticket_url: tx.ticket_url,     // link do comprovante/pagamento
    });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha interna', detalhe: String(e) });
  }
}
