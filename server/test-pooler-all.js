const { Client } = require('pg');
require('dotenv').config();

const required = ['DB_PASSWORD', 'SUPABASE_PROJECT_REF', 'SUPABASE_POOLER_HOST'];
const missing = required.filter(key => !process.env[key]);

if (missing.length) {
    console.error(`Faltan variables para el diagnostico: ${missing.join(', ')}`);
    console.error('No se ejecuta ninguna prueba sin credenciales explicitas en server/.env.');
    process.exit(1);
}

const password = process.env.DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const host = process.env.SUPABASE_POOLER_HOST;
const database = process.env.DB_NAME || 'postgres';

const configs = [
    {
        name: 'Pooler 5432 con usuario postgres.<project-ref>',
        clientOpts: {
            user: `postgres.${projectRef}`,
            password,
            host,
            port: 5432,
            database,
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Pooler 6543 con usuario postgres.<project-ref>',
        clientOpts: {
            user: `postgres.${projectRef}`,
            password,
            host,
            port: 6543,
            database,
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Pooler 5432 con usuario DB_USER',
        clientOpts: {
            user: process.env.DB_USER || 'postgres',
            password,
            host,
            port: 5432,
            database,
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Pooler 6543 con usuario DB_USER',
        clientOpts: {
            user: process.env.DB_USER || 'postgres',
            password,
            host,
            port: 6543,
            database,
            ssl: { rejectUnauthorized: false }
        }
    }
];

async function runTests() {
    for (const config of configs) {
        console.log(`Probando: ${config.name}...`);
        const client = new Client(config.clientOpts);
        try {
            await client.connect();
            console.log('Conexion exitosa.');
            const res = await client.query('SELECT NOW()');
            console.log(`Hora del servidor: ${res.rows[0].now}`);
            await client.end();
            return;
        } catch (err) {
            console.log(`Fallo: ${err.message} (Code: ${err.code || 'sin codigo'})`);
            try { await client.end(); } catch (e) {}
        }
    }
    console.log('Ninguna configuracion pudo conectar.');
}

runTests();
