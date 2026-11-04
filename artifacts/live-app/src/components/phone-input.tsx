import { useId, type ChangeEvent } from 'react';
import { COUNTRIES, getCountry, normalizePhoneNumber } from '@workspace/live-core';
import { Field } from '@/ui';
import { cn } from '@/lib/cn';
import { ChevronDown } from 'lucide-react';

interface PhoneInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  country: string;
  onCountryChange: (countryCode: string) => void;
  value: string;
  onChange: (localNumber: string, fullE164: string, isValid: boolean) => void;
  required?: boolean;
}

export function PhoneInput({
  label = 'رقم الموبايل / الهاتف',
  hint,
  error,
  country,
  onCountryChange,
  value,
  onChange,
  required = false,
}: PhoneInputProps) {
  const id = useId();
  const cfg = getCountry(country);

  const handleCountrySelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextCode = e.target.value;
    onCountryChange(nextCode);
    const nextCfg = getCountry(nextCode);
    const { fullPhone, isValid } = normalizePhoneNumber(value, nextCfg.phoneCode);
    onChange(value, fullPhone, isValid);
  };

  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Strip leading zero if typed for local mobile numbers
    if (raw.startsWith('0') && raw.length > 1) {
      raw = raw.replace(/^0+/, '');
    }
    const { fullPhone, isValid } = normalizePhoneNumber(raw, cfg.phoneCode);
    onChange(raw, fullPhone, isValid);
  };

  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <div className="flex w-full overflow-hidden rounded-md border border-transparent bg-surface-container-high transition-[border-color,background-color] duration-150 focus-within:border-secondary focus-within:bg-surface-container-lowest">
        {/* Country Dial Code Selector */}
        <div className="relative flex shrink-0 items-center border-e border-outline-variant/30 bg-surface-container ps-3 pe-8">
          <span className="me-2 text-title-md">{cfg.flag}</span>
          <span className="text-label-md font-semibold text-on-surface dir-ltr">{cfg.phoneCode}</span>
          <ChevronDown className="pointer-events-none absolute end-2 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
          <select
            value={cfg.code}
            onChange={handleCountrySelect}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="اختر كود الدولة"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.phoneCode})
              </option>
            ))}
          </select>
        </div>

        {/* Local Number Input */}
        <input
          id={id}
          type="tel"
          inputMode="tel"
          dir="ltr"
          required={required}
          value={value}
          onChange={handleNumberChange}
          placeholder={cfg.phonePlaceholder}
          className={cn(
            'gl-input h-12 flex-1 bg-transparent px-4 text-start text-body-lg text-on-surface placeholder:text-on-surface-variant/50 outline-none',
            error && 'text-error'
          )}
        />
      </div>
    </Field>
  );
}
