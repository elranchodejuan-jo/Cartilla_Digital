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
            
            -- Migración Ajuste 3: Estados
            ALTER TABLE vacunas ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente', ADD COLUMN IF NOT EXISTS fecha_asistencia DATE;
            ALTER TABLE desparasitaciones ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente', ADD COLUMN IF NOT EXISTS fecha_asistencia DATE;
            ALTER TABLE controles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente', ADD COLUMN IF NOT EXISTS fecha_asistencia DATE;
            
            -- Migración Ajuste 5: Bancos Clínicos
            CREATE TABLE IF NOT EXISTS banco_vacunas (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
                nombre VARCHAR(150) NOT NULL,
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
                especie VARCHAR(50) DEFAULT 'Ambos',
                tipo VARCHAR(50),
                rango_peso VARCHAR(50),
                parasitos TEXT,
                dosis VARCHAR(50),
                via VARCHAR(50),
                observaciones TEXT,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS banco_externos (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
                nombre VARCHAR(150) NOT NULL,
                especie VARCHAR(50) DEFAULT 'Ambos',
                tipo VARCHAR(50),
                rango_peso VARCHAR(50),
                parasitos TEXT,
                dosis VARCHAR(50),
                via VARCHAR(50),
                observaciones TEXT,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
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
