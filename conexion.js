/**
 * ARCHIVO DE CONEXIÓN Y LÓGICA DEL CUESTIONARIO
 * Feria de Ciencias - ISFT N.º 244
 */

// 1. CONFIGURACIÓN DE SUPABASE
// Reemplazá estas credenciales con las que te provee Supabase al crear tu proyecto
const SUPABASE_URL = "https://wteeonxrbfvoqtvretnd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Xm490-Ej7r9Wtho-Fl-l5g_Ab82xcCo";

// Inicialización del cliente Supabase
supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. VARIABLES DE ESTADO GLOBAL DEL JUEGO
let bancoPreguntasCompleto = [];
let nombreParticipante = "";
let cursoParticipante = "";
let preguntasSeleccionadas = [];
let indicePreguntaActual = 0;
let respuestasCorrectas = 0;
let respuestasIncorrectas = 0;
let tiempoRestante = 30; // Segundos por pregunta
let intervaloTiempo = null;
let seleccionHabilitada = true;

// 3. REFERENCIAS DE ELEMENTOS DEL DOM
const welcomeScreen = document.getElementById('welcome-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');
const loadingDb = document.getElementById('loading-db');

const questionNumberTxt = document.getElementById('question-number');
const timerTxt = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

// Elementos de la pantalla de resultados
const resultIconContainer = document.getElementById('result-icon-container');
const resultStatus = document.getElementById('result-status');
const resultMessage = document.getElementById('result-message');
const statCorrect = document.getElementById('stat-correct');
const statIncorrect = document.getElementById('stat-incorrect');
const statPercent = document.getElementById('stat-percent');

// 4. EVENT LISTENERS PRINCIPALES
startBtn.addEventListener('click', () => {
    // 1. Capturamos lo que escribieron en las cajitas del HTML
    const inputNombre = document.getElementById('input-nombre').value.trim();
    const inputCurso = document.getElementById('input-curso').value.trim();

    // 2. Validamos que no estén vacíos
    if (inputNombre === "" || inputCurso === "") {
        alert("Por favor, completa tu Nombre y Curso antes de iniciar el desafío.");
        return; // Esto frena el juego y no lo deja avanzar
    }

    // 3. Si completó todo, guardamos los datos en las variables globales
    nombreParticipante = inputNombre;
    cursoParticipante = inputCurso;

    // 4. Ejecutamos la función original que arranca la trivia
    iniciarJuego();
});
nextBtn.addEventListener('click', avanzarPregunta);
restartBtn.addEventListener('click', reiniciarJuego);

/**
 * Función que arranca el proceso descargando los datos de Supabase.
 */
async function iniciarJuego() {
    startBtn.style.display = 'none';
    loadingDb.classList.remove('hidden');

    try {
        // Hacemos una consulta a la tabla 'preguntas' en Supabase
        const { data, error } = await supabase
            .from('preguntas')
            .select('*');

        if (error) throw error;

        bancoPreguntasCompleto = data;

        if (bancoPreguntasCompleto.length < 10) {
            alert("El banco debe tener al menos 10 preguntas. Cargadas actualmente: " + bancoPreguntasCompleto.length);
            reestablecerBotonInicio();
            return;
        }

        // Preparar juego
        seleccionarYMezclarPreguntas();
        welcomeScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        quizScreen.classList.add('fade-in');
        
        mostrarPregunta();

    } catch (error) {
        console.error("Error conectando con Supabase:", error.message);
        alert("Error de conexión a la Base de Datos de la Feria. Verificá las credenciales en conexion.js.");
        reestablecerBotonInicio();
    }
}

function reestablecerBotonInicio() {
    startBtn.style.display = 'inline-block';
    loadingDb.classList.add('hidden');
}

/**
 * Filtra aleatoriamente 10 preguntas del lote completo traído de la base de datos.
 */
function seleccionarYMezclarPreguntas() {
    // Mezcla todo el banco de preguntas (Algoritmo Fisher-Yates)
    const bancoMezclado = [...bancoPreguntasCompleto].sort(() => Math.random() - 0.5);
    // Tomamos las primeras 10
    preguntasSeleccionadas = bancoMezclado.slice(0, 10);
    indicePreguntaActual = 0;
    respuestasCorrectas = 0;
    respuestasIncorrectas = 0;
}

/**
 * Renderiza la pregunta actual en la pantalla
 */
function mostrarPregunta() {
    seleccionHabilitada = true;
    nextBtn.disabled = true;
    
    const preguntaActual = preguntasSeleccionadas[indicePreguntaActual];
    
    // Actualizar textos e indicadores
    questionNumberTxt.textContent = `Pregunta: ${indicePreguntaActual + 1}/10`;
    questionText.textContent = preguntaActual.enunciado;
    
    // Barra de progreso
    const porcentajeProgreso = ((indicePreguntaActual) / 10) * 180; // Escalado dinámico
    progressBar.style.width = `${(indicePreguntaActual + 1) * 10}%`;

    // Preparar opciones de respuesta (mezcladas)
    // El formato de la base de datos asume columnas: opcion_a, opcion_b, opcion_c, opcion_d y respuesta_correcta
    const opciones = [
        { texto: preguntaActual.opcion_a, clave: 'A' },
        { texto: preguntaActual.opcion_b, clave: 'B' },
        { texto: preguntaActual.opcion_c, clave: 'C' },
        { texto: preguntaActual.opcion_d, clave: 'D' }
    ].sort(() => Math.random() - 0.5);

    // Limpiar contenedor e inyectar botones
    optionsContainer.innerHTML = '';
    opciones.forEach(opcion => {
        const boton = document.createElement('button');
        boton.classList.add('option-btn');
        boton.innerHTML = `<span>${opcion.texto}</span> <i class="fa-solid fa-circle-nodes opacity-0"></i>`;
        boton.dataset.clave = opcion.clave;
        boton.addEventListener('click', () => evaluarRespuesta(boton, preguntaActual.respuesta_correcta));
        optionsContainer.appendChild(boton);
    });

    // Iniciar el temporizador para esta pregunta
    iniciarTemporizador();
}

/**
 * Controla la cuenta regresiva de 30 segundos
 */
function iniciarTemporizador() {
    clearInterval(intervaloTiempo);
    tiempoRestante = 30;
    timerTxt.innerHTML = `<i class="fa-regular fa-clock"></i> 00:${tiempoRestante < 10 ? '0' : ''}${tiempoRestante}`;
    
    intervaloTiempo = setInterval(() => {
        tiempoRestante--;
        timerTxt.innerHTML = `<i class="fa-regular fa-clock"></i> 00:${tiempoRestante < 10 ? '0' : ''}${tiempoRestante}`;
        
        if (tiempoRestante <= 0) {
            clearInterval(intervaloTiempo);
            forzarRespuestaPorTiempo();
        }
    }, 1000);
}

/**
 * Evalúa si la opción presionada por el estudiante es correcta
 */
function evaluarRespuesta(botonSeleccionado, claveCorrecta) {
    if (!seleccionHabilitada) return;
    seleccionHabilitada = false;
    clearInterval(intervaloTiempo);

    const claveUser = botonSeleccionado.dataset.clave;
    const botones = optionsContainer.querySelectorAll('.option-btn');

    if (claveUser === claveCorrecta) {
        // RESPUESTA CORRECTA
        botonSeleccionado.classList.add('correct-answer');
        botonSeleccionado.querySelector('i').className = "fa-solid fa-circle-check";
        respuestasCorrectas++;
        ejecutarFeedbackVisual(true);
    } else {
        // RESPUESTA INCORRECTA
        botonSeleccionado.classList.add('wrong-answer');
        botonSeleccionado.querySelector('i').className = "fa-solid fa-circle-xmark";
        respuestasIncorrectas++;
        
        // Destacar cuál era la correcta
        botones.forEach(btn => {
            if (btn.dataset.clave === claveCorrecta) {
                btn.classList.add('correct-answer');
                btn.querySelector('i').className = "fa-solid fa-circle-check";
            }
        });
        ejecutarFeedbackVisual(false);
    }

    nextBtn.disabled = false;
    mostrarExplicacion(); // <-- AGREGALA TAMBIÉN ACÁ
}

/**
 * Si se acaba el tiempo, se marca como incorrecta y se muestra la solución
 */
function forzarRespuestaPorTiempo() {
    seleccionHabilitada = false;
    respuestasIncorrectas++;
    const preguntaActual = preguntasSeleccionadas[indicePreguntaActual];
    const botones = optionsContainer.querySelectorAll('.option-btn');

    botones.forEach(btn => {
        if (btn.dataset.clave === preguntaActual.respuesta_correcta) {
            btn.classList.add('correct-answer');
            btn.querySelector('i').className = "fa-solid fa-circle-check";
        } else {
            btn.style.opacity = "0.5";
        }
    });

    ejecutarFeedbackVisual(false);
    mostrarExplicacion(); // <--AGREGÁ ESTA LÍNEA ACÁ
    nextBtn.disabled = false;
}

/**
 * Genera flashes visuales de color en la pantalla a modo de feedback
 */
function ejecutarFeedbackVisual(esCorrecto) {
    const contenedor = document.getElementById('quiz-screen');
    const colorFlash = esCorrecto ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
    
    contenedor.style.boxShadow = `0 20px 40px ${colorFlash}`;
    setTimeout(() => {
        contenedor.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.5)';
    }, 600);
}

/**
 * Pasa a la siguiente pregunta o finaliza si llegó a la 10
 */
function avanzarPregunta() {
    indicePreguntaActual++;
    if (indicePreguntaActual < 10) {
        mostrarPregunta();
    } else {
        mostrarResultadosFinales();
    }
}

/**
 * Despliega los resultados con métricas y disparadores de celebración
 */
function mostrarResultadosFinales() {
    quizScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    resultScreen.classList.add('fade-in');

    const porcentajeFinal = (respuestasCorrectas / 10) * 100;
    
    // Render de variables numéricas
    statCorrect.textContent = respuestasCorrectas;
    statIncorrect.textContent = respuestasIncorrectas;
    statPercent.textContent = `${porcentajeFinal}%`;
    guardarParticipanteEnSupabase(respuestasCorrectas);

    // Evaluación de rangos según requerimiento institucional
    if (porcentajeFinal >= 90) {
        resultIconContainer.innerHTML = '<i class="fa-solid fa-trophy" style="color: #ffd700;"></i>';
        resultStatus.textContent = "¡Excelente!";
        resultMessage.textContent = "Demostraste un dominio absoluto de la Inteligencia Artificial. ¡Futuro profesional del sector tecnológico!";
    } else if (porcentajeFinal >= 70) {
        resultIconContainer.innerHTML = '<i class="fa-solid fa-medal" style="color: #c0c0c0;"></i>';
        resultStatus.textContent = "¡Muy Bien!";
        resultMessage.textContent = "Tenés bases muy sólidas sobre tecnologías emergentes. ¡Buen trabajo!";
    } else if (porcentajeFinal >= 50) {
        resultIconContainer.innerHTML = '<i class="fa-solid fa-user-graduate" style="color: var(--color-electric-blue);"></i>';
        resultStatus.textContent = "Bien";
        resultMessage.textContent = "Vas por buen camino, conocés los conceptos pero aún podés profundizar más.";
    } else {
        resultIconContainer.innerHTML = '<i class="fa-solid fa-book-open" style="color: var(--color-incorrect);"></i>';
        resultStatus.textContent = "Necesitás seguir aprendiendo";
        resultMessage.textContent = "La IA avanza rápido. Te invitamos a repasar los conceptos e investigar más sobre estos temas.";
    }

    // Efecto de celebración si supera el 80% (Usa canvas-confetti por CDN)
    if (porcentajeFinal >= 80) {
        dispararConfetti();
    }
}

function dispararConfetti() {
    const duracion = 3 * 1000;
    const fin = Date.now() + duracion;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#00d2ff', '#9d4edd', '#10b981']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#00d2ff', '#9d4edd', '#10b981']
        });

        if (Date.now() < fin) {
            requestAnimationFrame(frame);
        }
    }());
}

/**
 * Resetea variables para volver a jugar sin recargar página
 */
function reiniciarJuego() {
    resultScreen.classList.add('hidden');
    welcomeScreen.classList.remove('hidden');
    startBtn.style.display = 'inline-block';
    loadingDb.classList.add('hidden');
}
// FUNCIÓN PARA MOSTRAR LA EXPLICACIÓN DE SUPABASE
function mostrarExplicacion() {
    const explicacionContainer = document.getElementById('explicacion-container');
    // Obtenemos la pregunta que está activa ahora
    const preguntaActual = preguntasSeleccionadas[indicePreguntaActual];
    
    if (explicacionContainer && preguntaActual && preguntaActual.explicacion) {
        // Le metemos el texto de la base de datos
        explicacionContainer.innerHTML = `<strong>Explicación:</strong> ${preguntaActual.explicacion}`;
        // Hacemos que la cajita aparezca en pantalla
        explicacionContainer.style.display = 'block';
    }
}

// CORRECCIÓN PARA EL CASO 3: ESCONDERLA AL TOCAR EL BOTÓN SIGUIENTE
if (document.getElementById('btn-siguiente')) {
    document.getElementById('btn-siguiente').addEventListener('click', () => {
        const explicacionContainer = document.getElementById('explicacion-container');
        if (explicacionContainer) {
            explicacionContainer.style.display = 'none';
        }
    });
}

async function guardarParticipanteEnSupabase(porcentaje) {
    try {
        await supabase
            .from('participantes')
            .insert([
                { 
                    nivel_educativo: cursoParticipante, 
                    tema_interes: nombreParticipante,    
                    puntaje_final: porcentaje           
                }
            ]);
        console.log("¡Datos guardados con éxito!");
    } catch (err) {
        console.error("Error:", err);
    }
}
