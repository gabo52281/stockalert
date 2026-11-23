-- Se elimina el cambio obligatorio de contraseña.
-- La contraseña inicial la entrega el administrador y el usuario puede cambiarla
-- cuando quiera desde Perfil; el reset sigue invalidando sesiones por password_version.
ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;
