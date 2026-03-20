import { useState, useEffect, useCallback } from 'react';
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
 */
const PhoneMaskedInput = ({ name, value, onChange, placeholder, className }: PhoneMaskedInputProps) => {
  const [display, setDisplay] = useState(() => formatPhoneDisplay(value));

  useEffect(() => {
    setDisplay(formatPhoneDisplay(value));
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizePhone(e.target.value);
    // Limit to 11 digits
    const limited = raw.slice(0, 11);
    setDisplay(formatPhoneDisplay(limited));
    onChange(name, limited);
  }, [name, onChange]);

  return (
    <input
      type="tel"
      name={name}
      value={display}
      onChange={handleChange}
      placeholder={placeholder || '(41) 99745-2053'}
      className={className}
    />
  );
};

export default PhoneMaskedInput;
