'use client';

import Link from 'next/link';
import type { ActionState } from '@/lib/action-state';
import { PRODUCT_ICONS } from '@/config/product-icons';
import { ActionForm } from '@/components/form/ActionForm';
import { Alert } from '@/components/ui/Alert';
import { CheckboxField, HiddenField, MoneyField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatBRL } from '@/lib/money';
import type { Product } from '@/server/db/schema';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const UNIT_SUGGESTIONS = ['un', 'par', 'kit', 'm', 'kg', 'cx', 'jogo'];

export function ProductForm({ action, product, categories, fromStore }: { action: Action; product?: Product; categories: string[]; /** Aberto a partir de "Produtos da loja": ao cadastrar/cancelar volta para lá. */ fromStore?: boolean }) {
  const editing = Boolean(product);
  const backHref = fromStore ? '/sistema/loja/produtos' : '/sistema/produtos';
  return (
    <ActionForm action={action} className="stack" successToast>
      {product ? <HiddenField name="id" value={product.id} /> : null}
      {fromStore ? <HiddenField name="from" value="loja" /> : null}
      <datalist id="product-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="product-units">
        {UNIT_SUGGESTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div className="form-grid">
        <TextField className="col-6" name="name" label="Nome do produto" required defaultValue={product?.name} autoFocus={!editing} />
        <TextField className="col-3" name="code" label="Código" defaultValue={product?.code} hint="Vazio = gerado automaticamente" maxLength={30} />
        <TextField className="col-3" name="category" label="Categoria" required defaultValue={product?.category ?? 'Componentes'} list="product-categories" />

        {product && product.salePriceCents === 0 && product.demoPriceCents ? (
          <div className="col-12">
            <Alert variant="demo" title="Este produto está com preço de DEMONSTRAÇÃO na loja">
              A loja virtual mostra {formatBRL(product.demoPriceCents)} (valor fictício, só para conhecer o sistema). Informe o preço de venda real abaixo para substituí-lo.
            </Alert>
          </div>
        ) : null}
        <MoneyField className="col-3" name="salePriceCents" label="Preço de venda" defaultCents={product?.salePriceCents ?? 0} hint="R$ 0,00 = a definir (na loja: “valor sob consulta”)" />
        <MoneyField className="col-3" name="costCents" label="Custo" defaultCents={product?.costCents ?? 0} />
        {editing ? (
          <div className="col-3 field">
            <span className="field__label">Estoque atual</span>
            <p className="tabular" style={{ fontWeight: 700, fontSize: 18, minHeight: 40, display: 'flex', alignItems: 'center' }}>
              {product!.stock} {product!.unit}
            </p>
            <p className="field__hint">Use “Ajustar estoque” para alterar.</p>
          </div>
        ) : (
          <TextField className="col-3" name="stock" label="Estoque inicial" type="number" min={0} defaultValue={0} inputMode="numeric" />
        )}
        <TextField className="col-3" name="minStock" label="Estoque mínimo" type="number" min={0} defaultValue={product?.minStock ?? 0} inputMode="numeric" hint="0 = sem alerta" />

        <TextField className="col-3" name="unit" label="Unidade" required defaultValue={product?.unit ?? 'un'} list="product-units" maxLength={12} />
        <SelectField
          className="col-5"
          name="iconKey"
          label="Ícone (quando não houver foto)"
          defaultValue={product?.iconKey ?? 'component'}
          options={PRODUCT_ICONS.map((i) => ({ value: i.key, label: i.label }))}
        />
        <div className="col-4 field">
          <span className="field__label">Pré-visualização</span>
          <div className="empty__icon" style={{ width: 52, height: 52 }}>
            <ProductIcon iconKey={product?.iconKey ?? 'component'} size={34} />
          </div>
        </div>

        <TextareaField className="col-12" name="notes" label="Observações (internas)" defaultValue={product?.notes} rows={3} />
        <TextareaField
          className="col-12"
          name="storeDescription"
          label="Descrição na loja virtual (opcional)"
          defaultValue={product?.storeDescription}
          rows={3}
          maxLength={600}
          hint="Texto que o cliente lê na página do produto (medidas, aplicação, compatibilidade…). Escreva só o que for verdade; se ficar vazio, nada é exibido."
        />

        <div className="col-12 field">
          <label className="field__label" htmlFor="product-image">
            Foto do produto (opcional)
          </label>
          <div className="cluster" style={{ alignItems: 'flex-start', gap: 16 }}>
            {product?.imageFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/${product.imageFileId}`} alt={`Foto de ${product.name}`} width={88} height={88} style={{ borderRadius: 10, objectFit: 'cover', border: '1px solid var(--color-border)' }} />
            ) : null}
            <div className="stack" style={{ ['--gap' as string]: '8px', flex: '1 1 260px' }}>
              <input id="product-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
              <p className="field__hint">PNG, JPG ou WebP até 6 MB. A imagem é otimizada automaticamente.</p>
              {product?.imageFileId ? <CheckboxField name="removeImage" label="Remover a foto atual" /> : null}
            </div>
          </div>
        </div>

        <CheckboxField className="col-6" name="isActive" label="Produto ativo (disponível para venda e OS)" defaultChecked={product?.isActive ?? true} />
        <CheckboxField className="col-6" name="showOnSite" label="Exibir no site público" defaultChecked={product?.showOnSite ?? true} />
        <CheckboxField className="col-12" name="sellOnline" label="Vender na loja virtual (precisa de preço de venda e estoque; senão o site mostra “valor sob consulta”)" defaultChecked={product?.sellOnline ?? true} />
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">{editing ? 'Salvar alterações' : 'Cadastrar produto'}</SubmitButton>
        <Link href={backHref} className="btn">
          {editing ? 'Voltar' : 'Cancelar'}
        </Link>
      </div>
    </ActionForm>
  );
}
