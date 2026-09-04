const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// POST: Iniciar sesión (Login)
router.post('/login', async (req, res) => {
    try {
        console.log("INTENTO DE LOGIN:", req.body); 
        
        // Si req.body no existe, forzamos un objeto vacío para evitar el choque
        const { email, password } = req.body || {}; 

        if (!email || !password) {
            return res.status(400).json({ error: "Faltan datos (email o password)" });
        }

        // 1. Buscar si el correo existe
        const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        const usuario = resultado.rows[0];

        // 2. Comparar la contraseña ingresada con la encriptada
        const claveValida = await bcrypt.compare(password, usuario.password);
        if (!claveValida) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        // 3. Crear el Token de sesión (JWT)
        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' } // La sesión durará 8 horas
        );

        res.status(200).json({
            mensaje: "Login exitoso",
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error("Error en login:", error);
        // Cambiamos el 500 por 400 para que Apache NO intercepte la respuesta
        res.status(400).json({ 
            error: "Error interno revelado", 
            detalle: error.message 
        });
    }
});

// GET: Ruta temporal para crear a Paula, Verónica y Alejandra (Ejecutar solo 1 vez)
router.get('/seed', async (req, res) => {
    try {
        const kines = [
            { nombre: "Paula Muñoz", email: "pmunoz@kinecoronel.cl" },
            { nombre: "Veronica Soto", email: "vsoto@kinecoronel.cl" },
            { nombre: "Alejandra Escalona", email: "aescalona@kinecoronel.cl" }
        ];

        // Encriptar la contraseña "123456"
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("123456", salt);

        for (let kine of kines) {
            await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
                [kine.nombre, kine.email, hashedPassword, 'kinesiologo']
            );
        }

        res.status(201).json({ mensaje: "Kinesiólogas creadas exitosamente con clave: 123456" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error creando usuarios" });
    }
});

module.exports = router;