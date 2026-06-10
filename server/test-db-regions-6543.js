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

async function testRegions() {
    for (const region of regions) {
        const host = `aws-0-${region}.pooler.supabase.com`;
        console.log(`Probando región (Puerto 6543): ${region} (${host})...`);
        const client = new Client({
            user: 'postgres.ljvhnbbtlofdolwyoddn',
            password: process.env.DB_PASSWORD,
            host: host,
            port: 6543,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });
        
        try {
            await client.connect();
            console.log(`✅ ¡CONEXIÓN EXITOSA en la región (Puerto 6543): ${region}!`);
            const res = await client.query('SELECT NOW()');
            console.log(`Hora del servidor: ${res.rows[0].now}`);
            await client.end();
            return;
        } catch (err) {
            console.log(`❌ Falló ${region}: ${err.message}`);
            try { await client.end(); } catch(e) {}
        }
        console.log('--------------------------------------------------');
    }
    console.log('Ninguna de las regiones en puerto 6543 pudo conectar.');
}

testRegions();
