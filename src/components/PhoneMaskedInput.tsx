import { useState, useEffect, useCallback, forwardRef } from 'react';
import { sanitizePhone, formatPhoneDisplay } from '@/lib/whatsapp';

interface PhoneMaskedInputProps {
  name: string;
  value: string; // raw digits
  onChange: (name: string, rawValue: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Phone input that displays (XX) XXXXX-XXXX mask
 * but stores/returns only raw digits.
 * Supports ref forwarding for programmatic focus (used by deep-link CTAs).
 */
const PhoneMaskedInput = forwardRef<HTMLInputElement, PhoneMaskedInputProps>(
  ({ name, value, onChange, placeholder, className }, ref) => {
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
        type="tel"
        name={name}
        value={display}
        onChange={handleChange}
        placeholder={placeholder || '(41) 99745-2053'}
        className={className}
      />
    );
  }
);

PhoneMaskedInput.displayName = 'PhoneMaskedInput';

export default PhoneMaskedInput;
