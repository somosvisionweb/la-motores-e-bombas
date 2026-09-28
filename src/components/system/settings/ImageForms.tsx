'use client';

import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { addSiteImageAction, deleteSiteImageAction, removeLogoAction, updateSiteImageAltAction, uploadLogoAction } from '@/actions/settings';
import { ActionForm } from '@/components/form/ActionForm';
import { HiddenField, TextField } from '@/components/form/fields';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function LogoForm({ logoFileId, companyName }: { logoFileId: number | null; companyName: string }) {
  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <div className="logo-preview">
        {logoFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${logoFileId}`} alt={`Logo de ${companyName}`} />
        ) : (
          <p className="text-muted">Nenhuma logo enviada. Enquanto isso, o sistema usa apenas o nome da empresa em texto (marca provisória).</p>
        )}
      </div>
      <ActionForm action={uploadLogoAction} className="stack" resetOnSuccess>
        <div className="field">
          <label className="field__label" htmlFor="logo-file">
            {logoFileId ? 'Trocar a logo' : 'Enviar a logo oficial'}
          </label>
          <input id="logo-file" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="input" required />
          <p className="field__hint">PNG com fundo transparente é o ideal (também aceita JPG, WebP e SVG, até 6 MB). A imagem é otimizada automaticamente.</p>
        </div>
        <div className="cluster">
          <SubmitButton pendingLabel="Enviando…">
            <Upload aria-hidden="true" /> {logoFileId ? 'Substituir logo' : 'Enviar logo'}
          </SubmitButton>
        </div>
      </ActionForm>
      {logoFileId ? (
        <ConfirmActionForm
          action={removeLogoAction}
          title="Remover a logo?"
          message="A logo deixará de aparecer no site, no sistema e nos documentos. O nome da empresa em texto será usado no lugar."
          confirmLabel="Remover logo"
          triggerLabel="Remover logo"
          triggerIcon={<Trash2 aria-hidden="true" />}
          triggerSize="md"
        />
      ) : null}
    </div>
  );
}

export function SiteImageUploadForm({ slot, label, hint }: { slot: 'HERO' | 'GALLERY'; label: string; hint: string }) {
  return (
    <ActionForm action={addSiteImageAction} className="stack" resetOnSuccess>
      <HiddenField name="slot" value={slot} />
      <div className="form-grid">
        <div className="col-6 field">
          <label className="field__label" htmlFor={`image-${slot}`}>
            {label}
          </label>
          <input id={`image-${slot}`} name="image" type="file" accept="image/png,image/jpeg,image/webp" className="input" required />
          <p className="field__hint">{hint}</p>
        </div>
        <TextField className="col-6" name="alt" label="Descrição da imagem (acessibilidade e SEO)" required maxLength={200} placeholder="Ex.: Bancada de rebobinamento de motores" />
      </div>
      <div className="cluster">
        <SubmitButton pendingLabel="Enviando…">
          <ImagePlus aria-hidden="true" /> Enviar imagem
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SiteImageRow({ image }: { image: { id: number; fileId: number; alt: string; slot: string } }) {
  return (
    <div className="site-image-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/media/${image.fileId}`} alt={image.alt} width={120} height={80} />
      <ActionForm action={updateSiteImageAltAction} className="grow" successToast>
        <HiddenField name="id" value={image.id} />
        <div className="cluster" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
          <TextField className="grow" name="alt" label={image.slot === 'HERO' ? 'Imagem principal — descrição' : 'Descrição'} defaultValue={image.alt} maxLength={200} />
          <SubmitButton variant="secondary" size="sm" pendingLabel="Salvando…">
            Salvar
          </SubmitButton>
        </div>
      </ActionForm>
      <ConfirmActionForm
        action={deleteSiteImageAction}
        fields={{ id: image.id }}
        title="Remover esta imagem do site?"
        message="A imagem deixará de aparecer no site público."
        confirmLabel="Remover"
        triggerLabel="Remover imagem"
        triggerIcon={<Trash2 aria-hidden="true" />}
        iconOnly
      />
    </div>
  );
}
