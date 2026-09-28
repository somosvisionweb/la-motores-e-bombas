# Manual do usuário — LA Motores e Bombas

Guia rápido para a equipe. Acesse o sistema em **`/login`** (no site, rodapé → *Área restrita*).

## 1. Entrar e sair

1. Digite seu **usuário** e **senha**.
2. No **primeiro acesso** o sistema pede para criar uma senha nova (mínimo 8 caracteres, com letras e números).
3. Para sair: clique no seu nome (canto superior direito) → **Sair**.
4. Errou a senha 5 vezes? Aguarde 15 minutos. Esqueceu a senha? Peça ao administrador: *Usuários → (usuário) → Redefinir senha*.

**Dica:** pressione `/` (ou `Ctrl+K`) em qualquer tela para **buscar** cliente, telefone, produto ou **OS-000123** (abre a ordem direto).

## 2. Clientes

- **Novo cliente**: *Clientes → Novo cliente* (ou atalho no Dashboard). Nome é obrigatório; o telefone é formatado sozinho. Se o telefone já existir, o sistema avisa.
- **Ficha do cliente**: histórico completo (ordens, pagamentos), último serviço e botão **Nova ordem de serviço**. Botão **WhatsApp** abre a conversa.

## 3. Ordem de serviço (OS)

**Criar**: *Nova OS* → escolha o cliente (ou cadastre na hora) → equipamento e problema → adicione **serviços** e **peças** (digite para buscar no cadastro; peças vinculadas dão baixa no estoque sozinhas) → *Criar ordem de serviço*.

**Acompanhar**: a OS mostra o andamento em etapas:

`Aguardando avaliação → Em análise → Orçamento enviado → Aguardando aprovação → Em manutenção → Pronto → Entregue` (e *Aguardando peça* / *Cancelado* quando necessário).

- **Avançar para…** leva à próxima etapa com um clique; **Alterar status** permite escolher qualquer etapa e deixar uma observação.
- **Registrar pagamento**: informe valor (já vem o saldo), forma e data. Pagamentos parciais são permitidos; o saldo restante aparece na OS.
- **Entregar**: se ainda houver saldo, o sistema avisa (você pode entregar e receber depois — ficará como *pendente*). Ao entregar, o **prazo de garantia** passa a valer.
- **Comentários internos** ficam no histórico (não aparecem para o cliente).
- **Cancelar ordem**: devolve as peças ao estoque. Ordens com pagamento exigem estorno antes.

**Documentos** (botão **Documentos** na OS): **Imprimir (folha A4)**, **Gerar/baixar PDF**, **Visualizar PDF** e **Enviar pelo WhatsApp**. O documento traz os dados da empresa, do cliente, o serviço, os valores, as assinaturas e os **termos de garantia**.

> **Envio pelo WhatsApp**: o WhatsApp não permite anexar arquivos automaticamente por link. O sistema abre a conversa com uma mensagem pronta contendo o **link do PDF** (o cliente toca no link para ver/baixar). Para o link funcionar, o sistema precisa estar publicado na internet.

## 4. Vendas de balcão e estoque

- **Nova venda**: escolha os produtos, ajuste quantidade/valor, marque *Receber o pagamento agora* e a forma de pagamento. O estoque baixa sozinho.
- **Imprimir ao registrar**: a caixa **Imprimir o comprovante (A4) ao registrar a venda** (fica ligada; a sua escolha é lembrada neste computador) abre a folha A4 da venda com a janela de impressão assim que você clica em *Registrar venda*. Desmarque se não quiser imprimir — depois ainda dá para imprimir em *Vendas → (venda) → Imprimir*.
- **Cancelar venda**: devolve o estoque e estorna o pagamento.
- **Produtos**: *Produtos → Novo produto* (código automático). **Ajustar estoque** → entrada (compra/reposição), saída ou ajuste para a quantidade contada; tudo fica registrado em *Movimentações*.
- **Estoque mínimo**: defina por produto; quando o saldo chega ao mínimo aparece alerta (sino e Dashboard).
- **Exibir no site**: marque para o produto aparecer no site e na **loja virtual**. Sem preço de venda cadastrado, o site mostra “valor sob consulta” e o cliente fala pelo WhatsApp — nenhum preço é inventado.
- **Vender na loja virtual**: com *preço de venda* e *estoque* cadastrados, o produto já pode ser comprado no site (desmarque para vender só no balcão). Em *Descrição na loja virtual* você escreve o texto que o cliente lê na página do produto.

### Adicionar itens à loja (Produtos da loja)

Menu **Loja online → Produtos da loja** (ou o botão **Adicionar item à loja** no topo da tela de pedidos):

1. **Adicionar item à loja**: preencha *Nome*, *Categoria*, *Preço de venda* e *Estoque* (a foto é opcional) e clique em **Adicionar à loja**. O item já aparece no site: **à venda** se tiver preço e estoque, ou como “valor sob consulta” se o preço ficar em R$ 0,00. Para descrição, código, custo, estoque mínimo e ícone, use **Cadastro completo…**.
2. **Situação de cada produto**: **À venda**, **Sem estoque**, **Sem preço**, **Só consulta** (desmarcado “Vender na loja virtual”) ou **Oculto** (fora do site). Os cartões do topo contam cada situação e o filtro **Situação** lista só os produtos de uma delas; passe o mouse no selo para ver o que fazer.
3. **Edição rápida**: altere direto na tabela a categoria, o preço, o estoque e as caixas *No site* / *Vender online* de vários produtos e clique em **Salvar alterações** (só o que mudou é gravado). No estoque, digite a **quantidade certa** — o sistema registra a diferença no histórico de movimentações.
4. Logado no sistema, você também vê uma **barra de administração** no topo do site (atalhos para Painel, Pedidos, Produtos da loja e Adicionar item) e, na página de cada produto, **Editar este produto**. Visitantes não veem nada disso.

> Enquanto nenhum produto tiver **preço e estoque**, a loja funciona só como **catálogo**: sem carrinho, com o cliente consultando o valor pelo WhatsApp. O carrinho aparece sozinho quando o primeiro item ficar à venda.

### Loja online (pedidos do site)

Menu **Loja online** (o número ao lado mostra os pedidos novos). Cada compra feita no site vira um pedido `LJ-000123` e uma **venda** (canal “Loja online”): o estoque já fica reservado e o valor entra no Financeiro quando o pagamento é confirmado.

1. **Pedido novo** → abra o pedido. Se o cliente escolheu **PIX**, confira no aplicativo do banco e clique **Confirmar pagamento PIX** (o valor entra no financeiro e o pedido vai para *Confirmado*). Se escolheu **pagar na retirada**, clique **Confirmar pedido**.
2. **Marcar pronto** quando os produtos estiverem separados (para entrega: depois **Saiu para entrega**). O botão **Avisar cliente** abre o WhatsApp com o link de acompanhamento.
3. **Concluir**: quando o cliente retira (ou recebe). Se ainda houver saldo, escolha a forma de pagamento recebida — ela é lançada no Financeiro.
4. **Cancelar pedido**: devolve o estoque e estorna pagamentos (pedido já pago exige a permissão de cancelar vendas). O cliente vê o pedido como cancelado.
5. **Observações**: podem ser internas ou “visíveis ao cliente” (aparecem no acompanhamento do pedido).
6. **Imprimir o pedido**: o botão **Imprimir pedido (A4)** (topo do pedido) abre a folha e a janela de impressão. A folha traz o número do pedido, o cliente, **como receber** (retirada ou entrega com endereço e CEP), **o pagamento** (ex.: “PIX — aguardando confirmação”, “Pagar na entrega — a receber”), os produtos, o total e a **observação do cliente** — serve para separar os produtos e para a entrega.

#### Imprimir automaticamente cada pedido novo do site

1. No computador que está ligado à impressora, abra **Loja online → Impressão automática** (abre a página `/imprimir/loja`) e **deixe-a aberta**, de preferência em uma janela só para ela.
2. A cada pedido novo (a página confere a cada 15 segundos) ela imprime **uma folha A4 por pedido**. Se vários chegarem juntos, saem juntos. Pedidos cancelados não são impressos.
3. Use **Imprimir o último pedido (teste)** para conferir a impressora. **Pausar** interrompe e **Retomar** volta. A lista “Impressos nesta sessão” tem **Imprimir de novo**.
4. Pedidos que chegarem com a página **fechada** não são impressos sozinhos: eles aparecem em *Loja online* e você imprime pelo botão do pedido.

> **A janela de impressão vai aparecer a cada pedido**, porque um site não pode mandar imprimir “em silêncio”. Para imprimir direto, sem a janela, use o Chrome com a opção `--kiosk-printing`: (1) deixe a impressora da loja como **padrão do Windows**; (2) crie um atalho do Chrome e, em *Propriedades → Destino*, deixe assim (com o endereço do seu site): `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=https://SEU-SITE/imprimir/loja`; (3) **feche todas as janelas do Chrome** e abra pelo atalho (a opção só vale quando o Chrome é iniciado por ele). Essa configuração depende do computador e da impressora e **não foi testada com impressora física** durante o desenvolvimento — teste com o botão “Imprimir o último pedido (teste)”.

O cliente acompanha tudo por um **link privado** (enviado na confirmação e por WhatsApp). Pedidos com PIX não pagos são cancelados sozinhos no prazo definido em *Configurações → Loja virtual* (padrão 24 h) e o estoque volta; pedidos “pagar na retirada” que ninguém confirmar em 3 vezes esse prazo também.

> **PIX**: o sistema gera o QR Code e o “copia e cola” com a chave da empresa, mas **não sabe sozinho** que o pagamento caiu — a confirmação é manual. Cartão e boleto online **não** estão disponíveis (exigem contrato com um provedor de pagamentos).

## 5. Financeiro *(administrador)*

- **Entradas**: pagamentos de OS e vendas, mais *Nova entrada avulsa* (para o que não é OS nem venda). **Estornar** exige motivo.
- **Custos**: *Novo custo* com descrição, fornecedor, categoria, valor e forma de pagamento. A categoria **Mercadorias** alimenta o card *Custo de mercadorias*.
- **Resultado** = entradas − custos cadastrados. Use os filtros **Hoje, 7 dias, 30 dias, Este mês, Mês anterior** ou um período personalizado.

## 6. Relatórios *(administrador)*

*Relatórios* → escolha entradas, custos, serviços, clientes ou financeiro → período → **Imprimir**, **PDF** ou **Exportar CSV** (abre no Excel).

## 7. Serviços

*Serviços* lista o catálogo (os 19 oficiais já vêm cadastrados). Defina um **preço padrão** para agilizar as ordens e escolha o que aparece no **site**.

## 8. Usuários e permissões *(administrador)*

- **Novo usuário**: nome, login, perfil. O sistema mostra uma **senha temporária uma única vez** — anote e entregue à pessoa.
- **Perfis de acesso**: *Administrador* (tudo) e *Vendedor/Atendente*. Crie perfis personalizados marcando as permissões desejadas.
- Desativar um usuário encerra as sessões dele imediatamente.

## 9. Configurações *(administrador)*

| Aba | Para quê |
|---|---|
| **Empresa** | Nome, CNPJ, WhatsApp, telefone, e-mail, endereço, Instagram, horários, formas de pagamento, endereço público do site e a **política de privacidade** (botão *Usar o modelo pronto*; revise com o contador ou um advogado) |
| **Publicação** | **Checklist do que falta para o site ficar pronto**, calculado com os dados reais: dados da empresa, produtos com preço e estoque, chave PIX, condições e privacidade, remoção da demonstração, endereço público, HTTPS, senhas temporárias e backup. Cada passo tem um botão que leva direto à tela certa; o sino avisa enquanto houver passos obrigatórios pendentes |
| **Logo e imagens do site** | Logo oficial (PNG com fundo transparente é o ideal), foto principal e galeria do site |
| **Loja virtual** | Loja aberta/fechada, **chave PIX**, entrega (taxa, grátis a partir de), aviso de retirada, pedido mínimo, prazo de reserva do estoque, condições da loja (trocas etc.) e o passo a passo “para vender de verdade” |
| **Mensagens WhatsApp** | Textos dos botões do site e da mensagem de envio de OS/recibo e do aviso de pedido da loja (`{{empresa}}`, `{{nome}}`, `{{codigo}}`, `{{link}}`) |
| **Termos de garantia** | Texto que sai no fim de cada OS. Cada salvamento cria uma **nova versão**; documentos já entregues mantêm o texto da época |
| **SEO do site** | Título e descrição que aparecem no Google |
| **Dados e segurança** | Remover dados de demonstração, **baixar backup**, histórico de operações |

Tudo o que você altera aqui aparece na hora no site, nos documentos e nos PDFs.

## 10. Backup

*Configurações → Dados e segurança → Baixar backup agora*. Guarde o arquivo em local seguro. **Recomendado: semanalmente.**

## Problemas comuns

| Situação | O que fazer |
|---|---|
| "Sem permissão" | Seu perfil não libera essa área — fale com o administrador |
| Telefone "já cadastrado" | Abra o cliente existente; se for outra pessoa, marque *Cadastrar mesmo assim* |
| Estoque ficou negativo | Uma OS/venda usou mais peças do que havia; faça um **ajuste de entrada** com a compra correspondente |
| Link do PDF não abre para o cliente | O sistema ainda está só no computador local; publique-o e informe o endereço público em *Configurações → Empresa* |
| Registro com selo "Demonstração" | É dado fictício de exemplo — remova em *Configurações → Dados e segurança* |
| Loja mostra "Loja em demonstração" | Há produtos usando **preço de demonstração** (fictício). Cadastre o preço de venda real em *Produtos* e remova os dados de demonstração |
| Produto aparece "Esgotado" ou "Valor sob consulta" | Falta estoque (esgotado) ou preço de venda (sob consulta). Ajuste em *Loja online → Produtos da loja* |
| A loja não tem carrinho | Nenhum produto tem **preço e estoque** ainda (a loja fica como catálogo). Cadastre em *Loja online → Produtos da loja*; o carrinho aparece sozinho |
| Quero saber o que falta para publicar | *Configurações → Publicação* lista tudo, com o que já está pronto e o que ainda depende da empresa |
| Cliente diz que pagou o PIX e o pedido não mudou | Confira no app do banco e use *Confirmar pagamento PIX* no pedido |
| A impressão automática não imprimiu um pedido | A página *Impressão automática* precisa estar **aberta e sem pausa** no computador da impressora (ela só imprime pedidos que chegam depois que abriu). Pedidos perdidos: imprima pelo botão **Imprimir pedido (A4)** |
| A janela de impressão aparece a cada pedido | É como o navegador funciona. Para imprimir direto, use o atalho do Chrome com `--kiosk-printing` (veja “Imprimir automaticamente cada pedido novo do site”) |
