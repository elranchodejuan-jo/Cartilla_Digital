const { Client } = require('pg');
require('dotenv').config();

const password = process.env.DB_PASSWORD || '123JuanJo456&_&_';
const projectRef = 'ljvhnbbtlofdolwyoddn';
const host = 'aws-0-us-west-2.pooler.supabase.com';

const configs = [
    {
        name: 'Config 1: User with project ref, Port 5432, Direct Options',
        clientOpts: {
            user: `postgres.${projectRef}`,
            password: password,
            host: host,
            port: 5432,
            database: 'postgres',
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Config 2: User with project ref, Port 6543, Direct Options',
        clientOpts: {
            user: `postgres.${projectRef}`,
            password: password,
            host: host,
            port: 6543,
            database: 'postgres',
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Config 3: User ONLY postgres, Port 5432, Direct Options',
        clientOpts: {
            user: 'postgres',
            password: password,
            host: host,
            port: 5432,
            database: 'postgres',
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Config 4: User ONLY postgres, Port 6543, Direct Options',
        clientOpts: {
            user: 'postgres',
            password: password,
            host: host,
            port: 6543,
            database: 'postgres',
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Config 5: URI format, Port 6543, URL Encoded Password',
        clientOpts: {
            connectionString: `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${host}:6543/postgres`,
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Config 6: URI format, Port 5432, URL Encoded Password',
        clientOpts: {
            connectionString: `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${host}:5432/postgres`,
            ssl: { rejectUnauthorized: false }
        }
    }
];

async function runTests() {
    for (const config of configs) {
        console.log(`Running: ${config.name}...`);
        const client = new Client(config.clientOpts);
        try {
            await client.connect();
            console.log(`✅ SUCCESS! Connected to DB!`);
            const res = await client.query('SELECT NOW()');
            console.log(`Server time: ${res.rows[0].now}`);
            await client.end();
            console.log(`Connection closed successfully.\n`);
            return; // Stop on first success
        } catch (err) {
            console.log(`❌ FAILED: ${err.message} (Code: ${err.code})\n`);
            try { await client.end(); } catch (e) {}
        }
    }
    console.log('All connection configurations failed.');
}

runTests();
