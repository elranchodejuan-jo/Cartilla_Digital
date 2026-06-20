const { Pool } = require('pg');
require('dotenv').config();

const required = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME'];
const missing = required.filter(key => !process.env[key]);

if (missing.length) {
    console.error(`Faltan variables de conexion: ${missing.join(', ')}`);
    process.exit(1);
}

console.log('Probando conexion PostgreSQL con variables DB_*...');

const sslValue = (process.env.DB_SSL || '').toLowerCase();
const ssl = ['1', 'true', 'yes', 'require'].includes(sslValue)
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    ssl
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Conexion fallida:', err.message);
    } else {
        console.log('Conexion exitosa. Hora del servidor:', res.rows[0].now);
    }
    pool.end();
});
