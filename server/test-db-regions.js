const { Client } = require('pg');
require('dotenv').config();

const regions = [
    'sa-east-1',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'ca-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-south-1'
];

const required = ['DB_PASSWORD', 'SUPABASE_PROJECT_REF'];
const missing = required.filter(key => !process.env[key]);

if (missing.length) {
    console.error(`Faltan variables para diagnostico regional: ${missing.join(', ')}`);
    process.exit(1);
}

async function testRegions() {
    for (const region of regions) {
        const host = `aws-0-${region}.pooler.supabase.com`;
        console.log(`Probando region: ${region} (${host})...`);
        const client = new Client({
            user: `postgres.${process.env.SUPABASE_PROJECT_REF}`,
            password: process.env.DB_PASSWORD,
            host,
            port: 5432,
            database: process.env.DB_NAME || 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            await client.connect();
            console.log(`Conexion exitosa en region: ${region}.`);
            const res = await client.query('SELECT NOW()');
            console.log(`Hora del servidor: ${res.rows[0].now}`);
            await client.end();
            return;
        } catch (err) {
            console.log(`Fallo ${region}: ${err.message}`);
            try { await client.end(); } catch (e) {}
        }
        console.log('--------------------------------------------------');
    }
    console.log('Ninguna region probada pudo conectar.');
}

testRegions();
