# Publicação (deploy)

O sistema é um único aplicativo Node.js. Há dois caminhos recomendados:

| | **A) Servidor próprio (VPS)** | **B) Nuvem serverless + Turso** |
|---|---|---|
| Banco | Arquivo SQLite em disco persistente | Turso (libSQL) |
| Onde | VPS/servidor Linux ou Windows com Node 22+ | Vercel, Netlify, Render… |
| Prós | Mais simples e barato; dados na sua máquina | Sem servidor para cuidar |
| Atenção | Disco persistente + backup semanal | Disco local **não** persiste: use Turso |

> **HTTPS é obrigatório em produção.** O cookie de sessão é marcado `Secure`; sem HTTPS o login não funciona (exceto em `localhost`).

## Variáveis de ambiente

| Variável | Para quê | Padrão |
|---|---|---|
| `DATABASE_URL` | `file:./data/la-motores.db` (SQLite) ou `libsql://SEU-BANCO.turso.io` | arquivo local |
| `DATABASE_AUTH_TOKEN` | Token do Turso (só nuvem) | — |
| `APP_URL` | Endereço público (`https://www.seudominio.com.br`) — links de PDF e SEO | detecta pelo host |
| `AUTO_MIGRATE` | Aplica migrações ao iniciar | `true` |
| `SESSION_IDLE_HOURS` · `SESSION_MAX_DAYS` | Expiração da sessão | `12` · `7` |
| `BACKUP_DIR` | Pasta de `npm run db:backup` | `backups` |

O endereço público também pode ser definido no sistema: **Configurações → Empresa → Endereço público**. Sem ele (e sem `APP_URL`), o site usa o próprio host da requisição e, em `localhost`, sai com `noindex`.

## A) Servidor próprio (passo a passo)

1. **Instale o Node.js 22.12+** e clone/copie o projeto.
2. **Configure**: `cp .env.example .env` e ajuste `APP_URL`.
3. **Instale e compile**:
   ```bash
   npm ci
   npm run build
   ```
4. **Crie o banco (primeira vez)** — *sem* dados de demonstração:
   ```bash
   npm run db:migrate
   npm run db:seed        # imprime as senhas temporárias de ewerton e mario (uma única vez — anote)
   ```
5. **Inicie**: `npm start` (porta 3000; mude com `PORT=8080 npm start`). Mantenha rodando com **PM2** (`pm2 start npm --name la-motores -- start`) ou **systemd**.
6. **HTTPS**: coloque um proxy reverso (Caddy é o mais simples) na frente, encaminhando `Host` e `X-Forwarded-Proto`:
   ```
   www.seudominio.com.br {
     reverse_proxy localhost:3000
   }
   ```
7. **Backup**: agende `npm run db:backup` (semanal ou diário) e copie a pasta `backups/` para outro lugar (nuvem/HD externo). O administrador também baixa um backup em *Configurações → Dados e segurança*.

### Atualizar para uma nova versão

> A versão com **loja virtual** traz a migração `0001_store`: cria as tabelas da loja, acrescenta colunas em `products`, `sales` e `sale_items` (vendas antigas ficam como “balcão”) e libera as permissões da loja ao perfil *Vendedor / Atendente* já existente. A migração `0002_privacy` acrescenta a coluna `company_settings.privacy_text` (política de privacidade, vazia até a empresa escrever). Ambas são aplicadas sozinhas na inicialização; faça um **backup antes**.

```bash
git pull            # ou copie os arquivos novos
npm ci
npm run build
# reinicie o processo (pm2 restart la-motores) — as migrações são aplicadas na inicialização
```

## B) Nuvem serverless + Turso

1. Crie um banco no [Turso](https://turso.tech) e gere o token (`turso db create`, `turso db tokens create`).
2. Rode as migrações e o seed **uma vez** apontando para o Turso (na sua máquina):
   ```bash
   DATABASE_URL=libsql://SEU-BANCO.turso.io DATABASE_AUTH_TOKEN=... npm run db:migrate
   DATABASE_URL=libsql://SEU-BANCO.turso.io DATABASE_AUTH_TOKEN=... npm run db:seed
   ```
3. No provedor (Vercel etc.) importe o repositório e configure `DATABASE_URL`, `DATABASE_AUTH_TOKEN` e `APP_URL`. Comando de build: `npm run build`.
4. As fontes usadas nos PDFs e as migrações já são incluídas no pacote (`outputFileTracingIncludes` em `next.config.ts`).

## Checklist de publicação

> O sistema tem o mesmo checklist **calculado com os dados reais**: *Configurações → Publicação* (o sino do administrador avisa enquanto houver passo obrigatório pendente). Os itens abaixo que dependem do servidor (domínio, HTTPS, backup agendado) o sistema só consegue inferir — o restante ele confere sozinho.

- [ ] Domínio apontado e **HTTPS** ativo
- [ ] `APP_URL` (ou *Configurações → Empresa → Endereço público*) com o domínio real
- [ ] Banco criado **sem** dados de demonstração (`db:migrate` + `db:seed`; se já carregou, *Remover dados de demonstração*)
- [ ] Senhas temporárias trocadas no primeiro acesso (ewerton e mario)
- [ ] Logo oficial enviada (*Configurações → Logo e imagens do site*) e, se houver, fotos reais
- [ ] Preços de serviços e produtos cadastrados (produto sem preço aparece como “valor sob consulta” e o cliente fala pelo WhatsApp)
- [ ] **Loja virtual** (*Loja online → Produtos da loja* e *Configurações → Loja virtual*): preço e estoque dos produtos, chave PIX, entrega (só se a empresa entregar) e condições da loja; **remover os dados de demonstração** (sem isso a loja exibe o aviso “Loja em demonstração”). Sem nenhum produto com preço e estoque a loja funciona como catálogo (sem carrinho)
- [ ] **Política de privacidade** (*Configurações → Empresa*): usar o modelo pronto, **revisar com o contador/advogado** e salvar — publica `/privacidade` e o link no rodapé e no checkout
- [ ] Fazer um **pedido de teste** de ponta a ponta com o domínio real (PIX de valor baixo, confirmar, concluir e cancelar/estornar)
- [ ] Conferir SEO (*Configurações → SEO do site*) e enviar `https://SEU-DOMINIO/sitemap.xml` ao Google Search Console
- [ ] Backup agendado e testado (restaurar em outra máquina)
- [ ] Testar o envio de PDF pelo WhatsApp com o domínio real

## Exemplo de Dockerfile (não testado neste ambiente)

> Escrito como ponto de partida — o Docker não estava disponível durante o desenvolvimento, então valide antes de usar.

```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000 DATABASE_URL=file:/data/la-motores.db
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
```

Monte um volume em `/data` para o banco e faça backup dele.

## Segurança em produção

- Cabeçalhos ativos: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- `robots.txt` bloqueia `/sistema`, `/imprimir`, `/api`, `/d`, `/login`, carrinho, checkout e acompanhamento de pedidos (`/loja/pedido/…`) para buscadores; essas páginas também saem com `noindex`.
- **Loja virtual atrás de proxy**: o limite de pedidos por aparelho usa o IP de `X-Forwarded-For`. Configure o proxy reverso para **substituir** esse cabeçalho (o Caddy já faz isso). Sem IP conhecido (Node exposto direto, sem proxy) vale um teto geral de 60 pedidos por hora para todos; um cliente que forje o cabeçalho pode burlar o limite por aparelho — o limite por telefone, o bloqueio de robôs e a expiração de pedidos abandonados continuam valendo.
- O IP do comprador fica guardado no pedido apenas para limitar abusos (LGPD: o modelo de política de privacidade do sistema já informa isso — publique-o em *Configurações → Empresa*).
- Nunca versione o arquivo `.env` nem a pasta `data/` (já estão no `.gitignore`).
- Esqueceu a senha do administrador? No servidor: `npm run user:reset-password -- ewerton`.
