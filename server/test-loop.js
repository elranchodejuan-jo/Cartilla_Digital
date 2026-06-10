const { Client } = require('pg');

const password = 'CartillaDigital2026BaseDatos';
const projectRef = 'ljvhnbbtlofdolwyoddn';
const host = 'aws-0-us-west-2.pooler.supabase.com';

const configs = [
    { name: 'Port 6543', port: 6543 },
    { name: 'Port 5432', port: 5432 }
];

let attempts = 0;
const maxAttempts = 24; // 2 minutes total (24 * 5s)

async function testConnection() {
    attempts++;
    console.log(`--- Attempt ${attempts}/${maxAttempts} ---`);
    for (const config of configs) {
        const client = new Client({
            user: `postgres.${projectRef}`,
            password: password,
            host: host,
            port: config.port,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            await client.connect();
            console.log(`✅ SUCCESS on ${config.name}! Connected to DB!`);
            const res = await client.query('SELECT NOW()');
            console.log(`Server time: ${res.rows[0].now}`);
            await client.end();
            process.exit(0); // Success! Exit the script.
        } catch (err) {
            console.log(`❌ ${config.name} Failed: ${err.message}`);
            try { await client.end(); } catch (e) {}
        }
    }

    if (attempts >= maxAttempts) {
        console.log('Finished testing. All attempts failed.');
        process.exit(1);
    } else {
        setTimeout(testConnection, 5000);
    }
}

console.log('Starting propagation connection test loop...');
testConnection();
