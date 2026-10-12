const express = require('express');
const multer = require('multer');
const visionService = require('../services/vision.service');
const pool = require('../db'); // Importamos la base de datos para el calendario

const router = express.Router();

// ==========================================
// 1. MÓDULO DE ESCÁNER IA (GEMINI)
// ==========================================
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('El archivo debe ser una imagen (JPG, PNG, etc).'), false);
        }
    }
});

// Ruta POST: /api/agenda/scan -> Escanea la imagen y devuelve los datos
router.post('/scan', upload.single('imagen'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "No se proporcionó ninguna imagen. Asegúrate de enviar el archivo con el key 'imagen'." 
            });
        }

        const imageBuffer = req.file.buffer;
        const mimeType = req.file.mimetype;

        const extractedData = await visionService.extractAgendaData(imageBuffer, mimeType);

        return res.status(200).json({
            success: true,
            message: "Imagen procesada correctamente",
            data: extractedData
        });
    } catch (error) {
        console.error("Error procesando imagen de agenda:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Ocurrió un error al intentar procesar los datos de la agenda." 
        });
    }
});

// ==========================================
// 2. MÓDULO DE CALENDARIO Y BASE DE DATOS
// ==========================================

// GET: Obtener todas las citas para pintarlas en el calendario
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT c.*, p.nombre AS paciente_nombre, p.rut 
            FROM citas c
            JOIN pacientes p ON c.paciente_id = p.id
            ORDER BY c.fecha_hora ASC
        `;
        const resultado = await pool.query(query);
        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo la agenda:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// POST: Guardar una nueva cita en la base de datos
router.post('/', async (req, res) => {
    const { paciente_id, fecha_hora, duracion_minutos, estado, motivo, color } = req.body;

    try {
        const nuevaCita = await pool.query(
            `INSERT INTO citas 
            (paciente_id, fecha_hora, duracion_minutos, estado, motivo, color) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [paciente_id, fecha_hora, duracion_minutos || 45, estado || 'Agendada', motivo, color || '#2563eb']
        );
        res.status(201).json(nuevaCita.rows[0]);
    } catch (error) {
        console.error("Error creando cita:", error);
        res.status(500).json({ error: "Error al agendar la cita" });
    }
});

// DELETE: Cancelar/Eliminar una cita
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM citas WHERE id = $1', [id]);
        res.status(200).json({ mensaje: "Cita eliminada correctamente" });
    } catch (error) {
        console.error("Error eliminando cita:", error);
        res.status(500).json({ error: "Error al eliminar" });
    }
});

module.exports = router;