const express = require('express');
const router = express.Router();
const pool = require('../db'); 

// POST: Crear un bono asignado a la kinesióloga con su MONTO
router.post('/', async (req, res) => {
    try {
        // 👇 1. Agregamos monto a lo que recibimos
        const { rut_beneficiario, fecha_emision, numero_bono, kinesiologo_id, monto } = req.body;

        if (!rut_beneficiario || !numero_bono || !kinesiologo_id) {
            return res.status(400).json({ 
                success: false, 
                message: "Faltan datos obligatorios o el ID del kinesiólogo." 
            });
        }

        // 👇 2. Agregamos monto al INSERT
        const query = `
            INSERT INTO bonos (rut_beneficiario, fecha_emision, numero_bono, kinesiologo_id, monto) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *;
        `;
        // Si no viene monto, guardamos 0 por defecto
        const result = await pool.query(query, [rut_beneficiario, fecha_emision, numero_bono, kinesiologo_id, monto || 0]);

        return res.status(201).json({ 
            success: true, 
            message: "Bono almacenado correctamente",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error guardando el bono en la BD:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error interno del servidor al intentar guardar el bono." 
        });
    }
});

// GET: Obtener los bonos filtrados por kinesióloga
router.get('/', async (req, res) => {
    // 👇 Recibimos el kinesiologo_id por la URL (?kinesiologo_id=X)
    const { kinesiologo_id } = req.query; 

    try {
        // 🔒 BLINDAJE DE SEGURIDAD: Exigir siempre el ID
        if (!kinesiologo_id) {
            return res.status(400).json({ 
                success: false, 
                message: "Acceso denegado: Se requiere el identificador del kinesiólogo." 
            });
        }

        // Búsqueda normal filtrada por kinesióloga
        const query = 'SELECT * FROM bonos WHERE kinesiologo_id = $1 ORDER BY fecha_registro DESC';
        const result = await pool.query(query, [kinesiologo_id]);
        
        return res.status(200).json({ 
            success: true, 
            data: result.rows 
        });
    } catch (error) {
        console.error("Error obteniendo los bonos:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error al obtener la lista de bonos." 
        });
    }
});

module.exports = router;