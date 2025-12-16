// server.js
require('dotenv').config(); // Carga las variables del .env
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const Participante = require('./models/Participante'); // Importa el modelo

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Para procesar cuerpos JSON
// Sirve todos los archivos estáticos de la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public'))); 

// Conexión a MongoDB con opciones mejoradas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
})
.then(() => console.log('✅ Conexión a MongoDB Atlas exitosa!'))
.catch(err => {
    console.error('❌ Error de conexión a MongoDB:', err.message);
    process.exit(1);
});

// Manejo de errores global
process.on('unhandledRejection', (err) => {
    console.error('Error no manejado en promesa:', err);
});

// ==========================================================
// 1. RUTA GET: OBTENER DATOS (Para los MÓVILES)
// ==========================================================
// Esta es la ruta que tu frontend llamará para obtener la clasificación y pronósticos
app.get('/api/porra', async (req, res) => {
    try {
        // Busca todos los participantes, ordenados por puntos
        const participantes = await Participante.find().sort({ puntos: -1 }); 
        res.json(participantes);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener los datos de la porra.');
    }
});


// ==========================================================
// 2. RUTA POST: ACTUALIZAR RESULTADOS (Solo para el ADMIN)
// **NOTA: Aquí va la lógica de cálculo que tenías en script.js**
// ==========================================================
app.post('/api/actualizar_porra', async (req, res) => {
    const { password, idPartido, resultadoReal } = req.body;
    
    // Verificación de administrador
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ mensaje: 'Acceso denegado. Contraseña de administrador incorrecta.' });
    }

    try {
        // TU LÓGICA COMPLEJA DE CÁLCULO DE PUNTOS DEBE VENIR AQUÍ
        // DEBES MOVER LA FUNCIÓN `calcularPuntos` Y EL ARRAY `gruposData`
        // Y EL ARRAY `pronosticosConfirmados` DE script.js A ESTE SERVIDOR
        
        // EJEMPLO DE LÓGICA (Necesitas traer tu lógica real de script.js)
        // const participantes = await Participante.find({});
        // for (let p of participantes) {
        //     if (p.pronosticos[idPartido]) {
        //         p.puntos += tuFuncionCalcularPuntos(p.pronosticos[idPartido], resultadoReal);
        //         await p.save();
        //     }
        // }
        
        res.json({ mensaje: 'Resultados y puntos actualizados correctamente en la BBDD central.' });
    } catch (error) {
        console.error("Error al actualizar la porra:", error);
        res.status(500).json({ mensaje: 'Error interno del servidor al procesar la actualización.' });
    }
});


// ==========================================================
// INICIO DEL SERVIDOR
// ==========================================================
app.listen(port, () => {
    console.log(`Servidor Express corriendo en el puerto: ${port}`);
    console.log('¡Listo para el despliegue!');
});