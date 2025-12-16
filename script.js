// Configuración global
const CONFIG = {
    apiUrl: window.location.hostname.includes('localhost') 
        ? 'http://localhost:3000/api' 
        : '/api',
    datos: {
        participantes: [],
        partidos: [],
        pronosticos: {}
    },
    usuarioActual: null
};

// Elementos del DOM
const ELEMENTOS = {
    contenedorPrincipal: document.getElementById('contenedor-principal') || document.body,
    contenedorPartidos: document.getElementById('contenedor-partidos'),
    contenedorClasificacion: document.getElementById('contenedor-clasificacion'),
    contenedorError: document.getElementById('contenedor-error')
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await cargarDatosIniciales();
        inicializarEventos();
        actualizarInterfaz();
    } catch (error) {
        mostrarError('Error al inicializar la aplicación: ' + error.message);
    }
});

// Carga los datos iniciales de la aplicación
async function cargarDatosIniciales() {
    try {
        // Cargar participantes
        const [participantes, partidos] = await Promise.all([
            obtenerDatos('/porra'),
            obtenerDatos('/partidos')
        ]);

        CONFIG.datos.participantes = participantes || [];
        CONFIG.datos.partidos = partidos || [];
        
        // Verificar si hay datos
        if (CONFIG.datos.participantes.length === 0) {
            console.warn('No se encontraron participantes');
        }
        
        if (CONFIG.datos.partidos.length === 0) {
            console.warn('No se encontraron partidos');
        }

    } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        throw error;
    }
}

// Función genérica para obtener datos de la API
async function obtenerDatos(endpoint) {
    try {
        const response = await fetch(`${CONFIG.apiUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error en la petición a ${endpoint}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error al obtener datos de ${endpoint}:`, error);
        throw error;
    }
}

// Actualiza la interfaz de usuario
function actualizarInterfaz() {
    if (ELEMENTOS.contenedorPartidos) {
        renderizarPartidos();
    }
    
    if (ELEMENTOS.contenedorClasificacion) {
        renderizarClasificacion();
    }
}

// Renderiza la lista de partidos
function renderizarPartidos() {
    if (!ELEMENTOS.contenedorPartidos) return;
    
    if (CONFIG.datos.partidos.length === 0) {
        ELEMENTOS.contenedorPartidos.innerHTML = '<p class="no-data">No hay partidos programados</p>';
        return;
    }

    ELEMENTOS.contenedorPartidos.innerHTML = CONFIG.datos.partidos.map(partido => `
        <div class="partido-card" data-partido-id="${partido._id}">
            <div class="equipos">
                <span class="equipo local">${partido.local || 'Equipo Local'}</span>
                <span class="vs">vs</span>
                <span class="equipo visitante">${partido.visitante || 'Equipo Visitante'}</span>
            </div>
            <div class="info-partido">
                ${partido.fecha ? `<span class="fecha">${new Date(partido.fecha).toLocaleDateString()}</span>` : ''}
                ${partido.hora ? `<span class="hora">${partido.hora}</span>` : ''}
                ${partido.resultado ? 
                    `<span class="resultado">${partido.resultado.local || '0'} - ${partido.resultado.visitante || '0'}</span>` : 
                    '<span class="por-jugar">Por jugar</span>'
                }
            </div>
        </div>
    `).join('');
}

// Renderiza la clasificación
function renderizarClasificacion() {
    if (!ELEMENTOS.contenedorClasificacion) return;

    const participantesOrdenados = [...CONFIG.datos.participantes]
        .sort((a, b) => (b.puntos || 0) - (a.puntos || 0) || (b.aciertos || 0) - (a.aciertos || 0));

    if (participantesOrdenados.length === 0) {
        ELEMENTOS.contenedorClasificacion.innerHTML = '<p class="no-data">No hay datos de clasificación disponibles</p>';
        return;
    }

    ELEMENTOS.contenedorClasificacion.innerHTML = `
        <table class="clasificacion-table">
            <thead>
                <tr>
                    <th>Posición</th>
                    <th>Participante</th>
                    <th>Puntos</th>
                    <th>Aciertos</th>
                </tr>
            </thead>
            <tbody>
                ${participantesOrdenados.map((participante, index) => `
                    <tr>
                        <td>${index + 1}º</td>
                        <td>${participante.nombre || 'Sin nombre'}</td>
                        <td>${participante.puntos || 0}</td>
                        <td>${participante.aciertos || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Muestra mensajes de error
function mostrarError(mensaje, esFatal = false) {
    console.error(mensaje);
    
    if (!ELEMENTOS.contenedorError) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'contenedor-error';
        document.body.prepend(errorDiv);
        ELEMENTOS.contenedorError = errorDiv;
    }
    
    const errorElement = document.createElement('div');
    errorElement.className = `error-mensaje ${esFatal ? 'fatal' : ''}`;
    errorElement.textContent = mensaje;
    
    ELEMENTOS.contenedorError.appendChild(errorElement);
    
    // Eliminar el mensaje después de 5 segundos
    setTimeout(() => {
        if (errorElement.parentNode === ELEMENTOS.contenedorError) {
            ELEMENTOS.contenedorError.removeChild(errorElement);
        }
    }, 5000);
}

// Inicializa los event listeners
function inicializarEventos() {
    // Aquí puedes añadir los event listeners necesarios
    console.log('Eventos inicializados');
    
    // Ejemplo de delegación de eventos para los partidos
    if (ELEMENTOS.contenedorPartidos) {
        ELEMENTOS.contenedorPartidos.addEventListener('click', (e) => {
            const partidoCard = e.target.closest('.partido-card');
            if (partidoCard) {
                const partidoId = partidoCard.dataset.partidoId;
                console.log('Partido seleccionado:', partidoId);
                // Aquí puedes manejar la selección de un partido
            }
        });
    }
}

// Hacer funciones disponibles globalmente si es necesario
window.mostrarError = mostrarError;

// Nuevo array global que almacenará los datos de la porra desde el servidor
let datosPorraGlobal = [];

// Función para obtener los datos desde el servidor central
async function cargarPorraCentral() {
    try {
        const response = await fetch('/api/porra'); // Llama a la ruta del servidor
        if (!response.ok) {
            throw new Error('Error al obtener datos del servidor.');
        }
        datosPorraGlobal = await response.json();

        // Llama a la función principal que renderiza la clasificación
        iniciarAplicacion(); 

    } catch (error) {
        console.error("Error cargando la porra:", error);
        alert("No se pudo conectar al servidor de la Porra. Intenta recargar.");
    }
}

// Ejecuta la carga al iniciar la app, en lugar de document.addEventListener('DOMContentLoaded', ...)
cargarPorraCentral(); 

// Y donde tenías el código de inicialización:
// Manten la función de inicialización, pero asegúrate de que use datosPorraGlobal
function iniciarAplicacion() {
    // 1. Carga de pronósticos (Ahora está en datosPorraGlobal)
    // Ya no necesitas leer de localStorage aquí, solo usas datosPorraGlobal
    // ...

    // 4. Renderización de la clasificación general
    // Asegúrate de que esta función usa datosPorraGlobal
    // renderizarClasificacionGeneral(datosPorraGlobal); 
    // ...
}

// ====================================================================
// 0.2 MARCADO DE ACIERTOS EN PERFILES (VISUAL)
// ====================================================================

function marcarAciertosPerfil() {
    if (!perfilNombre) return; // Solo para páginas de perfil

    const pronosticosOficiales = cargarPronosticosPorClave(perfilesConfig.partidos.key);

    document.querySelectorAll('.partido-card').forEach(card => {
        // limpiar badge previa
        card.querySelector('.badge-puntos')?.remove();

        const equipoLocal = card.querySelector('.equipo-local')?.textContent?.trim();
        const equipoVisitante = card.querySelector('.equipo-visitante')?.textContent?.trim();
        if (!equipoLocal || !equipoVisitante) return;

        const nombrePartido = `${equipoLocal} vs ${equipoVisitante}`;
        const oficial = pronosticosOficiales[nombrePartido];
        const jugador = pronosticosConfirmados[nombrePartido];

        card.classList.remove('acierto-exacto', 'acierto-signo');

        if (!oficial || !jugador) return;
        if (typeof oficial.local !== 'number' || typeof oficial.visitante !== 'number') return;
        if (typeof jugador.local !== 'number' || typeof jugador.visitante !== 'number') return;

        const esExacto = oficial.local === jugador.local && oficial.visitante === jugador.visitante;
        if (esExacto) {
            card.classList.add('acierto-exacto');
            const badge = document.createElement('span');
            badge.className = 'badge-puntos badge-exacto';
            badge.textContent = '+5';
            card.prepend(badge);
            return;
        }

        const signoOficial = obtenerSignoResultado(oficial.local, oficial.visitante);
        const signoJugador = obtenerSignoResultado(jugador.local, jugador.visitante);
        if (signoOficial === signoJugador) {
            card.classList.add('acierto-signo');
            const badge = document.createElement('span');
            badge.className = 'badge-puntos badge-signo';
            badge.textContent = '+2';
            card.prepend(badge);
        }
    });
}

/**
 * Guarda el objeto actual de pronósticos en localStorage.
 */
function guardarPronosticos() {
    localStorage.setItem(storageKey, JSON.stringify(pronosticosConfirmados));
}


// ====================================================================
// 1. ESTRUCTURA DE DATOS (ACTUALIZADA)
// ====================================================================

// Estructura de equipos por grupo
const gruposData = [
    { nombre: "A", equipos: ["México", "Sudáfrica", "Corea del Sur", "Rep. UEFA 4"] },
    { nombre: "B", equipos: ["Canadá", "Rep. UEFA 1", "Catar", "Suiza"] },
    { nombre: "C", equipos: ["Brasil", "Marruecos", "Haití", "Escocia"] },
    { nombre: "D", equipos: ["Estados Unidos", "Paraguay", "Australia", "Rep. UEFA 3"] },
    { nombre: "E", equipos: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"] },
    { nombre: "F", equipos: ["Países Bajos", "Japón", "Rep. UEFA 2", "Túnez"] },
    { nombre: "G", equipos: ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"] },
    { nombre: "H", equipos: ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"] },
    { nombre: "I", equipos: ["Francia", "Senegal", "Play-off 2", "Noruega"] },
    { nombre: "J", equipos: ["Argentina", "Argelia", "Austria", "Jordania"] },
    { nombre: "K", equipos: ["Portugal", "Play-off 1", "Uzbekistán", "Colombia"] },
    { nombre: "L", equipos: ["Inglaterra", "Croacia", "Ghana", "Panamá"] },
];

// Calendario de partidos por grupo (solo enfrentamiento y jornada)
function obtenerPartidosDelGrupo(nombreGrupo) {
    const calendario = {
        "A": [
          { jornada: 1, local: "México", visitante: "Sudáfrica" }, { jornada: 1, local: "Corea del Sur", visitante: "Rep. UEFA 4" },
          { jornada: 2, local: "Rep. UEFA 4", visitante: "Sudáfrica" }, { jornada: 2, local: "México", visitante: "Corea del Sur" },
          { jornada: 3, local: "Rep. UEFA 4", visitante: "México" }, { jornada: 3, local: "Sudáfrica", visitante: "Corea del Sur" }
        ],
        "B": [
          { jornada: 1, local: "Canadá", visitante: "Rep. UEFA 1" }, { jornada: 1, local: "Catar", visitante: "Suiza" },
          { jornada: 2, local: "Suiza", visitante: "Rep. UEFA 1" }, { jornada: 2, local: "Canadá", visitante: "Catar" },
          { jornada: 3, local: "Suiza", visitante: "Canadá" }, { jornada: 3, local: "Rep. UEFA 1", visitante: "Catar" }
        ],
        "C": [
          { jornada: 1, local: "Brasil", visitante: "Marruecos" }, { jornada: 1, local: "Haití", visitante: "Escocia" },
          { jornada: 2, local: "Escocia", visitante: "Marruecos" }, { jornada: 2, local: "Brasil", visitante: "Haití" },
          { jornada: 3, local: "Escocia", visitante: "Brasil" }, { jornada: 3, local: "Marruecos", visitante: "Haití" }
        ],
        "D": [
          { jornada: 1, local: "Estados Unidos", visitante: "Paraguay" }, { jornada: 1, local: "Australia", visitante: "Rep. UEFA 3" },
          { jornada: 2, local: "Rep. UEFA 3", visitante: "Paraguay" }, { jornada: 2, local: "Estados Unidos", visitante: "Australia" },
          { jornada: 3, local: "Rep. UEFA 3", visitante: "Estados Unidos" }, { jornada: 3, local: "Paraguay", visitante: "Australia" }
        ],
        "E": [
          { jornada: 1, local: "Alemania", visitante: "Curazao" }, { jornada: 1, local: "Costa de Marfil", visitante: "Ecuador" },
          { jornada: 2, local: "Alemania", visitante: "Costa de Marfil" }, { jornada: 2, local: "Ecuador", visitante: "Curazao" },
          { jornada: 3, local: "Ecuador", visitante: "Alemania" }, { jornada: 3, local: "Curazao", visitante: "Costa de Marfil" }
        ],
        "F": [
          { jornada: 1, local: "Países Bajos", visitante: "Japón" }, { jornada: 1, local: "Rep. UEFA 2", visitante: "Túnez" },
          { jornada: 2, local: "Países Bajos", visitante: "Rep. UEFA 2" }, { jornada: 2, local: "Túnez", visitante: "Japón" },
          { jornada: 3, local: "Japón", visitante: "Rep. UEFA 2" }, { jornada: 3, local: "Túnez", visitante: "Países Bajos" }
        ],
        "G": [
          { jornada: 1, local: "Irán", visitante: "Nueva Zelanda" }, { jornada: 1, local: "Bélgica", visitante: "Egipto" },
          { jornada: 2, local: "Bélgica", visitante: "Irán" }, { jornada: 2, local: "Nueva Zelanda", visitante: "Egipto" },
          { jornada: 3, local: "Egipto", visitante: "Irán" }, { jornada: 3, local: "Nueva Zelanda", visitante: "Bélgica" }
        ],
        "H": [
          { jornada: 1, local: "España", visitante: "Cabo Verde" }, { jornada: 1, local: "Arabia Saudita", visitante: "Uruguay" },
          { jornada: 2, local: "España", visitante: "Arabia Saudita" }, { jornada: 2, local: "Uruguay", visitante: "Cabo Verde" },
          { jornada: 3, local: "Cabo Verde", visitante: "Arabia Saudita" }, { jornada: 3, local: "Uruguay", visitante: "España" }
        ],
        "I": [
          { jornada: 1, local: "Francia", visitante: "Senegal" }, { jornada: 1, local: "Play-off 2", visitante: "Noruega" },
          { jornada: 2, local: "Francia", visitante: "Play-off 2" }, { jornada: 2, local: "Noruega", visitante: "Senegal" },
          { jornada: 3, local: "Noruega", visitante: "Francia" }, { jornada: 3, local: "Senegal", visitante: "Play-off 2" }
        ],
        "J": [
          { jornada: 1, local: "Argentina", visitante: "Argelia" }, { jornada: 1, local: "Austria", visitante: "Jordania" },
          { jornada: 2, local: "Argentina", visitante: "Austria" }, { jornada: 2, local: "Jordania", visitante: "Argelia" },
          { jornada: 3, local: "Argelia", visitante: "Austria" }, { jornada: 3, local: "Jordania", visitante: "Argentina" }
        ],
        "K": [
          { jornada: 1, local: "Portugal", visitante: "Play-off 1" }, { jornada: 1, local: "Uzbekistán", visitante: "Colombia" },
          { jornada: 2, local: "Portugal", visitante: "Uzbekistán" }, { jornada: 2, local: "Colombia", visitante: "Play-off 1" },
          { jornada: 3, local: "Colombia", visitante: "Portugal" }, { jornada: 3, local: "Play-off 1", visitante: "Uzbekistán" }
        ],
        "L": [
          { jornada: 1, local: "Inglaterra", visitante: "Croacia" }, { jornada: 1, local: "Ghana", visitante: "Panamá" },
          { jornada: 2, local: "Inglaterra", visitante: "Ghana" }, { jornada: 2, local: "Panamá", visitante: "Croacia" },
          { jornada: 3, local: "Panamá", visitante: "Inglaterra" }, { jornada: 3, local: "Croacia", visitante: "Ghana" }
        ]
    };
    return calendario[nombreGrupo] || [];
}

// Estructura que define cómo se encadenan los partidos (Llave Ganadora -> Llave Siguiente)
// Basado en la nomenclatura Mxx del cuadro oficial del Mundial 2026.
const encadenamientoBracket = {
    // Dieciseisavos de Final (R32 - M73 a M88)
    // NOTA: No necesita mapeo aquí ya que usa los clasificados de grupo
    R32: {},
    
    // Octavos de Final (R16 - M89 a M96) - ACTUALIZADO
    R16: [
        // Ganador partido 74 v Ganador partido 77
        { llave: 89, equipo1Ganador: 'M74', equipo2Ganador: 'M77' }, 
        
        // Ganador partido 73 v Ganador partido 75
        { llave: 90, equipo1Ganador: 'M73', equipo2Ganador: 'M75' },
        
        // Ganador partido 76 v Ganador partido 78
        { llave: 91, equipo1Ganador: 'M76', equipo2Ganador: 'M78' },
        
        // Ganador partido 79 v Ganador partido 80
        { llave: 92, equipo1Ganador: 'M79', equipo2Ganador: 'M80' },
        
        // Ganador partido 83 v Ganador partido 84
        { llave: 93, equipo1Ganador: 'M83', equipo2Ganador: 'M84' },
        
        // Ganador partido 81 v Ganador partido 82
        { llave: 94, equipo1Ganador: 'M81', equipo2Ganador: 'M82' },
        
        // Ganador partido 86 v Ganador partido 88
        { llave: 95, equipo1Ganador: 'M86', equipo2Ganador: 'M88' },
        
        // Ganador partido 85 v Ganador partido 87
        { llave: 96, equipo1Ganador: 'M85', equipo2Ganador: 'M87' },
    ],
    
    // Cuartos de Final (R8 - M97 a M100) - ACTUALIZADO
    R8: [
        // Ganador partido 89 v Ganador partido 90
        { llave: 97, equipo1Ganador: 'M89', equipo2Ganador: 'M90' },
        
        // Ganador partido 93 v Ganador partido 94
        { llave: 98, equipo1Ganador: 'M93', equipo2Ganador: 'M94' },
        
        // Ganador partido 91 v Ganador partido 92
        { llave: 99, equipo1Ganador: 'M91', equipo2Ganador: 'M92' },
        
        // Ganador partido 95 v Ganador partido 96
        { llave: 100, equipo1Ganador: 'M95', equipo2Ganador: 'M96' },
    ],
    
    // Semifinales (R4 - M101 a M102) - ACTUALIZADO
    R4: [
        // Ganador partido 97 v Ganador partido 98
        { llave: 101, equipo1Ganador: 'M97', equipo2Ganador: 'M98' },
        
        // Ganador partido 99 v Ganador partido 100
        { llave: 102, equipo1Ganador: 'M99', equipo2Ganador: 'M100' },
    ],
    
    // Final y 3er Puesto (M103 y M104) - ACTUALIZADO
    Final: [
        // Partido 103 (3er Puesto): Perdedor M101 v Perdedor M102
        { llave: 103, nombre: '3er Puesto', equipo1Ganador: 'M101-P', equipo2Ganador: 'M102-P' }, 
        
        // Partido 104 (Final): Ganador M101 v Ganador M102
        { llave: 104, nombre: 'Final', equipo1Ganador: 'M101-G', equipo2Ganador: 'M102-G' },  
    ]
};


// ====================================================================
// 2. GENERACIÓN DE ESTRUCTURA Y PESTAÑAS (TABS)
// ====================================================================

function generarEstructuraPartidos() {
    const contenedorGrupos = document.getElementById("contenedor-grupos");
    const contenedorTabs = document.getElementById("group-tabs");

    // 1. GENERAR PESTAÑAS Y CONTENIDO DE GRUPOS
    gruposData.forEach((grupo, index) => {
        const idGrupo = `grupo-${grupo.nombre.toLowerCase()}`;
        
        // Crear botón de pestaña (Tab)
        const button = document.createElement('button');
        button.className = 'tab-button';
        button.textContent = `Grupo ${grupo.nombre}`;
        button.dataset.target = idGrupo;
        
        // Crear contenido del grupo (Section)
        const section = document.createElement('section');
        section.className = 'grupo';
        section.id = idGrupo;
        
        let htmlContent = `<h3>Grupo ${grupo.nombre}</h3>`;
        
        const partidosDelGrupo = obtenerPartidosDelGrupo(grupo.nombre); 

        partidosDelGrupo.forEach(p => {
          const nombrePartido = `${p.local} vs ${p.visitante}`;
          const resultadoGuardado = pronosticosConfirmados[nombrePartido];
          const disabledAttr = resultadoGuardado ? 'disabled' : '';
          const valorLocal = resultadoGuardado ? resultadoGuardado.local : '';
          const valorVisitante = resultadoGuardado ? resultadoGuardado.visitante : '';
          const btnConfirmarDisabled = resultadoGuardado ? 'disabled' : '';
          const btnCambiarDisabled = resultadoGuardado ? '' : 'disabled';


          htmlContent += `
            <div class="partido-card">
              <div class="info-partido">
                  <span class="jornada">Jornada ${p.jornada}</span>
              </div>
              <div class="equipos">
                <span class="equipo-local">${p.local}</span>
                <input type="number" class="marcador" min="0" placeholder="0" value="${valorLocal}" ${disabledAttr}>
                <span class="vs">vs</span>
                <input type="number" class="marcador" min="0" placeholder="0" value="${valorVisitante}" ${disabledAttr}>
                <span class="equipo-visitante">${p.visitante}</span>
              </div>
              <div class="acciones">
                <button class="btn-confirmar" ${btnConfirmarDisabled}>Confirmar</button>
                <button class="btn-cambiar" ${btnCambiarDisabled}>Cambiar</button>
                ${esPaginaPartidos ? `<button class="btn-acertantes-exactos" data-partido="${nombrePartido}">Acertantes Exactos</button>` : ''}
              </div>
            </div>
          `;
        });

        section.innerHTML = htmlContent;
        
        contenedorTabs.appendChild(button);
        contenedorGrupos.appendChild(section);

        // Activar el primer grupo (Grupo A) por defecto al cargar
        if (index === 0) {
            button.classList.add('active');
            section.classList.add('active');
        }
    });

    // 2. GENERAR PESTAÑAS DE RONDAS ELIMINATORIAS
    const rondasEliminatorias = [
        { id: 'ronda-r32', nombre: '🏆 R32', funcion: generarDieciseisavos, ronda: 'R32' },
        { id: 'ronda-r16', nombre: '⏩ R16', funcion: () => generarRonda('R16'), ronda: 'R16' },
        { id: 'ronda-r8', nombre: '⭐ Cuartos', funcion: () => generarRonda('R8'), ronda: 'R8' },
        { id: 'ronda-r4', nombre: '✨ Semis', funcion: () => generarRonda('R4'), ronda: 'R4' },
        { id: 'ronda-final', nombre: '🥇 Final', funcion: () => generarRonda('Final'), ronda: 'Final' },
    ];
    
    rondasEliminatorias.forEach(rondaData => {
        const buttonRonda = document.createElement('button');
        buttonRonda.className = 'tab-button';
        buttonRonda.textContent = rondaData.nombre;
        buttonRonda.dataset.target = rondaData.id;
        contenedorTabs.appendChild(buttonRonda);

        const sectionRonda = document.createElement('section');
        sectionRonda.className = 'grupo';
        sectionRonda.id = rondaData.id;
        // Creamos un div específico para el contenido del bracket de cada ronda
        sectionRonda.innerHTML = `<h3>${rondaData.nombre}</h3><div id="bracket-contenido-${rondaData.ronda}"></div>`;
        contenedorGrupos.appendChild(sectionRonda);
    });


    // 3. LÓGICA DE CAMBIO DE PESTAÑA (Event Listener)
    contenedorTabs.addEventListener('click', (event) => {
        if (event.target.classList.contains('tab-button')) {
            const targetId = event.target.dataset.target;

            // Desactivar todos los botones y grupos
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.grupo').forEach(group => group.classList.remove('active'));

            // Activar el botón clicado y el contenido correspondiente
            event.target.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            // Si es una pestaña de eliminatoria, renderizamos el bracket
            const rondaActiva = rondasEliminatorias.find(r => r.id === targetId);
            if (rondaActiva) {
                 const partidos = rondaActiva.funcion();
                 // Pasamos el contenedor específico y el nombre de la ronda
                 renderizarRondaEliminatoria(partidos, rondaActiva.ronda); 
            }
        }
    });

    // Después de renderizar la estructura, marcar aciertos en perfiles
    marcarAciertosPerfil();
}


// ====================================================================
// 3. FUNCIÓN DE CÁLCULO DE CLASIFICACIÓN
// ====================================================================

/**
 * Calcula y devuelve la tabla de clasificación de un grupo basándose en los resultados.
 */
function calcularClasificacion(nombreGrupo, equiposGrupo, resultados) {
    const clasificacion = equiposGrupo.map(equipo => ({
        equipo: equipo,
        pj: 0, pg: 0, pe: 0, pp: 0,
        gf: 0, gc: 0, dg: 0,
        ptos: 0 
    }));

    // Solo considera los resultados de la fase de grupos (identificados por 'vs' en la clave)
    const partidosDelGrupo = Object.keys(resultados).filter(key => 
        key.includes(' vs ') && resultados[key].grupo === nombreGrupo
    );

    partidosDelGrupo.forEach(key => {
        const resultado = resultados[key];
        const [localNombre, visitanteNombre] = key.split(' vs ');
        const golLocal = resultado.local;
        const golVisitante = resultado.visitante;

        const equipoLocal = clasificacion.find(e => e.equipo === localNombre);
        const equipoVisitante = clasificacion.find(e => e.equipo === visitanteNombre);

        if (!equipoLocal || !equipoVisitante) return; 

        // Actualizar Partidos Jugados (PJ) y Goles (GF, GC, DG)
        equipoLocal.pj++;
        equipoVisitante.pj++;

        equipoLocal.gf += golLocal;
        equipoLocal.gc += golVisitante;
        
        equipoVisitante.gf += golVisitante;
        equipoVisitante.gc += golLocal;
        
        equipoLocal.dg = equipoLocal.gf - equipoLocal.gc;
        equipoVisitante.dg = equipoVisitante.gf - equipoVisitante.gc; 

        // Actualizar Puntos (Ptos, PG, PE, PP)
        if (golLocal > golVisitante) {
            equipoLocal.ptos += 3; equipoLocal.pg++; equipoVisitante.pp++;
        } else if (golLocal < golVisitante) {
            equipoVisitante.ptos += 3; equipoVisitante.pg++; equipoLocal.pp++;
        } else {
            equipoLocal.ptos += 1; equipoVisitante.ptos += 1; equipoLocal.pe++; equipoVisitante.pe++;
        }
    });

    // Ordenar: Puntos > Diferencia de Goles > Goles a Favor
    clasificacion.sort((a, b) => {
        if (a.ptos !== b.ptos) return b.ptos - a.ptos;
        if (a.dg !== b.dg) return b.dg - a.dg;
        return b.gf - a.gf;
    });

    return clasificacion;
}


// ====================================================================
// 4. FUNCIÓN DE RENDERIZADO DE LA CLASIFICACIÓN
// ====================================================================

/**
 * Crea y añade la tabla de clasificación al grupo correspondiente en el DOM.
 */
function renderizarClasificacion(grupoData, clasificacion) {
    const grupoElement = document.getElementById(`grupo-${grupoData.nombre.toLowerCase()}`);
    
    // Eliminar tabla anterior si existe
    let tablaExistente = grupoElement.querySelector('.tabla-clasificacion-grupo');
    if (tablaExistente) {
        tablaExistente.remove();
    }
    
    let html = `
        <table class="tabla-clasificacion-grupo">
            <thead>
                <tr>
                    <th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
                    <th>GF</th><th>GC</th><th>DG</th><th>Ptos</th>
                </tr>
            </thead>
            <tbody>
    `;

    clasificacion.forEach((e, index) => {
        let claseFila = '';
        if (index === 0 || index === 1) {
            claseFila = 'pasa-directo'; 
        } else if (index === 2) {
            claseFila = 'candidato-tercero'; 
        } else if (index === 3) {
             claseFila = 'eliminado'; 
        }
        
        html += `
            <tr class="${claseFila}">
                <td class="equipo-nombre">${e.equipo}</td>
                <td>${e.pj}</td><td>${e.pg}</td><td>${e.pe}</td><td>${e.pp}</td>
                <td>${e.gf}</td><td>${e.gc}</td><td>${e.dg}</td>
                <td><strong>${e.ptos}</strong></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    
    grupoElement.insertAdjacentHTML('beforeend', html);
}


// ====================================================================
// 5. MANEJO DE EVENTOS (Grupos - Sigue usando marcadores)
// ====================================================================

/**
 * Maneja el evento de confirmar o cambiar un resultado de partido de la FASE DE GRUPOS.
 */
function manejarPronostico(event) {
    const boton = event.target;
    if (boton.classList.contains('btn-acertantes-exactos')) {
        const nombrePartido = boton.dataset.partido;
        const lista = obtenerAcertantesExactos(nombrePartido);
        const mensaje = lista.length
            ? `Acertantes exactos (${lista.length}):\n- ${lista.join('\n- ')}`
            : 'Nadie ha acertado este resultado exacto todavía.';
        alert(mensaje);
        return;
    }

    if (!boton.classList.contains('btn-confirmar') && !boton.classList.contains('btn-cambiar')) return;

    const partidoCard = boton.closest('.partido-card');
    const inputLocal = partidoCard.querySelector('.equipos .marcador:nth-child(2)');
    const inputVisitante = partidoCard.querySelector('.equipos .marcador:nth-child(4)');
    const btnConfirmar = partidoCard.querySelector('.btn-confirmar');
    const btnCambiar = partidoCard.querySelector('.btn-cambiar');
    
    const equipoLocal = partidoCard.querySelector('.equipo-local').textContent.trim();
    const equipoVisitante = partidoCard.querySelector('.equipo-visitante').textContent.trim();
    const nombrePartido = `${equipoLocal} vs ${equipoVisitante}`;
    
    const grupoElementId = partidoCard.closest('.grupo').id;
    if (!grupoElementId.startsWith('grupo-')) return;
    
    const grupoNombre = grupoElementId.replace('grupo-', '').toUpperCase();
    const grupoEncontrado = gruposData.find(g => g.nombre === grupoNombre);

    if (boton.classList.contains('btn-confirmar')) {
        const golLocal = parseInt(inputLocal.value);
        const golVisitante = parseInt(inputVisitante.value);
        
        if (isNaN(golLocal) || isNaN(golVisitante) || golLocal < 0 || golVisitante < 0) {
            alert("Por favor, introduce puntuaciones válidas (números no negativos).");
            return;
        }

        pronosticosConfirmados[nombrePartido] = {
            local: golLocal,
            visitante: golVisitante,
            grupo: grupoNombre
        };
        
        inputLocal.disabled = true;
        inputVisitante.disabled = true;
        btnConfirmar.disabled = true;
        btnCambiar.disabled = false;
        
        guardarPronosticos(); 

    } else if (boton.classList.contains('btn-cambiar')) {
        // En perfiles, exigir contraseña para permitir cambiar un pronóstico ya confirmado
        if (!esPaginaPartidos && perfilNombre) {
            const pass = prompt("Introduce la contraseña para modificar este pronóstico:");
            if (pass !== CONTRASENA_CAMBIO_PERFIL) {
                if (pass !== null) {
                    alert("Contraseña incorrecta. No se ha modificado el pronóstico.");
                }
                return;
            }
        }

        inputLocal.disabled = false;
        inputVisitante.disabled = false;
        btnConfirmar.disabled = false;
        btnCambiar.disabled = true;
        
        delete pronosticosConfirmados[nombrePartido];

        guardarPronosticos(); 
    }
    
    if (grupoEncontrado) {
        const clasificacionActualizada = calcularClasificacion(grupoNombre, grupoEncontrado.equipos, pronosticosConfirmados);
        renderizarClasificacion({ nombre: grupoNombre }, clasificacionActualizada);
    }

    // Recalcular marcado de aciertos en perfiles
    marcarAciertosPerfil();
}


// ====================================================================
// 6. LÓGICA DE BRACKET (Ganadores y Generación)
// ====================================================================

/**
 * Determina el equipo ganador (o perdedor) de un partido por su llave (Mxx).
 * @param {string} llavePartido - Ej: 'M73' o 'M101-P'.
 * @param {boolean} getLoser - Si es true, devuelve el perdedor.
 * @returns {string} Nombre del equipo ganador/perdedor, o 'TBD'.
 */
function obtenerGanador(llavePartido, getLoser = false) {
    if (llavePartido.endsWith('-P')) { 
        // Si termina en '-P', buscamos al perdedor
        return obtenerGanador(llavePartido.replace('-P', ''), true);
    }
    if (llavePartido.endsWith('-G')) { 
        // Si termina en '-G', buscamos al ganador
        return obtenerGanador(llavePartido.replace('-G', ''), false);
    }

    const resultado = pronosticosConfirmados[llavePartido];
    
    if (!resultado || resultado.equipoLocal === 'TBD' || resultado.equipoVisitante === 'TBD' || !resultado.ganador) {
        return 'TBD';
    }

    const { ganador, equipoLocal, equipoVisitante } = resultado;
    
    if (getLoser) {
        return (ganador === equipoLocal) ? equipoVisitante : equipoLocal;
    }
    
    return ganador;
}

/**
 * Genera el listado de partidos para una ronda eliminatoria (R16, R8, R4, Final).
 * @param {string} ronda - Ej: 'R16', 'R8', 'R4', 'Final'.
 * @returns {object[]} Lista de partidos con equipos ya asignados.
 */
function generarRonda(ronda) {
    const partidosRonda = encadenamientoBracket[ronda];
    const listaPartidos = [];

    partidosRonda.forEach(p => {
        let equipo1, equipo2;
        let nombreLlave = `M${p.llave}`; 
        
        // Obtiene los equipos ganadores de la ronda anterior
        equipo1 = obtenerGanador(p.equipo1Ganador);
        equipo2 = obtenerGanador(p.equipo2Ganador);
        
        listaPartidos.push({
            llave: p.llave, 
            nombreCompletoLlave: nombreLlave, 
            equipo1: equipo1,
            equipo2: equipo2
        });

        // Lógica de Actualización de Pronósticos:
        const datosActuales = pronosticosConfirmados[nombreLlave] || {};
        
        // Comprobar si los equipos han cambiado.
        const equiposHanCambiado = datosActuales.equipoLocal !== equipo1 || datosActuales.equipoVisitante !== equipo2;
        
        if (equiposHanCambiado) {
             // Si los equipos cambian (porque se eligió un ganador distinto en la ronda anterior), 
             // la llave debe reiniciarse (borrando el 'ganador' anterior).
             pronosticosConfirmados[nombreLlave] = {
                 equipoLocal: equipo1,
                 equipoVisitante: equipo2,
                 ronda: ronda
             };
        } else {
            // Si los equipos son los mismos, mantenemos el estado actual, incluido el 'ganador'.
            pronosticosConfirmados[nombreLlave] = {
                ...datosActuales, // Mantiene 'ganador' si existe
                equipoLocal: equipo1,
                equipoVisitante: equipo2,
                ronda: ronda
            };
        }
    });

    guardarPronosticos();

    return listaPartidos;
}

// ----------------------------------------------------
// 6.1 LÓGICA ESPECÍFICA: MEJORES TERCEROS Y DIECISEISAVOS (ACTUALIZADA)
// ----------------------------------------------------

/**
 * Itera sobre todos los grupos, encuentra el 3er lugar de cada uno 
 * y los clasifica para determinar cuáles avanzan (8 mejores de 12).
 */
function calcularMejoresTerceros() {
    const tercerosLugares = [];
    
    gruposData.forEach(grupo => {
        const clasificacionGrupo = calcularClasificacion(grupo.nombre, grupo.equipos, pronosticosConfirmados);
        
        if (clasificacionGrupo.length >= 3) {
            const tercerLugar = clasificacionGrupo[2];
            
            tercerosLugares.push({
                grupo: grupo.nombre,
                equipo: tercerLugar.equipo,
                ptos: tercerLugar.ptos,
                dg: tercerLugar.dg,
                gf: tercerLugar.gf,
                pj: tercerLugar.pj
            });
        }
    });
    
    // Clasificar: Ptos > DG > GF > PJ
    tercerosLugares.sort((a, b) => {
        if (a.ptos !== b.ptos) return b.ptos - a.ptos;
        if (a.dg !== b.dg) return b.dg - a.dg;
        if (a.gf !== b.gf) return b.gf - a.gf;
        return a.pj - b.pj; 
    });

    return tercerosLugares.slice(0, 8); // Devolver los 8 mejores
}

/**
 * Obtiene los 1° y 2° de cada grupo y los 8 mejores 3°s.
 */
function obtenerClasificados() {
    const clasificados = { primeros: [], segundos: [], terceros: [] };
    const mejoresTerceros = calcularMejoresTerceros(); 
    const nombresMejoresTerceros = mejoresTerceros.map(t => t.equipo);

    gruposData.forEach(grupo => {
        const clasificacionGrupo = calcularClasificacion(grupo.nombre, grupo.equipos, pronosticosConfirmados);

        if (clasificacionGrupo.length >= 4) {
            clasificados.primeros.push({ equipo: clasificacionGrupo[0].equipo, grupo: grupo.nombre });
            clasificados.segundos.push({ equipo: clasificacionGrupo[1].equipo, grupo: grupo.nombre });

            const tercerLugar = clasificacionGrupo[2].equipo;
            if (nombresMejoresTerceros.includes(tercerLugar)) {
                const dataTercero = mejoresTerceros.find(t => t.equipo === tercerLugar);
                clasificados.terceros.push(dataTercero);
            }
        }
    });
    // Ordenar los terceros para la asignación simplificada
    clasificados.terceros.sort((a, b) => {
        if (a.ptos !== b.ptos) return b.ptos - a.ptos;
        if (a.dg !== b.dg) return b.dg - a.dg;
        return b.gf - a.gf;
    });

    return clasificados;
}


/**
 * Genera el bracket de dieciseisavos (M73 a M88) usando los clasificados de grupo.
 * **ACTUALIZADO** con el nuevo calendario de 16avos.
 * @returns {object[]} Lista de 16 partidos de la R32.
 */
function generarDieciseisavos() {
    const clasificados = obtenerClasificados();
    const p = {}; clasificados.primeros.forEach(c => p[c.grupo] = c.equipo); 
    const s = {}; clasificados.segundos.forEach(c => s[c.grupo] = c.equipo); 
    const tercerosPorOrden = clasificados.terceros.map(t => t.equipo); 

    // Comprobación simple para ver si la fase de grupos está completada
    if (Object.keys(pronosticosConfirmados).filter(k => k.includes(' vs ')).length < (12 * 6)) {
         return []; 
    }
    
    const r32Partidos = [
        // Partido 73 – 2º Grupo A v 2º Grupo B 
        { llave: 73, equipo1: s['A'], equipo2: s['B'] }, 
        
        // Partido 74 – 1º Grupo E v 3º Grupo A/B/C/D/F (Tercero 1)
        { llave: 74, equipo1: p['E'], equipo2: tercerosPorOrden[0] || 'Tercero 1' },                               
        
        // Partido 75 – 1º Grupo F v 2º Grupo C 
        { llave: 75, equipo1: p['F'], equipo2: s['C'] },                               
        
        // Partido 76 – 1º Grupo E v 2º Grupo F 
        { llave: 76, equipo1: p['E'], equipo2: s['F'] }, 


        // Partido 77 – 1º Grupo I v 3º Grupo C/D/F/G/H (Tercero 2)
        { llave: 77, equipo1: p['I'], equipo2: tercerosPorOrden[1] || 'Tercero 2' },                               
        
        // Partido 78 – 2º Grupo E v 2º Grupo I 
        { llave: 78, equipo1: s['E'], equipo2: s['I'] },                               
        
        // Partido 79 – 1º Grupo A v 3º Grupo C/E/F/H/I (Tercero 3)
        { llave: 79, equipo1: p['A'], equipo2: tercerosPorOrden[2] || 'Tercero 3' },
        
        // Partido 80 – 1º Grupo L v 3º Grupo E/H/I/J/K (Tercero 4)
        { llave: 80, equipo1: p['L'], equipo2: tercerosPorOrden[3] || 'Tercero 4' },
        
        // Partido 81 – 1º Grupo D v 3º Grupo B/E/F/I/J (Tercero 5)
        { llave: 81, equipo1: p['D'], equipo2: tercerosPorOrden[4] || 'Tercero 5' },                               
        
        // Partido 82 – 1º Grupo G v 3º Grupo A/E/H/I/J (Tercero 6)
        { llave: 82, equipo1: p['G'], equipo2: tercerosPorOrden[5] || 'Tercero 6' },
        
        // Partido 83 – 2º Grupo K v 2º Grupo L 
        { llave: 83, equipo1: s['K'], equipo2: s['L'] },                               
        
        // Partido 84 – 1º Grupo H v 2º Grupo J 
        { llave: 84, equipo1: p['H'], equipo2: s['J'] },
        
        // Partido 85 – 1º Grupo B v 3º Grupo E/F/G/I/J (Tercero 7)
        { llave: 85, equipo1: p['B'], equipo2: tercerosPorOrden[6] || 'Tercero 7' },
        
        // Partido 86 – 1º Grupo J v 2º Grupo H 
        { llave: 86, equipo1: p['J'], equipo2: s['H'] },
        
        // Partido 87 – 1º Grupo K v 3º Grupo D/E/I/J/L (Tercero 8)
        { llave: 87, equipo1: p['K'], equipo2: tercerosPorOrden[7] || 'Tercero 8' },
        
        // Partido 88 – 2º Grupo D v 2º Grupo G 
        { llave: 88, equipo1: s['D'], equipo2: s['G'] },   
    ];

    r32Partidos.forEach(p => {
        const nombreLlave = `M${p.llave}`;
        const datosActuales = pronosticosConfirmados[nombreLlave] || {};
        
        const equiposHanCambiado = datosActuales.equipoLocal !== p.equipo1 || datosActuales.equipoVisitante !== p.equipo2;

        if (equiposHanCambiado) {
             // Reiniciar la llave si los equipos clasificados cambian
             pronosticosConfirmados[nombreLlave] = {
                 equipoLocal: p.equipo1, 
                 equipoVisitante: p.equipo2,
                 ronda: 'R32'
             };
        } else {
             // Mantener los datos existentes si los equipos son los mismos
             pronosticosConfirmados[nombreLlave] = {
                ...datosActuales,
                equipoLocal: p.equipo1, 
                equipoVisitante: p.equipo2,
                ronda: 'R32'
            };
        }
    });

    guardarPronosticos();
    return r32Partidos.map(p => ({ 
        llave: p.llave, 
        nombreCompletoLlave: `M${p.llave}`, 
        equipo1: p.equipo1,
        equipo2: p.equipo2
    }));
}


// ====================================================================
// 7. RENDERIZADO DE RONDAS ELIMINATORIAS
// ====================================================================

/**
 * Renderiza cualquier ronda eliminatoria (R32, R16, R8, etc.) en el DOM.
 */
function renderizarRondaEliminatoria(partidos, ronda) {
    const contenedor = document.getElementById(`bracket-contenido-${ronda}`); 
    if (!contenedor) return; 

    let html = '';
    
    const totalPartidosFaseGrupos = 12 * 6;
    const partidosConfirmados = Object.keys(pronosticosConfirmados).filter(k => k.includes(' vs ')).length;
    const faltantes = totalPartidosFaseGrupos - partidosConfirmados;
    
    if (partidos.length === 0 && ronda === 'R32' && faltantes > 0) {
        html = `<p>Faltan **${faltantes}** resultados de grupos para generar los Dieciseisavos (R32).</p>`;
    } else if (partidos.length === 0 && ronda !== 'R32') {
         html = `<p>Faltan resultados de la ronda anterior para generar los ${ronda}.</p>`;
    } else {
        html = '<div class="ronda-eliminatoria">';

        // Preparar datos de puntos por presencia en ronda (solo en perfiles)
        let equiposOficialRonda = null;
        let equiposJugadorRonda = null;
        let puntosRonda = 0;
        if (perfilNombre) {
            const pronOficial = cargarPronosticosPorClave(perfilesConfig.partidos.key);
            const soloFinal = ronda === 'Final';
            equiposOficialRonda = obtenerEquiposPorRonda(pronOficial, ronda, soloFinal);
            equiposJugadorRonda = obtenerEquiposPorRonda(pronosticosConfirmados, ronda, soloFinal);
            const mapaPuntosRonda = { R32: 2, R16: 3, R8: 4, R4: 5, Final: 6 };
            puntosRonda = mapaPuntosRonda[ronda] || 0;
        }
        
        partidos.forEach(p => {
            // Calcular puntos de presencia de equipos en esta llave (solo perfiles)
            let puntosPartido = 0;
            if (perfilNombre && equiposOficialRonda && equiposJugadorRonda && puntosRonda > 0) {
                [p.equipo1, p.equipo2].forEach(eq => {
                    if (!eq || eq === 'TBD' || eq.startsWith('Tercero')) return;
                    if (equiposOficialRonda.has(eq) && equiposJugadorRonda.has(eq)) {
                        puntosPartido += puntosRonda;
                    }
                });
            }

            const nombreLlave = p.nombreCompletoLlave; // M73, M89, M104, etc.
            const resultadoGuardado = pronosticosConfirmados[nombreLlave] || {};
            
            const ganadorElegido = resultadoGuardado.ganador; 
            const yaHayGanador = !!ganadorElegido; 

            const EQUIPO_1_TBD = p.equipo1 === 'TBD' || p.equipo1.includes('Tercero'); // Considerar Tercero X como TBD si no se ha resuelto
            const EQUIPO_2_TBD = p.equipo2 === 'TBD' || p.equipo2.includes('Tercero');
            const TBD_CLASS = (EQUIPO_1_TBD || EQUIPO_2_TBD) ? 'tbd-enfrentamiento' : '';

            let LLAVE_TITULO;
            if (ronda === 'Final') {
                LLAVE_TITULO = (p.llave === 104) ? 'FINAL (M104)' : '3ER PUESTO (M103)';
            } else {
                 LLAVE_TITULO = `PARTIDO M${p.llave}`;
            }
            
            // Clases para destacar el equipo elegido y deshabilitar si ya hay ganador
            const claseEquipo1 = (ganadorElegido === p.equipo1) ? 'elegido' : '';
            const claseEquipo2 = (ganadorElegido === p.equipo2) ? 'elegido' : '';
            const disabledClase = yaHayGanador ? 'deshabilitado' : '';
            
            // Condición para deshabilitar los botones de elección
            const disableButtons = (EQUIPO_1_TBD || EQUIPO_2_TBD || yaHayGanador) ? 'disabled' : '';

            html += `
                <div class="partido-bracket ${TBD_CLASS} ${disabledClase}">
                    <span class="llave">${ronda} - ${LLAVE_TITULO}</span>
                    <div class="enfrentamiento-clic">
                        <button 
                            class="btn-equipo-ganador ${claseEquipo1}" 
                            data-llave="${nombreLlave}" 
                            data-equipo="${p.equipo1}"
                            ${disableButtons}>
                            ${p.equipo1}
                        </button>
                        
                        <span class="vs-eliminatoria">VS</span>
                        
                        <button 
                            class="btn-equipo-ganador ${claseEquipo2}" 
                            data-llave="${nombreLlave}" 
                            data-equipo="${p.equipo2}"
                            ${disableButtons}>
                            ${p.equipo2}
                        </button>
                    </div>
                     ${perfilNombre && puntosPartido > 0 ? 
                        `<div class="puntos-ronda">+${puntosPartido}</div>`
                       : ''}
                     ${yaHayGanador && !EQUIPO_1_TBD && !EQUIPO_2_TBD ? 
                        `<div class="acciones-elim">
                            <button class="btn-cambiar-elim-clic" data-llave="${nombreLlave}">Cambiar Ganador</button>
                         </div>` 
                         : ''}
                </div>
            `;
        });
        
        html += '</div>';
    }

    contenedor.innerHTML = html;
}


// ====================================================================
// 8. MANEJO DE EVENTOS (Eliminatorias - Clic de Avance) - CORREGIDO
// ====================================================================

function manejarPronosticoEliminatoria(event) {
    const boton = event.target;
    
    const esConfirmar = boton.classList.contains('btn-equipo-ganador');
    const esCambiar = boton.classList.contains('btn-cambiar-elim-clic');
    
    if (!esConfirmar && !esCambiar) return;

    const llavePartido = boton.dataset.llave; // Ej: M73, M99, M104

    // LÓGICA ROBUSTA PARA DETERMINAR LA RONDA POR RANGO DE LLAVE
    const numeroLlave = parseInt(llavePartido.replace('M', ''));
    let ronda;
    
    if (numeroLlave >= 73 && numeroLlave <= 88) {
        ronda = 'R32';
    } else if (numeroLlave >= 89 && numeroLlave <= 96) {
        ronda = 'R16';
    } else if (numeroLlave >= 97 && numeroLlave <= 100) {
        ronda = 'R8'; 
    } else if (numeroLlave >= 101 && numeroLlave <= 102) {
        ronda = 'R4';
    } else if (numeroLlave >= 103 && numeroLlave <= 104) {
        ronda = 'Final';
    }
    
    if (!ronda) return; 

    if (!pronosticosConfirmados[llavePartido]) return; 

    if (esConfirmar) {
        const equipoGanador = boton.dataset.equipo;
        
        // 1. Guardar el ganador
        pronosticosConfirmados[llavePartido].ganador = equipoGanador;
        
    } else if (esCambiar) {
        // 1. Eliminar el ganador
        delete pronosticosConfirmados[llavePartido].ganador;
        
        // También aseguramos que no quede ningún marcador remanente si lo hubiera
        delete pronosticosConfirmados[llavePartido].local;
        delete pronosticosConfirmados[llavePartido].visitante;
    }
    
    // 2. Persistencia
    guardarPronosticos(); 
    
    // 3. Re-renderizar la ronda actual (para actualizar el estado visual)
    const partidosActuales = (ronda === 'R32') ? generarDieciseisavos() : generarRonda(ronda);
    renderizarRondaEliminatoria(partidosActuales, ronda);
    
    // 4. Re-renderizar la siguiente ronda (propagación del ganador)
    const siguienteRonda = {
        R32: 'R16', R16: 'R8', R8: 'R4', R4: 'Final', Final: null
    };
    if (siguienteRonda[ronda]) {
        const nextRondaName = siguienteRonda[ronda];
        const nextRondaPartidos = generarRonda(nextRondaName);
        
        // Renderizar solo si la pestaña de la siguiente ronda está activa/visible
        const nextRondaTabId = `ronda-${nextRondaName.toLowerCase()}`;
        if (document.getElementById(nextRondaTabId)?.classList.contains('active')) {
             renderizarRondaEliminatoria(nextRondaPartidos, nextRondaName);
        }
    }
}


// ====================================================================
// 9. INICIALIZACIÓN
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    const tablaClasificacion = document.getElementById('tabla-clasificacion');

    // Si estamos en la página de clasificación, calculamos puntos y mostramos reglas
    if (tablaClasificacion) {
        actualizarClasificacionIndex();

        const btnReglas = document.querySelector('.btn-reglas-header');
        if (btnReglas) {
            btnReglas.addEventListener('click', () => {
                alert(
`REGLAS DE PUNTUACIÓN

FASE DE GRUPOS
- 5 puntos por acertar el resultado exacto de un partido.
- 2 puntos por acertar simplemente (gana local, gana visitante o empate).

ELIMINATORIAS (PRESENCIA POR RONDA)
- Dieciseisavos: 2 puntos por cada equipo que esté en el resultado oficial y también en tu cuadro (cualquier cruce).
- Octavos: 3 puntos por equipo.
- Cuartos: 4 puntos por equipo.
- Semifinales: 5 puntos por equipo.
- Final: 6 puntos por cada finalista que coincide.

BONUS CAMPEÓN
- +4 puntos extra si aciertas el campeón del mundo (ganador de la Final).`);
            });
        }
        return;
    }

    const contenedorGrupos = document.getElementById('contenedor-grupos');
    const contenedorTabs = document.getElementById('group-tabs');

    // Si no existen contenedores (p.ej. página sin estructura de pronósticos), salimos.
    if (!contenedorGrupos || !contenedorTabs) return;

    // 1. Generar toda la estructura de pestañas y partidos
    generarEstructuraPartidos(); 
    
    // 2. Escuchar eventos en el contenedor principal (para Confirmar/Cambiar de GRUPOS)
    contenedorGrupos.addEventListener('click', manejarPronostico);
    
    // 3. Escuchar eventos en el contenedor principal (para ELIMINATORIAS - CLIC)
    contenedorGrupos.addEventListener('click', manejarPronosticoEliminatoria);

    // 4. Renderizar clasificaciones iniciales de grupos
    gruposData.forEach(grupo => {
        const clasificacionInicial = calcularClasificacion(grupo.nombre, grupo.equipos, pronosticosConfirmados);
        renderizarClasificacion(grupo, clasificacionInicial);
    });

    // 5. Manejo del botón de reinicio
    const btnReiniciar = document.getElementById('btn-reiniciar-app');
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarPronosticos);
    }
});
// ====================================================================
// 10. FUNCIÓN DE REINICIO TOTAL DE LA APP (Con Contraseña DINÁMICA)
// ====================================================================

/**
 * Borra los pronósticos del perfil actual guardados en localStorage y recarga la página.
 */
function reiniciarPronosticos() {
    // Usamos la variable global 'passwordReiniciar'
    const password = prompt(`Introduce la contraseña para reiniciar los resultados de ${storageKey.replace('pronosticosMundial_', '').replace('pronosticosMundial', 'este perfil')}:`);
    
    if (password === passwordReiniciar) {
        localStorage.removeItem(storageKey); 
        alert(`¡Todos los pronósticos de este perfil han sido reiniciados! La página se recargará ahora.`);
        window.location.reload(); 
    } else if (password !== null) {
        alert("Contraseña incorrecta. El reinicio ha sido cancelado.");
    }
}

// ... (El resto del código JS (Bloque 9 - Inicialización) permanece aquí, intacto) ...