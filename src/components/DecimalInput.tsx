import React, { useState, useEffect } from 'react';

interface DecimalInputProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  title?: string;
}

export const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = '0.00',
  className = '',
  id,
  title,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [digits, setDigits] = useState<string>('');

  // Keep internal digits in sync with incoming numeric value when NOT focused
  useEffect(() => {
    if (!isFocused) {
      if (value === 0) {
        setDigits('');
      } else {
        const cents = Math.round(value * 100);
        setDigits(cents > 0 ? cents.toString() : '');
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value === 0) {
      setDigits('');
    } else {
      const cents = Math.round(value * 100);
      setDigits(cents > 0 ? cents.toString() : '');
    }
    // Select input text so if user hits backspace or types a digit on focused selection, it works smoothly
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Extract only digits
    const extractedDigits = raw.replace(/\D/g, '');
    // Strip leading zeros so e.g. "0020" becomes "20"
    const cleanDigits = extractedDigits.replace(/^0+/, '').slice(0, 9);

    setDigits(cleanDigits);

    const cents = cleanDigits === '' ? 0 : parseInt(cleanDigits, 10);
    const numValue = cents / 100;
    onChange(numValue);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const cents = digits === '' ? 0 : parseInt(digits, 10);
    const numValue = cents / 100;
    onChange(numValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  // Format display value:
  // When digits is empty (''), display '' so placeholder ('0.00') shows
  // When digits has '2' -> display '0.02'
  // When digits has '20' -> display '0.20'
  // When digits has '203' -> display '2.03'
  // When digits has '2038' -> display '20.38'
  // When not focused and value > 0 -> display value.toFixed(2)
  const formatDisplay = (): string => {
    if (digits === '') {
      return isFocused ? '' : value === 0 ? '' : value.toFixed(2);
    }
    const cents = parseInt(digits, 10);
    return (cents / 100).toFixed(2);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={formatDisplay()}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      title={title}
    />
  );
};
