const express = require('express');
const router = express.Router(); 
const pool = require('../db'); // Asegúrate de que esta ruta a tu base de datos sea la correcta

// ==========================================
// 1. GET: Obtener pacientes (Filtrados por kinesiólogo)
// ==========================================
router.get('/', async (req, res) => {
    const { kinesiologo_id } = req.query; // Capturamos el ?kinesiologo_id=1 que envía el frontend
    
    try {
        let query = 'SELECT * FROM pacientes';
        let params = [];
        
        if (kinesiologo_id) {
            query += ' WHERE kinesiologo_id = $1 ORDER BY id DESC';
            params.push(kinesiologo_id);
        } else {
            query += ' ORDER BY id DESC';
        }

        const resultado = await pool.query(query, params);
        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo pacientes:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// ==========================================
// 2. GET: Obtener un solo paciente por ID (Para ver detalle o editar)
// ==========================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query('SELECT * FROM pacientes WHERE id = $1', [id]);
        
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Paciente no encontrado" });
        }
        
        res.status(200).json(resultado.rows[0]);
    } catch (error) {
        console.error("Error obteniendo paciente:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// ==========================================
// 3. POST: Crear un nuevo paciente
// ==========================================
router.post('/', async (req, res) => {
    const { nombre, rut, estado, kinesiologo_id, direccion, fecha_nacimiento, correo, telefono } = req.body;

    try {
        const nuevoPaciente = await pool.query(
            `INSERT INTO pacientes 
            (nombre, rut, estado, kinesiologo_id, direccion, fecha_nacimiento, correo, telefono) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [nombre, rut, estado, kinesiologo_id, direccion, fecha_nacimiento, correo, telefono]
        );
        res.status(201).json(nuevoPaciente.rows[0]);
    } catch (error) {
        console.error(error);
        if (error.code === '23505') { 
            return res.status(400).json({ error: "El RUT ya está registrado" });
        }
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// ==========================================
// 4. PUT: Editar paciente
// ==========================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, rut, estado, direccion, fecha_nacimiento, correo, telefono } = req.body;

    try {
        const pacienteActualizado = await pool.query(
            `UPDATE pacientes 
            SET nombre = $1, rut = $2, estado = $3, direccion = $4, fecha_nacimiento = $5, correo = $6, telefono = $7 
            WHERE id = $8 RETURNING *`,
            [nombre, rut, estado, direccion, fecha_nacimiento, correo, telefono, id]
        );
        res.status(200).json(pacienteActualizado.rows[0]);
    } catch (error) {
        console.error(error);
        if (error.code === '23505') { 
            return res.status(400).json({ error: "El RUT ya está registrado por otro paciente" });
        }
        res.status(500).json({ error: "Error en el servidor" });
    }
});

module.exports = router;