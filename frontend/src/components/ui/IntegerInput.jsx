import { useLayoutEffect, useRef, useState } from 'react';
import {
  caretForDigitCount, digitsBeforeCaret, isIntegerText, normalizeDigits,
} from '../../utils/numeric.js';

function validationMessage(value, { required, allowZero, min, max }) {
  if (value === '') return required ? 'Este campo es obligatorio.' : '';
  if (!isIntegerText(value, { allowZero })) {
    return allowZero ? 'Solo se permiten números enteros.' : 'Debe ser un entero mayor que cero.';
  }
  const number = Number(value);
  if (min !== undefined && number < Number(min)) return `El valor mínimo es ${min}.`;
  if (max !== undefined && number > Number(max)) return `El valor máximo es ${max}.`;
  return '';
}

/**
 * Campo controlado para unidades físicas. El padre conserva siempre una cadena
 * de dígitos (o `''` mientras se edita); nunca un número que pueda reintroducir
 * un cero al borrar. Los rangos se validan al perder el foco y al enviar, no
 * durante la escritura, para que borrar no restaure el valor anterior.
 */
export default function IntegerInput({
  value, onChange, allowZero = true, min, max, required, ...props
}) {
  const inputRef = useRef(null);
  const caretDigitsRef = useRef(null);
  const [touched, setTouched] = useState(false);

  const digits = normalizeDigits(value ?? '');
  const message = validationMessage(digits, { required, allowZero, min, max });
  const showError = touched && Boolean(message);

  useLayoutEffect(() => {
    inputRef.current?.setCustomValidity(message);
  }, [message]);

  useLayoutEffect(() => {
    if (caretDigitsRef.current === null || !inputRef.current) return;
    const position = caretForDigitCount(digits, caretDigitsRef.current);
    inputRef.current.setSelectionRange(position, position);
    caretDigitsRef.current = null;
  }, [digits]);

  const handleChange = (event) => {
    const raw = event.target.value;

    if (raw !== '' && !/^\d+$/.test(raw)) {
      // Carácter no numérico: no se propaga y React restaura el texto controlado.
      caretDigitsRef.current = null;
      return;
    }

    caretDigitsRef.current = digitsBeforeCaret(raw, event.target.selectionStart);
    onChange(normalizeDigits(raw));
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
        pattern="[0-9]*"
        required={required}
        value={digits}
        onChange={handleChange}
        onBlur={(event) => { setTouched(true); props.onBlur?.(event); }}
        onInvalid={(event) => { setTouched(true); props.onInvalid?.(event); }}
        aria-invalid={showError || undefined}
      />
      {showError && <small className="field__error">{message}</small>}
    </>
  );
}
