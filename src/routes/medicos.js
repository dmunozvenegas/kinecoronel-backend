const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. GET: Obtener todos los médicos (Ordenados alfabéticamente)
router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM medicos_derivantes ORDER BY nombre ASC');
        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo médicos:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// 2. POST: Agregar un nuevo médico a la red
router.post('/', async (req, res) => {
    const { nombre, especialidad, lugar_trabajo, correo, telefono } = req.body;
    try {
        const nuevoMedico = await pool.query(
            `INSERT INTO medicos_derivantes (nombre, especialidad, lugar_trabajo, correo, telefono) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [nombre, especialidad, lugar_trabajo, correo, telefono]
        );
        res.status(201).json(nuevoMedico.rows[0]);
    } catch (error) {
        console.error("Error agregando médico:", error);
        res.status(500).json({ error: "Error al guardar el médico" });
    }
});

// 3. PUT: Actualizar datos de un médico
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, especialidad, lugar_trabajo, correo, telefono } = req.body;
    try {
        const actualizado = await pool.query(
            `UPDATE medicos_derivantes 
            SET nombre = $1, especialidad = $2, lugar_trabajo = $3, correo = $4, telefono = $5 
            WHERE id = $6 RETURNING *`,
            [nombre, especialidad, lugar_trabajo, correo, telefono, id]
        );
        res.status(200).json(actualizado.rows[0]);
    } catch (error) {
        console.error("Error actualizando médico:", error);
        res.status(500).json({ error: "Error al actualizar" });
    }
});

// 4. DELETE: Eliminar un médico del directorio
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM medicos_derivantes WHERE id = $1', [id]);
        res.status(200).json({ mensaje: "Médico eliminado correctamente" });
    } catch (error) {
        console.error("Error eliminando médico:", error);
        res.status(500).json({ error: "Error al eliminar" });
    }
});

module.exports = router;