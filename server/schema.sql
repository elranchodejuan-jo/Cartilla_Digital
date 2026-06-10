-- Script de Inicialización de Base de Datos para PostgreSQL (Cartilla Digital)

-- Habilitar extensión para generación de UUIDs si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: VETERINARIAS (Clínicas / Multitenant)
CREATE TABLE IF NOT EXISTS veterinarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    iniciales VARCHAR(10) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    direccion TEXT,
    logo_base64 TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices para búsquedas de login rápidos
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
    foto_base64 TEXT,
    tutor_nombre VARCHAR(150) NOT NULL DEFAULT 'Sin Tutor',
    tutor_telefono VARCHAR(50),
    tutor_direccion TEXT,
    observaciones TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices de mascota por clínica y búsquedas de QR
CREATE INDEX IF NOT EXISTS idx_mascotas_veterinaria ON mascotas(veterinaria_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_codigo ON mascotas(codigo);

-- 3. TABLA: VACUNAS
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
    observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_vacunas_mascota ON vacunas(mascota_id);

-- 4. TABLA: DESPARASITACIONES (Internas y Externas)
CREATE TABLE IF NOT EXISTS desparasitaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mascota_id UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL DEFAULT 'interna', -- 'interna' o 'externa'
    producto VARCHAR(150) NOT NULL,
    tipo_producto VARCHAR(50), -- tableta, pipeta, collar, etc.
    rango_peso VARCHAR(100),
    parasitos_cubre VARCHAR(255),
    fecha_aplicacion DATE NOT NULL,
    proxima_aplicacion DATE,
    dosis VARCHAR(100),
    via VARCHAR(50),
    responsable VARCHAR(150) NOT NULL,
    observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_desparasitaciones_mascota ON desparasitaciones(mascota_id);

-- 5. TABLA: CONTROLES CLÍNICOS
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
    proximo_control DATE
);

CREATE INDEX IF NOT EXISTS idx_controles_mascota ON controles(mascota_id);

-- 6. TABLA: TRANSFERENCIAS (Historial e inicio de transferencias entre clínicas)
CREATE TABLE IF NOT EXISTS transferencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mascota_id UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    veterinaria_origen_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
    veterinaria_destino_id UUID REFERENCES veterinarias(id) ON DELETE CASCADE, -- NULL si es transferencia abierta con código
    codigo_transferencia VARCHAR(20) UNIQUE NOT NULL, -- ej: TX-892A41
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'completada', 'expirada'
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transferencias_codigo ON transferencias(codigo_transferencia);
