/**
 * CARTILLA DIGITAL - Módulo de Códigos Únicos (codigo.js)
 * Genera el identificador único para cada cartilla clínica digital de mascota.
 */

/**
 * Obtiene un string de fecha en formato local AAMMDD.
 * @param {Date|string} fechaInput - Fecha a procesar
 * @returns {string} Fecha formateada como AAMMDD (ej. "260610")
 */
function formatearFechaAAMMDD(fechaInput) {
    const fecha = fechaInput instanceof Date ? fechaInput : new Date(fechaInput);
    if (isNaN(fecha.getTime())) {
        const hoy = new Date();
        const y = String(hoy.getFullYear()).slice(-2);
        const m = String(hoy.getMonth() + 1).padStart(2, "0");
        const d = String(hoy.getDate()).padStart(2, "0");
        return `${y}${m}${d}`;
    }
    
    const year = String(fecha.getFullYear()).slice(-2);
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    
    return `${year}${month}${day}`;
}

/**
 * Genera el string del código único de la cartilla.
 * Formato: CD-[INICIALES_VETERINARIA]-[ESPECIE]-[AAMMDD]-[CONTADOR]
 * 
 * @param {Object} params
 * @param {string} params.inicialesVeterinaria - Iniciales de la veterinaria (ej. DDT, MVZ)
 * @param {string} params.especie - Especie ("perro" o "gato")
 * @param {Date|string} params.fecha - Objeto Date o string de la fecha de registro
 * @param {number} params.numeroPaciente - Número correlativo
 * @returns {string} Código único generado
 */
function generarCodigoCartilla({ inicialesVeterinaria, especie, fecha, numeroPaciente }) {
    const prefijo = "CD";
    
    // Especie: C = Canino, F = Felino, O = Otro (por seguridad)
    // Se mantiene soporte retroactivo para 'perro' y 'gato'
    let especieCodigo = "O";
    const espLower = (especie || "").toLowerCase().trim();
    if (espLower === "canino" || espLower === "perro") especieCodigo = "C";
    else if (espLower === "felino" || espLower === "gato") especieCodigo = "F";
    
    // Formatear la fecha
    const fechaCodigo = formatearFechaAAMMDD(fecha);
    
    // Formatear contador: dos dígitos mínimo (01-99) y dinámico si supera 99
    const contador = numeroPaciente < 100
        ? String(numeroPaciente).padStart(2, "0")
        : String(numeroPaciente);
        
    const inicialesFormateadas = (inicialesVeterinaria || "CD").toUpperCase().trim();
    
    return `${prefijo}-${inicialesFormateadas}-${especieCodigo}-${fechaCodigo}-${contador}`;
}

/**
 * Calcula el siguiente número correlativo para un paciente según las reglas de negocio.
 * Se reinicia si cambia la clínica, la especie o la fecha exacta de registro.
 * 
 * @param {string} inicialesVeterinaria - Iniciales de la veterinaria
 * @param {string} especie - Especie ("perro" o "gato")
 * @param {string} fechaString - Fecha de registro en formato "YYYY-MM-DD"
 * @returns {number} Siguiente número correlativo (mínimo 1)
 */
function calcularSiguienteNumeroPaciente(inicialesVeterinaria, especie, fechaString) {
    const mascotas = typeof obtenerMascotas === 'function' ? obtenerMascotas() : [];
    
    const inicialesBuscar = (inicialesVeterinaria || "").toUpperCase().trim();
    const especieBuscar = (especie || "").toLowerCase().trim();
    
    // Sanitizar fecha de búsqueda (eliminar posibles espacios)
    const fechaBuscar = (fechaString || "").trim();
    
    // Filtrar coincidencias en el LocalStorage
    const coincidencias = mascotas.filter(mascota => {
        const mascCodiVet = (mascota.veterinariaIniciales || "").toUpperCase().trim();
        const mascEspecie = (mascota.especie || "").toLowerCase().trim();
        const mascFecha = (mascota.fechaRegistro || "").trim(); // YYYY-MM-DD
        
        return mascCodiVet === inicialesBuscar &&
               mascEspecie === especieBuscar &&
               mascFecha === fechaBuscar;
    });
    
    return coincidencias.length + 1;
}
