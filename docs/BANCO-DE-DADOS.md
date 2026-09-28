# Banco de dados

SQLite (arquivo local `data/la-motores.db`) ou **Turso/libSQL** na nuvem — o mesmo esquema e o mesmo código. Definido em `src/server/db/schema.ts` (Drizzle) e versionado em `drizzle/` (`npm run db:generate` cria novas migrações; `npm run db:migrate` — ou a inicialização do servidor, com `AUTO_MIGRATE=true` — aplica).

## Convenções

- **Dinheiro**: inteiros em centavos (`*_cents`). Nunca ponto flutuante.
- **Datas de negócio** (entrada, previsão, entrega, pagamento, custo): texto `YYYY-MM-DD` no fuso da empresa.
- **Carimbos de tempo** (`created_at`…): milissegundos desde 1970.
- **`is_demo`**: registros de DEMONSTRAÇÃO (clientes, ordens, vendas, pedidos da loja, pagamentos, custos, movimentos e notificações). Removíveis em bloco; nunca movimentam estoque. Os preços fictícios da loja ficam em `products.demo_price_cents` (nunca em `sale_price_cents`) e são zerados na mesma limpeza.
- **`search_text`**: texto normalizado (minúsculo, sem acento) para busca rápida.
- Chaves estrangeiras ativas; exclusões protegidas por regra de negócio (não se exclui o que tem histórico).

## Tabelas (28)

### Acesso e segurança
| Tabela | Conteúdo |
|---|---|
| `roles` | Perfis de acesso e lista de permissões (JSON). `admin` e `seller` são do sistema (não excluíveis). |
| `users` | Usuários: login, hash **scrypt** da senha (nunca a senha), perfil, ativo, troca obrigatória de senha. |
| `sessions` | Sessões: `id` = SHA-256 do token do cookie, expiração, último uso, IP. |
| `login_attempts` | Tentativas de login (para o bloqueio por excesso de falhas). |
| `audit_logs` | Trilha de auditoria: quem, quando, o quê (sem dados sensíveis). |

### Empresa e conteúdo
| Tabela | Conteúdo |
|---|---|
| `company_settings` | Linha única: nome, CNPJ, e-mail, WhatsApp, telefone, endereço, Instagram, horários (JSON), formas de pagamento, logo, SEO, URL pública, modelos de mensagem e o texto da **política de privacidade** (`privacy_text`, migração `0002_privacy`; vazio = a página `/privacidade` não existe). |
| `guarantee_terms` | Termos de garantia **versionados** (texto com marcação simples, prazo em meses, versão ativa). |
| `files` | Imagens (logo, site, produtos) em BLOB, já otimizadas. |
| `site_images` | Imagem principal e galeria do site (com texto alternativo e ordem). |
| `document_links` | Links públicos de PDF (token aleatório, expiração, revogáveis). |

### Operação
| Tabela | Conteúdo |
|---|---|
| `customers` | Clientes (nome, documento, telefone, WhatsApp, e-mail, endereço, observações). |
| `services` | Catálogo de serviços (grupo, preço padrão opcional, exibir no site, ordem). |
| `products` | Produtos (código PRD-####, preço, custo, estoque, mínimo, ícone/foto, exibir no site, **vender na loja virtual**, descrição da loja e preço de demonstração). |
| `stock_movements` | Livro-razão do estoque (entrada, compra, uso em OS, venda, ajuste, devolução) com referência da origem. |
| `service_orders` | Ordens de serviço (número sequencial, cliente, equipamento, status, datas, totais, termos congelados). |
| `service_order_items` | Itens da OS: serviço ou peça (vinculada ou não a produto), quantidade, valor unitário e custo. |
| `service_order_events` | Linha do tempo da OS (criação, status, pagamentos, comentários). |
| `sales` · `sale_items` | Vendas e seus itens. `sales.channel` = `BALCAO` (equipe) ou `LOJA` (pedido do site); linhas de taxa (ex.: entrega) têm `is_fee = 1` e ficam fora dos rankings. |
| `payments` | Entradas: vinculadas a OS, venda ou avulsas; forma; data; status (PAGO/ESTORNADO) e motivo do estorno. |

### Loja virtual
| Tabela | Conteúdo |
|---|---|
| `store_settings` | Linha única: loja aberta, chave PIX (já normalizada) e tipo, entrega (taxa, grátis a partir de, aviso), aviso de retirada, pedido mínimo, prazo de reserva do estoque, condições da loja. Sem a linha valem os padrões do código. |
| `store_orders` | Pedido do site: número `LJ-000123`, **token público de 256 bits**, venda vinculada (`sale_id`, única), status, retirada/entrega, forma de pagamento (PIX ou na retirada), comprador (nome, telefone só com dígitos, e-mail), endereço (JSON), totais, "copia e cola" do PIX gerado, IP de origem (limite contra abuso), datas de confirmação/pronto/conclusão/cancelamento. |
| `store_order_events` | Linha do tempo do pedido; cada evento é **público** (o cliente vê no acompanhamento) ou interno. |

### Financeiro, relatórios e avisos
| Tabela | Conteúdo |
|---|---|
| `expense_categories` | Categorias de custo (uma marca "mercadorias" alimenta o card *Custo de mercadorias*). |
| `expenses` | Custos: data, descrição, fornecedor, categoria, valor, forma de pagamento, observações. |
| `reports` | Histórico de relatórios impressos/exportados. |
| `notifications` · `notification_reads` | Avisos internos e quem já leu. |

## Relações principais

```
roles 1─* users 1─* sessions
customers 1─* service_orders 1─* service_order_items ─* products / services
                           1─* service_order_events
                           1─* payments *─1 sales 1─* sale_items ─* products
                                             1─1 store_orders 1─* store_order_events
products 1─* stock_movements   (ref: OS ou venda)
expense_categories 1─* expenses
company_settings ─1 files (logo) · site_images ─1 files · products ─1 files (foto)
```

## Dados iniciais (seed oficial)

`npm run db:seed` (idempotente) cria: configurações da empresa com os dados oficiais, horários, formas de pagamento, mensagens de WhatsApp, termos de garantia (versão 1), perfis Administrador e Vendedor, usuários **ewerton** e **mario**, os **19 serviços** e **13 produtos** oficiais (sem preços — a empresa cadastra), categorias de custo iniciais.

## Backup e restauração

- **Sistema**: Configurações → Dados e segurança → *Baixar backup agora* (cópia consistente via `VACUUM INTO`, apenas para administradores).
- **Terminal**: `npm run db:backup` (grava em `backups/`).
- **Restaurar**: pare o servidor, substitua `data/la-motores.db` pelo arquivo de backup e inicie novamente.
- **Turso**: use os backups/pontos de restauração do próprio provedor.
