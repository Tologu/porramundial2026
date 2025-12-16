// models/Participante.js
const mongoose = require('mongoose');

const ParticipanteSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true }, // 'Tomas', 'Miguel', etc.
    puntos: { type: Number, default: 0 },
    aciertos: { type: Number, default: 0 },
    // Aquí guardaremos todos los pronósticos del jugador
    pronosticos: { type: Object, default: {} },
    // La clave de almacenamiento que tenías antes (opcional, pero ayuda)
    storageKey: String 
});

module.exports = mongoose.model('Participante', ParticipanteSchema);