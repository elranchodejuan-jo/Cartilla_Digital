-- Admin Center - migracion segura sugerida para Cartilla Digital
-- No elimina datos ni renombra tablas existentes.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE veterinarias
    ADD COLUMN IF NOT EXISTS role VARCHAR(40) NOT NULL DEFAULT 'clinic_owner',
    ADD COLUMN IF NOT EXISTS estado_cuenta VARCHAR(40) NOT NULL DEFAULT 'activa',
    ADD COLUMN IF NOT EXISTS plan_actual VARCHAR(40) NOT NULL DEFAULT 'Free',
    ADD COLUMN IF NOT EXISTS plan_inicio DATE,
    ADD COLUMN IF NOT EXISTS plan_vencimiento DATE,
    ADD COLUMN IF NOT EXISTS trial_inicio DATE,
    ADD COLUMN IF NOT EXISTS trial_fin DATE,
    ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP,
    ADD COLUMN IF NOT EXISTS notas_internas TEXT;

CREATE TABLE IF NOT EXISTS admin_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    user_email TEXT,
    type VARCHAR(40) DEFAULT 'sugerencia',
    priority VARCHAR(20) DEFAULT 'media',
    message TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(40) DEFAULT 'nuevo',
    internal_response TEXT,
    internal_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_feedback_status ON admin_feedback(status);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_veterinaria ON admin_feedback(veterinaria_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    actor_email TEXT,
    clinic_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    module VARCHAR(80),
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    level VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_clinic ON activity_logs(clinic_id);

-- Para asignarte como super admin:
-- UPDATE veterinarias
-- SET role = 'super_admin'
-- WHERE email = 'tu-correo@dominio.com';
