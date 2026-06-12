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
