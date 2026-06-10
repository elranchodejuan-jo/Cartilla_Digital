/**
 * CARTILLA DIGITAL - Módulo de Controles Veterinarios (controles.js)
 * Lógica de negocio para las consultas y el historial clínico básico de pacientes.
 */

/**
 * Agrega un control clínico básico al historial de la mascota, validando los rangos fisiológicos.
 * 
 * @param {string} mascotaId - ID de la mascota
 * @param {Object} datosControl - Objeto con datos fisiológicos e indicaciones clínicas
 * @returns {Promise<boolean>} True si se guardó con éxito
 */
async function registrarControlMascota(mascotaId, datosControl) {
    if (!mascotaId) return false;
    
    // Validaciones
    if (!datosControl.motivo || !datosControl.motivo.trim()) {
        throw new Error("El motivo del control es obligatorio.");
    }
    if (!datosControl.fecha) {
        datosControl.fecha = new Date().toISOString().split('T')[0];
    }
    if (new Date(datosControl.fecha) > new Date()) {
        throw new Error("La fecha del control no puede ser en el futuro.");
    }
    
    // Validar rangos numéricos si se especificaron
    if (datosControl.peso !== '' && (isNaN(datosControl.peso) || parseFloat(datosControl.peso) < 0)) {
        throw new Error("El peso debe ser un número positivo.");
    }
    if (datosControl.temperatura !== '' && (isNaN(datosControl.temperatura) || parseFloat(datosControl.temperatura) < 25 || parseFloat(datosControl.temperatura) > 46)) {
        throw new Error("La temperatura ingresada está fuera del rango fisiológico viable (25°C - 46°C).");
    }
    if (datosControl.fc !== '' && (isNaN(datosControl.fc) || parseInt(datosControl.fc) < 0)) {
        throw new Error("La frecuencia cardiaca debe ser un número positivo.");
    }
    if (datosControl.fr !== '' && (isNaN(datosControl.fr) || parseInt(datosControl.fr) < 0)) {
        throw new Error("La frecuencia respiratoria debe ser un número positivo.");
    }
    if (datosControl.proximoControl) {
        if (new Date(datosControl.proximoControl) < new Date(datosControl.fecha)) {
            throw new Error("La fecha de próximo control no puede ser anterior a la del control actual.");
        }
    }
    
    return await guardarControl(mascotaId, datosControl);
}

/**
 * Actualiza los datos de un control clínico existente.
 */
async function actualizarControlMascota(mascotaId, controlId, datosControl) {
    if (!mascotaId || !controlId) return false;
    
    // Validaciones
    if (!datosControl.motivo || !datosControl.motivo.trim()) {
        throw new Error("El motivo del control es obligatorio.");
    }
    if (!datosControl.fecha) {
        datosControl.fecha = new Date().toISOString().split('T')[0];
    }
    if (new Date(datosControl.fecha) > new Date()) {
        throw new Error("La fecha del control no puede ser en el futuro.");
    }
    
    // Validar rangos numéricos si se especificaron
    if (datosControl.peso !== '' && (isNaN(datosControl.peso) || parseFloat(datosControl.peso) < 0)) {
        throw new Error("El peso debe ser un número positivo.");
    }
    if (datosControl.temperatura !== '' && (isNaN(datosControl.temperatura) || parseFloat(datosControl.temperatura) < 25 || parseFloat(datosControl.temperatura) > 46)) {
        throw new Error("La temperatura ingresada está fuera del rango fisiológico viable (25°C - 46°C).");
    }
    if (datosControl.fc !== '' && (isNaN(datosControl.fc) || parseInt(datosControl.fc) < 0)) {
        throw new Error("La frecuencia cardiaca debe ser un número positivo.");
    }
    if (datosControl.fr !== '' && (isNaN(datosControl.fr) || parseInt(datosControl.fr) < 0)) {
        throw new Error("La frecuencia respiratoria debe ser un número positivo.");
    }
    if (datosControl.proximoControl) {
        if (new Date(datosControl.proximoControl) < new Date(datosControl.fecha)) {
            throw new Error("La fecha de próximo control no puede ser anterior a la del control actual.");
        }
    }
    
    return await actualizarControl(mascotaId, controlId, datosControl);
}
