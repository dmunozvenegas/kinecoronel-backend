const express = require('express');
const multer = require('multer');
const visionService = require('../services/vision.service');

const router = express.Router();

// Configuración de multer en memoria (no guarda en el disco, ideal para la IA)
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

// Ruta POST: /api/agenda/scan
// Recibe la imagen, la manda al servicio de IA y devuelve el JSON
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

        // Mandamos a llamar a Gemini desde tu servicio
        const extractedData = await visionService.extractAgendaData(imageBuffer, mimeType);

        // Retornamos el éxito al Frontend
        return res.status(200).json({
            success: true,
            message: "Imagen procesada correctamente",
            data: extractedData
        });

    // ✅ CÓDIGO CORREGIDO en agenda.js:
    } catch (error) {
        console.error("Error procesando imagen de agenda:", error);
        res.status(500).json({ 
            success: false, 
            // Le decimos que use el mensaje real, o que ponga el genérico solo si no hay mensaje
            message: error.message || "Ocurrió un error al intentar procesar los datos de la agenda." 
        });
    }
});

module.exports = router;