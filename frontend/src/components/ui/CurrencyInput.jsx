import { useLayoutEffect, useRef, useState } from 'react';
import {
  caretForDigitCount, digitsBeforeCaret, formatCurrencyDigits, normalizeDigits,
  parseCurrencyEditing,
} from '../../utils/numeric.js';

/**
 * Campo controlado para valores COP. El estado del formulario conserva solo
 * dígitos (o `''`), nunca texto formateado ni el valor anterior. La interfaz
 * muestra `$ 1.250.000` y reconstruye el formato después de cada edición,
 * incluidos los estados intermedios al borrar o borrar en medio.
 */
export default function CurrencyInput({ value, onChange, required, ...props }) {
  const inputRef = useRef(null);
  const caretDigitsRef = useRef(null);
  const [touched, setTouched] = useState(false);
  const [inputError, setInputError] = useState('');
  const [cursorVersion, setCursorVersion] = useState(0);

  const digits = normalizeDigits(value ?? '');
  const formatted = formatCurrencyDigits(digits);
  const message = inputError || (digits === '' && required ? 'Este campo es obligatorio.' : '');
  const showError = touched && Boolean(message);

  useLayoutEffect(() => {
    inputRef.current?.setCustomValidity(message);
  }, [message]);

  useLayoutEffect(() => {
    if (caretDigitsRef.current === null || !inputRef.current) return;
    const position = caretForDigitCount(formatted, caretDigitsRef.current);
    inputRef.current.setSelectionRange(position, position);
    caretDigitsRef.current = null;
  }, [formatted, cursorVersion]);

  const handleChange = (event) => {
    const raw = event.target.value;
    const parsed = parseCurrencyEditing(raw, digits);

    if (parsed === null) {
      // Entrada incompatible (decimal, signo, letra…): React restaura el valor
      // controlado, pero el estado del padre se conserva intacto.
      caretDigitsRef.current = null;
      setInputError('Use solo números enteros en pesos colombianos.');
      setTouched(true);
      return;
    }

    caretDigitsRef.current = digitsBeforeCaret(raw, event.target.selectionStart);
    setInputError('');
    setCursorVersion((version) => version + 1);
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
        required={required}
        value={formatted}
        onChange={handleChange}
        onBlur={(event) => { setTouched(true); props.onBlur?.(event); }}
        onInvalid={(event) => { setTouched(true); props.onInvalid?.(event); }}
        aria-invalid={showError || undefined}
      />
      {showError && <small className="field__error">{message}</small>}
    </>
  );
}
