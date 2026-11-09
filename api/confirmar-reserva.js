// ============================================================
//  Reserva de segurança — chamada pela tela /obrigado
//  Caminho: /api/confirmar-reserva?id=<payment_id>
//  Se o aviso do Mercado Pago (webhook) falhou, este caminho garante
//  que os dados da reserva cheguem por e-mail. Consulta o pagamento
//  direto no Mercado Pago (não confia na URL) e só age se APROVADO.
//  Sem duplicar: se o e-mail já saiu, não envia de novo.
// ============================================================
import { processarPagamento } from './_notificar.js';

export default async function handler(req, res) {
  try {
    const id = String(req.query.id || '').replace(/\D/g, '');
    if (!id) return res.status(400).json({ erro: 'id ausente' });
    const r = await processarPagamento(id, { origem: 'retorno', soAprovado: true });
    return res.status(200).json({ ok: r.ok, status: r.status });
  } catch (e) {
    console.log('Erro em confirmar-reserva:', String(e));
    return res.status(500).json({ erro: 'falha interna' });
  }
}
