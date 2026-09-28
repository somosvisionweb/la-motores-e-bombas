'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { formatCpfCnpj } from '@/lib/document-id';
import { formatDecimalBR } from '@/lib/money';
import { formatPhoneBR } from '@/lib/phone';
import { cn } from '@/lib/cn';
import { useFormState } from './ActionForm';

interface BaseProps {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  disabled?: boolean;
  /** Erro fornecido externamente (formulários que não usam ActionForm). */
  error?: string;
}

/** Envolve rótulo, controle, dica e mensagem de erro com ids de acessibilidade. */
function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
  labelHidden,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  labelHidden?: boolean;
}) {
  return (
    <div className={cn('field', className)}>
      <label className={cn('field__label', labelHidden && 'sr-only')} htmlFor={id}>
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function useFieldState(name: string, externalError?: string) {
  const { state } = useFormState();
  return {
    error: externalError ?? state.fieldErrors?.[name],
    submitted: state.values?.[name],
    /** Chave que força o campo a assumir o valor devolvido pelo servidor após um erro. */
    resetKey: state.values ? `s:${state.values[name] ?? ''}` : 'init',
  };
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

// ---------------------------------------------------------------------------

export function TextField({
  name,
  label,
  required,
  hint,
  className,
  disabled,
  error: externalError,
  defaultValue,
  type = 'text',
  placeholder,
  autoComplete,
  maxLength,
  inputMode,
  autoFocus,
  readOnly,
  list,
  min,
  max,
}: BaseProps & {
  defaultValue?: string | number | null;
  type?: 'text' | 'email' | 'url' | 'date' | 'time' | 'number' | 'tel' | 'search';
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url';
  autoFocus?: boolean;
  readOnly?: boolean;
  list?: string;
  min?: string | number;
  max?: string | number;
}) {
  const id = useId();
  const { error, submitted, resetKey } = useFieldState(name, externalError);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        key={resetKey}
        id={id}
        name={name}
        type={type}
        className="input"
        defaultValue={submitted ?? (defaultValue === null || defaultValue === undefined ? '' : String(defaultValue))}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        autoFocus={autoFocus}
        readOnly={readOnly}
        disabled={disabled}
        list={list}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-required={required || undefined}
      />
    </FieldShell>
  );
}

export function TextareaField({
  name,
  label,
  required,
  hint,
  className,
  disabled,
  error: externalError,
  defaultValue,
  rows = 4,
  maxLength,
  placeholder,
}: BaseProps & { defaultValue?: string | null; rows?: number; maxLength?: number; placeholder?: string }) {
  const id = useId();
  const { error, submitted, resetKey } = useFieldState(name, externalError);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea
        key={resetKey}
        id={id}
        name={name}
        className="textarea"
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        defaultValue={submitted ?? defaultValue ?? ''}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export function SelectField({
  name,
  label,
  required,
  hint,
  className,
  disabled,
  error: externalError,
  options,
  defaultValue,
  placeholder,
}: BaseProps & { options: SelectOption[]; defaultValue?: string | number | null; placeholder?: string }) {
  const id = useId();
  const { error, submitted, resetKey } = useFieldState(name, externalError);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select
        key={resetKey}
        id={id}
        name={name}
        className="select"
        defaultValue={submitted ?? (defaultValue === null || defaultValue === undefined ? '' : String(defaultValue))}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  className,
  disabled,
  defaultChecked,
  value = 'on',
}: Omit<BaseProps, 'required' | 'error'> & { defaultChecked?: boolean; value?: string }) {
  const id = useId();
  const { state } = useFormState();
  const checked = state.values ? state.values[name] === value : defaultChecked;
  return (
    <div className={cn('field', className)}>
      <label className="check" htmlFor={id}>
        <input key={state.values ? 'sub' : 'init'} id={id} type="checkbox" name={name} value={value} defaultChecked={checked} disabled={disabled} />
        {label}
      </label>
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

/** Valor em reais digitado como "banco" (só dígitos; 1 → 0,01). O formulário recebe CENTAVOS. */
export function MoneyField({
  name,
  label,
  required,
  hint,
  className,
  disabled,
  error: externalError,
  defaultCents,
  nullable,
  placeholder,
  onCentsChange,
}: BaseProps & { defaultCents?: number | null; nullable?: boolean; placeholder?: string; onCentsChange?: (cents: number) => void }) {
  const id = useId();
  const { error, submitted } = useFieldState(name, externalError);
  const initial = submitted !== undefined ? (submitted === '' ? null : Number(submitted)) : (defaultCents ?? (nullable ? null : 0));
  const [cents, setCentsState] = useState<number | null>(Number.isFinite(initial as number) ? (initial as number | null) : null);
  const setCents = (value: number | null) => {
    setCentsState(value);
    onCentsChange?.(value ?? 0);
  };

  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <div className="input-group">
        <span className="input-group__addon" aria-hidden="true">
          R$
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="input tabular"
          value={cents === null ? '' : formatDecimalBR(cents)}
          placeholder={placeholder ?? (nullable ? 'a combinar' : '0,00')}
          disabled={disabled}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
            if (!digits) setCents(nullable ? null : 0);
            else setCents(Number(digits));
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
      </div>
      <input type="hidden" name={name} value={cents === null ? '' : cents} disabled={disabled} />
    </FieldShell>
  );
}

function MaskedField({
  name,
  label,
  required,
  hint,
  className,
  disabled,
  error: externalError,
  defaultValue,
  mask,
  inputMode,
  placeholder,
  autoComplete,
  maxLength,
}: BaseProps & {
  defaultValue?: string | null;
  mask: (value: string) => string;
  inputMode?: 'numeric' | 'tel';
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  const id = useId();
  const { error, submitted } = useFieldState(name, externalError);
  const [value, setValue] = useState(mask(submitted ?? defaultValue ?? ''));
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        id={id}
        name={name}
        type="text"
        className="input tabular"
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => setValue(mask(event.target.value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />
    </FieldShell>
  );
}

export function PhoneField(props: BaseProps & { defaultValue?: string | null; placeholder?: string }) {
  return <MaskedField {...props} mask={formatPhoneBR} inputMode="tel" placeholder={props.placeholder ?? '(81) 99999-9999'} autoComplete="tel-national" maxLength={19} />;
}

export function DocumentField(props: BaseProps & { defaultValue?: string | null }) {
  return <MaskedField {...props} mask={formatCpfCnpj} inputMode="numeric" placeholder="000.000.000-00" maxLength={18} />;
}

export function PasswordField({
  name,
  label,
  required,
  hint,
  className,
  error: externalError,
  autoComplete = 'current-password',
  autoFocus,
}: BaseProps & { autoComplete?: 'current-password' | 'new-password'; autoFocus?: boolean }) {
  const id = useId();
  const { error } = useFieldState(name, externalError);
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <div className="password-field">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          className="input"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm password-field__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  );
}

export function HiddenField({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={String(value)} />;
}
