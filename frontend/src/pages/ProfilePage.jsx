import { useState } from 'react';
import { KeyRound, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { authApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Field.jsx';
import Badge from '../components/ui/Badge.jsx';

export default function ProfilePage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirm) {
      notifyError('Las contraseñas nuevas no coinciden');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      success('Contraseña actualizada correctamente');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      notifyError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Mi perfil" description="Información de la cuenta y cambio de contraseña." />
      <div className="grid-2">
        <Card>
          <CardHeader title="Datos personales" subtitle="Información asociada a su usuario" />
          <CardBody>
            <div className="profile-details">
              <div className="avatar avatar--large">{user?.name?.charAt(0)?.toUpperCase()}</div>
              <div>
                <h3>{user?.name}</h3>
                <p>{user?.email}</p>
                <Badge tone="info">{user?.roleLabel}</Badge>
              </div>
            </div>
            <ul className="detail-list">
              <li><span>Identificador</span><strong>#{user?.id}</strong></li>
              <li><span>Rol del sistema</span><strong>{user?.role}</strong></li>
              <li><span>Estado</span><strong>{user?.active ? 'Activo' : 'Inactivo'}</strong></li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cambiar contraseña" subtitle="Use al menos 8 caracteres" />
          <CardBody>
            <form onSubmit={submit} className="form-stack">
              <Field label="Contraseña actual">
                <Input type="password" value={form.currentPassword} required
                  onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} />
              </Field>
              <Field label="Nueva contraseña">
                <Input type="password" value={form.newPassword} minLength={8} required
                  onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
              </Field>
              <Field label="Confirmar contraseña">
                <Input type="password" value={form.confirm} minLength={8} required
                  onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
              </Field>
              <Button type="submit" icon={KeyRound} loading={saving}>Actualizar contraseña</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
