-- Script de inicializacion de base de datos para PostgreSQL (Cartilla Digital)

-- Habilitar extension para generacion de UUIDs si no esta activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: VETERINARIAS (Clinicas / multitenant)
CREATE TABLE IF NOT EXISTS veterinarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    propietario VARCHAR(150),
    iniciales VARCHAR(10) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    direccion TEXT,
    logo_base64 TEXT,
    role VARCHAR(40) NOT NULL DEFAULT 'clinic_owner',
    estado_cuenta VARCHAR(40) NOT NULL DEFAULT 'activa',
    plan_actual VARCHAR(40) NOT NULL DEFAULT 'Free',
    plan_inicio DATE,
    plan_vencimiento DATE,
    trial_inicio DATE,
    trial_fin DATE,
    ultimo_login TIMESTAMP,
    notas_internas TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_veterinarias_email ON veterinarias(email);
CREATE INDEX IF NOT EXISTS idx_veterinarias_iniciales ON veterinarias(iniciales);

-- 2. TABLA: MASCOTAS (Pacientes)
CREATE TABLE IF NOT EXISTS mascotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    veterinaria_iniciales VARCHAR(10) NOT NULL,
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    especie VARCHAR(50) NOT NULL,
    raza VARCHAR(100),
    sexo VARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    color VARCHAR(100),
    peso NUMERIC(6, 2),
    esterilizado BOOLEAN DEFAULT false,
    foto_base64 TEXT,
    tutor_nombre VARCHAR(150) NOT NULL DEFAULT 'Sin Tutor',
    tutor_telefono VARCHAR(50),
    tutor_email TEXT,
    tutor_direccion TEXT,
    observaciones TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mascotas_veterinaria ON mascotas(veterinaria_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_codigo ON mascotas(codigo);

ALTER TABLE mascotas
    ADD COLUMN IF NOT EXISTS tutor_email TEXT;

-- 3. TABLA: RAZAS PERSONALIZADAS POR CLINICA
CREATE TABLE IF NOT EXISTS razas_clinica (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    especie VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    nombre_normalizado VARCHAR(100) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (veterinaria_id, especie, nombre_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_razas_clinica_veterinaria ON razas_clinica(veterinaria_id);

-- 3. TABLA: EQUIPO VETERINARIO
CREATE TABLE IF NOT EXISTS equipo_veterinario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    estado VARCHAR(20) DEFAULT 'activo',
    es_principal BOOLEAN DEFAULT false,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipo_veterinaria ON equipo_veterinario(veterinaria_id);

-- 4. TABLA: VACUNAS
CREATE TABLE IF NOT EXISTS vacunas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mascota_id UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    enfermedades VARCHAR(255),
    laboratorio VARCHAR(150),
    fecha_aplicacion DATE NOT NULL,
    proxima_dosis DATE,
    lote VARCHAR(100),
    responsable VARCHAR(150) NOT NULL,
    responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL,
    observaciones TEXT,
    status VARCHAR(20) DEFAULT 'pendiente',
    fecha_asistencia DATE
);

CREATE INDEX IF NOT EXISTS idx_vacunas_mascota ON vacunas(mascota_id);

-- 5. TABLA: DESPARASITACIONES (Internas y externas)
CREATE TABLE IF NOT EXISTS desparasitaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mascota_id UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL DEFAULT 'interna',
    producto VARCHAR(150) NOT NULL,
    tipo_producto VARCHAR(50),
    rango_peso VARCHAR(100),
    parasitos_cubre VARCHAR(255),
    fecha_aplicacion DATE NOT NULL,
    proxima_aplicacion DATE,
    dosis VARCHAR(100),
    via VARCHAR(50),
    responsable VARCHAR(150) NOT NULL,
    responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL,
    observaciones TEXT,
    status VARCHAR(20) DEFAULT 'pendiente',
    fecha_asistencia DATE
);

CREATE INDEX IF NOT EXISTS idx_desparasitaciones_mascota ON desparasitaciones(mascota_id);

-- 6. TABLA: CONTROLES CLINICOS
CREATE TABLE IF NOT EXISTS controles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mascota_id UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    peso NUMERIC(6, 2),
    temperatura NUMERIC(4, 1),
    fc INTEGER,
    fr INTEGER,
    hallazgos TEXT,
    diagnostico TEXT,
    tratamiento TEXT,
    recomendaciones TEXT,
    proximo_control DATE,
    responsable VARCHAR(150),
    responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pendiente',
    fecha_asistencia DATE
);

CREATE INDEX IF NOT EXISTS idx_controles_mascota ON controles(mascota_id);

-- 7. TABLA: TRANSFERENCIAS
CREATE TABLE IF NOT EXISTS transferencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mascota_id UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    veterinaria_origen_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    veterinaria_destino_id UUID REFERENCES veterinarias(id) ON DELETE CASCADE,
    codigo_transferencia VARCHAR(20) UNIQUE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transferencias_codigo ON transferencias(codigo_transferencia);

-- 7B. SISTEMA DE ASOCIACIONES Y TRANSFERENCIAS ENTRE CLINICAS
ALTER TABLE mascotas
    ADD COLUMN IF NOT EXISTS source_veterinaria_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_mascota_id UUID REFERENCES mascotas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_patient_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS received_by_transfer BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS transfer_request_id UUID,
    ADD COLUMN IF NOT EXISTS code_species VARCHAR(1),
    ADD COLUMN IF NOT EXISTS code_date VARCHAR(6),
    ADD COLUMN IF NOT EXISTS code_counter INTEGER,
    ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(30) DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_mascotas_source ON mascotas(source_veterinaria_id, source_mascota_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_transfer_request ON mascotas(transfer_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mascotas_veterinaria_codigo ON mascotas(veterinaria_id, codigo);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mascotas_code_sequence
    ON mascotas(veterinaria_id, code_species, code_date, code_counter)
    WHERE code_species IS NOT NULL AND code_date IS NOT NULL AND code_counter IS NOT NULL;

CREATE TABLE IF NOT EXISTS clinic_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_clinic_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    receiver_clinic_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    message TEXT,
    requested_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    responded_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (requester_clinic_id <> receiver_clinic_id),
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'blocked', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_clinic_associations_pair
    ON clinic_associations (
        LEAST(requester_clinic_id, receiver_clinic_id),
        GREATEST(requester_clinic_id, receiver_clinic_id)
    )
    WHERE status IN ('pending', 'accepted', 'blocked');
CREATE INDEX IF NOT EXISTS idx_clinic_associations_requester ON clinic_associations(requester_clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_associations_receiver ON clinic_associations(receiver_clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_associations_status ON clinic_associations(status);

CREATE TABLE IF NOT EXISTS patient_transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type VARCHAR(30) NOT NULL,
    transfer_type VARCHAR(40) NOT NULL,
    origin_clinic_id UUID REFERENCES veterinarias(id) ON DELETE CASCADE,
    destination_clinic_id UUID REFERENCES veterinarias(id) ON DELETE CASCADE,
    requester_clinic_id UUID REFERENCES veterinarias(id) ON DELETE CASCADE,
    receiver_clinic_id UUID REFERENCES veterinarias(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reason TEXT,
    rejection_reason TEXT,
    requested_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    responded_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (request_type IN ('send_patient', 'request_patient')),
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed', 'expired')),
    CHECK (transfer_type IN ('reference', 'definitive', 'history_consultation', 'emergency', 'continuity', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_patient_transfer_origin ON patient_transfer_requests(origin_clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfer_destination ON patient_transfer_requests(destination_clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfer_requester ON patient_transfer_requests(requester_clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfer_receiver ON patient_transfer_requests(receiver_clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfer_status ON patient_transfer_requests(status);

CREATE TABLE IF NOT EXISTS patient_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID NOT NULL REFERENCES patient_transfer_requests(id) ON DELETE CASCADE,
    source_patient_id UUID REFERENCES mascotas(id) ON DELETE SET NULL,
    copied_patient_id UUID REFERENCES mascotas(id) ON DELETE SET NULL,
    patient_name_snapshot TEXT,
    patient_code_snapshot TEXT,
    tutor_name_snapshot TEXT,
    species_snapshot TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_transfer_items_request ON patient_transfer_items(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfer_items_source ON patient_transfer_items(source_patient_id);

CREATE TABLE IF NOT EXISTS patient_request_search_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID NOT NULL REFERENCES patient_transfer_requests(id) ON DELETE CASCADE,
    patient_name TEXT,
    patient_code TEXT,
    tutor_name TEXT,
    tutor_phone TEXT,
    tutor_email TEXT,
    species TEXT,
    breed TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_request_search_transfer ON patient_request_search_data(transfer_request_id);

CREATE TABLE IF NOT EXISTS patient_transfer_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID NOT NULL REFERENCES patient_transfer_requests(id) ON DELETE CASCADE,
    include_pet_data BOOLEAN DEFAULT TRUE,
    include_tutor_data BOOLEAN DEFAULT TRUE,
    include_vaccines BOOLEAN DEFAULT FALSE,
    include_internal_deworming BOOLEAN DEFAULT FALSE,
    include_external_deworming BOOLEAN DEFAULT FALSE,
    include_preventive_history BOOLEAN DEFAULT FALSE,
    include_next_appointments BOOLEAN DEFAULT FALSE,
    include_observations BOOLEAN DEFAULT FALSE,
    include_photos BOOLEAN DEFAULT FALSE,
    include_full_history BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (transfer_request_id)
);

CREATE TABLE IF NOT EXISTS transfer_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES patient_transfer_requests(id) ON DELETE SET NULL,
    association_id UUID REFERENCES clinic_associations(id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    actor_user_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    actor_clinic_id UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_audit_request ON transfer_audit_logs(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_association ON transfer_audit_logs(association_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_clinic ON transfer_audit_logs(actor_clinic_id);

CREATE TABLE IF NOT EXISTS internal_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    type VARCHAR(60) NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    related_transfer_id UUID REFERENCES patient_transfer_requests(id) ON DELETE SET NULL,
    related_association_id UUID REFERENCES clinic_associations(id) ON DELETE SET NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_internal_notifications_vet ON internal_notifications(veterinaria_id, read_at, created_at);

-- 7C. SOPORTE ADMIN CENTER
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

-- 7D. FASE 2 - CONTROL AVANZADO Y SOPORTE
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

CREATE TABLE IF NOT EXISTS support_internal_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    created_by UUID REFERENCES veterinarias(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    follow_up_status VARCHAR(30) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_internal_notes_clinic ON support_internal_notes(clinic_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_mascotas_transfer_request'
    ) THEN
        ALTER TABLE mascotas
            ADD CONSTRAINT fk_mascotas_transfer_request
            FOREIGN KEY (transfer_request_id) REFERENCES patient_transfer_requests(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 8. TABLA: TOKENS DE RECUPERACION DE PASSWORD
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    expira_en TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

-- 9. TABLAS: BANCO CLINICO
CREATE TABLE IF NOT EXISTS banco_vacunas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(80),
    especie VARCHAR(50) DEFAULT 'Ambos',
    enfermedades TEXT,
    laboratorio VARCHAR(100),
    lote VARCHAR(50),
    frecuencia VARCHAR(50),
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banco_vacunas_veterinaria ON banco_vacunas(veterinaria_id);

CREATE TABLE IF NOT EXISTS banco_internos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    principio_activo VARCHAR(150),
    especie VARCHAR(50) DEFAULT 'Ambos',
    tipo VARCHAR(50),
    rango_peso VARCHAR(50),
    parasitos TEXT,
    dosis VARCHAR(50),
    via VARCHAR(50),
    frecuencia VARCHAR(100),
    laboratorio VARCHAR(100),
    lote VARCHAR(50),
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banco_internos_veterinaria ON banco_internos(veterinaria_id);

CREATE TABLE IF NOT EXISTS banco_externos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    principio_activo VARCHAR(150),
    especie VARCHAR(50) DEFAULT 'Ambos',
    tipo VARCHAR(50),
    rango_peso VARCHAR(50),
    duracion VARCHAR(100),
    parasitos TEXT,
    dosis VARCHAR(50),
    via VARCHAR(50),
    frecuencia VARCHAR(100),
    laboratorio VARCHAR(100),
    lote VARCHAR(50),
    observaciones TEXT,
    advertencias TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banco_externos_veterinaria ON banco_externos(veterinaria_id);
