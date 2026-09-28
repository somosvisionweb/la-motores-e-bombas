# Loja virtual

Loja online integrada ao site e ao sistema: o cliente escolhe os produtos, coloca no **carrinho**, finaliza o **pedido** e acompanha por um link privado. Para a equipe, cada pedido vira uma **venda** (canal “Loja online”) — estoque, financeiro, relatórios e documentos funcionam sem nada extra.

## Páginas

| Endereço | O que é |
|---|---|
| `/loja` | Catálogo: busca sem acento, filtro por categoria, ordenação (destaques, nome, preço). |
| `/loja/produto/12-rolamentos` | Página do produto: preço, estoque, quantidade, **Adicionar ao carrinho** / **Comprar agora**, descrição, produtos relacionados, dados estruturados (schema.org `Product`, só com preço real). |
| `/loja/carrinho` | Carrinho completo (também há a **gaveta do carrinho** em todas as páginas do site, aberta pelo ícone do cabeçalho). |
| `/loja/finalizar` | Checkout: dados do cliente, retirada ou entrega, forma de pagamento, observações, aceite das condições. |
| `/loja/pedido/<token>` | Acompanhamento do pedido (link privado): etapas, PIX (QR Code + copia e cola), endereço/horário de retirada, histórico. |
| `/privacidade` | Política de privacidade (LGPD), escrita pela empresa em *Configurações → Empresa*. Sem texto cadastrado, a página não existe (404) e o link some do rodapé e do checkout. |
| `/sistema/loja` · `/sistema/loja/<id>` | Painel da equipe: lista, filtros, detalhe e ações dos pedidos. |
| `/imprimir/loja` | **Estação de impressão**: página que fica aberta no computador da loja e imprime (A4) cada pedido novo do site (ver “Imprimir os pedidos”). |
| `/sistema/loja/produtos` | **Produtos da loja**: adicionar item, edição rápida de preço/estoque/categoria/visibilidade e situação de cada produto. |
| `/sistema/configuracoes/loja` | Configurações da loja (PIX, entrega, prazos, condições). |
| `/sistema/configuracoes/publicacao` | **Publicação**: checklist do que falta para o site e a loja ficarem prontos (calculado com os dados reais). |

Na página inicial, a seção **Produtos** vira uma vitrine com preço e botão de compra; o item **Produtos** do menu leva à loja. Com a loja **fechada** (Configurações → Loja virtual) tudo volta ao comportamento anterior: produtos só para consulta pelo WhatsApp, sem carrinho.

## Gerenciar os itens da loja (equipe)

Em **Loja online → Produtos da loja** (permissão `products.view`; alterar exige `products.manage`, e mexer no estoque exige `products.stock`):

- **Adicionar item à loja**: nome, categoria, preço de venda, estoque inicial e foto (opcional) numa linha só. O item já entra **à venda** se tiver preço e estoque; sem preço aparece como “valor sob consulta”. Descrição, código, custo, estoque mínimo e ícone ficam na ficha completa (*Cadastro completo…*, que volta para esta tela ao salvar).
- **Situação de cada produto** (selo colorido + filtro + contadores no topo): **À venda**, **Sem estoque** (tem preço, estoque zerado), **Sem preço**, **Só consulta** (“Vender na loja virtual” desmarcado) e **Oculto** (inativo ou fora do site). A situação considera só o preço **real**: preço de demonstração não conta e a linha avisa “usando preço de demonstração”.
- **Edição rápida** (tabela): categoria, preço, estoque e as caixas *No site* / *Vender online* de vários produtos, com **um** botão *Salvar alterações*. O formulário leva junto os valores originais de cada linha, então **só o que mudou é gravado**; o estoque digitado vira um **ajuste relativo** (o histórico registra a diferença como “Ajuste pela edição rápida da loja”), de modo que uma venda feita enquanto a tela estava aberta não é desfeita. O lote é atômico: se um produto não existir mais, nada é salvo.
- **Barra de administração** no topo do site público (só para quem está logado no sistema — visitantes nunca veem): atalhos para Painel, Pedidos, Produtos da loja e Adicionar item; na página de cada produto há o atalho **Editar este produto**.

## Modo catálogo (nada à venda ainda)

Enquanto **nenhum** produto puder ser comprado (nem com preço real + estoque, nem com preço de demonstração), a loja funciona como **catálogo**: o site **não mostra carrinho** nem promete compra online — o cabeçalho, a página inicial e `/loja` explicam “consulte o valor e a disponibilidade pelo WhatsApp”. Assim que o primeiro item ganha preço e estoque, o carrinho e os botões de compra aparecem sozinhos. O mesmo vale com a loja fechada.

## Privacidade (LGPD)

A loja recebe **nome, telefone, e-mail (opcional), endereço (só na entrega) e observações** e registra o **IP** do pedido para prevenir abuso; o carrinho fica só no navegador do cliente. Por isso a empresa deve publicar uma política de privacidade:

- Em **Configurações → Empresa → Política de privacidade**, o botão **Usar o modelo pronto** preenche um texto geral com os dados oficiais (nome, CNPJ, e-mail, WhatsApp, endereço) descrevendo exatamente o que o sistema faz. É um **ponto de partida**: revise com o contador ou um advogado antes de publicar.
- Salvar publica `/privacidade`, o link **Política de privacidade** no rodapé, o aviso no checkout e a entrada no `sitemap.xml`. Deixar o texto vazio remove tudo.
- Formato do texto: linha em branco separa parágrafos, linhas “1. Título” viram subtítulos e linhas iniciadas por “- ” viram listas. **Nunca há HTML livre**: o texto é exibido sempre como texto puro.

## Regras de preço e estoque (nada é inventado)

Um produto aparece na loja se estiver **ativo** e marcado **Exibir no site**. Ele só pode ser **comprado** se também estiver marcado **Vender na loja virtual** e tiver **preço de venda maior que zero** e **estoque**:

| Situação | O que o cliente vê |
|---|---|
| Preço + estoque | Preço, “Em estoque” (ou “Últimas unidades” com 5 ou menos) e botão **Adicionar**. |
| Preço, sem estoque | Preço e “Esgotado no momento” + botão para consultar reposição pelo WhatsApp. |
| Sem preço (R$ 0,00) | “Valor sob consulta” + botão do WhatsApp. **Nunca** se inventa preço. |
| “Vender na loja virtual” desmarcado | Igual ao “sem preço”: só consulta. |

O **navegador só guarda produto + quantidade**. Preço, estoque e disponibilidade são decididos **no servidor**, na conferência do carrinho (`/api/loja/carrinho`) e — de novo, dentro da transação — ao finalizar o pedido. Não existe oversell: se o estoque acabou entre o carrinho e o pedido, o pedido é recusado com a mensagem do que faltou.

## Modo demonstração

Os 13 produtos oficiais vêm **sem preço** (a empresa cadastra). Para conhecer a loja, os dados de demonstração incluem **preços fictícios** (`products.demo_price_cents`) e pedidos de exemplo. Regras:

- O preço real (`sale_price_cents`) **sempre vence** o de demonstração; o de demonstração só vale enquanto não houver preço real.
- Enquanto houver preço de demonstração em uso, **todas as páginas da loja exibem “Loja em demonstração”**, o cartão do produto tem o selo “Demonstração” e o pedido é marcado `is_demo`.
- Pedido de demonstração **nunca** mexe no estoque real, usa um PIX com chave **inexistente** (`demonstracao@loja.invalid`, domínio reservado que nunca existe — ninguém consegue pagar por engano) e não gera aviso de WhatsApp ao cliente.
- Carrinho misto (produto real + de demonstração) vira pedido de demonstração inteiro.
- **Configurações → Dados e segurança → Remover dados de demonstração** apaga pedidos de exemplo e zera os preços fictícios.

## Fluxo do pedido

```
cliente finaliza ──► RECEIVED (Recebido) ──► CONFIRMED (Confirmado) ──► READY (Pronto)
                          │                                                │
                          │                                     [entrega] OUT_FOR_DELIVERY (Saiu para entrega)
                          ▼                                                ▼
                     CANCELED (Cancelado) ◄── (a qualquer momento, até concluir)    COMPLETED (Concluído)
```

- **Criar pedido** (uma transação): confere preço e estoque, cria a **venda** (baixa o estoque e guarda o custo do momento), grava o pedido com link secreto (256 bits), gera o PIX (se escolhido), cria o aviso para a equipe e a auditoria.
- **Confirmar pagamento PIX**: lança a entrada no Financeiro (forma PIX, valor do saldo) e leva o pedido a *Confirmado*.
- **Concluir**: se ainda houver saldo (pagar na retirada), pede a forma de pagamento recebida e lança a entrada.
- **Cancelar**: devolve o estoque, estorna pagamentos, cancela a venda e mostra “Pedido cancelado” ao cliente. Pedido **já pago** só pode ser cancelado por quem tem a permissão de cancelar vendas (`sales.cancel`). Cancelar a venda pela tela de Vendas também cancela o pedido.
- **Expiração**: o estoque é reservado ao criar o pedido. PIX não pago em `hold_hours` (padrão 24 h) e pedidos “pagar na retirada” que a equipe não confirma em 3× esse prazo são cancelados sozinhos (evita travar o estoque com pedidos abandonados ou falsos). Pedidos confirmados e de demonstração não expiram. `0` desativa.

## Pagamento

| Forma | Como funciona |
|---|---|
| **PIX** | O sistema monta o **BR Code** (padrão do Banco Central) com a chave da empresa, o valor e o identificador `LJ000123`, e gera o **QR Code** no servidor (biblioteca `qrcode`; nada vai para serviços externos). O dinheiro cai direto na conta da chave — sem intermediário e sem taxa. **Confirmação manual**: a equipe confere no app do banco e usa *Confirmar pagamento PIX*. Sem chave cadastrada, a loja não oferece PIX. |
| **Pagar na retirada / na entrega** | Sem cobrança online; a forma (dinheiro, PIX ou cartão no balcão) é registrada ao concluir. |
| Cartão de crédito / boleto online | **Não disponíveis**: exigem contrato com um provedor de pagamentos (Mercado Pago, Stripe, Pagar.me…) e credenciais da empresa. O ponto de extensão é simples: o provedor avisa por *webhook* e o sistema chama `confirmStorePayment` (mesma regra do PIX manual). |

A chave PIX é guardada **normalizada** conforme o tipo (CPF, CNPJ, telefone `+55…`, e-mail, chave aleatória) e o código gerado fica salvo no pedido: trocar a chave depois não altera pedidos antigos.

## Entrega e retirada

- **Retirada na loja**: sempre disponível (endereço e horário oficiais, mais o aviso definido em *Configurações → Loja virtual*).
- **Entrega**: **desligada por padrão** — a empresa não informou se entrega peças. Ao ativar, defina taxa, “grátis a partir de” e um aviso (regiões/prazo). O checkout pede o endereço completo (CEP, rua, número, bairro, cidade, UF). A taxa entra como uma linha própria na venda (`sale_items.is_fee`), fora dos rankings de produtos.
- **Pedido mínimo** opcional.

## Imprimir os pedidos (folha A4)

**A folha do pedido** é o documento da venda vinculada (`/imprimir/venda/<id>`, também em PDF). Nos pedidos da loja ela sai como **PEDIDO DA LOJA ONLINE Nº LJ-000123** e traz, além do cliente, dos produtos e do total: data e hora do pedido, **como receber** (retirada ou entrega), **endereço de entrega com CEP**, **forma e situação do pagamento** (ex.: “PIX — aguardando confirmação do pagamento”, “Pagar na entrega — a receber”, “PIX — pago”), situação do pedido, e-mail e a **observação escrita pelo cliente**. Pedido cancelado sai marcado “PEDIDO CANCELADO”; registros de demonstração saem com “DEMONSTRAÇÃO — dados fictícios, sem valor como comprovante”. O HTML de impressão e o PDF usam o mesmo modelo (`SaleDocument.order`).

Três formas de imprimir:

1. **Um pedido**: botão **Imprimir pedido (A4)** no topo do pedido (*Loja online → pedido*): abre a folha e já chama a janela de impressão do navegador.
2. **Venda de balcão**: em *Vendas → Nova venda* há a caixa **Imprimir o comprovante (A4) ao registrar a venda** (ligada por padrão; a escolha fica guardada no navegador de cada computador). Ao registrar, o sistema abre direto a folha com a janela de impressão; a barra da folha tem **Voltar** para a venda.
3. **Automático, a cada pedido novo do site** — a **estação de impressão** (`/imprimir/loja`, botão **Impressão automática** em *Loja online*, exige `store.view` + `documents.print`):
   - Fica aberta no computador da loja. A cada 15 s consulta `/api/loja/pedidos-novos?depois=<id>` (até 5 pedidos por vez, já com o documento pronto) e, se chegou pedido, coloca as folhas A4 numa área escondida da própria página e chama `window.print()`; vários pedidos chegando juntos saem em **um** trabalho de impressão (uma folha cada). Pedidos cancelados não são impressos.
   - Começa **“a partir de agora”**: só imprime pedidos criados depois que a página abriu. O ponto onde parou fica na aba (`sessionStorage`), então recarregar a página não reimprime nada nem perde pedidos. Pedidos que chegarem com a página **fechada** não são impressos sozinhos — continuam em *Loja online*, com o botão de imprimir.
   - Botões: **Pausar/Retomar** e **Imprimir o último pedido (teste)** (serve para testar a impressora; não mexe no ponto onde a estação parou). A página lista o que já foi impresso, com **Imprimir de novo**.
   - **Limite do navegador**: um site não consegue imprimir “em silêncio”. Sem ajuste, a janela de impressão do navegador abre a cada pedido e alguém clica em *Imprimir*. Para imprimir direto, o Chrome do computador da loja precisa ser aberto com `--kiosk-printing` (ver [Manual do usuário](MANUAL-DO-USUARIO.md)); esse ajuste não foi testado com impressora física neste ambiente.
   - Decisão técnica: nada de `iframe` — o site envia `X-Frame-Options: DENY`/`frame-ancestors 'none'`, que bloqueiam até páginas do próprio sistema em iframe; por isso a estação imprime na própria página, sem afrouxar a segurança.

## Segurança e abuso

- Checkout **público** (sem login) protegido por: campo-isca invisível (robôs), tempo mínimo de preenchimento (2,5 s), **limite de 8 pedidos por IP por hora** (60 por hora no total quando o IP é desconhecido), **3 pedidos abertos por telefone**, validação Zod no servidor e conferência de preço/estoque no servidor. O IP vem de `X-Forwarded-For` (ver [DEPLOY](DEPLOY.md)).
- O link de acompanhamento é um **token aleatório de 256 bits** (não adivinhável), a página é `noindex`, sem cache e com `<meta name="referrer" content="no-referrer">` (o endereço secreto não vaza para outros sites); o telefone aparece mascarado.
- O cliente **não** é cadastrado automaticamente (evita lotar o cadastro com dados de terceiros/robôs); só é ligado a um cliente existente quando o telefone corresponde a **um único** cadastro.
- Permissões: `store.view` (ver pedidos) e `store.manage` (confirmar, separar, concluir, cancelar sem pagamento). Configurações da loja exigem `settings.manage`. O perfil *Vendedor / Atendente* recebe `store.view` e `store.manage` (a migração faz isso em instalações existentes).
- Saídas escapadas pelo React; `qrcode` roda só no servidor; CSP de produção permite apenas `data:` para a imagem do QR.

## Notificações e busca

- Novo pedido → notificação para quem tem `store.view` (sino) + alerta “N pedidos novos na loja online” e selo no menu **Loja online**.
- Busca global (`/` ou `Ctrl+K`): digite `LJ-000123` para abrir o pedido.
- Mensagem de WhatsApp ao cliente: modelo editável em *Configurações → Mensagens WhatsApp* (`{{nome}}`, `{{empresa}}`, `{{codigo}}`, `{{link}}`). O link só funciona para o cliente com o sistema publicado na internet (mesma limitação dos PDFs).

## Testes

`tests/lib/pix.test.ts` (CRC, campos EMV, chaves), `tests/lib/store-rules.test.ts` (preço/estoque, carrinho, fluxo, permissões, migração, validações), `tests/lib/store-admin.test.ts` (situação do produto na loja, cadastro rápido, texto e modelo da política de privacidade), `tests/services/store.test.ts` (catálogo, carrinho, criação de pedido, PIX, entrega, demonstração, limites, vínculo com clientes, status, pagamento, cancelamento, expiração, painel, limpeza da demonstração), `tests/services/store-catalog.test.ts` (adicionar item, edição rápida com estoque relativo e lote atômico, filtros/contadores, modo catálogo) e `tests/services/publication.test.ts` (checklist de publicação, alerta no sino, política de privacidade). A impressão dos pedidos (documento com o bloco do pedido, folha HTML, PDF, fila de pedidos novos para a estação) é coberta em `tests/services/store.test.ts`.

## O que depende da empresa

Preços e estoque reais, chave PIX, decisão de entregar ou não, condições de troca/devolução (texto), **texto da política de privacidade revisado**, logo e fotos oficiais, e — para cartão/boleto online — contratar um provedor de pagamentos. O checklist **Configurações → Publicação** mostra, com os dados reais, o que ainda falta.
