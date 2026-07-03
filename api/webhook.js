// ============================================================
//  Webhook (Mercado Pago) — confirmação automática de pagamento
//  Caminho: /api/webhook
//  No pagamento APROVADO:
//    1) envia e-mail de confirmação ao CLIENTE (via Brevo);
//    2) se a venda tem cupom de parceiro, envia e-mail ao PARCEIRO
//       avisando a comissão daquela venda.
//  (WhatsApp automático entra aqui depois, quando o template estiver aprovado.)
//
//  Variáveis de ambiente necessárias (na Vercel):
//   - MP_ACCESS_TOKEN  (já existe)
//   - BREVO_API_KEY    (chave da Brevo)
//   - EMAIL_FROM       (e-mail remetente VERIFICADO na Brevo, ex.: novarotajeri@gmail.com)
//   - EMAIL_FROM_NAME  (opcional, ex.: "Passeio em Jeri")
//   - SUPORTE_WHATSAPP (opcional, só dígitos, ex.: 5588988526911)
// ============================================================

function brl(v) {
  const n = Number(v) || 0;
  return 'R$ ' + n.toLocaleString('pt-BR');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Envia um e-mail pela Brevo. Retorna o status HTTP (ou 0 se não enviou).
async function enviarEmail({ toEmail, toName, subject, html }) {
  if (!process.env.BREVO_API_KEY || !toEmail) return 0;
  const payload = {
    sender: { name: process.env.EMAIL_FROM_NAME || 'Passeio em Jeri', email: process.env.EMAIL_FROM },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent: html,
  };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.status;
}

// ---------- E-mail do CLIENTE (reserva confirmada) ----------
function montarEmailCliente({ nome, produto, valor, data, pousada, codigo, wpp }) {
  const linhas = [];
  if (data) linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Data</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(data)}</td></tr>`);
  if (pousada) linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Pousada</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(pousada)}</td></tr>`);
  linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Valor pago</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#C24800">${brl(valor)}</td></tr>`);
  linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Código</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(codigo)}</td></tr>`);
  const botaoWpp = wpp
    ? `<a href="https://wa.me/${wpp}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Falar no WhatsApp</a>`
    : '';
  return `<!DOCTYPE html><html><body style="margin:0;background:#FDF0DC;font-family:Arial,Helvetica,sans-serif;color:#1A1208">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0D0A07;border-radius:14px 14px 0 0;padding:22px 26px">
      <div style="color:#FF8C42;font-size:13px;letter-spacing:2px">PASSEIO EM JERI</div>
      <div style="color:#fff;font-size:22px;font-weight:800;margin-top:4px">Reserva confirmada ✅</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:26px">
      <p style="margin:0 0 14px">Olá, <strong>${escapeHtml(nome)}</strong>! Recebemos o seu pagamento e a sua reserva está confirmada.</p>
      <div style="background:#FDF0DC;border-radius:10px;padding:14px 16px;margin:14px 0">
        <div style="font-weight:700;margin-bottom:8px">${escapeHtml(produto)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${linhas.join('')}</table>
      </div>
      <p style="margin:14px 0;font-size:14px;color:#6B5D4F">Qualquer dúvida sobre horário de embarque, ponto de encontro ou alteração, fale com a gente:</p>
      <div style="margin:6px 0 4px">${botaoWpp}</div>
      <p style="margin:22px 0 0;font-size:12px;color:#9b8e7e">Nova Rota Jeri Ltda — ME · Este é um e-mail automático de confirmação.</p>
    </div>
  </div>
  </body></html>`;
}

// ---------- E-mail do PARCEIRO (comissão a receber) ----------
function montarEmailParceiro({ parceiro, produto, comissao, valorVenda, data, codigo }) {
  const linhas = [];
  linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Passeio</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(produto)}</td></tr>`);
  if (data) linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Data do passeio</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(data)}</td></tr>`);
  linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Valor da venda</td><td style="padding:4px 0;text-align:right;font-weight:600">${brl(valorVenda)}</td></tr>`);
  linhas.push(`<tr><td style="padding:4px 0;color:#6B5D4F">Referência</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(codigo)}</td></tr>`);
  return `<!DOCTYPE html><html><body style="margin:0;background:#FDF0DC;font-family:Arial,Helvetica,sans-serif;color:#1A1208">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0D0A07;border-radius:14px 14px 0 0;padding:22px 26px">
      <div style="color:#FF8C42;font-size:13px;letter-spacing:2px">PASSEIO EM JERI · PARCEIROS</div>
      <div style="color:#fff;font-size:22px;font-weight:800;margin-top:4px">Você tem comissão a receber 🎉</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:26px">
      <p style="margin:0 0 14px">Olá, <strong>${escapeHtml(parceiro)}</strong>! Uma reserva foi confirmada e paga através do seu cupom.</p>
      <div style="background:#FDF0DC;border-radius:10px;padding:14px 16px;margin:14px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">${linhas.join('')}</table>
        <div style="border-top:1px solid #F5DEB3;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:#6B5D4F;font-weight:600">Sua comissão</span>
          <span style="font-size:20px;font-weight:800;color:#C24800">${brl(comissao)}</span>
        </div>
      </div>
      <p style="margin:14px 0;font-size:13px;color:#6B5D4F">Este é o aviso desta venda. O acerto/pagamento das comissões é feito conforme combinado com a Nova Rota Jeri.</p>
      <p style="margin:22px 0 0;font-size:12px;color:#9b8e7e">Nova Rota Jeri Ltda — ME · E-mail automático para parceiros.</p>
    </div>
  </div>
  </body></html>`;
}

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
      console.log('Pagamento', pagamentoId, '->', pg.status, '| ref:', pg.external_reference);

      if (pg.status === 'approved') {
        const md = pg.metadata || {};
        const email = (pg.payer && pg.payer.email) || md.email || '';
        const nome = md.nome || (pg.payer && pg.payer.first_name) || 'Cliente';
        const produto = md.produto_nome || pg.description ||
          (pg.additional_info && pg.additional_info.items && pg.additional_info.items[0] && pg.additional_info.items[0].title) ||
          'Sua reserva';
        const valor = (md.total != null ? md.total : pg.transaction_amount) || 0;
        const data = md.data || '';
        const pousada = md.pousada || '';
        const codigo = pg.external_reference || ('MP-' + pagamentoId);
        const wpp = process.env.SUPORTE_WHATSAPP || '';

        // 1) E-mail de confirmação ao CLIENTE
        if (email) {
          const st = await enviarEmail({
            toEmail: email, toName: nome,
            subject: 'Reserva confirmada — Passeio em Jeri',
            html: montarEmailCliente({ nome, produto, valor, data, pousada, codigo, wpp }),
          });
          console.log('E-mail cliente ->', st, 'para', email);
        } else {
          console.log('E-mail do cliente vazio: não enviado.');
        }

        // 2) E-mail de comissão ao PARCEIRO (se houver cupom de parceiro)
        const parceiroEmail = md.parceiro_email || '';
        const comissao = Number(md.comissao) || 0;
        if (parceiroEmail && comissao > 0) {
          const st = await enviarEmail({
            toEmail: parceiroEmail, toName: md.parceiro || 'Parceiro',
            subject: 'Você tem comissão a receber — Passeio em Jeri',
            html: montarEmailParceiro({
              parceiro: md.parceiro || 'Parceiro',
              produto, comissao, valorVenda: valor, data, codigo,
            }),
          });
          console.log('E-mail parceiro ->', st, 'para', parceiroEmail, '| comissao', comissao);
        }
      }
    }

    // Responda sempre 200 pro Mercado Pago não reenviar.
    return res.status(200).send('ok');
  } catch (e) {
    console.log('Erro no webhook:', String(e));
    return res.status(200).send('ok');
  }
}
