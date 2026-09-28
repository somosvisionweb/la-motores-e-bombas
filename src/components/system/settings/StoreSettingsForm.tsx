'use client';

import { updateStoreSettingsAction } from '@/actions/store';
import { ActionForm } from '@/components/form/ActionForm';
import { CheckboxField, MoneyField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { PIX_KEY_TYPES, PIX_KEY_TYPE_LABEL } from '@/config/store';
import type { StoreConfig } from '@/server/services/store-settings';

export function StoreSettingsForm({ config }: { config: StoreConfig }) {
  return (
    <ActionForm action={updateStoreSettingsAction} className="stack" successToast>
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <CardHeader title="Loja aberta" subtitle="Fechada, o site volta a mostrar os produtos apenas para consulta pelo WhatsApp (carrinho e compras ficam desativados)." />
          <CardBody>
            <CheckboxField name="enabled" label="Loja virtual aberta ao público" defaultChecked={config.enabled} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pagamento por PIX"
            subtitle="O cliente paga direto na sua conta, sem intermediário e sem taxa. Depois de conferir o valor no aplicativo do banco, a equipe confirma o pagamento no pedido."
          />
          <CardBody>
            <div className="form-grid">
              <SelectField
                className="col-4"
                name="pixKeyType"
                label="Tipo da chave PIX"
                defaultValue={config.pixKeyType ?? ''}
                placeholder="Sem PIX"
                options={PIX_KEY_TYPES.map((type) => ({ value: type, label: PIX_KEY_TYPE_LABEL[type] }))}
              />
              <TextField
                className="col-8"
                name="pixKey"
                label="Chave PIX da empresa"
                defaultValue={config.pixKey}
                maxLength={120}
                hint="Sem chave cadastrada, a loja não oferece pagamento por PIX (fica só “pagar na retirada”). O nome que aparece para o cliente no banco é o cadastrado na chave."
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Retirada e entrega" subtitle="A retirada na loja está sempre disponível. A entrega só existe se você ativar — a empresa não informou se entrega peças, então ela vem desligada." />
          <CardBody>
            <div className="form-grid">
              <TextField className="col-12" name="pickupNote" label="Aviso na retirada (opcional)" defaultValue={config.pickupNote} maxLength={300} hint="Ex.: “Retire no balcão com o número do pedido.” Aparece no checkout e no acompanhamento." />
              <CheckboxField className="col-12" name="deliveryEnabled" label="Oferecer entrega no checkout" defaultChecked={config.deliveryEnabled} />
              <MoneyField className="col-4" name="deliveryFeeCents" label="Taxa de entrega" defaultCents={config.deliveryFeeCents} hint="R$ 0,00 = entrega grátis." />
              <MoneyField className="col-4" name="freeDeliveryMinCents" label="Entrega grátis a partir de" defaultCents={config.freeDeliveryMinCents} nullable placeholder="sem entrega grátis" hint="Vazio = nunca." />
              <MoneyField className="col-4" name="minOrderCents" label="Pedido mínimo" defaultCents={config.minOrderCents} hint="R$ 0,00 = sem mínimo." />
              <TextField className="col-12" name="deliveryNote" label="Aviso sobre a entrega (opcional)" defaultValue={config.deliveryNote} maxLength={300} hint="Ex.: regiões atendidas e prazo. Aparece no checkout e no acompanhamento." />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reserva do estoque" subtitle="O estoque é reservado assim que o pedido é feito. Pedidos com PIX que não forem pagos no prazo são cancelados sozinhos e o estoque volta; pedidos “pagar na retirada” que a equipe não confirmar em até 3 vezes esse prazo também." />
          <CardBody>
            <div className="form-grid">
              <TextField className="col-4" name="holdHours" label="Prazo para pagar o PIX (horas)" type="number" min={0} max={720} defaultValue={config.holdHours} inputMode="numeric" hint="0 = nunca cancelar sozinho (a equipe cancela manualmente). Pedidos já confirmados nunca são cancelados sozinhos." />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Condições da loja" subtitle="Trocas, devoluções, garantia dos produtos, prazos… Escreva o que a empresa pratica. Se preencher, o cliente precisa marcar que leu antes de finalizar." />
          <CardBody>
            <TextareaField name="policyText" label="Texto das condições (opcional)" defaultValue={config.policyText} rows={6} maxLength={2000} />
          </CardBody>
        </Card>

        <div className="form-actions">
          <SubmitButton pendingLabel="Salvando…">Salvar configurações da loja</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
