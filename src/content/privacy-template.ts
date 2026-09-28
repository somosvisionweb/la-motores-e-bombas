import { fullAddress, phoneDisplay, type CompanyLike } from '@/lib/company';

/**
 * Modelo GERAL de política de privacidade (LGPD), descrevendo o que este sistema realmente faz com os dados
 * (pedidos da loja, botões de WhatsApp, IP para prevenção de abuso, carrinho só no navegador).
 * É um ponto de partida para a empresa revisar com o contador/advogado — não é aconselhamento jurídico.
 *
 * O título da página fica por conta do site; o texto começa direto no primeiro parágrafo.
 * Formato simples: linhas "1. Título" viram subtítulos e linhas "- item" viram listas (ver `parsePolicyText`).
 *
 * @param today data de hoje já formatada (dd/mm/aaaa)
 */
export function buildPrivacyTemplate(company: CompanyLike, today: string): string {
  const contacts = [
    company.email?.trim() || null,
    phoneDisplay(company) ? `WhatsApp/telefone: ${phoneDisplay(company)}` : null,
    fullAddress(company) || null,
  ]
    .filter((line): line is string => Boolean(line))
    .map((line) => `- ${line}`);

  return `Esta política explica como a ${company.name}${company.cnpj ? ` (CNPJ ${company.cnpj})` : ''} trata os dados pessoais informados neste site, de acordo com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).

1. Quais dados coletamos
- Ao finalizar um pedido na loja: nome, telefone/WhatsApp, e-mail (opcional), endereço (somente quando há entrega) e as observações que você escrever.
- Ao usar os botões de WhatsApp, a conversa acontece no próprio WhatsApp e segue a política dele.
- Para prevenir fraudes e abusos, registramos o endereço IP de onde o pedido foi feito.
- O carrinho de compras fica salvo apenas no seu navegador e só é enviado a nós quando você finaliza o pedido.

2. Para que usamos os dados
- Separar e entregar (ou deixar disponível para retirada) o seu pedido e avisar sobre o andamento, inclusive por WhatsApp.
- Emitir comprovantes e cumprir obrigações legais, fiscais e contábeis.
- Prevenir fraudes e proteger o site contra abusos.

3. Compartilhamento
Não vendemos os seus dados. Eles podem ser tratados por prestadores necessários ao funcionamento do site (como a hospedagem) e informados a autoridades quando a lei exigir.

4. Por quanto tempo guardamos
Pelo tempo necessário para atender o pedido e cumprir obrigações legais e de garantia. Depois disso, os dados podem ser eliminados ou anonimizados.

5. Seus direitos
Você pode pedir a confirmação de que tratamos os seus dados, o acesso a eles, a correção de dados incompletos ou desatualizados, a anonimização ou eliminação e informações sobre o compartilhamento, usando os contatos abaixo.

6. Contato
${contacts.length > 0 ? contacts.join('\n') : '- (informe aqui os contatos da empresa)'}

Última atualização: ${today}`;
}
