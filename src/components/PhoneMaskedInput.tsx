import { useState, useEffect, useCallback, forwardRef } from 'react';
import { sanitizePhone, formatPhoneDisplay } from '@/lib/whatsapp';

interface PhoneMaskedInputProps {
  name: string;
  value: string; // raw digits
  onChange: (name: string, rawValue: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Phone input that displays (XX) XXXXX-XXXX mask
 * but stores/returns only raw digits.
 * Supports ref forwarding for programmatic focus (used by deep-link CTAs).
 */
const PhoneMaskedInput = forwardRef<HTMLInputElement, PhoneMaskedInputProps>(
  ({ name, value, onChange, placeholder, className, id, ...aria }, ref) => {
    const [display, setDisplay] = useState(() => formatPhoneDisplay(value));

    useEffect(() => {
      setDisplay(formatPhoneDisplay(value));
    }, [value]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = sanitizePhone(e.target.value);
      const limited = raw.slice(0, 11);
      setDisplay(formatPhoneDisplay(limited));
      onChange(name, limited);
    }, [name, onChange]);

    return (
      <input
        ref={ref}
        id={id}
        type="tel"
        name={name}
        value={display}
        onChange={handleChange}
        placeholder={placeholder || '(41) 99745-2053'}
        className={className}
        aria-invalid={(aria as any)['aria-invalid']}
        aria-describedby={(aria as any)['aria-describedby']}
      />
    );
  }
);

PhoneMaskedInput.displayName = 'PhoneMaskedInput';

export default PhoneMaskedInput;
