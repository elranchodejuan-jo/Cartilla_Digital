const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false // Requerido para conexiones seguras en Supabase
    }
});

// Automatizar migración de columnas del tutor si no existen
const migrarBaseDatos = async () => {
    try {
        await pool.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            
            ALTER TABLE mascotas 
            ADD COLUMN IF NOT EXISTS tutor_nombre VARCHAR(150) NOT NULL DEFAULT 'Sin Tutor',
            ADD COLUMN IF NOT EXISTS tutor_telefono VARCHAR(50),
            ADD COLUMN IF NOT EXISTS tutor_direccion TEXT;
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
                token VARCHAR(64) UNIQUE NOT NULL,
                expira_en TIMESTAMP NOT NULL,
                usado BOOLEAN DEFAULT FALSE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS equipo_veterinario (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
                nombre VARCHAR(150) NOT NULL,
                cargo VARCHAR(100) NOT NULL,
                estado VARCHAR(20) DEFAULT 'activo',
                es_principal BOOLEAN DEFAULT false,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE vacunas
                ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente',
                ADD COLUMN IF NOT EXISTS fecha_asistencia DATE;

            ALTER TABLE desparasitaciones
                ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente',
                ADD COLUMN IF NOT EXISTS fecha_asistencia DATE;

            ALTER TABLE controles
                ADD COLUMN IF NOT EXISTS responsable VARCHAR(150),
                ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente',
                ADD COLUMN IF NOT EXISTS fecha_asistencia DATE;

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

            ALTER TABLE banco_vacunas
                ADD COLUMN IF NOT EXISTS tipo VARCHAR(80);

            ALTER TABLE banco_internos
                ADD COLUMN IF NOT EXISTS principio_activo VARCHAR(150),
                ADD COLUMN IF NOT EXISTS frecuencia VARCHAR(100),
                ADD COLUMN IF NOT EXISTS laboratorio VARCHAR(100),
                ADD COLUMN IF NOT EXISTS lote VARCHAR(50);

            ALTER TABLE banco_externos
                ADD COLUMN IF NOT EXISTS principio_activo VARCHAR(150),
                ADD COLUMN IF NOT EXISTS duracion VARCHAR(100),
                ADD COLUMN IF NOT EXISTS frecuencia VARCHAR(100),
                ADD COLUMN IF NOT EXISTS laboratorio VARCHAR(100),
                ADD COLUMN IF NOT EXISTS lote VARCHAR(50),
                ADD COLUMN IF NOT EXISTS advertencias TEXT;

            CREATE INDEX IF NOT EXISTS idx_equipo_veterinaria ON equipo_veterinario(veterinaria_id);
        `);
        console.log('Migración de base de datos verificada y al día.');
    } catch (e) {
        console.error('Error durante la migración automática de la base de datos:', e.message);
    }
};

// Prueba de conexión al inicializar
pool.query('SELECT NOW()', async (err, res) => {
    if (err) {
        console.error('Error de conexión a PostgreSQL en Supabase:', err.message);
    } else {
        console.log('Conexión exitosa a PostgreSQL. Hora del servidor:', res.rows[0].now);
        await migrarBaseDatos();
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
