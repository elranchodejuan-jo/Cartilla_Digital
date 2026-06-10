const { Pool } = require('pg');
require('dotenv').config();

console.log('Testing direct IPv6 connection...');
console.log('IP:', '2600:1f14:359d:9301:d34d:1575:9756:c6a4');

const pool = new Pool({
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    host: '2600:1f14:359d:9301:d34d:1575:9756:c6a4',
    port: 5432,
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection failed:', err.message);
    } else {
        console.log('Connection successful! Server time:', res.rows[0].now);
    }
    pool.end();
});
