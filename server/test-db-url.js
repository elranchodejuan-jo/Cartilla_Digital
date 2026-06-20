const { Client } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no esta configurada. Este diagnostico solo se ejecuta con una URL explicita en server/.env.');
    process.exit(1);
}

console.log('Probando conexion con DATABASE_URL configurada en entorno...');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.connect()
    .then(async () => {
        console.log('Conexion exitosa usando DATABASE_URL.');
        const res = await client.query('SELECT NOW()');
        console.log('Hora del servidor:', res.rows[0].now);
        await client.end();
    })
    .catch(err => {
        console.error('Conexion fallida:', err.message);
        client.end().catch(() => {});
    });
