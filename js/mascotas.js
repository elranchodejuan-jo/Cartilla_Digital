/**
 * CARTILLA DIGITAL - Módulo de Mascotas (mascotas.js)
 * Lógica de negocio para el registro y gestión de mascotas/pacientes.
 */

/**
 * Calcula la edad legible de una mascota a partir de su fecha de nacimiento.
 * @param {string} fechaNacimientoString - Fecha en formato "YYYY-MM-DD"
 * @returns {string} Edad formateada (ej. "2 años y 3 meses", "5 meses", "Menor de 1 mes")
 */
function calcularEdadMascota(fechaNacimientoString) {
    if (!fechaNacimientoString) return "Fecha no especificada";
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const cumpleanos = new Date(fechaNacimientoString);
    cumpleanos.setHours(0,0,0,0);
    
    if (isNaN(cumpleanos.getTime())) return "Fecha inválida";
    
    let anos = hoy.getFullYear() - cumpleanos.getFullYear();
    let meses = hoy.getMonth() - cumpleanos.getMonth();
    
    if (meses < 0 || (meses === 0 && hoy.getDate() < cumpleanos.getDate())) {
        anos--;
        meses += 12;
    }
    
    if (hoy.getDate() < cumpleanos.getDate()) {
        meses--;
        if (meses < 0) {
            anos--;
            meses += 11;
        }
    }
    
    if (anos < 0) return "Recién nacido / Aún no nace";
    
    if (anos === 0) {
        if (meses === 0) {
            return "Menor de 1 mes";
        }
        return meses === 1 ? "1 mes" : `${meses} meses`;
    } else {
        const stringAnos = anos === 1 ? "1 año" : `${anos} años`;
        if (meses === 0) {
            return stringAnos;
        }
        const stringMeses = meses === 1 ? "1 mes" : `${meses} meses`;
        return `${stringAnos} y ${stringMeses}`;
    }
}

/**
 * Registra un nuevo paciente en la veterinaria aplicando validaciones previas.
 * @param {Object} datosMascota - Formulario de mascota.
 * @returns {Promise<Object|null>} Retorna la mascota guardada o arroja un error.
 */
function emailMascotaValidoOpcional(valor) {
    const email = (valor || '').trim();
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function registrarMascota(datosMascota) {
    // 1. Validaciones de negocio obligatorias
    if (!datosMascota.nombre || !datosMascota.nombre.trim()) {
        throw new Error("El nombre de la mascota es obligatorio.");
    }
    if (!datosMascota.especie) {
        throw new Error("La especie de la mascota es obligatoria.");
    }
    if (!datosMascota.fechaNacimiento) {
        throw new Error("La fecha de nacimiento es obligatoria.");
    }
    if (new Date(datosMascota.fechaNacimiento) > new Date()) {
        throw new Error("La fecha de nacimiento no puede ser en el futuro.");
    }
    if (!datosMascota.tutor?.nombre || !datosMascota.tutor.nombre.trim()) {
        throw new Error("El nombre del tutor es obligatorio.");
    }
    if (!emailMascotaValidoOpcional(datosMascota.tutor?.email)) {
        throw new Error("Ingresa un correo válido o deja el campo vacío.");
    }
    if (datosMascota.peso !== '' && (isNaN(datosMascota.peso) || parseFloat(datosMascota.peso) < 0)) {
        throw new Error("El peso debe ser un número positivo.");
    }
    
    // 2. Guardar mediante la capa de almacenamiento API (código correlativo se genera en servidor)
    return await guardarMascota(datosMascota);
}

/**
 * Modifica los datos de una mascota existente previa validación.
 * @param {string} id - ID de la mascota.
 * @param {Object} datosModificados - Nuevos datos.
 * @returns {Promise<boolean>} True si se actualizó correctamente.
 */
async function editarMascota(id, datosModificados) {
    if (!id) return false;
    
    if (!datosModificados.nombre || !datosModificados.nombre.trim()) {
        throw new Error("El nombre de la mascota es obligatorio.");
    }
    if (!datosModificados.fechaNacimiento) {
        throw new Error("La fecha de nacimiento es obligatoria.");
    }
    if (new Date(datosModificados.fechaNacimiento) > new Date()) {
        throw new Error("La fecha de nacimiento no puede ser en el futuro.");
    }
    if (!datosModificados.tutor?.nombre || !datosModificados.tutor.nombre.trim()) {
        throw new Error("El nombre del tutor es obligatorio.");
    }
    if (!emailMascotaValidoOpcional(datosModificados.tutor?.email)) {
        throw new Error("Ingresa un correo válido o deja el campo vacío.");
    }
    if (datosModificados.peso !== '' && (isNaN(datosModificados.peso) || parseFloat(datosModificados.peso) < 0)) {
        throw new Error("El peso debe ser un número positivo.");
    }
    
    return await actualizarMascota(id, datosModificados);
}
