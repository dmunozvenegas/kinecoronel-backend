const { Pool } = require('pg');

const pool = new Pool({
    // Tus variables de conexión actuales (ya sea connectionString o DB_USER, etc.)
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    // NUEVAS REGLAS PARA NEONDB:
    idleTimeoutMillis: 30000,       // Cierra conexiones inactivas después de 30 segundos (evita zombies)
    connectionTimeoutMillis: 5000,  // Tiempo máximo para intentar conectarse
    max: 10                         // Límite de conexiones simultáneas para no saturar la capa gratuita
});

// Este bloque es vital para capturar las caídas de Neon sin que el servidor responda con error al frontend
pool.on('error', (err, client) => {
    console.error('🐘 Alerta inactiva de Neon DB capturada:', err.message);
});

module.exports = pool;