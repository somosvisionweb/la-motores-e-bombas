'use client';

import { useState } from 'react';
import {
  updateBusinessHoursAction,
  updateCompanyProfileAction,
  updatePaymentMethodsAction,
  updatePrivacyPolicyAction,
  updateSeoAction,
  updateWhatsAppTemplatesAction,
} from '@/actions/settings';
import { WEEKDAY_KEYS, WEEKDAY_LABEL, WHATSAPP_TEMPLATE_PLACEHOLDERS, type BusinessHours, type WhatsAppTemplates } from '@/config/company';
import { storeOrderTemplate } from '@/config/company-defaults';
import { PAYMENT_METHOD_KEYS, PAYMENT_METHOD_LABEL } from '@/config/payment-methods';
import { ActionForm, useFormState } from '@/components/form/ActionForm';
import { CheckboxField, PhoneField, TextareaField, TextField } from '@/components/form/fields';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { displayPhone } from '@/lib/phone';
import { PRIVACY_TEXT_MAX } from '@/lib/policy-text';

export function CompanyProfileForm({
  company,
}: {
  company: {
    name: string;
    cnpj: string | null;
    email: string | null;
    whatsapp: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    instagram: string | null;
    publicBaseUrl: string | null;
  };
}) {
  return (
    <ActionForm action={updateCompanyProfileAction} className="stack">
      <div className="form-grid">
        <TextField className="col-8" name="name" label="Nome da empresa" required defaultValue={company.name} />
        <TextField className="col-4" name="cnpj" label="CNPJ" defaultValue={company.cnpj} placeholder="00.000.000/0000-00" />
        <PhoneField className="col-4" name="whatsapp" label="WhatsApp" required defaultValue={company.whatsapp ? displayPhone(company.whatsapp.replace(/^55/, '')) : ''} hint="Usado nos botões do site e nas mensagens." />
        <PhoneField className="col-4" name="phone" label="Telefone de contato exibido" defaultValue={company.phone} hint="Aparece nos documentos e no site." />
        <TextField className="col-4" name="email" label="E-mail" type="email" defaultValue={company.email} />
        <TextField className="col-5" name="address" label="Endereço (rua e número)" defaultValue={company.address} />
        <TextField className="col-3" name="city" label="Cidade" defaultValue={company.city} />
        <TextField className="col-2" name="state" label="UF" defaultValue={company.state} maxLength={2} />
        <TextField className="col-2" name="zip" label="CEP" defaultValue={company.zip} />
        <TextField className="col-6" name="instagram" label="Instagram" defaultValue={company.instagram} placeholder="@usuario" />
        <TextField className="col-6" name="publicBaseUrl" label="Endereço público do site/sistema" defaultValue={company.publicBaseUrl} placeholder="https://www.seusite.com.br" hint="Usado nos links de PDF enviados por WhatsApp e no SEO. Deixe vazio enquanto estiver testando localmente." />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Salvar dados da empresa</SubmitButton>
      </div>
    </ActionForm>
  );
}

function HoursRows({ hours }: { hours: BusinessHours }) {
  const { state } = useFormState();
  const [closed, setClosed] = useState<Record<string, boolean>>(() => Object.fromEntries(WEEKDAY_KEYS.map((d) => [d, hours[d].closed])));
  return (
    <div className="hours-grid">
      {WEEKDAY_KEYS.map((day) => {
        const error = state.fieldErrors?.[`${day}_open`] ?? state.fieldErrors?.[`${day}_close`];
        return (
          <div key={day} className="hours-row">
            <strong>{WEEKDAY_LABEL[day]}</strong>
            <label className="check">
              <input type="checkbox" name={`${day}_closed`} checked={closed[day]} onChange={(e) => setClosed((c) => ({ ...c, [day]: e.target.checked }))} />
              Fechado
            </label>
            <input type="time" name={`${day}_open`} className="input input--sm" defaultValue={hours[day].open ?? '08:00'} disabled={closed[day]} aria-label={`${WEEKDAY_LABEL[day]}: abertura`} />
            <span aria-hidden="true">às</span>
            <input type="time" name={`${day}_close`} className="input input--sm" defaultValue={hours[day].close ?? '17:00'} disabled={closed[day]} aria-label={`${WEEKDAY_LABEL[day]}: fechamento`} />
            {error ? (
              <p className="field__error" role="alert" style={{ gridColumn: '1 / -1' }}>
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function BusinessHoursForm({ hours }: { hours: BusinessHours }) {
  return (
    <ActionForm action={updateBusinessHoursAction} className="stack">
      <HoursRows hours={hours} />
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Salvar horários</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PaymentMethodsForm({ accepted }: { accepted: string[] }) {
  return (
    <ActionForm action={updatePaymentMethodsAction} className="stack">
      <div className="cluster" style={{ gap: 24 }}>
        {PAYMENT_METHOD_KEYS.map((key) => (
          <CheckboxField key={key} name="paymentMethods" value={key} label={PAYMENT_METHOD_LABEL[key]} defaultChecked={accepted.includes(key)} />
        ))}
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Salvar formas de pagamento</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function WhatsAppTemplatesForm({ templates }: { templates: WhatsAppTemplates }) {
  return (
    <ActionForm action={updateWhatsAppTemplatesAction} className="stack">
      <p className="text-muted">
        Variáveis disponíveis: {WHATSAPP_TEMPLATE_PLACEHOLDERS.map((p) => (
          <code key={p} className="code-tag" style={{ marginRight: 6 }}>
            {p}
          </code>
        ))}
        <br />
        <span style={{ fontSize: 13 }}>{'{{empresa}}'} usa o nome cadastrado. O link do PDF é adicionado ao final da mensagem no momento do envio.</span>
      </p>
      <div className="form-grid">
        <TextareaField className="col-12" name="general" label="Contato geral (site)" defaultValue={templates.general} rows={2} required />
        <TextareaField className="col-12" name="attendance" label="Solicitar atendimento (site)" defaultValue={templates.attendance} rows={2} required />
        <TextareaField className="col-12" name="quote" label="Solicitar orçamento (site)" defaultValue={templates.quote} rows={2} required />
        <TextareaField className="col-12" name="homeVisit" label="Atendimento a domicílio (site)" defaultValue={templates.homeVisit} rows={2} required />
        <TextareaField className="col-12" name="orderShare" label="Envio da OS / recibo ao cliente (sistema)" defaultValue={templates.orderShare} rows={3} required />
        <TextareaField
          className="col-12"
          name="storeOrder"
          label="Aviso sobre pedido da loja virtual (sistema)"
          defaultValue={storeOrderTemplate(templates)}
          rows={3}
          required
          hint="{{link}} é o endereço para o cliente acompanhar o pedido."
        />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Salvar mensagens</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SeoForm({ seoTitle, seoDescription }: { seoTitle: string; seoDescription: string }) {
  const [title, setTitle] = useState(seoTitle);
  const [description, setDescription] = useState(seoDescription);
  return (
    <ActionForm action={updateSeoAction} className="stack">
      <div className="form-grid">
        <div className="col-12 field">
          <label className="field__label" htmlFor="seoTitle">
            Título da página (aparece no Google e na aba do navegador)
          </label>
          <input id="seoTitle" name="seoTitle" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          <p className="field__hint">{title.length}/80 caracteres — ideal até ~65.</p>
        </div>
        <div className="col-12 field">
          <label className="field__label" htmlFor="seoDescription">
            Descrição (resumo exibido abaixo do título nos resultados de busca)
          </label>
          <textarea id="seoDescription" name="seoDescription" className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} required />
          <p className="field__hint">{description.length}/200 caracteres — ideal entre 120 e 160.</p>
        </div>
      </div>
      <div className="serp-preview" aria-label="Pré-visualização no Google">
        <span className="serp-preview__url">lamotoresebombas › início</span>
        <span className="serp-preview__title">{title || 'Título do site'}</span>
        <span className="serp-preview__desc">{description || 'Descrição do site'}</span>
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Salvar SEO</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PrivacyPolicyForm({ text, template }: { text: string; template: string }) {
  const [value, setValue] = useState(text);
  const [confirming, setConfirming] = useState(false);

  function askForTemplate() {
    if (value.trim() && value.trim() !== template.trim()) setConfirming(true);
    else setValue(template);
  }

  return (
    <ActionForm action={updatePrivacyPolicyAction} className="stack" keepValues>
      <Alert variant="warning" title="Modelo geral — peça uma revisão">
        O modelo descreve o que este site realmente faz com os dados (pedidos da loja, WhatsApp, IP para evitar abuso, carrinho só no navegador). É um ponto de partida: antes de publicar, revise com o contador ou um advogado e ajuste ao que a empresa pratica.
      </Alert>
      <div className="field">
        <label className="field__label" htmlFor="privacyText">
          Texto da política de privacidade
        </label>
        <textarea
          id="privacyText"
          name="privacyText"
          className="textarea"
          rows={16}
          value={value}
          maxLength={PRIVACY_TEXT_MAX}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Vazio = o site não mostra a página de privacidade."
        />
        <p className="field__hint">
          {value.length.toLocaleString('pt-BR')}/{PRIVACY_TEXT_MAX.toLocaleString('pt-BR')} caracteres. Formato: linha em branco separa parágrafos, “1. Título” vira subtítulo e linhas iniciadas por “- ” viram lista. Deixe vazio para remover a página do site.
        </p>
      </div>
      {confirming ? (
        <Alert variant="warning" title="Substituir o texto atual pelo modelo?">
          O que está escrito acima será trocado (você ainda precisa salvar).
          <div className="cluster" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setValue(template);
                setConfirming(false);
              }}
            >
              Sim, usar o modelo
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </Alert>
      ) : null}
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Salvar política</SubmitButton>
        <button type="button" className="btn btn--ghost" onClick={askForTemplate}>
          {value.trim() ? 'Usar o modelo pronto' : 'Preencher com o modelo pronto'}
        </button>
      </div>
    </ActionForm>
  );
}
