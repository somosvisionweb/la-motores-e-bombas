# Design system

Guia **vivo** dentro do sistema: **Configurações → Guia de estilo** (`/sistema/design-system`). Todas as amostras usam os componentes reais e as cores são lidas das variáveis CSS, então o guia nunca fica desatualizado. Este documento resume as regras.

## Identidade

- **Azul escuro** (confiança, técnica) + **verde** (ação positiva, concluído, valores, indicadores).
- Técnico, moderno e confiável — sem aparência de "painel genérico": poucas sombras, hierarquia por borda e cor, ilustrações técnicas originais (motor e bomba em estilo de prancha de engenharia).
- **Site** (comercial, fundos claros, respiro, seções escuras de destaque) e **sistema** (funcional, denso e organizado) compartilham os mesmos tokens e componentes.

## Onde fica

`src/styles/`: `tokens.css` (variáveis) · `base.css` (reset, tipografia, utilitários) · `ui.css` (componentes) · `app.css` (sistema) · `charts.css` · `print.css` (documentos A4) · `site.css` (site). Componentes React em `src/components/ui`, `form`, `charts`.

## Tokens

- **Cores**: `--navy-950…50`, `--green-800…50`, `--gray-950…50`, semânticas (`--color-success/warning/danger/info/primary/brand`), tons de selos (`--tone-*`). Pares de texto/fundo validados em WCAG AA.
- **Tipografia**: títulos *Barlow Semi Condensed* 500/600/700; texto *Inter*; ambas hospedadas no projeto (sem Google Fonts). Números tabulares em valores e tabelas. Moeda sempre `R$ 1.234,56`.
- **Espaçamento**: escala de 4px (`--space-1…24`). **Raios**: 6/8/12/18px. **Sombras**: `--shadow-sm/md/lg`, uso discreto.
- **Movimento**: `--dur-fast/dur/dur-slow` (120/200/360 ms) com `--ease`; respeita `prefers-reduced-motion`.

## Componentes

Botões (principal, institucional, padrão, discreto, perigo, sobre fundo escuro; tamanhos sm/md/lg; ícone) · campos (texto, e-mail, telefone, CPF/CNPJ, moeda, seleção, área de texto, senha, caixa de seleção, busca com autocomplete) · cartões e indicadores (`StatCard` com faixa de cor) · tabelas (ordenáveis, filtros, paginação, empilhadas no celular) · selos (status da OS com 9 cores, forma de pagamento, situação, demonstração) · alertas (info, sucesso, atenção, erro, demonstração) · avisos (toasts) · modal nativo `<dialog>` · menu suspenso · abas e controle segmentado · estado vazio · acompanhamento do fluxo da OS · gráficos de colunas e barras (HTML/CSS).

## Regras de uso

1. **Um botão principal (verde) por tela.** Verde significa algo positivo; nunca use verde para "excluir" ou "erro".
2. **Vermelho** só para erro, estorno e exclusão; **âmbar** para atenção; **azul** para informação e neutralidade.
3. Ações destrutivas **sempre** pedem confirmação (modal) e, quando faz sentido, um motivo.
4. Todo campo tem **rótulo visível**; erros aparecem junto do campo, com texto (não só cor).
5. **Dados de demonstração** sempre carregam o selo "Demonstração" e o aviso no topo do sistema.
6. Gráficos: uma série = uma cor; duas séries = azul e verde (validadas para daltonismo); sempre com tabela equivalente e tooltip acessível por teclado.
7. Tabelas em celular viram cartões (rótulo + valor); colunas secundárias podem sumir em larguras médias (`.col-hide-md`).
8. Impressão A4 usa layout próprio (`print.css`), diferente da tela, e lê os dados da empresa das Configurações.
9. Texto do cliente (garantia, diferencial, headline) **não é reescrito**; alterações de conteúdo institucional acontecem em `src/content/site.ts` ou nas Configurações.

## Acessibilidade

Foco visível em todos os controles · navegação por teclado (menus, modais, autocomplete, gráficos) · `aria-*` em componentes interativos · link para pular ao conteúdo · contraste AA · alvos de toque ≥ 40px · sem animações essenciais.
