# Verificação final (checklist de 20 itens)

Como foi verificado: **testes automatizados** (`npm test` — 277 testes, banco temporário), **`npm run typecheck`**, **`npm run lint`** (0 erros/0 avisos), **`next build`** (produção) e **roteiros automatizados em navegador real** (Chrome, emulando desktop, tablet e celular) que exercitam as telas como um usuário — criando, editando, pagando, estornando, imprimindo, trocando permissões — e capturam erros de console, falhas de rede e estouro horizontal de layout.

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | **Todas as páginas abrem** | ✅ | ~50 rotas do sistema + site + impressões varridas em desktop (1440) e celular (390): status 200, sem erro de console e sem rolagem horizontal. Página 404 e de erro amigáveis. |
| 2 | **Todos os formulários funcionam** | ✅ | Clientes (criar/editar/excluir, duplicidade), serviços, produtos (criar/editar/excluir protegido), OS (criar/editar/status/pagamento/comentário), vendas (criar/cancelar), custos e categorias, entradas avulsas e estorno, usuários e perfis, todas as abas de Configurações (empresa, horários, pagamentos, mensagens, termos, SEO, logo, imagens, dados demo). Validações mostram erros por campo. |
| 3 | **Login** | ✅ | Senha errada → mensagem genérica; 5 falhas → bloqueio de 15 min; primeiro acesso exige troca de senha; sair encerra a sessão; rotas e APIs sem sessão → login/401. |
| 4 | **Permissões** | ✅ | Vendedor (perfil real testado no navegador): sem Configurações, Usuários, Custos, Relatórios, visão financeira, backup (403), PDF/CSV de relatórios (403); com OS, vendas, clientes, pagamentos e impressão. Administrador sempre com tudo; perfis personalizados criados/excluídos; último administrador protegido. Regras cobertas por testes. |
| 5 | **Clientes** | ✅ | Cadastro com máscaras, telefone duplicado avisado, ficha com histórico, edição, exclusão só sem histórico. |
| 6 | **Ordens de serviço** | ✅ | Ciclo completo: criar com serviço + peça vinculada ao estoque, pagamento parcial, Pronto, aviso de saldo ao entregar, Entregue, quitação, garantia congelada, notificações, comentários. Testes de regra (datas, estoque idempotente, status). |
| 7 | **Produtos / estoque** | ✅ | Cadastro, ajuste (entrada/saída/contagem), livro-razão, baixa automática por OS/venda, devolução ao cancelar, alerta de estoque baixo, exclusão bloqueada se já usado. Demonstração nunca mexe no estoque. |
| 8 | **Financeiro** | ✅ | Entradas por forma de pagamento, custos por categoria, estorno com motivo, resultado = entradas − custos; estornados e fora do período não entram nas somas (testes). |
| 9 | **Relatórios** | ✅ | Entradas, custos, serviços, clientes e financeiro: tela, impressão, PDF e CSV (UTF-8 com BOM, `;`, vírgula decimal, proteção contra fórmulas). |
| 10 | **PDF** | ✅ | OS/recibo (2 páginas com termos), recibo de pagamento, comprovante de venda e relatórios gerados e conferidos visualmente; cabeçalho da empresa, CNPJ, cliente, serviço, valores, assinaturas e rodapé com paginação. Texto dos termos idêntico ao fornecido, com prazo por extenso ("3 (três) meses"). |
| 11 | **Impressão A4** | ✅ | Páginas `/imprimir/...` com layout próprio de impressão (diferente da tela), 2 páginas para OS com termos, conferidas via "imprimir em PDF" do navegador. |
| 12 | **Responsividade** | ✅ | Site de 320 a 1920 px sem estouro; menu em gaveta abaixo de 1240 px; sistema com tabelas que viram cartões, colunas secundárias que somem em larguras médias e menu lateral em gaveta. |
| 13 | **Links do WhatsApp** | ✅ | 44 links no site com número oficial e mensagem pré-preenchida (atendimento, orçamento, domicílio, geral, por serviço e por produto); mensagens editáveis em Configurações e refletidas na hora. Envio de OS/recibo: mensagem com link do PDF (limitação abaixo). |
| 14 | **Dados da empresa** | ✅ | CNPJ, e-mail, WhatsApp, endereço, Instagram, horários e formas de pagamento conferidos por teste automatizado contra o cadastro oficial e lidos das Configurações (site, documentos e PDFs). Alterar horário/mensagem/SEO/logo aparece imediatamente. |
| 15 | **Console do navegador** | ✅ | Sem erros/avisos nas páginas varridas (desenvolvimento e produção com CSP ativa). |
| 16 | **Erros no backend** | ✅ | Sem exceções nas execuções; `next build` conclui; erros de negócio viram mensagens em português; rotas inexistentes/documentos inválidos → 404. |
| 17 | **Banco de dados** | ✅ | 25 tabelas com chaves e índices; migração + seed idempotentes; escrita serializada em transação; integridade e regras cobertas por testes de integração; backup (VACUUM INTO) verificado. |
| 18 | **Segurança** | ✅ | Senhas scrypt com salt; sessão em cookie HttpOnly/SameSite/Secure (produção) guardando só o hash do token; bloqueio por tentativas; validação Zod no servidor; guardas em todas as páginas/ações/APIs (auditado); CSP, HSTS e demais cabeçalhos; upload validado (tipo real, tamanho, reprocessado); links de PDF com token de 256 bits e revogáveis; CSV sem injeção de fórmulas; auditoria. |
| 19 | **Mobile** | ✅ | Site e sistema verificados em 390, 360 e 320 px: gaveta de menu, formulários, tabelas empilhadas, gráficos com rótulos legíveis, modais e botões com alvo de toque adequado. |
| 20 | **Nada fictício apresentado como real** | ✅ | Site usa somente dados oficiais e o catálogo oficial (19 serviços, 13 produtos, sem preços). Sem depoimentos, avaliações, anos de experiência, certificações ou equipe inventados. Ilustrações do site são identificadas como ilustrações técnicas; logo e favicon são provisórios (nenhuma logo foi inventada). Dados de demonstração têm o selo "Demonstração", prefixo "[DEMO]", telefones inexistentes e aviso permanente, e nunca alteram estoque. Na loja virtual, produto sem preço aparece como "valor sob consulta" (nenhum preço é inventado); os preços fictícios de demonstração ficam em coluna própria (`demo_price_cents`), aparecem sempre com o aviso "Loja em demonstração" e somem com os demais dados de demonstração. |

## Loja virtual (verificação adicional)

Detalhes de funcionamento em [LOJA-VIRTUAL](LOJA-VIRTUAL.md).

| Verificação | Resultado |
|---|---|
| **Testes automatizados** (70 novos) | ✅ Código PIX (CRC, campos EMV, chaves), regras de preço/estoque/demonstração, carrinho, pedido em transação única (estoque insuficiente não grava nada), entrega e taxa, limites por IP/telefone/IP desconhecido, vínculo com clientes, fluxo de status, pagamento (PIX e na retirada), cancelamento (estoque, estorno, sincronia com Vendas), expiração de pedidos abandonados, busca global, comprovante com o nome do comprador, permissões, migração e limpeza da demonstração. |
| **Navegador real (Chrome)** | ✅ Catálogo, produto, carrinho, checkout e acompanhamento em 320, 375, 897 e 1440 px (e o painel/configurações em 390 e 897 px) **sem estouro horizontal**; adicionar ao carrinho, gaveta do carrinho (Esc, foco, `inert`), quantidades, problemas de estoque + “Corrigir carrinho”; checkout com erro por campo (retirada e entrega); pedido com **PIX de demonstração** e com **PIX real** (CRC válido, QR carregado com a CSP de produção); painel: confirmar PIX, marcar pronto, salvar configurações; **vendedor** vê “Loja online” (com o selo de pedidos novos) e não vê as configurações da loja; loja **fechada** (volta ao modo “consultar pelo WhatsApp”). |
| **Produção** | ✅ `next build` conclui; servidor de produção (CSP ativa) sem erros de console no fluxo completo de compra. |
| **Atualização de banco existente** | ✅ Migração `0001_store` aplicada em cópia do banco atual: tabelas novas, colunas com padrão, vendas antigas como “balcão”, perfil Vendedor recebe as permissões da loja (idempotente). |
| **Segurança do checkout público** | ✅ Preço e estoque decididos no servidor; campo-isca + tempo mínimo; limites por IP e telefone; token de 256 bits; `noindex`; saída escapada. |

## Itens da loja, publicação e privacidade (verificação adicional)

Detalhes em [LOJA-VIRTUAL](LOJA-VIRTUAL.md) (seções “Gerenciar os itens da loja”, “Modo catálogo” e “Privacidade”).

| Verificação | Resultado |
|---|---|
| **Testes automatizados** (41 novos: 227 → 268) | ✅ Situação do produto na loja (ordem de prioridade e SQL = memória), cadastro rápido (validações), edição rápida (só grava o que mudou, estoque **relativo** que não desfaz vendas, lote atômico, histórico e auditoria), filtros/contadores/paginação, modo catálogo, checklist de publicação (cada passo muda sozinho com o dado real; obrigatórios × recomendados; loja fechada; alerta do sino), texto e modelo da política de privacidade (dados oficiais, sem HTML livre, sem prometer o que o sistema não faz). |
| **Navegador real** (banco limpo, sem demonstração) | ✅ **Adicionar item** (linha nova, aviso, formulário limpo), **edição rápida** de vários itens (mensagem de sucesso, situações e contadores atualizados, preços reais na loja e carrinho aparecendo sozinho), barra de administração no site (só logado), checklist **Publicação** com os passos reais pendentes, política de privacidade (modelo com os dados oficiais → salvar → `/privacidade`, link no rodapé, aviso no checkout com abertura em nova aba, entrada no `sitemap.xml`, passo do checklist concluído). |
| **Celular (375 px)** | ✅ `/privacidade`, o cartão de privacidade, *Publicação* e *Produtos da loja* sem rolagem horizontal (um botão largo demais foi encurtado). |
| **Produção** | ✅ `npm run typecheck`, `npm run lint` (0 avisos) e `next build` concluem com as novas rotas (`/privacidade`, `/sistema/loja/produtos`, `/sistema/configuracoes/publicacao`). |
| **Atualização de banco existente** | ✅ Migração `0002_privacy` (uma coluna nova, nula) aplicada no banco do projeto depois de um backup; nada é perdido. |

## Impressão A4 ao finalizar a venda (verificação adicional)

Detalhes em [LOJA-VIRTUAL](LOJA-VIRTUAL.md) (seção “Imprimir os pedidos”) e no [Manual do usuário](MANUAL-DO-USUARIO.md).

| Verificação | Resultado |
|---|---|
| **Testes automatizados** (9 novos: 268 → 277) | ✅ Documento do pedido (código LJ, como receber, endereço com CEP, pagamento “aguardando/pago/a receber”, situação, e-mail e observação do cliente; cancelado e demonstração marcados; venda de balcão inalterada), folha HTML (endereço só uma vez) e PDF do mesmo modelo, fila de pedidos novos (ordem, limite, cancelados ignorados mas contados no avanço, “último pedido” para teste). |
| **Navegador real** (banco descartável) | ✅ **Balcão**: registrar venda com a caixa ligada abre `/imprimir/venda/<id>?auto=1` e aciona a impressão uma vez; a escolha da caixa fica guardada após recarregar. **Estação** (`/imprimir/loja`): pedido novo impresso em até um ciclo de consulta; dois pedidos juntos saem em **um** trabalho com duas folhas; entrega mostra endereço, CEP, e-mail, observação e taxa; pausar não imprime e retomar imprime; recarregar a página não reimprime; “imprimir o último pedido (teste)” não move o ponteiro; API responde 400 (parâmetro inválido), 200 sem cache e 401 sem sessão. A folha do pedido conferida em tela e as regras de `@media print` presentes. No celular (375 px) a estação, *Loja online*, *Nova venda* e a tela do pedido não têm rolagem horizontal (a folha A4 em si rola na horizontal em telas pequenas, por projeto). |
| **Produção** | ✅ `npm run typecheck`, `npm run lint` (0 avisos) e `next build` concluem com as novas rotas. |

**Não verificado:** a impressão em **impressora física** (nos testes a chamada `window.print()` foi interceptada) e o modo `--kiosk-printing` do Chrome — dependem do computador e da impressora da loja. Sem esse modo, a janela de impressão do navegador abre a cada pedido.

## Limitações e pendências (transparência)

- **Impressão automática**: só funciona com a página *Impressão automática* aberta no computador da loja (pedidos que chegam com ela fechada não são impressos sozinhos) e mostra a janela de impressão do navegador a cada pedido, salvo com `--kiosk-printing`.
- **Política de privacidade**: o texto é um **modelo geral**. Ele descreve o que o sistema coleta, mas **não substitui a revisão de um contador/advogado**; a empresa deve conferi-lo e ajustá-lo antes de publicar.

- **Loja virtual**: sem cartão/boleto online (exige provedor de pagamentos e credenciais da empresa); o **PIX é confirmado manualmente**; a **entrega** vem desligada; preços e estoque reais precisam ser cadastrados (até lá a loja mostra “valor sob consulta” ou os preços fictícios de demonstração, sempre sinalizados).

- **PDF no WhatsApp**: o WhatsApp não permite anexar arquivo por link. O sistema gera o PDF, cria um link seguro e o inclui na mensagem; também há "Baixar PDF" e "Compartilhar PDF" (em aparelhos compatíveis). O link só abre para o cliente após publicar o sistema na internet com o endereço público configurado.
- **Logo e fotos**: aguardam o material real da empresa (envio em *Configurações → Logo e imagens do site*). Até lá: marca tipográfica provisória e ilustrações técnicas.
- **Preços**: serviços e produtos foram cadastrados sem valores (a empresa define). O site não exibe preços.
- **Publicação**: exige domínio + HTTPS (ver [DEPLOY](DEPLOY.md)). Em `localhost` o site sai com `noindex` de propósito.
- **Dependências**: `npm audit` acusa avisos moderados apenas na ferramenta de desenvolvimento `drizzle-kit` (não afeta o sistema publicado).
