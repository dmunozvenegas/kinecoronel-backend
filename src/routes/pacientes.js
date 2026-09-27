const express = require('express');
const router = express.Router(); 
// POST: Crear un nuevo paciente
router.post('/', async (req, res) => {
    // Recibimos los nuevos campos del frontend
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
        if (error.code === '23505') { // Código de error de Postgres para "Unique Violation"
            return res.status(400).json({ error: "El RUT ya está registrado" });
        }
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// PUT: Editar paciente
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