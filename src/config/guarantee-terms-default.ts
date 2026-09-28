/**
 * TERMOS E CONDIÇÕES DE GARANTIA — texto fornecido pelo cliente (LA Motores e Bombas).
 * Mantido exatamente como recebido; nenhuma cláusula foi criada ou alterada.
 * O único ajuste é o placeholder {{prazo_garantia}}, que é substituído por "3 (três) meses"
 * (o prazo fica editável em Configurações → Termos de garantia).
 *
 * Marcação: "# " cláusula · "## " subtítulo · "- " item de lista · "!" linha em destaque · linha em branco separa parágrafos.
 */
export const DEFAULT_TERMS_TITLE = 'Termos e Condições de Garantia';
export const DEFAULT_WARRANTY_MONTHS = 3;

export const DEFAULT_TERMS_CONTENT = `# 1. Prazo de garantia
O equipamento possui garantia de {{prazo_garantia}}, contados a partir da data de realização do serviço, exclusivamente para defeitos relacionados ao serviço executado ou às peças substituídas, conforme avaliação técnica.

# 2. Aterramento do equipamento
O cliente é responsável por providenciar e manter o aterramento adequado do equipamento e da instalação elétrica, conforme as normas técnicas e de segurança aplicáveis, especialmente a ABNT NBR 5410 – Instalações elétricas de baixa tensão.

A ausência de aterramento adequado, quando tecnicamente exigível, poderá comprometer o funcionamento e a segurança do equipamento. A empresa não se responsabiliza por danos decorrentes da falta ou inadequação do aterramento da instalação.

# 3. Situações não cobertas pela garantia
A garantia não cobre defeitos ou danos decorrentes de:
- Queda ou variação de tensão elétrica;
- Falta de água ou funcionamento do equipamento sem água, quando aplicável;
- Mau dimensionamento elétrico ou hidráulico da instalação;
- Instalação inadequada ou fora das especificações do fabricante;
- Falta ou inadequação do aterramento;
- Sobrecarga, curto-circuito ou problemas na rede elétrica;
- Mau uso, negligência, acidentes ou alterações realizadas por terceiros;
- Desgaste natural de componentes decorrente do uso.

# 4. Comprovante do serviço
Para solicitar atendimento em garantia, é obrigatória a apresentação desta nota/ordem de serviço ou comprovante correspondente ao serviço realizado. Na ausência do comprovante, a garantia poderá não ser reconhecida.

# 5. Avaliação técnica
Todo equipamento apresentado em garantia estará sujeito à avaliação técnica, a fim de identificar a causa do defeito. Caso seja constatado que o problema não está relacionado ao serviço realizado ou às peças substituídas, o reparo poderá ser realizado mediante novo orçamento.

## Declaração do cliente
Declaro estar ciente dos termos e condições acima, especialmente quanto à responsabilidade pelo aterramento, condições da instalação elétrica/hidráulica e demais itens não cobertos pela garantia.

!Garantia: {{prazo_garantia}}.
`;
