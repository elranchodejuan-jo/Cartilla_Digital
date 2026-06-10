const { Client } = require('pg');

// URL encode the password: "123JuanJo456&_&_" -> "123JuanJo456%26_%26_"
const connectionString = 'postgresql://postgres.ljvhnbbtlofdolwyoddn:123JuanJo456%26_%26_@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require';

console.log('Testing connection with URL-encoded connection string...');

const client = new Client({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

client.connect()
    .then(async () => {
        console.log('✅ Connection successful using connection URL!');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0].now);
        await client.end();
    })
    .catch(err => {
        console.error('❌ Connection failed:', err.message);
        client.end().catch(() => {});
    });
