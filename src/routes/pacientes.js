const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. RUTAS ESTÁTICAS PRIMERO (Obligatorio para que no choquen con /:id)
router.get('/test', (req, res) => {
    res.status(200).json({ 
        status: "success",
        mensaje: "¡El enrutador funciona perfecto y no fue interceptado por /:id!" 
    });
});

// 2. GET: Obtener pacientes (Con aviso si falta el kinesiologo_id)
router.get('/', async (req, res) => {
    const { kinesiologo_id } = req.query; 

    try {
        // Si quieres que devuelva TODOS los pacientes cuando no se le pasa ID (opcional para pruebas):
        if (!kinesiologo_id) {
            const todosLosPacientes = await pool.query('SELECT * FROM pacientes ORDER BY id ASC');
            return res.status(200).json(todosLosPacientes.rows);
        }

        // Búsqueda normal filtrada por kinesióloga
        const resultado = await pool.query(
            'SELECT * FROM pacientes WHERE kinesiologo_id = $1 ORDER BY id ASC',
            [kinesiologo_id]
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo pacientes:", error);
        res.status(500).json({ error: "Error interno del servidor al consultar pacientes" });
    }
});

// 3. GET: Obtener un solo paciente por su ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const paciente = await pool.query('SELECT * FROM pacientes WHERE id = $1', [id]);
        if (paciente.rows.length === 0) {
            return res.status(404).json({ error: "Paciente no encontrado" });
        }
        res.status(200).json(paciente.rows[0]);
    } catch (error) {
        console.error("Error obteniendo paciente:", error);
        res.status(500).json({ error: "Error en la base de datos al buscar ID" });
    }
});

// 4. POST: Crear un paciente
router.post('/', async (req, res) => {
    const { nombre, rut, estado, kinesiologo_id, direccion, fecha_nacimiento, correo, telefono } = req.body;

    try {
        const nuevoPaciente = await pool.query(
            `INSERT INTO pacientes 
            (nombre, rut, estado, kinesiologo_id, direccion, fecha_nacimiento, correo, telefono) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [nombre, rut, estado || 'Activo', kinesiologo_id, direccion, fecha_nacimiento, correo, telefono]
        );
        
        res.status(201).json({ 
            mensaje: "Paciente registrado con éxito", 
            data: nuevoPaciente.rows[0] 
        });
    } catch (error) {
        console.error("Error creando paciente:", error);
        res.status(500).json({ error: "Error al guardar en la base de datos" });
    }
});

// 5. PUT: Actualizar datos de un paciente
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

        if (pacienteActualizado.rows.length === 0) {
            return res.status(404).json({ error: "Paciente no encontrado" });
        }

        res.status(200).json({ 
            mensaje: "Paciente actualizado correctamente", 
            data: pacienteActualizado.rows[0] 
        });
    } catch (error) {
        console.error("Error actualizando paciente:", error);
        res.status(500).json({ error: "Error en la base de datos al actualizar" });
    }
});

module.exports = router;