# Arquitetura

## Visão geral

Aplicação **Next.js 16 (App Router)** única, com renderização no servidor, que serve o site público e o sistema interno. Banco **SQLite/libSQL** via **Drizzle ORM**. Sem microserviços e sem dependências externas em tempo de execução — fácil de hospedar e de manter.

```
Navegador ──► proxy.ts (checagem otimista do cookie em /sistema e /imprimir)
                │
                ├─► src/app        rotas (páginas, route handlers, metadados)
                │      └─► lê dados via services (Server Components) ou chama actions (formulários)
                ├─► src/actions    Server Actions: permissão + validação (Zod) + serviço
                ├─► src/server     regras de negócio, banco, autenticação, documentos
                │      ├─ services/   uma função por regra ("criar OS", "registrar pagamento"…)
                │      ├─ db/         schema Drizzle, cliente, migrações, seeds
                │      ├─ auth/       senhas, sessões, permissões, limite de tentativas
                │      └─ documents/  modelo único de documento → HTML A4 e PDF (PDFKit)
                └─► src/components UI (ui/, form/, charts/, system/, site/)
```

### Camadas e regra de dependência

`app` → `actions` → `server/services` → `server/db`. Componentes de UI não importam serviços; utilitários puros ficam em `src/lib` (sem acesso a banco ou a Next). Constantes e catálogos em `src/config`.

## Estrutura de pastas

```
src/
  app/
    (site)/            site público (layout com cabeçalho, rodapé, JSON-LD; página inicial; imagem Open Graph)
      loja/            loja virtual: catálogo, produto, carrinho, finalizar e acompanhamento do pedido
      privacidade/     política de privacidade (texto escrito pela empresa; 404 se vazio)
    (auth)/            login e troca de senha
    sistema/           sistema interno (dashboard, clientes, ordens, serviços, produtos, vendas, loja online,
                       financeiro, relatórios, impressão, usuários, configurações, guia de estilo)
    imprimir/          páginas de impressão A4 (OS, recibo, venda, relatório)
    api/               busca, notificações, lookup, backup, PDFs, CSV, loja/carrinho (conferência pública do carrinho)
    d/[token]/         link público (revogável) para PDF de documento
    media/[id]/        imagens (logo, site, produtos) servidas do banco com cache imutável
    robots.ts · sitemap.ts · not-found.tsx · error.tsx
  actions/             Server Actions por módulo
  components/          ui/ (design system), form/, charts/ (HTML+CSS), system/, site/, documents/
  config/              permissões, status da OS, formas de pagamento, catálogo oficial, dados oficiais (seed)
  content/site.ts      textos institucionais fornecidos pela empresa
  lib/                 dinheiro (centavos), datas, telefone, CPF/CNPJ, validações Zod, SEO, links…
  server/
    auth/  db/  documents/  services/
  styles/              tokens.css · base.css · ui.css · app.css · charts.css · print.css · site.css
drizzle/               migração SQL versionada
scripts/               migrar, seed, demonstração, backup, reset, redefinir senha
tests/                 Vitest (unidade + integração com banco temporário)
docs/                  documentação
```

## Decisões importantes

- **Dinheiro em centavos (inteiros)**; datas "de negócio" como texto `YYYY-MM-DD` no fuso `America/Recife` (sem surpresas de fuso/horário de verão).
- **Escrita única no banco** — toda escrita passa por `runWrite(tx => …)`: fila em processo (SQLite tem um escritor) + transação, com chamadas aninhadas reaproveitando a mesma transação (`AsyncLocalStorage`). Leitura direta por `getDb()`.
- **Estoque em livro-razão** (`stock_movements`) com `products.stock` derivado; OS e vendas usam reconciliação idempotente por referência (editar a OS 10 vezes não baixa o estoque 10 vezes). Registros de demonstração nunca movimentam estoque.
- **Um modelo de documento, duas saídas** — `buildOrderDocument` etc. produzem uma estrutura única renderizada em HTML (impressão A4, layout próprio, diferente da tela) e em PDF (PDFKit com fontes embutidas). Assim impressão e PDF nunca divergem.
- **Termos de garantia versionados** — cada edição cria nova versão; a OS "congela" a versão vigente ao ser entregue, então documentos antigos mantêm o texto da época. O texto padrão é exatamente o fornecido pela empresa.
- **Site 100% dirigido por dados** — `getSiteData()` (cache de 60 s em memória, invalidado ao salvar) monta serviços, produtos, imagens e dados da empresa; a página é gerada a cada requisição (`force-dynamic`), então edições aparecem na hora. SEO: título/descrição das Configurações, Open Graph gerado, JSON-LD `LocalBusiness`, `sitemap.xml`, `robots.txt`; ambientes de teste (localhost) saem com `noindex`.
- **Segurança em camadas** — `proxy.ts` faz só uma checagem otimista do cookie; a verificação real acontece no servidor em cada página (`requirePagePermission`), ação (`requireActionPermission`) e API (`guardApi`). Nunca se confia no menu escondido.
- **Formulários** — `ActionForm` liga um formulário a uma Server Action, exibe erros por campo, toast de sucesso e devolve os valores digitados em caso de erro. O tratamento de sucesso acontece dentro da ação (não em efeito), por isso continua funcionando quando a página é atualizada logo após salvar.
- **Gráficos sem biblioteca** — HTML/CSS puros, acessíveis (tooltip por teclado, tabela equivalente), com cores validadas para daltonismo (azul e verde).
- **Loja virtual sobre a venda** — cada pedido cria uma **venda** (`sales`, canal LOJA) na mesma transação: ela baixa o estoque, guarda o custo e recebe os pagamentos, então Financeiro, relatórios e documentos funcionam sem código novo. O pedido (`store_orders`) guarda só o que é da loja (comprador, entrega, status, link público, PIX). O carrinho fica no navegador (só produto + quantidade); **preço e estoque são sempre decididos no servidor**, na hora de conferir o carrinho e de finalizar. PIX é gerado localmente (BR Code + QR) com a chave da empresa; a confirmação do pagamento é manual. Detalhes em [LOJA-VIRTUAL.md](LOJA-VIRTUAL.md).
- **Impressão dos pedidos da loja** — a folha do pedido é o próprio documento da venda (`SaleDocument`), que ganha o bloco `order` (código LJ, como receber, endereço, pagamento, observações do cliente) e a marca `demo`; HTML A4 e PDF continuam lendo o mesmo modelo. A **estação de impressão** (`/imprimir/loja`, `components/documents/StorePrintStation.tsx`) consulta `GET /api/loja/pedidos-novos?depois=<id>` a cada 15 s (`listStoreOrdersToPrint`: ordem crescente, até 5, cancelados ignorados mas contados no avanço), renderiza as folhas numa área escondida da própria página (`.station-sheets`, visível só em `@media print`) e chama `window.print()`; o ponteiro fica em `sessionStorage`. Sem `iframe` de propósito: `X-Frame-Options: DENY` bloqueia até páginas do próprio sistema.
- **Gestão dos itens da loja** — `services/store-catalog.ts` calcula a **situação** de cada produto (`À venda`, `Sem estoque`, `Sem preço`, `Só consulta`, `Oculto`) em SQL (`LISTING_SQL`, para filtros e contadores) e em memória (`storeListingStatus`, em `lib/store-pricing.ts`) — as duas versões são cobertas pelos mesmos testes. A edição rápida envia junto os valores originais de cada linha (`orig-<id>`), grava só o que mudou e aplica o estoque como **ajuste relativo** (`recordMovement`), numa única transação (tudo ou nada). Sem nenhum produto vendável a loja entra em **modo catálogo** (`getStoreOverview().sellable`): cabeçalho e páginas não mostram carrinho.
- **Checklist de publicação** — `services/publication.ts` calcula cada passo com dados reais (empresa, produtos com preço e estoque, PIX, demonstração, endereço público/HTTPS, senhas temporárias, backup); é a fonte tanto da página *Configurações → Publicação* quanto do alerta do sino. Nada é marcado manualmente.
- **Política de privacidade** — texto simples em `company_settings.privacy_text`, renderizado por `lib/policy-text.ts` (parágrafos, subtítulos e listas; **sem HTML livre**). O modelo geral (`content/privacy-template.ts`) descreve o que o sistema realmente coleta e deve ser revisado pela empresa.
- **Responsividade** — tabelas viram cartões conforme a largura disponível (container queries), colunas de menor prioridade somem em larguras médias; menu lateral vira gaveta no celular.

## Fluxos principais

**Criar OS**: formulário (`OrderForm`) → `createOrderAction` (permissão `orders.create`, Zod) → `createOrder` (transação: número sequencial, itens, totais, evento na linha do tempo, baixa de estoque, notificação, auditoria) → redireciona para a OS.

**Entregar OS**: `changeOrderStatusAction` → `changeOrderStatus` (regras de datas, congela versão dos termos, avisa saldo a receber) → `revalidatePath`.

**PDF/Impressão**: `/api/documentos/os/[id]/pdf` e `/imprimir/os/[id]` chamam o mesmo `buildOrderDocument`; o link público `/d/[token]` reutiliza o gerador de PDF.

**WhatsApp**: `buildSiteLinks` (site) e `WhatsAppShareDialog` (sistema) montam links `wa.me` com mensagens dos modelos editáveis em Configurações → Mensagens.

## Testes

`npm test` roda 277 testes: utilidades (dinheiro, datas, telefone, CPF/CNPJ), regras da OS, vendas, financeiro, relatórios, usuários e perfis, autenticação/limite de tentativas, dados de demonstração, busca global, dados do site/SEO, geração de PDF e a **loja virtual** (código PIX, preços/estoque, checkout, cancelamento, expiração, limites contra abuso, migração), a gestão dos itens da loja (adicionar, edição rápida, situações, modo catálogo), o checklist de publicação e a política de privacidade. Testes de integração usam um SQLite temporário criado do zero (migração + seed oficial).
