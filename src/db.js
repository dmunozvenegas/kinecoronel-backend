const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000, 
    idleTimeoutMillis: 30000,       
    max: 10                         
});

// --- RADAR DE CONEXIÓN ---
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error conectando a Neon DB:', err.message);
    } else {
        console.log('✅ Conexión a Neon DB exitosa!');
        release(); // libera el cliente
    }
});

pool.on('error', (err, client) => {
    console.error('🐘 Alerta inactiva de Neon DB ignorada:', err.message);
});

module.exports = pool;