import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { homePathFor, useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../api/client.js';
import Button from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Field.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const { success, error: notifyError } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState('');

  if (user) return <Navigate to={homePathFor(user)} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setValidation('');
    if (!form.email || !form.password) {
      setValidation('Ingrese su correo y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      const loggedUser = await login(form);
      success('Bienvenido a STOCKALERT');
      // No se respeta `state.from`: si era una ruta de inventario, un rol sin
      // ese permiso caería en /acceso-denegado apenas iniciar sesión.
      navigate(homePathFor(loggedUser), { replace: true });
    } catch (err) {
      notifyError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-hero__brand">
          <ShieldCheck size={26} />
          <strong>STOCKALERT</strong>
        </div>
        <div className="login-hero__content">
          <h1>Anticípese al desabastecimiento.</h1>
          <p>
            Centralice su inventario, registre cada movimiento y reciba alertas preventivas
            basadas en existencias reales y comportamiento histórico.
          </p>
          <div className="login-hero__features">
            <span>Trazabilidad completa</span>
            <span>Alertas inteligentes</span>
            <span>Indicadores en tiempo real</span>
          </div>
        </div>
        <p className="login-hero__footer">© {new Date().getFullYear()} STOCKALERT · Ingeniería de Software</p>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <span className="login-card__eyebrow">ACCESO AL SISTEMA</span>
          <h2>Iniciar sesión</h2>
          <p>Ingrese sus credenciales para continuar.</p>

          <form onSubmit={submit}>
            <Field label="Correo electrónico">
              <div className="input-with-icon">
                <Mail size={17} />
                <Input
                  type="email"
                  autoComplete="username"
                  placeholder="usuario@empresa.com"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
            </Field>

            <Field label="Contraseña">
              <div className="input-with-icon">
                <LockKeyhole size={17} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <button
                  type="button"
                  className="input-icon-button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            {validation && <p className="form-error">{validation}</p>}

            <Button type="submit" fullWidth loading={submitting} className="login-submit">
              Ingresar al sistema
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
