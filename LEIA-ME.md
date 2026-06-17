# Plano B — Pagamento automático com Mercado Pago (passo a passo)

Objetivo: o site gera a cobrança com o **valor exato** (qualquer quantidade de pessoas, qualquer cupom) e o Mercado Pago confirma o pagamento. Para isso usamos um **mini-servidor** (função serverless) que guarda o token secreto.

Arquivos desta pasta:
- `api/criar-pagamento.js` — cria a cobrança com o valor certo (calculado no servidor).
- `api/webhook.js` — (opcional) recebe a confirmação automática do Mercado Pago.
- `package.json` — configuração mínima.
- `integracao-site.js` — trecho que o site usa pra chamar o backend.

> Dica geral: faça **tudo em modo TESTE primeiro**. Só troque para produção quando um pagamento de teste funcionar de ponta a ponta.

---

## Passo 1 — Pegar as credenciais no Mercado Pago
1. Entre em **mercadopago.com.br** com a conta da empresa (Nova Rota Jeri).
2. Vá em **"Seu negócio" / "Suas integrações"** (área de Desenvolvedores) e **crie uma aplicação** (tipo: Checkout Pro / Pagamentos online).
3. Dentro da aplicação, copie o **Access Token**. Existem dois:
   - **Teste** (começa com `TEST-...`) — use primeiro.
   - **Produção** (começa com `APP_USR-...`) — use só no final.
4. Guarde esse token com cuidado: ele **nunca** vai para o site, só para o servidor.

## Passo 2 — Hospedar o backend (Vercel, grátis e sem cartão)
Caminho mais fácil, sem linha de comando:
1. Suba esta pasta `mp-backend` para um repositório no **GitHub** (pode criar a conta e fazer upload pelo site do GitHub: "Add file" → "Upload files").
2. Crie conta em **vercel.com** e clique em **"Add New… → Project"**.
3. **Importe** o repositório do GitHub.
4. Antes de finalizar, abra **"Environment Variables"** e adicione:
   - `MP_ACCESS_TOKEN` = (cole o token de **TESTE** por enquanto)
   - `SITE_URL` = `https://passeioemjeri.com.br`
5. Clique em **Deploy**. No fim, a Vercel te dá uma URL, ex.: `https://passeioemjeri-mp.vercel.app`.
   - Seu endpoint de pagamento será: `…vercel.app/api/criar-pagamento`

(Alternativas ao Vercel: Netlify, Cloudflare Workers, Render. O conceito é o mesmo.)

## Passo 3 — Testar o backend
- Abra no navegador: `SUA_URL/api/criar-pagamento` — deve responder "Método não permitido" (normal, porque só aceita POST). Isso já confirma que está no ar.
- O teste real acontece no Passo 5 (com o site) usando os **cartões de teste** do Mercado Pago.

## Passo 4 — Ligar o site ao backend
- Me mande a sua URL da Vercel. Eu coloco no site o trecho do `integracao-site.js` e faço o botão **"Cartão"** chamar o backend (em vez do link fixo), redirecionando pro checkout do Mercado Pago com o valor exato.
- Enquanto isso não acontece, o site continua funcionando normal (links fixos / WhatsApp).

## Passo 5 — Testar o fluxo completo (modo teste)
1. No site, faça uma reserva e clique em **Cartão**.
2. Vai abrir o checkout do Mercado Pago (versão sandbox).
3. Pague com um **cartão de teste** do Mercado Pago (eles fornecem números de teste para "aprovado", "recusado", etc.).
4. Confirme que o valor está certo (inclusive com cupom) e que volta para o site na tela de sucesso.

## Passo 6 — Ir para produção
1. Na Vercel, troque a variável `MP_ACCESS_TOKEN` pelo token de **PRODUÇÃO** (`APP_USR-...`) e faça **Redeploy**.
2. No site, passamos a usar o link de produção (`data.url`). (Eu ajusto isso quando você avisar.)
3. Faça uma compra real de baixo valor para validar e depois reembolse, se quiser.

## Passo 7 (opcional) — Confirmação automática (webhook)
1. Na Vercel, adicione a variável `WEBHOOK_URL` = `SUA_URL/api/webhook`.
2. No painel do Mercado Pago, configure as **notificações/webhooks** apontando para `SUA_URL/api/webhook` (evento de **pagamentos**).
3. Assim, quando um pagamento é aprovado, o `webhook.js` é avisado e você pode disparar um e-mail/WhatsApp de confirmação (há um espaço marcado com `TODO` no arquivo).

---

## Segurança (importante)
- O **Access Token fica só no servidor** (variável de ambiente), nunca no site.
- O **preço é calculado no servidor** (no `criar-pagamento.js`), então ninguém consegue forçar um valor menor pela tela.
- Em produção, troque o CORS de `*` para o seu domínio (`https://passeioemjeri.com.br`) no `criar-pagamento.js`.
- Mantenha os **cupons** do backend (`CUPONS`) iguais aos do site.

## Sobre custos
- O Mercado Pago cobra uma **taxa por transação** (cartão/Pix variam). Confira as taxas atuais no painel deles e considere isso na precificação — vale alinhar com seu contador, junto com a emissão de nota fiscal.
