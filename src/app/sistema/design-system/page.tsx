import { Banknote, ClipboardList, Plus, Printer, RefreshCw, Search, Trash2, Wallet } from 'lucide-react';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { formatCompactBRL } from '@/components/charts/scale';
import { CheckboxField, DocumentField, MoneyField, PasswordField, PhoneField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { NAV_ICONS } from '@/components/system/nav-icons';
import { MenuDemo, ModalDemo, TokenSwatches, ToastDemo } from '@/components/system/design/DesignSystemDemos';
import { Alert } from '@/components/ui/Alert';
import { Badge, DemoBadge, MethodBadge, PaymentStateBadge, StatusBadge } from '@/components/ui/Badge';
import { MotorBlueprint, PumpBlueprint } from '@/components/ui/Blueprints';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InstagramIcon, WhatsAppIcon } from '@/components/ui/brand-icons';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { Segmented, Tabs } from '@/components/ui/Tabs';
import { StatCard } from '@/components/ui/StatCard';
import { OrderStepper } from '@/components/ui/Stepper';
import { ORDER_STATUS_KEYS } from '@/config/order-status';
import { PRODUCT_ICONS } from '@/config/product-icons';
import { formatBRL } from '@/lib/money';
import { requirePagePermission } from '@/server/auth/session';

export const metadata = { title: 'Guia de estilo' };

const NAVY = ['--navy-950', '--navy-900', '--navy-800', '--navy-700', '--navy-600', '--navy-500', '--navy-400', '--navy-300', '--navy-200', '--navy-100', '--navy-50'];
const GREEN = ['--green-800', '--green-700', '--green-600', '--green-500', '--green-400', '--green-300', '--green-200', '--green-100', '--green-50'];
const GRAY = ['--gray-950', '--gray-800', '--gray-700', '--gray-600', '--gray-500', '--gray-400', '--gray-300', '--gray-200', '--gray-100', '--gray-50'];
const SEMANTIC = ['--color-success', '--color-warning', '--color-danger', '--color-info', '--color-primary', '--color-brand'];
const SPACES = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-6', '--space-8', '--space-12', '--space-16'];
const RADII = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'];
const TONES = ['slate', 'blue', 'violet', 'amber', 'cyan', 'orange', 'teal', 'green', 'red'] as const;

const SAMPLE_DAYS = ['01/09', '02/09', '03/09', '04/09', '05/09', '06/09', '07/09', '08/09', '09/09', '10/09'];
const SAMPLE_INCOME = [0, 18000, 25000, 0, 32000, 14000, 0, 41000, 22000, 9000];
const SAMPLE_COST = [12000, 0, 8000, 0, 0, 26000, 0, 9000, 0, 15000];

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card id={id}>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        <div className="stack" style={{ ['--gap' as string]: '20px' }}>
          {children}
        </div>
      </CardBody>
    </Card>
  );
}

function Specimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="ds-label">{label}</p>
      {children}
    </div>
  );
}

export default async function DesignSystemPage() {
  await requirePagePermission('settings.manage');

  return (
    <>
      <PageHeader
        title="Guia de estilo"
        subtitle="Design system do sistema e do site: cores, tipografia, componentes e regras de uso. Todas as amostras usam os componentes reais."
      />

      <nav className="ds-toc" aria-label="Seções do guia">
        {[
          ['cores', 'Cores'],
          ['tipografia', 'Tipografia'],
          ['espacos', 'Espaços e formas'],
          ['botoes', 'Botões'],
          ['campos', 'Campos'],
          ['cartoes', 'Cartões'],
          ['tabelas', 'Tabelas'],
          ['badges', 'Selos'],
          ['alertas', 'Alertas e avisos'],
          ['sobreposicao', 'Modal e menu'],
          ['navegacao', 'Abas'],
          ['icones', 'Ícones'],
          ['graficos', 'Gráficos'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Section id="cores" title="Cores" subtitle="Azul escuro = confiança e técnica. Verde = ação positiva, concluído, valores e indicadores.">
          <Specimen label="Azul da marca">
            <TokenSwatches tokens={NAVY} />
          </Specimen>
          <Specimen label="Verde de destaque">
            <TokenSwatches tokens={GREEN} />
          </Specimen>
          <Specimen label="Neutros">
            <TokenSwatches tokens={GRAY} />
          </Specimen>
          <Specimen label="Semânticas">
            <TokenSwatches tokens={SEMANTIC} />
          </Specimen>
          <p className="text-muted">
            Regras: verde só para ações positivas (botão principal, “concluído”, valores recebidos); vermelho só para erro/estorno/exclusão; âmbar para atenção. Texto sobre fundo escuro usa branco; sobre verde, azul-marinho. Todos os pares
            de texto e fundo usados nos componentes atendem ao contraste WCAG AA.
          </p>
        </Section>

        <Section id="tipografia" title="Tipografia" subtitle="Títulos em Barlow Semi Condensed (técnica e compacta); textos em Inter (legível em tela e impressão). Fontes hospedadas no próprio sistema.">
          <div className="ds-type">
            <h1>Título 1 — Seu equipamento parado</h1>
            <h2>Título 2 — Ordens de serviço</h2>
            <h3>Título 3 — Dados do cliente</h3>
            <h4>Título 4 — Observações</h4>
            <p style={{ fontSize: 'var(--text-md)' }}>Texto padrão (Inter 16px): manutenção, conserto e rebobinamento de motores elétricos e bombas.</p>
            <p>Texto base (15px): usado em formulários, tabelas e descrições.</p>
            <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
              Texto auxiliar (13px): dicas, legendas e metadados.
            </p>
            <p className="mono">OS-000123 · REC-000045 · código em fonte monoespaçada</p>
            <p className="tabular" style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              {formatBRL(123456)} <span className="text-muted" style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>números tabulares, sempre em R$ com vírgula</span>
            </p>
          </div>
        </Section>

        <Section id="espacos" title="Espaços e formas" subtitle="Escala de 4px. Sombras discretas: hierarquia por borda e cor, não por sombra pesada.">
          <Specimen label="Espaçamento">
            <ul className="ds-spaces">
              {SPACES.map((space) => (
                <li key={space}>
                  <span style={{ width: `var(${space})` }} />
                  <code>{space}</code>
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen label="Raio de borda">
            <ul className="ds-radii">
              {RADII.map((radius) => (
                <li key={radius}>
                  <span style={{ borderRadius: `var(${radius})` }} />
                  <code>{radius}</code>
                </li>
              ))}
            </ul>
          </Specimen>
        </Section>

        <Section id="botoes" title="Botões" subtitle="Um botão principal (verde) por tela. Ações destrutivas sempre pedem confirmação.">
          <Specimen label="Variações">
            <div className="cluster">
              <button type="button" className="btn btn--primary">
                <Plus aria-hidden="true" /> Principal
              </button>
              <button type="button" className="btn btn--brand">
                Institucional
              </button>
              <button type="button" className="btn">
                Padrão
              </button>
              <button type="button" className="btn btn--ghost">
                Discreto
              </button>
              <button type="button" className="btn btn--danger-soft">
                <Trash2 aria-hidden="true" /> Excluir
              </button>
              <button type="button" className="btn btn--danger">
                Confirmar exclusão
              </button>
              <span className="ds-on-dark">
                <button type="button" className="btn btn--on-dark">
                  Sobre fundo escuro
                </button>
              </span>
            </div>
          </Specimen>
          <Specimen label="Tamanhos e estados">
            <div className="cluster">
              <button type="button" className="btn btn--primary btn--sm">
                Pequeno
              </button>
              <button type="button" className="btn btn--primary">
                Médio
              </button>
              <button type="button" className="btn btn--primary btn--lg">
                Grande
              </button>
              <button type="button" className="btn btn--icon" aria-label="Imprimir">
                <Printer aria-hidden="true" />
              </button>
              <button type="button" className="btn btn--primary" disabled>
                Desabilitado
              </button>
            </div>
          </Specimen>
        </Section>

        <Section id="campos" title="Campos de formulário" subtitle="Rótulo sempre visível, dica abaixo, erro em vermelho com ícone e texto. Máscaras: telefone, CPF/CNPJ e moeda (R$).">
          <div className="form-grid">
            <TextField className="col-4" name="ds-text" label="Texto" placeholder="Nome do cliente" hint="Dica: aparece abaixo do campo." />
            <TextField className="col-4" name="ds-required" label="Obrigatório" required defaultValue="Preenchido" />
            <TextField className="col-4" name="ds-error" label="Com erro" error="Informe um valor válido." defaultValue="abc" />
            <PhoneField className="col-4" name="ds-phone" label="Telefone" defaultValue="81996405805" />
            <DocumentField className="col-4" name="ds-doc" label="CPF / CNPJ" defaultValue="31127662000150" />
            <MoneyField className="col-4" name="ds-money" label="Valor (centavos)" defaultCents={123456} />
            <SelectField
              className="col-4"
              name="ds-select"
              label="Seleção"
              defaultValue="PIX"
              options={[
                { value: 'PIX', label: 'PIX' },
                { value: 'DINHEIRO', label: 'Dinheiro' },
              ]}
            />
            <PasswordField className="col-4" name="ds-pass" label="Senha" autoComplete="new-password" />
            <TextField className="col-4" name="ds-disabled" label="Desabilitado" disabled defaultValue="Somente leitura" />
            <TextareaField className="col-12" name="ds-area" label="Texto longo" rows={2} placeholder="Observações…" />
            <div className="col-12">
              <CheckboxField name="ds-check" label="Caixa de seleção" defaultChecked />
            </div>
          </div>
        </Section>

        <Section id="cartoes" title="Cartões e indicadores" subtitle="Indicadores com faixa de cor: verde = entradas/positivo, azul = neutro, vermelho = atenção.">
          <div className="grid grid--3">
            <StatCard label="Entradas" value={<Money cents={259000} />} meta="13 pagamento(s) · 30 dias" icon={<Wallet />} accent="green" />
            <StatCard label="Custos" value={<Money cents={170000} />} meta="12 lançamento(s)" icon={<Banknote />} accent="navy" />
            <StatCard label="Pendências" value="3" meta="pagamentos em aberto" icon={<ClipboardList />} accent="red" />
          </div>
          <Card>
            <CardHeader title="Título do cartão" subtitle="Subtítulo explicativo" actions={<button className="btn btn--sm">Ação</button>} />
            <CardBody>Conteúdo do cartão. Cartões agrupam informações relacionadas, com borda fina e cantos de 12px.</CardBody>
          </Card>
          <Card>
            <EmptyState icon={<Search size={26} aria-hidden="true" />} title="Estado vazio" action={<button className="btn btn--primary btn--sm">Criar primeiro registro</button>}>
              Sempre explique o que fazer em seguida quando não houver dados.
            </EmptyState>
          </Card>
        </Section>

        <Section id="tabelas" title="Tabelas" subtitle="Ordenação por cabeçalho, filtros e paginação. Em telas estreitas a tabela vira cartões empilhados; colunas menos importantes somem em larguras médias.">
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">OS</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Status</th>
                  <th scope="col">Pagamento</th>
                  <th scope="col" className="num">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell-primary" data-label="">
                    <span className="code-tag">OS-000123</span> <DemoBadge />
                  </td>
                  <td data-label="Cliente">
                    Nome do cliente <span className="cell-sub">Motor elétrico 1/2 cv</span>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status="EM_MANUTENCAO" />
                  </td>
                  <td data-label="Pagamento">
                    <PaymentStateBadge total={25000} paid={10000} />
                  </td>
                  <td className="num" data-label="Total">
                    <Money cents={25000} />
                  </td>
                </tr>
                <tr>
                  <td className="cell-primary" data-label="">
                    <span className="code-tag">OS-000124</span>
                  </td>
                  <td data-label="Cliente">Outro cliente</td>
                  <td data-label="Status">
                    <StatusBadge status="ENTREGUE" />
                  </td>
                  <td data-label="Pagamento">
                    <PaymentStateBadge total={18000} paid={18000} />
                  </td>
                  <td className="num" data-label="Total">
                    <Money cents={18000} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="badges" title="Selos (badges)" subtitle="Cada status da OS tem cor própria; formas de pagamento e situação também. Demonstração é sempre identificada.">
          <Specimen label="Status da ordem de serviço">
            <div className="cluster">
              {ORDER_STATUS_KEYS.map((status) => (
                <StatusBadge key={status} status={status} />
              ))}
            </div>
          </Specimen>
          <Specimen label="Formas de pagamento e situação">
            <div className="cluster">
              <MethodBadge method="PIX" />
              <MethodBadge method="DINHEIRO" />
              <MethodBadge method="CARTAO" />
              <MethodBadge method="BOLETO" />
              <PaymentStateBadge total={100} paid={100} />
              <PaymentStateBadge total={100} paid={40} />
              <PaymentStateBadge total={100} paid={0} />
              <DemoBadge />
            </div>
          </Specimen>
          <Specimen label="Tons disponíveis">
            <div className="cluster">
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone} dot>
                  {tone}
                </Badge>
              ))}
            </div>
          </Specimen>
          <Specimen label="Fluxo da OS (acompanhamento)">
            <OrderStepper status="EM_MANUTENCAO" />
          </Specimen>
        </Section>

        <Section id="alertas" title="Alertas e avisos" subtitle="Alertas ficam na página; avisos (toasts) confirmam uma ação e somem sozinhos.">
          <Alert variant="info" title="Informação">
            Mensagem neutra para orientar o usuário.
          </Alert>
          <Alert variant="success" title="Sucesso">
            Ação concluída.
          </Alert>
          <Alert variant="warning" title="Atenção">
            Algo precisa ser revisado antes de continuar.
          </Alert>
          <Alert variant="danger" title="Erro">
            Não foi possível concluir. Corrija os campos destacados.
          </Alert>
          <Alert variant="demo" title="Dados de DEMONSTRAÇÃO no sistema">
            Registros fictícios sempre são identificados e nunca se misturam aos dados reais.
          </Alert>
          <Specimen label="Avisos (toasts) — clique para ver">
            <ToastDemo />
          </Specimen>
        </Section>

        <Section id="sobreposicao" title="Modal e menu suspenso" subtitle="Modal para confirmações e formulários curtos; menu para ações secundárias.">
          <div className="cluster">
            <ModalDemo />
            <MenuDemo />
          </div>
        </Section>

        <Section id="navegacao" title="Abas e filtros" subtitle="Abas mudam de página; o controle segmentado filtra a mesma lista.">
          <Tabs
            label="Exemplo de abas"
            items={[
              { href: '#navegacao', label: 'Visão geral', active: true },
              { href: '#navegacao-entradas', label: 'Entradas', active: false },
              { href: '#navegacao-custos', label: 'Custos', active: false },
            ]}
          />
          <Segmented
            label="Exemplo de filtro"
            items={[
              { href: '#filtro-hoje', label: 'Hoje', active: false },
              { href: '#filtro-30', label: '30 dias', active: true },
              { href: '#filtro-mes', label: 'Este mês', active: false },
            ]}
          />
        </Section>

        <Section id="icones" title="Ícones" subtitle="Ícones de linha (lucide) com 18–20px; ícones técnicos e ilustrações são originais da marca.">
          <Specimen label="Menu do sistema">
            <ul className="ds-icons">
              {Object.entries(NAV_ICONS).map(([name, Icon]) => (
                <li key={name}>
                  <Icon aria-hidden="true" />
                  <code>{name}</code>
                </li>
              ))}
              <li>
                <RefreshCw aria-hidden="true" />
                <code>status</code>
              </li>
              <li>
                <WhatsAppIcon aria-hidden="true" />
                <code>whatsapp</code>
              </li>
              <li>
                <InstagramIcon aria-hidden="true" />
                <code>instagram</code>
              </li>
            </ul>
          </Specimen>
          <Specimen label="Ícones técnicos dos produtos">
            <ul className="ds-icons">
              {PRODUCT_ICONS.map((icon) => (
                <li key={icon.key}>
                  <ProductIcon iconKey={icon.key} size={36} />
                  <code>{icon.key}</code>
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen label="Ilustrações técnicas (site e login)">
            <div className="ds-blueprints">
              <div className="ds-on-dark">
                <MotorBlueprint />
              </div>
              <div className="ds-on-dark">
                <PumpBlueprint />
              </div>
            </div>
          </Specimen>
        </Section>

        <Section id="graficos" title="Gráficos" subtitle="HTML e CSS puros: acessíveis, com tooltip por teclado e tabela equivalente. Duas cores validadas para daltonismo (azul e verde). Amostra com valores fictícios.">
          <ColumnChart
            categories={SAMPLE_DAYS}
            series={[
              { key: 'in', label: 'Entradas', color: 'green', values: SAMPLE_INCOME },
              { key: 'out', label: 'Custos', color: 'navy', values: SAMPLE_COST },
            ]}
            formatValue={formatBRL}
            formatAxis={formatCompactBRL}
            ariaLabel="Exemplo: entradas e custos por dia"
            height={200}
          />
          <HBarChart
            rows={[
              { label: 'PIX', value: 120000, sub: '6 pagamentos' },
              { label: 'Dinheiro', value: 54500, sub: '3 pagamentos' },
              { label: 'Cartão', value: 29400, sub: '2 pagamentos' },
            ]}
            formatValue={formatBRL}
            color="green"
            ariaLabel="Exemplo: formas de pagamento"
          />
        </Section>
      </div>
    </>
  );
}
