const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Cargar las variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------
// 🌟 UN SOLO CORS MAESTRO Y SEGURO
// ---------------------------------------------------------------------
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'https://sistema.kinecoronel.cl',
        'https://kinecoronel-frontend.vercel.app', // Agrega tu URL de Vercel aquí
        /\.vercel\.app$/                           // Expresión regular para permitir cualquier subdominio de Vercel
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json()); 
app.use('/uploads', express.static('uploads'));

// ---------------------------------------------------------------------
// 1. RESPUESTAS JSON ESTÁNDAR
// ---------------------------------------------------------------------
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: "success", 
        message: "API de KineCoronel funcionando correctamente en la raíz 🚀" 
    });
});

app.get('/api', (req, res) => {
    res.status(200).json({ 
        status: "success", 
        message: "API de KineCoronel conectada y lista en el endpoint /api 🚀" 
    });
});

// ---------------------------------------------------------------------
// 2. IMPORTACIÓN DE RUTAS
// ---------------------------------------------------------------------
const agendaRoutes = require('./routes/agenda');
const pacientesRoutes = require('./routes/pacientes');
const ordenesRoutes = require('./routes/ordenes');
const authRoutes = require('./routes/auth');
const bonosRoutes = require('./routes/bonos'); 
const ReportesRoutes = require('./routes/reportes'); 

// ---------------------------------------------------------------------
// 3. ENRUTAMIENTO DOBLE (Protección total contra recortes de cPanel)
// ---------------------------------------------------------------------
// Opción A: Rutas estándar
app.use('/api/agenda', agendaRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/ordenes', ordenesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bonos', bonosRoutes); 
app.use('/api/reportes', ReportesRoutes);

// Opción B: Fallback para cPanel
app.use('/agenda', agendaRoutes);
app.use('/pacientes', pacientesRoutes);
app.use('/ordenes', ordenesRoutes);
app.use('/auth', authRoutes);
app.use('/bonos', bonosRoutes); 

// ---------------------------------------------------------------------
// 4. ARRANQUE DEL SERVIDOR
// ---------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Servidor KineCoronel activo en el puerto ${PORT}`);
});