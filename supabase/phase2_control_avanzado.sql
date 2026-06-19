-- Fase 2 - Control avanzado de Cartilla Digital
-- Migracion segura sugerida: no elimina datos ni modifica columnas destructivamente.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tickets enviados por clinicas al administrador.
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    user_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(60) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'media',
    status VARCHAR(40) NOT NULL DEFAULT 'enviado',
    related_module VARCHAR(80),
    admin_response TEXT,
    admin_notes TEXT,
    assigned_to UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    attachment_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    CHECK (status IN ('enviado', 'recibido', 'revisado', 'en_proceso', 'en_desarrollo', 'solucionado', 'rechazado', 'cerrado')),
    CHECK (priority IN ('baja', 'media', 'alta', 'urgente')),
    CHECK (type IN ('problema_tecnico', 'error_sistema', 'sugerencia', 'solicitud_mejora', 'duda', 'pago_plan', 'impresion_pdf', 'qr_cartilla_publica', 'recordatorios', 'otro'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_clinic ON support_tickets(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);

-- Conversacion futura o respuestas adicionales dentro del ticket.
CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    sender_role VARCHAR(40) NOT NULL DEFAULT 'clinic',
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at ASC);

-- Auditoria de cambios de estado de tickets.
CREATE TABLE IF NOT EXISTS support_ticket_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    previous_status VARCHAR(40),
    new_status VARCHAR(40) NOT NULL,
    changed_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_history_ticket ON support_ticket_status_history(ticket_id, created_at ASC);

-- Historial de pagos manuales o conectados a pasarela futura.
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    subscription_id UUID,
    plan_name TEXT,
    amount NUMERIC(12, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    payment_method TEXT,
    payment_status VARCHAR(30) DEFAULT 'pendiente',
    payment_date TIMESTAMP,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    reference TEXT,
    receipt_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (payment_status IN ('pagado', 'pendiente', 'fallido', 'vencido', 'reembolsado', 'manual', 'verificado'))
);

CREATE INDEX IF NOT EXISTS idx_payments_clinic ON payments(clinic_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);

-- Alertas persistentes gestionables por el administrador.
CREATE TABLE IF NOT EXISTS admin_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES veterinarias(id) ON DELETE CASCADE,
    alert_type VARCHAR(80),
    title TEXT NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'media',
    status VARCHAR(30) DEFAULT 'pendiente',
    source_module VARCHAR(80),
    related_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    CHECK (severity IN ('baja', 'media', 'alta', 'critica')),
    CHECK (status IN ('pendiente', 'en_revision', 'resuelta', 'ignorada'))
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON admin_alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_clinic ON admin_alerts(clinic_id);

-- Notas internas de soporte por clinica.
CREATE TABLE IF NOT EXISTS support_internal_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    created_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    follow_up_status VARCHAR(30) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_internal_notes_clinic ON support_internal_notes(clinic_id, created_at DESC);

-- RLS sugerido para Supabase si se expone acceso directo desde cliente.
-- Este proyecto usa API Express con JWT y validacion de tenant en servidor;
-- si mas adelante se consulta Supabase directo desde frontend, activar RLS
-- y crear politicas equivalentes por clinic_id y role super_admin.
