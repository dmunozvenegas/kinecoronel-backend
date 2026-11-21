const express = require('express');
const router = express.Router();
const pool = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Normaliza teléfonos chilenos a formato 569XXXXXXXX
const normalizarTelefono = (tel = '') => {
    let limpio = tel.replace(/\D/g, '');
    if (limpio.length === 8) limpio = '569' + limpio;
    if (limpio.length === 9 && limpio.startsWith('9')) limpio = '56' + limpio;
    return limpio;
};

// Generar código único corto ej: KC-8492
const generarCodigoCupon = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let sufijo = '';
    for (let i = 0; i < 4; i++) {
        sufijo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `KC-${sufijo}`;
};

// =========================================================
// 1. GET PÚBLICO: Obtener casillas de la ruleta
// =========================================================
router.get('/premios', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, orden, titulo, etiqueta_ruleta, color_hex FROM feria_premios WHERE activo = TRUE ORDER BY orden ASC'
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error cargando premios:', error);
        res.status(500).json({ error: 'Error cargando premios de la ruleta' });
    }
});
// =====================================================================
// ADMINISTRACIÓN DE PREMIOS DESDE EL CRM
// =====================================================================

// 1. Listar todos los premios para el panel Admin (sin fallar por nombres de columnas)
router.get('/premios/admin', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM feria_premios ORDER BY orden ASC, id ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error listando premios admin:', error);
        res.status(500).json({ 
            error: 'No se pudieron cargar los premios', 
            detalle: error.message // <-- Nos dirá la causa exacta si algo más falla
        });
    }
});
// 2. Crear un nuevo premio en la ruleta (con auto-reparación de secuencia SERIAL)
router.post('/premios', async (req, res) => {
    try {
        const {
            orden = 1,
            titulo,
            descripcion = '',
            etiqueta_ruleta,
            color_hex = '#0284c7',
            stock_disponible = 10,
            probabilidad_peso = 10,
            activo = true
        } = req.body;

        if (!titulo || !etiqueta_ruleta) {
            return res.status(400).json({ error: 'El título y el texto corto de la ruleta son obligatorios' });
        }

        // Asegura que la secuencia del ID esté al día antes de insertar
        await pool.query(`
            SELECT setval(
                pg_get_serial_sequence('feria_premios', 'id'),
                COALESCE((SELECT MAX(id) FROM feria_premios), 0) + 1,
                false
            )
        `);

        const result = await pool.query(
            `INSERT INTO feria_premios
             (orden, titulo, descripcion, etiqueta_ruleta, color_hex, stock_disponible, probabilidad_peso, activo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                Number(orden) || 1,
                titulo.trim(),
                (descripcion || '').trim(),
                etiqueta_ruleta.trim(),
                color_hex || '#0284c7',
                Math.max(0, Number(stock_disponible) || 0),
                Math.max(1, Number(probabilidad_peso) || 1),
                Boolean(activo)
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error detallado creando premio:', error);
        res.status(500).json({ error: `Error al guardar el nuevo premio: ${error.message}` });
    }
});

// 3. Editar un premio existente (stock, texto, color, peso o activo)
router.put('/premios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            orden,
            titulo,
            descripcion,
            etiqueta_ruleta,
            color_hex,
            stock_disponible,
            probabilidad_peso,
            activo
        } = req.body;

        const result = await pool.query(
            `UPDATE feria_premios
             SET orden = $1,
                 titulo = $2,
                 descripcion = $3,
                 etiqueta_ruleta = $4,
                 color_hex = $5,
                 stock_disponible = $6,
                 probabilidad_peso = $7,
                 activo = $8
             WHERE id = $9
             RETURNING *`,
            [
                Number(orden) || 1,
                titulo.trim(),
                (descripcion || '').trim(),
                etiqueta_ruleta.trim(),
                color_hex || '#0284c7',
                Math.max(0, Number(stock_disponible) || 0),
                Math.max(1, Number(probabilidad_peso) || 1),
                Boolean(activo),
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Premio no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error actualizando premio:', error);
        res.status(500).json({ error: 'Error al actualizar el premio' });
    }
});

// 4. Eliminar premio (si ya tiene ganadores asociados, lo oculta con activo = false para no perder historial)
router.delete('/premios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const uso = await pool.query('SELECT COUNT(*)::int AS total FROM feria_leads WHERE premio_id = $1', [id]);

        if (uso.rows[0].total > 0) {
            const soft = await pool.query(
                'UPDATE feria_premios SET activo = FALSE WHERE id = $1 RETURNING *',
                [id]
            );
            return res.json({
                modo: 'desactivado',
                mensaje: 'El premio ya tiene ganadores registrados, por lo que se desactivó de la ruleta sin borrar el historial.',
                premio: soft.rows[0]
            });
        }

        await pool.query('DELETE FROM feria_premios WHERE id = $1', [id]);
        res.json({ modo: 'eliminado', mensaje: 'Premio eliminado correctamente' });
    } catch (error) {
        console.error('Error eliminando premio:', error);
        res.status(500).json({ error: 'Error al eliminar el premio' });
    }
});

// =========================================================
// 2. POST PÚBLICO: Registrar encuesta + Girar Ruleta (Transaccional)
// =========================================================
router.post('/girar', async (req, res) => {
    const { nombre, telefono, correo, dolencia, prevision, acepta_contacto } = req.body;

    if (!nombre || !telefono || !dolencia || !prevision) {
        return res.status(400).json({ error: 'Completa tu nombre, WhatsApp, zona de molestia y previsión.' });
    }

    const telNormalizado = normalizarTelefono(telefono);
    if (telNormalizado.length < 11) {
        return res.status(400).json({ error: 'Ingresa un número de WhatsApp válido (ej: +56 9 1234 5678).' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar si este WhatsApp ya participó
        const existente = await client.query(
            `SELECT l.codigo_cupon, l.expira_en, p.orden, p.titulo 
             FROM feria_leads l 
             JOIN feria_premios p ON p.id = l.premio_id 
             WHERE l.telefono = $1`,
            [telNormalizado]
        );

        if (existente.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Este número de WhatsApp ya giró la ruleta.',
                cuponExistente: existente.rows[0]
            });
        }

        // Bloquear premios disponibles para evitar sobre-asignar stock
        const { rows: todosPremios } = await client.query(
            'SELECT * FROM feria_premios WHERE activo = TRUE ORDER BY orden ASC FOR UPDATE'
        );

        const elegibles = todosPremios.filter(p => p.stock_disponible > 0 && p.probabilidad_peso > 0);
        if (elegibles.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Se agotaron los cupones por hoy. ¡Consulta en el stand!' });
        }

        // Sorteo ponderado según probabilidad_peso
        const pesoTotal = elegibles.reduce((acc, p) => acc + p.probabilidad_peso, 0);
        let random = Math.random() * pesoTotal;
        let premioGanado = elegibles[0];

        for (const p of elegibles) {
            if (random < p.probabilidad_peso) {
                premioGanado = p;
                break;
            }
            random -= p.probabilidad_peso;
        }

        // Descontar 1 unidad de stock
        await client.query(
            'UPDATE feria_premios SET stock_disponible = stock_disponible - 1 WHERE id = $1',
            [premioGanado.id]
        );

        const codigo = generarCodigoCupon();
        const expiraEn = new Date();
        expiraEn.setDate(expiraEn.getDate() + premioGanado.dias_validez);

        const nuevoLead = await client.query(
            `INSERT INTO feria_leads 
            (nombre, telefono, correo, dolencia, prevision, acepta_contacto, premio_id, codigo_cupon, expira_en)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [nombre.trim(), telNormalizado, correo || null, dolencia, prevision, acepta_contacto !== false, premioGanado.id, codigo, expiraEn]
        );

        await client.query('COMMIT');

        // Índice exacto en el arreglo visual para detener la animación en el sector correcto
        const sectorIndex = todosPremios.findIndex(p => p.id === premioGanado.id);

        res.status(201).json({
            sectorIndex,
            premio: {
                id: premioGanado.id,
                titulo: premioGanado.titulo,
                etiqueta: premioGanado.etiqueta_ruleta
            },
            cupon: {
                codigo: nuevoLead.rows[0].codigo_cupon,
                expira_en: nuevoLead.rows[0].expira_en
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en giro de ruleta:', error);
        res.status(500).json({ error: 'Error procesando el sorteo' });
    } finally {
        client.release();
    }
});

// =========================================================
// 3. GET ADMIN CRM: Listar leads, métricas y stock actual
// =========================================================
router.get('/leads', async (req, res) => {
    try {
        const leadsRes = await pool.query(`
            SELECT l.*, p.titulo AS premio_titulo, p.color_hex
            FROM feria_leads l
            LEFT JOIN feria_premios p ON p.id = l.premio_id
            ORDER BY l.id DESC
        `);

        const stockRes = await pool.query(
            'SELECT * FROM feria_premios ORDER BY orden ASC, id ASC'
        );

        res.json({
            leads: leadsRes.rows,
            premios: stockRes.rows
        });
    } catch (error) {
        console.error('Error cargando leads CRM:', error);
        res.status(500).json({ 
            error: 'Error cargando datos del CRM', 
            detalle: error.message 
        });
    }
});

// =========================================================
// 4. PUT ADMIN CRM: Marcar cupón como Canjeado / Convertido
// =========================================================
router.put('/leads/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado_cupon } = req.body;
    try {
        const actualizado = await pool.query(
            `UPDATE feria_leads 
             SET estado_cupon = $1, 
                 canjeado_en = CASE WHEN $1 IN ('canjeado', 'convertido') THEN NOW() ELSE canjeado_en END
             WHERE id = $2 RETURNING *`,
            [estado_cupon, id]
        );
        res.status(200).json(actualizado.rows[0]);
    } catch (error) {
        console.error('Error actualizando cupón:', error);
        res.status(500).json({ error: 'No se pudo actualizar el cupón' });
    }
});

// =========================================================
// 5. POST ADMIN CRM: Generar mensaje WhatsApp persuasivo con Gemini AI
// =========================================================
router.post('/generar-mensaje', async (req, res) => {
    const { nombre, dolencia, prevision, premio_titulo, codigo_cupon } = req.body;

    const mensajeBase = `¡Hola ${nombre}! 👋 Te escribimos del Centro Kinésico KineCoronel. Qué gusto conocerte en la feria. Te recordamos que ganaste *${premio_titulo}* (Código: *${codigo_cupon}*). Vimos que nos comentaste sobre *${dolencia}* y atendemos con convenio *${prevision}*. ¿Te gustaría que agendemos tu hora esta semana?`;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({ mensaje: mensajeBase });
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Redacta un mensaje corto, cercano y profesional de WhatsApp (máximo 450 caracteres, español chileno natural, con 2 emojis sutiles) de parte del Centro Kinésico "KineCoronel" en Coronel para ${nombre}, quien participó en nuestra ruleta de la feria.
        Ganó: "${premio_titulo}" (código ${codigo_cupon}).
        Zona de molestia o interés: "${dolencia}".
        Previsión: "${prevision}".
        Invítalo a agendar su hora respondiendo este mensaje antes de que venza su cupón. Devuelve SOLO el texto del mensaje sin comillas.`;

        const result = await model.generateContent(prompt);
        res.status(200).json({ mensaje: result.response.text().trim() });
    } catch (error) {
        console.error('Fallback mensaje WhatsApp:', error.message);
        res.status(200).json({ mensaje: mensajeBase });
    }
});

module.exports = router;