// ============================================================
//  Trecho para o SITE chamar o backend (cole no <script> do site).
//  Quando o backend estiver no ar, me mande a URL que eu encaixo isso
//  no botão de Cartão automaticamente.
// ============================================================

// Coloque a URL do seu backend (Vercel). Ex.: 'https://passeioemjeri-mp.vercel.app'
const BACKEND_URL = '';

async function pagarCartaoMP(id, pessoas, cupom, nome, email) {
  try {
    const r = await fetch(BACKEND_URL + '/api/criar-pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pessoas, cupom, nome, email }),
    });
    const data = await r.json();
    // Em TESTE use data.sandbox ; em PRODUÇÃO use data.url
    const destino = data.url || data.sandbox;
    if (destino) {
      window.location.href = destino;
    } else {
      alert('Não foi possível iniciar o pagamento. Tente de novo ou fale no WhatsApp.');
    }
  } catch (e) {
    alert('Erro de conexão com o pagamento. Tente de novo ou fale no WhatsApp.');
  }
}
