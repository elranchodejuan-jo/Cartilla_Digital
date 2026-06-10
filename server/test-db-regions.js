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
    'eu-west-2',     // London
    'eu-west-3',     // Paris
    'eu-central-1',
    'ap-southeast-1', // Singapore
    'ap-southeast-2', // Sydney
    'ap-northeast-1', // Tokyo
    'ap-northeast-2', // Seoul
    'ap-south-1'      // Mumbai
];

async function testRegions() {
    for (const region of regions) {
        const host = `aws-0-${region}.pooler.supabase.com`;
        console.log(`Probando región: ${region} (${host})...`);
        const client = new Client({
            user: 'postgres.ljvhnbbtlofdolwyoddn',
            password: process.env.DB_PASSWORD,
            host: host,
            port: 5432,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });
        
        try {
            await client.connect();
            console.log(`✅ ¡CONEXIÓN EXITOSA en la región: ${region}!`);
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
    console.log('Ninguna de las regiones probadas pudo conectar.');
}

testRegions();
