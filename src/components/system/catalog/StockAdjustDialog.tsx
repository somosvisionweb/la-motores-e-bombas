'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackagePlus } from 'lucide-react';
import { adjustStockAction } from '@/actions/products';
import { ActionForm } from '@/components/form/ActionForm';
import { HiddenField, SelectField, TextField } from '@/components/form/fields';
import { Modal } from '@/components/ui/Modal';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function StockAdjustDialog({ productId, productName, current, unit }: { productId: number; productName: string; current: number; unit: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <PackagePlus aria-hidden="true" /> Ajustar estoque
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajustar estoque">
        <ActionForm
          action={adjustStockAction}
          className="stack"
          successToast
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          <HiddenField name="id" value={productId} />
          <p className="text-muted">
            <strong>{productName}</strong> — saldo atual: <strong className="tabular">{current}</strong> {unit}
          </p>
          <SelectField
            name="mode"
            label="Tipo de ajuste"
            required
            defaultValue="ADD"
            options={[
              { value: 'ADD', label: 'Entrada (compra / reposição)' },
              { value: 'REMOVE', label: 'Saída manual (perda / uso interno)' },
              { value: 'SET', label: 'Definir saldo (contagem de estoque)' },
            ]}
          />
          <TextField name="quantity" label="Quantidade" type="number" min={0} required defaultValue={1} inputMode="numeric" />
          <TextField name="note" label="Motivo / observação" maxLength={200} placeholder="Ex.: compra no fornecedor, inventário…" />
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <SubmitButton pendingLabel="Salvando…">Confirmar ajuste</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
