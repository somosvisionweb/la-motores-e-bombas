# Log de construção — LA Motores e Bombas

> Documento de trabalho: decisões, convenções e progresso. Atualizado durante o desenvolvimento.

## Stack
Next.js 16 (App Router, Turbopack) · TypeScript · Drizzle ORM + libSQL (SQLite local / Turso na nuvem) · Zod 4 ·
PDFKit (PDF) · sharp (imagens) · lucide-react (ícones) · CSS próprio (design system em `src/styles`) · Vitest.

## Convenções (importante)
- **Dinheiro** = inteiros em centavos (`*_cents`). Datas "de negócio" = texto `YYYY-MM-DD` (fuso America/Recife).
- **Toda escrita no banco passa por `runWrite(tx => …)`** (`src/server/db/client.ts`): fila em processo (SQLite = 1 escritor) e
  chamadas aninhadas reaproveitam a transação (AsyncLocalStorage). Leitura: `getDb()`.
- **Camadas**: `src/app` (rotas finas) → `src/actions` (Server Actions: permissão + validação Zod) →
  `src/server/services` (regras de negócio) → `src/server/db` (schema/cliente). UI em `src/components`. Utilitários puros em `src/lib`.
- **Permissões**: `src/config/permissions.ts` (catálogo) · páginas: `requirePagePermission`, ações: `requireActionPermission`.
- **Formulários**: `ActionForm` (context) + campos em `components/form/fields.tsx`; ações retornam `ActionState`; `runAction` trata erros.
- **Feedback**: `setFlash()` (cookie) + `<FlashToaster/>`; `useToast()`.
- **Estoque**: livro-razão `stock_movements`; OS e vendas usam `reconcileStockForRef` (idempotente).
- **Dados de demonstração**: coluna `is_demo` (customers, service_orders, sales, payments, expenses…); nunca misturados com oficiais.
- Nada de dados da empresa hardcoded: tudo vem de `company_settings` (seed inicial em `config/company-defaults.ts`).
- **Site público**: `src/app/(site)` (layout + página) monta tudo a partir de `getSiteData()` (cache de 60 s em memória, invalidado
  ao salvar configurações/serviços/produtos). Textos institucionais fornecidos pela empresa ficam em `src/content/site.ts`.
  Links de WhatsApp são gerados por `buildSiteLinks()` (`src/lib/site-links.ts`) a partir dos modelos de mensagem editáveis.
- **Sucesso de formulários**: `ActionForm`/`ConfirmActionForm` tratam o resultado dentro da própria ação (não em efeito) — assim toast e fechamento de modal funcionam mesmo quando a página é atualizada e o componente é recriado.
- **Loja virtual**: pedido = venda (`sales.channel = 'LOJA'`) + `store_orders`, criados na mesma transação (`placeStoreOrder`). Preço/estoque decididos no servidor (`lib/store-pricing.ts`); carrinho no navegador (`components/store/cart-store.ts`, `useSyncExternalStore`). Preços fictícios só em `products.demo_price_cents`. PIX: `lib/pix.ts` (BR Code) + `qrcode` no servidor. Formulários com estado próprio (botões de opção) usam `<ActionForm keepValues>` para o React não reiniciar o formulário após um erro. O `SubmitButton` lê o `pending` tanto do `useFormStatus` quanto do `ActionForm`, então funciona nos dois modos.
- **Arquivos**: nunca editar arquivos com PowerShell (`Get-Content`/`Set-Content` corrompe acentos) — usar as ferramentas Edit/Write.

## Ambiente de teste (agente)
- Servidor de preview: `.claude/launch.json` (na raiz do projeto) → `npm run dev` na porta 3000.
- O painel do navegador do app é estreito; para conferir layouts em vários tamanhos usa-se o Chrome headless via DevTools Protocol
  (script de captura no scratchpad da sessão: emulação de celular/tablet/desktop, detecção de overflow horizontal e erros de console).
- Senhas do seed são aleatórias (impressas uma vez). Para testes locais foi definida uma senha própria; ao final o banco é recriado.

## Progresso
- [x] Fundação: config, banco (25 tabelas), migração, seed oficial, auth (scrypt, sessões, throttle), RBAC, shell, design system base
- [x] Clientes (CRUD, ficha, histórico, duplicidade, WhatsApp)
- [x] Catálogo: serviços e produtos (estoque em livro-razão, ajuste, ícones técnicos)
- [x] Ordens de Serviço (form, detalhe, status, itens, pagamentos, estoque, notificações)
- [x] Financeiro (entradas/custos) · Vendas
- [x] Dashboard + gráficos · Relatórios
- [x] Documentos: impressão A4, PDF, recibo, WhatsApp
- [x] Busca global · Notificações
- [x] Usuários e perfis · Configurações (empresa, logo, horários, termos, imagens do site, dados demo)
- [x] Site público (SEO: título/descrição, Open Graph gerado, JSON-LD LocalBusiness, sitemap, robots) — verificado em desktop, tablet e celular
- [x] Verificação no navegador de todos os módulos (roteiros automatizados via Chrome DevTools) e correções encontradas
- [x] Testes automatizados (277) · lint (ESLint 9) · `next build` · documentação (README, ARQUITETURA, BANCO-DE-DADOS, DESIGN-SYSTEM, DEPLOY, MANUAL-DO-USUARIO, VERIFICACAO)
- [x] Guia de estilo dentro do sistema (`/sistema/design-system`)
- [x] **Loja virtual** (catálogo, produto, carrinho, checkout, PIX, acompanhamento do pedido, painel da equipe, configurações, demonstração) — ver [LOJA-VIRTUAL](LOJA-VIRTUAL.md)
- [x] **Itens da loja, publicação e privacidade** — *Loja online → Produtos da loja* (adicionar item, edição rápida, situações), modo catálogo, barra de administração no site, checklist *Configurações → Publicação* com alerta no sino e política de privacidade (`/privacidade`, migração `0002_privacy`) — ver [LOJA-VIRTUAL](LOJA-VIRTUAL.md)
- [x] **Impressão A4 ao finalizar** — folha do pedido da loja (bloco do pedido, endereço com CEP, pagamento, observações), "Imprimir ao registrar" na venda de balcão e estação de impressão automática dos pedidos novos (`/imprimir/loja`) — ver [LOJA-VIRTUAL](LOJA-VIRTUAL.md)
