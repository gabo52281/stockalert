import { useLayoutEffect, useRef, useState } from 'react';
import {
  caretForDigitCount, digitsBeforeCaret, formatCurrencyDigits, parseCurrencyDigits,
} from '../../utils/numeric.js';

/**
 * Campo controlado para valores COP. El estado del formulario conserva solo
 * dígitos; la interfaz muestra `$ 1.250.000` mientras se escribe.
 */
export default function CurrencyInput({ value, onChange, ...props }) {
  const inputRef = useRef(null);
  const caretDigitsRef = useRef(null);
  const [error, setError] = useState('');
  const [cursorVersion, setCursorVersion] = useState(0);

  const formatted = formatCurrencyDigits(value);

  useLayoutEffect(() => {
    if (caretDigitsRef.current === null || !inputRef.current) return;
    const position = caretForDigitCount(formatted, caretDigitsRef.current);
    inputRef.current.setSelectionRange(position, position);
    caretDigitsRef.current = null;
  }, [formatted, cursorVersion]);

  const handleChange = (event) => {
    const raw = event.target.value;
    const digitCount = digitsBeforeCaret(raw, event.target.selectionStart);
    const parsed = parseCurrencyDigits(raw);

    caretDigitsRef.current = digitCount;
    setCursorVersion((version) => version + 1);

    if (parsed === null) {
      setError('Use solo números enteros en pesos colombianos.');
      return;
    }

    setError('');
    onChange(parsed);
  };

  return (
    <>
      <input
        {...props}
        ref={inputRef}
        className={`input ${props.className || ''}`.trim()}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatted}
        onChange={handleChange}
      />
      {error && <small className="field__error">{error}</small>}
    </>
  );
}
