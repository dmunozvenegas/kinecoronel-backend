const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- CONFIGURACIÓN DE MULTER (PARA SUBIDA DE ARCHIVOS) ---
// CORRECCIÓN: Ahora retrocede solo un nivel para guardar en la raíz del backend
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ==========================================
// RUTAS DE ÓRDENES MÉDICAS
// ==========================================

// 1. GET: Obtener todas las órdenes médicas (General)
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT o.*, p.nombre AS paciente_nombre 
            FROM ordenes_medicas o
            JOIN pacientes p ON o.paciente_id = p.id
            ORDER BY o.fecha_registro DESC
        `;
        const resultado = await pool.query(query);
        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo órdenes:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// 2. GET: Obtener órdenes de un paciente específico
router.get('/paciente/:paciente_id', async (req, res) => {
    const { paciente_id } = req.params;
    try {
        const resultado = await pool.query(
            'SELECT * FROM ordenes_medicas WHERE paciente_id = $1 ORDER BY fecha_registro DESC',
            [paciente_id]
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo órdenes del paciente:", error);
        res.status(500).json({ error: "Error en la base de datos" });
    }
});

// 3. POST: Crear una nueva orden médica (Con subida de archivos)
router.post('/', upload.fields([
    { name: 'archivo_orden', maxCount: 1 },
    { name: 'archivos_examenes', maxCount: 5 },
    { name: 'archivos_examenes[]', maxCount: 5 }
]), async (req, res) => {
    const { paciente_id, diagnostico, medico_derivante, sesiones_indicadas, fecha_emision } = req.body;
    
    let rutaOrden = null;
    let rutasExamenes = null;

    // CORRECCIÓN: Lógica limpia para capturar la orden
    if (req.files && req.files['archivo_orden']) {
        rutaOrden = '/uploads/' + req.files['archivo_orden'][0].filename;
    }

    // CORRECCIÓN: Lógica limpia para capturar exámenes (con o sin corchetes)
    const examenesFiles = (req.files && req.files['archivos_examenes']) || (req.files && req.files['archivos_examenes[]']);
    if (examenesFiles) {
        const paths = examenesFiles.map(file => '/uploads/' + file.filename);
        rutasExamenes = JSON.stringify(paths);
    }

    try {
        const nuevaOrden = await pool.query(
            `INSERT INTO ordenes_medicas 
            (paciente_id, diagnostico, medico_derivante, sesiones_indicadas, fecha_emision, archivo_orden, archivos_examenes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [paciente_id, diagnostico, medico_derivante, sesiones_indicadas, fecha_emision, rutaOrden, rutasExamenes]
        );
        
        res.status(201).json({ 
            mensaje: "Orden médica registrada con éxito", 
            data: nuevaOrden.rows[0] 
        });
    } catch (error) {
        console.error("Error creando orden médica:", error);
        res.status(500).json({ error: "Error al guardar en la base de datos" });
    }
});

// 3.5 PUT: Editar una orden médica existente (Con subida opcional de archivos)
router.put('/:id', upload.fields([
    { name: 'archivo_orden', maxCount: 1 },
    { name: 'archivos_examenes', maxCount: 5 },
    { name: 'archivos_examenes[]', maxCount: 5 } // CORRECCIÓN: Agregado antibalas aquí también
]), async (req, res) => {
    const { id } = req.params;
    const { diagnostico, medico_derivante, sesiones_indicadas, fecha_emision } = req.body;
    
    let rutaOrden = null;
    let rutasExamenes = null;

    if (req.files && req.files['archivo_orden']) {
        rutaOrden = '/uploads/' + req.files['archivo_orden'][0].filename;
    }

    const examenesFiles = (req.files && req.files['archivos_examenes']) || (req.files && req.files['archivos_examenes[]']);
    if (examenesFiles) {
        const paths = examenesFiles.map(file => '/uploads/' + file.filename);
        rutasExamenes = JSON.stringify(paths);
    }

    try {
        const ordenActualizada = await pool.query(
            `UPDATE ordenes_medicas 
            SET diagnostico = $1, 
                medico_derivante = $2, 
                sesiones_indicadas = $3, 
                fecha_emision = $4, 
                archivo_orden = COALESCE($5, archivo_orden), 
                archivos_examenes = COALESCE($6, archivos_examenes)
            WHERE id = $7 RETURNING *`,
            [diagnostico, medico_derivante, sesiones_indicadas, fecha_emision, rutaOrden, rutasExamenes, id]
        );
        
        if (ordenActualizada.rowCount === 0) {
            return res.status(404).json({ error: "Orden no encontrada" });
        }

        res.status(200).json({ 
            mensaje: "Orden médica actualizada con éxito", 
            data: ordenActualizada.rows[0] 
        });
    } catch (error) {
        console.error("Error actualizando orden médica:", error);
        res.status(500).json({ error: "Error al actualizar en la base de datos" });
    }
});

// ==========================================
// RUTAS DE SESIONES (EVOLUCIONES)
// ==========================================

// 4. GET: Obtener historial de sesiones de una orden
router.get('/sesiones/:orden_id', async (req, res) => {
    const { orden_id } = req.params;
    try {
        const resultado = await pool.query(
            'SELECT * FROM sesiones WHERE orden_id = $1 ORDER BY fecha DESC',
            [orden_id]
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo sesiones:", error);
        res.status(500).json({ error: "Error en la base de datos" });
    }
});

// 5. POST: Registrar una nueva sesión (Incrementa contador)
router.post('/sesion', async (req, res) => {
    const { orden_id, evolucion, terapias, fecha } = req.body; 
    const terapiasStr = terapias ? JSON.stringify(terapias) : null;

    try {
        await pool.query(
            'INSERT INTO sesiones (orden_id, evolucion, terapias, fecha) VALUES ($1, $2, $3, $4)',
            [orden_id, evolucion, terapiasStr, fecha]
        );

        const ordenActualizada = await pool.query(
            'UPDATE ordenes_medicas SET sesiones_realizadas = sesiones_realizadas + 1 WHERE id = $1 RETURNING *',
            [orden_id]
        );

        res.status(201).json({ 
            mensaje: "Sesión registrada", 
            orden: ordenActualizada.rows[0] 
        });
    } catch (error) {
        console.error("Error al registrar sesión:", error);
        res.status(500).json({ error: "No se pudo registrar la sesión" });
    }
});

// 6. PUT: Editar una sesión existente
router.put('/sesion/:id', async (req, res) => {
    const { id } = req.params;
    const { evolucion, terapias, fecha } = req.body;
    const terapiasStr = terapias ? JSON.stringify(terapias) : null;

    try {
        await pool.query(
            'UPDATE sesiones SET evolucion = $1, terapias = $2, fecha = $3 WHERE id = $4',
            [evolucion, terapiasStr, fecha, id]
        );
        res.status(200).json({ mensaje: "Sesión actualizada correctamente" });
    } catch (error) {
        console.error("Error editando sesión:", error);
        res.status(500).json({ error: "Error al actualizar la sesión" });
    }
});

// 7. DELETE: Eliminar una sesión
router.delete('/sesion/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener a qué orden pertenece esta sesión antes de borrarla
        const sesion = await pool.query('SELECT orden_id FROM sesiones WHERE id = $1', [id]);
        if (sesion.rowCount === 0) {
            return res.status(404).json({ error: "Sesión no encontrada" });
        }
        
        const orden_id = sesion.rows[0].orden_id;

        // 2. Eliminar la sesión de la base de datos
        await pool.query('DELETE FROM sesiones WHERE id = $1', [id]);

        // 3. Restar 1 al contador de sesiones realizadas en la orden médica (evitando números negativos)
        await pool.query(
            'UPDATE ordenes_medicas SET sesiones_realizadas = GREATEST(sesiones_realizadas - 1, 0) WHERE id = $1',
            [orden_id]
        );

        res.status(200).json({ mensaje: "Evolución eliminada correctamente" });
    } catch (error) {
        console.error("Error eliminando sesión:", error);
        res.status(500).json({ error: "Error al eliminar la evolución" });
    }
});

// 8. DELETE: Eliminar una orden médica completa y limpiar sus archivos del servidor
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener la orden para saber qué rutas de archivos debemos borrar físicamente
        const ordenResult = await pool.query('SELECT archivo_orden, archivos_examenes FROM ordenes_medicas WHERE id = $1', [id]);
        
        if (ordenResult.rowCount === 0) {
            return res.status(404).json({ error: "Orden no encontrada" });
        }

        const orden = ordenResult.rows[0];

        // 2. Eliminar los archivos físicos del disco duro (si existen)
        const baseDir = path.join(__dirname, '../'); // Sube a la raíz del backend
        
        // Borrar el archivo de la orden médica
        if (orden.archivo_orden) {
            const filePath = path.join(baseDir, orden.archivo_orden); // Ej: ../uploads/archivo.pdf
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        // Borrar los archivos de exámenes asociados
        if (orden.archivos_examenes) {
            try {
                const examenes = JSON.parse(orden.archivos_examenes);
                examenes.forEach(ruta => {
                    const filePath = path.join(baseDir, ruta);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });
            } catch (e) {
                console.error("Error parseando exámenes para eliminar:", e);
            }
        }

        // 3. Eliminar todas las sesiones (evoluciones) asociadas a esta orden por seguridad
        await pool.query('DELETE FROM sesiones WHERE orden_id = $1', [id]);

        // 4. Finalmente, eliminar la orden médica de la tabla
        await pool.query('DELETE FROM ordenes_medicas WHERE id = $1', [id]);

        res.status(200).json({ mensaje: "Orden y archivos eliminados correctamente" });
    } catch (error) {
        console.error("Error eliminando orden:", error);
        res.status(500).json({ error: "Error al eliminar la orden médica" });
    }
});

module.exports = router;