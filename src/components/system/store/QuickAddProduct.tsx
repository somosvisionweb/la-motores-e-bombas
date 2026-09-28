'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { quickAddProductAction } from '@/actions/products';
import { ActionForm } from '@/components/form/ActionForm';
import { MoneyField, TextField } from '@/components/form/fields';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';

/** Cadastro rápido de item da loja: o essencial numa linha; foto, descrição e demais opções ficam na ficha completa. */
export function QuickAddProduct({ categories }: { categories: string[] }) {
  // Depois de adicionar, o formulário é recriado (campos limpos, inclusive o preço e a foto escolhida).
  const [formKey, setFormKey] = useState(0);
  return (
    <Card id="adicionar">
      <CardHeader title="Adicionar item à loja" subtitle="Cadastre o essencial agora. Descrição, código e outras opções ficam na ficha completa do produto." />
      <CardBody>
        <ActionForm key={formKey} action={quickAddProductAction} className="stack" successToast onSuccess={() => setFormKey((key) => key + 1)}>
          <datalist id="quick-add-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <div className="form-grid">
            <TextField className="col-5" name="name" label="Nome do item" required maxLength={120} placeholder="Ex.: Capacitor 25 µF" />
            <TextField className="col-3" name="category" label="Categoria" required maxLength={80} list="quick-add-categories" placeholder="Ex.: Capacitores" />
            <MoneyField className="col-2" name="salePriceCents" label="Preço de venda" hint="R$ 0,00 = valor sob consulta" />
            <TextField className="col-2" name="stock" label="Estoque" type="number" min={0} defaultValue={0} inputMode="numeric" />
            <div className="col-12 field">
              <label className="field__label" htmlFor="quick-add-image">
                Foto do item (opcional)
              </label>
              <input id="quick-add-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
              <p className="field__hint">PNG, JPG ou WebP até 6 MB. Sem foto, a loja usa um ícone técnico.</p>
            </div>
          </div>
          <div className="form-actions">
            <SubmitButton pendingLabel="Adicionando…">
              <Plus aria-hidden="true" /> Adicionar à loja
            </SubmitButton>
            <Link href="/sistema/produtos/novo?origem=loja" className="btn btn--ghost" title="Descrição, código, custo, estoque mínimo e ícone">
              Abrir cadastro completo
            </Link>
          </div>
        </ActionForm>
      </CardBody>
    </Card>
  );
}
