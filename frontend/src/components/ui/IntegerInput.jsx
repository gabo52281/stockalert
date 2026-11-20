import { useState } from 'react';
import { isIntegerText, normalizeDigits } from '../../utils/numeric.js';

/**
 * Campo controlado para unidades físicas. Solo acepta dígitos: no permite
 * decimales, signos, notación científica ni cambio de valor con la rueda del ratón.
 */
export default function IntegerInput({
  value, onChange, allowZero = true, min, max, ...props
}) {
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const raw = event.target.value;

    if (raw === '') {
      setError('');
      onChange('');
      return;
    }

    if (!isIntegerText(raw, { allowZero })) {
      setError(allowZero ? 'Solo se permiten números enteros.' : 'Debe ser un entero mayor que cero.');
      return;
    }

    const number = Number(raw);
    if (min !== undefined && number < Number(min)) {
      setError(`El valor mínimo es ${min}.`);
      return;
    }
    if (max !== undefined && number > Number(max)) {
      setError(`El valor máximo es ${max}.`);
      return;
    }

    setError('');
    onChange(normalizeDigits(raw));
  };

  return (
    <>
      <input
        {...props}
        className={`input ${props.className || ''}`.trim()}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        value={value ?? ''}
        onChange={handleChange}
      />
      {error && <small className="field__error">{error}</small>}
    </>
  );
}
