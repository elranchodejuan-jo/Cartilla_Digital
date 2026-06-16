-- Script de inicializacion de base de datos para PostgreSQL (Cartilla Digital)

-- Habilitar extension para generacion de UUIDs si no esta activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: VETERINARIAS (Clinicas / multitenant)
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

CREATE INDEX IF NOT EXISTS idx_mascotas_veterinaria ON mascotas(veterinaria_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_codigo ON mascotas(codigo);

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
