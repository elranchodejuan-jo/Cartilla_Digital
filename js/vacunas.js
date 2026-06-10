/**
 * CARTILLA DIGITAL - Módulo de Vacunas (vacunas.js)
 * Lógica de negocio y alertas para el registro de vacunación.
 */

/**
 * Calcula el estado de una vacuna en base a la fecha de su próxima dosis y la fecha actual.
 * 
 * @param {string} fechaProximaDosisString - Fecha de la próxima dosis en formato "YYYY-MM-DD"
 * @returns {Object} Un objeto con { status: 'success'|'warning'|'danger'|'none', label: string, daysLeft: number }
 */
function evaluarEstadoVacuna(fechaProximaDosisString) {
    if (!fechaProximaDosisString) {
        return {
            status: 'none',
            label: 'No programada',
            daysLeft: Infinity
        };
    }
    
    // Obtener fechas a las 00:00:00 para comparación de días limpia
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const proximaDosis = new Date(fechaProximaDosisString);
    proximaDosis.setHours(0, 0, 0, 0);
    
    if (isNaN(proximaDosis.getTime())) {
        return {
            status: 'none',
            label: 'Fecha inválida',
            daysLeft: Infinity
        };
    }
    
    const diffTime = proximaDosis.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return {
            status: 'danger', // Vencida
            label: 'Vencida',
            daysLeft: diffDays
        };
    } else if (diffDays <= 7) {
        return {
            status: 'warning', // Próxima (7 días o menos)
            label: `Próxima (${diffDays} ${diffDays === 1 ? 'día' : 'días'})`,
            daysLeft: diffDays
        };
    } else {
        return {
            status: 'success', // Al día (más de 7 días de vigencia)
            label: 'Al día',
            daysLeft: diffDays
        };
    }
}

/**
 * Registra una vacuna validando previamente sus fechas.
 * 
 * @param {string} mascotaId - ID de la mascota
 * @param {Object} datosVacuna - Objeto con datos de la vacuna
 * @returns {Promise<boolean>} True si se guardó con éxito
 */
async function registrarVacunaMascota(mascotaId, datosVacuna) {
    if (!mascotaId) return false;
    
    // Validaciones clínicas de fechas
    if (!datosVacuna.nombre || !datosVacuna.nombre.trim()) {
        throw new Error("El nombre de la vacuna es obligatorio.");
    }
    if (!datosVacuna.fechaAplicacion) {
        throw new Error("La fecha de aplicación es obligatoria.");
    }
    if (new Date(datosVacuna.fechaAplicacion) > new Date()) {
        throw new Error("La fecha de aplicación no puede ser en el futuro.");
    }
    if (datosVacuna.proximaDosis) {
        if (new Date(datosVacuna.proximaDosis) < new Date(datosVacuna.fechaAplicacion)) {
            throw new Error("La fecha de la próxima dosis no puede ser anterior a la de aplicación.");
        }
    }
    if (!datosVacuna.responsable || !datosVacuna.responsable.trim()) {
        throw new Error("El veterinario responsable es obligatorio.");
    }
    
    return await guardarVacuna(mascotaId, datosVacuna);
}

/**
 * Actualiza los datos de una vacuna del historial clínico.
 */
async function actualizarVacunaMascota(mascotaId, vacunaId, datosVacuna) {
    if (!mascotaId || !vacunaId) return false;
    
    // Validaciones clínicas de fechas
    if (!datosVacuna.nombre || !datosVacuna.nombre.trim()) {
        throw new Error("El nombre de la vacuna es obligatorio.");
    }
    if (!datosVacuna.fechaAplicacion) {
        throw new Error("La fecha de aplicación es obligatoria.");
    }
    if (new Date(datosVacuna.fechaAplicacion) > new Date()) {
        throw new Error("La fecha de aplicación no puede ser en el futuro.");
    }
    if (datosVacuna.proximaDosis) {
        if (new Date(datosVacuna.proximaDosis) < new Date(datosVacuna.fechaAplicacion)) {
            throw new Error("La fecha de la próxima dosis no puede ser anterior a la de aplicación.");
        }
    }
    if (!datosVacuna.responsable || !datosVacuna.responsable.trim()) {
        throw new Error("El veterinario responsable es obligatorio.");
    }
    
    return await actualizarVacuna(mascotaId, vacunaId, datosVacuna);
}
