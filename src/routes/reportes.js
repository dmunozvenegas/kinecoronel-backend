const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET: Obtener datos para el Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // 1. Obtener la cantidad de sesiones agrupadas por mes (Últimos 6 meses)
        const querySesiones = `
            SELECT 
                EXTRACT(MONTH FROM fecha) AS mes_numero,
                COUNT(*) AS total_sesiones
            FROM sesiones
            WHERE fecha >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY EXTRACT(MONTH FROM fecha)
            ORDER BY EXTRACT(MONTH FROM fecha);
        `;
        
        // 2. Obtener total de pacientes registrados (Para el KPI)
        const queryPacientes = `SELECT COUNT(*) as total FROM pacientes`;

        const [sesionesResult, pacientesResult] = await Promise.all([
            pool.query(querySesiones),
            pool.query(queryPacientes)
        ]);

        // Mapear el número del mes a su nombre en español
        const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        const datosGrafico = sesionesResult.rows.map(row => ({
            mes: nombresMeses[row.mes_numero - 1],
            sesiones: parseInt(row.total_sesiones)
        }));

        res.status(200).json({
            graficoSesiones: datosGrafico,
            totalPacientes: parseInt(pacientesResult.rows[0].total)
        });

    } catch (error) {
        console.error("Error obteniendo datos del dashboard:", error);
        res.status(500).json({ error: "Error en la base de datos" });
    }
});

module.exports = router;