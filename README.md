# LA Motores e Bombas — Site + Sistema de Gestão

Site institucional e sistema interno de gestão da **LA Motores e Bombas** (assistência técnica de motores elétricos e bombas — Jaboatão dos Guararapes/PE).

| | |
|---|---|
| **Site público** | `/` — páginas institucionais, serviços, produtos, diferencial, atendimento a domicílio e contato (WhatsApp, Instagram, mapa). SEO completo. |
| **Loja virtual** | `/loja` — catálogo com carrinho, checkout (retirada ou entrega), **PIX** (QR Code + copia e cola) ou pagamento na retirada, e acompanhamento do pedido por link privado. Integrada ao estoque e ao financeiro. |
| **Sistema interno** | `/sistema` (login em `/login`) — clientes, ordens de serviço, serviços, produtos e estoque, vendas, financeiro, relatórios, impressão A4/PDF, usuários e configurações. |

> Todos os dados da empresa (nome, CNPJ, telefone, endereço, horários, formas de pagamento, mensagens de WhatsApp, termos de garantia, logo, SEO) ficam em **Configurações** e alimentam site, documentos e PDFs. Nada disso está fixo no código.

## O que o sistema faz

- **Clientes** — cadastro com máscaras, telefone/WhatsApp, verificação de duplicidade, ficha com histórico (linha do tempo), botão "Nova ordem de serviço".
- **Ordens de serviço** — numeração automática (`OS-000123`), itens de serviço e peças, desconto, status com cores (Aguardando avaliação → … → Entregue/Cancelado), histórico, pagamentos parciais, baixa automática de estoque, prazo de garantia congelado na entrega.
- **Serviços e produtos** — catálogo oficial (19 serviços, 13 produtos) editável; estoque em livro-razão (entradas, saídas, ajustes) com alerta de estoque baixo; produtos aparecem no site sem preço inventado.
- **Vendas de balcão** — produtos, desconto, pagamento na hora ou depois, cancelamento devolve estoque e estorna pagamentos.
- **Loja virtual** — cada pedido do site vira uma venda (canal “Loja online”): estoque reservado na hora, PIX com confirmação manual, painel de pedidos (confirmar, separar, entregar, concluir, cancelar), avisos e link de acompanhamento para o cliente. Em **Loja online → Produtos da loja** a equipe **adiciona itens** (nome, categoria, preço, estoque e foto) e edita preço, estoque, categoria e visibilidade de vários produtos de uma vez; sem nenhum item com preço e estoque a loja funciona como catálogo (sem carrinho). Ver [Loja virtual](docs/LOJA-VIRTUAL.md).
- **Publicação** — *Configurações → Publicação* mostra, com os dados reais do sistema, o que falta para o site e a loja ficarem prontos (dados da empresa, preços e estoque, PIX, privacidade, demonstração, endereço público, HTTPS, senhas, backup) e o sino avisa enquanto houver passo obrigatório pendente. Inclui **política de privacidade** (modelo LGPD editável, página `/privacidade`).
- **Financeiro** — entradas (pagamentos), custos por categoria, resultado = entradas − custos cadastrados, estornos com motivo.
- **Dashboard e relatórios** — indicadores, gráficos, tabelas; relatórios de entradas, custos, serviços, clientes e financeiro (tela, impressão, **PDF** e **CSV/Excel**).
- **Documentos** — OS/recibo, recibo de pagamento, comprovante de venda e relatórios em **A4 (impressão)** e **PDF** com cabeçalho da empresa, dados do cliente, assinaturas e termos de garantia. Envio ao cliente pelo **WhatsApp com link do PDF** (ver limitações). Vendas de balcão podem **imprimir o comprovante A4 ao registrar**, e cada **pedido novo do site** pode sair impresso em A4 na hora, pela página *Impressão automática* aberta no computador da loja (a janela de impressão do navegador aparece a cada pedido, a menos que o Chrome use `--kiosk-printing`).
- **Busca global** (`/` ou `Ctrl+K`): cliente, telefone, OS-000123 (abre direto), produto, serviço, venda.
- **Notificações internas** — nova OS, aguardando aprovação, serviço pronto, estoque baixo, pagamentos pendentes, OS com prazo próximo/vencido.
- **Usuários e permissões** — perfis de acesso (Administrador, Vendedor/Atendente) e perfis personalizados; senhas com hash, primeiro acesso com troca obrigatória, bloqueio por tentativas.
- **Configurações** — empresa (com política de privacidade), publicação (checklist), horários, formas de pagamento, mensagens de WhatsApp, termos de garantia (versionados), SEO, logo e imagens do site, backup, dados de demonstração.

## Começando

Requisitos: **Node.js 22.12+** e npm.

```bash
npm install
cp .env.example .env        # ajuste se necessário (o padrão funciona localmente)
npm run setup               # cria o banco, aplica o seed oficial e carrega dados de DEMONSTRAÇÃO
npm run dev                 # http://localhost:3000
```

O `npm run setup` imprime as **senhas temporárias** dos usuários iniciais (uma única vez):

| Usuário | Perfil |
|---|---|
| `ewerton` — Ewerton Nunes | Administrador (acesso total) |
| `mario` — Mario Vinicius | Vendedor / Atendente (sem acesso a configurações, usuários, custos e relatórios) |

No primeiro acesso o sistema exige a troca da senha. Esqueceu? `npm run user:reset-password -- ewerton`.

> Para usar de verdade: em **Configurações → Dados e segurança**, clique em **Remover dados de demonstração** (ou rode `npm run db:demo:clear`). Registros de demonstração sempre têm o selo "Demonstração" e nunca mexem no estoque real.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Desenvolvimento, build e servidor de produção |
| `npm run setup` | Migra + seed oficial + demonstração |
| `npm run db:migrate` · `db:seed` | Aplica migrações · dados oficiais (idempotente) |
| `npm run db:demo` · `db:demo:clear` | Carrega · remove dados de demonstração |
| `npm run db:backup` | Cópia consistente do banco em `backups/` |
| `npm run db:reset -- --yes [--demo]` | Recria o banco do zero (**apaga tudo**; local apenas) |
| `npm run user:reset-password -- <usuario>` | Nova senha temporária |
| `npm test` · `npm run typecheck` · `npm run lint` | Testes automatizados · verificação de tipos · ESLint |

## Tecnologia

Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM + libSQL (SQLite local; **Turso** na nuvem) · Zod 4 · PDFKit (PDF) · sharp (imagens) · qrcode (QR do PIX) · lucide-react · CSS próprio (design system em `src/styles`) · Vitest. Sem dependência de serviços externos em tempo de execução; fontes e ícones são hospedados no próprio projeto.

## Documentação

- [Arquitetura](docs/ARQUITETURA.md) — camadas, pastas, fluxos e decisões
- [Banco de dados](docs/BANCO-DE-DADOS.md) — tabelas, relações e convenções
- [Design system](docs/DESIGN-SYSTEM.md) — cores, tipografia, componentes (guia vivo em **Configurações → Guia de estilo**)
- [Publicação (deploy)](docs/DEPLOY.md) — servidor próprio, nuvem (Turso), backups, HTTPS
- [Loja virtual](docs/LOJA-VIRTUAL.md) — regras de preço/estoque, pedidos, PIX, entrega, segurança e modo demonstração
- [Manual do usuário](docs/MANUAL-DO-USUARIO.md) — passo a passo para a equipe
- [Verificação final](docs/VERIFICACAO.md) — checklist de 20 itens com o resultado
- [Log de construção](docs/BUILD-LOG.md) — convenções e progresso

## Segurança (resumo)

Senhas com scrypt + salt (nunca em texto) · sessão em cookie `HttpOnly` + `SameSite=Lax` (o banco guarda só o hash do token) · expiração por inatividade e por tempo máximo · bloqueio após 5 falhas (por usuário) / 30 (por IP) em 15 min · permissões verificadas no servidor em **todas** as páginas, ações e APIs · validação com Zod no servidor · trilha de auditoria · cabeçalhos de segurança e CSP em produção · upload de imagens validado (tipo real, tamanho, reprocessado) · links públicos de PDF com token aleatório e revogáveis.

## Limitações conhecidas (transparência)

- **WhatsApp não anexa o PDF automaticamente.** O WhatsApp (`wa.me`) só permite mensagem pré-preenchida; o sistema gera um **link público do PDF** e o inclui na mensagem. O link só funciona para o cliente depois que o sistema estiver publicado na internet (defina o endereço público em Configurações → Empresa).
- **Logo**: enquanto a empresa não enviar a logo oficial (Configurações → Logo e imagens), o sistema usa o nome em texto como marca provisória. O favicon ("LA") também é provisório.
- **Fotos reais**: o site usa ilustrações técnicas originais até que a empresa envie fotos (imagem principal e galeria).
- **Loja virtual sem cartão/boleto online**: exige contrato com um provedor de pagamentos (credenciais da empresa). A loja oferece **PIX** (a confirmação é manual, pois o sistema não “ouve” o banco) e **pagamento na retirada**. A **entrega** vem desligada (a empresa não informou se entrega peças) e os **preços e o estoque** dos produtos precisam ser cadastrados pela empresa — enquanto isso a loja mostra “valor sob consulta” (ou os preços **fictícios de demonstração**, sempre sinalizados).
- Sem integração fiscal (NF-e) nem e-mail automático — fora do escopo definido.
