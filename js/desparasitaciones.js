/**
 * CARTILLA DIGITAL - Módulo de Desparasitaciones (desparasitaciones.js)
 * Lógica de negocio y alertas para el control antiparasitario.
 */

/**
 * Evalúa el estado de una desparasitación en base a la fecha de próxima aplicación.
 * 
 * @param {string} fechaProximaAplicacionString - Fecha en formato "YYYY-MM-DD"
 * @returns {Object} Un objeto con { status: 'success'|'warning'|'danger'|'none', label: string, daysLeft: number }
 */
function evaluarEstadoDesparasitacion(fechaProximaAplicacionString) {
    if (!fechaProximaAplicacionString) {
        return {
            status: 'none',
            label: 'No programada',
            daysLeft: Infinity
        };
    }
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const proximaAplicacion = new Date(fechaProximaAplicacionString);
    proximaAplicacion.setHours(0, 0, 0, 0);
    
    if (isNaN(proximaAplicacion.getTime())) {
        return {
            status: 'none',
            label: 'Fecha inválida',
            daysLeft: Infinity
        };
    }
    
    const diffTime = proximaAplicacion.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return {
            status: 'danger',
            label: 'Vencida',
            daysLeft: diffDays
        };
    } else if (diffDays <= 7) {
        return {
            status: 'warning',
            label: `Próxima (${diffDays} ${diffDays === 1 ? 'día' : 'días'})`,
            daysLeft: diffDays
        };
    } else {
        return {
            status: 'success',
            label: 'Al día',
            daysLeft: diffDays
        };
    }
}

/**
 * Agrega una desparasitación al historial validando previamente sus fechas.
 * 
 * @param {string} mascotaId - ID de la mascota
 * @param {Object} datosDesparasitacion - Objeto con datos de desparasitación
 * @returns {Promise<boolean>} True si se guardó con éxito
 */
async function registrarDesparasitacionMascota(mascotaId, datosDesparasitacion) {
    if (!mascotaId) return false;
    
    // Validaciones clínicas
    if (!datosDesparasitacion.producto || !datosDesparasitacion.producto.trim()) {
        throw new Error("El nombre del producto desparasitante es obligatorio.");
    }
    if (!datosDesparasitacion.fechaAplicacion) {
        throw new Error("La fecha de aplicación es obligatoria.");
    }
    if (new Date(datosDesparasitacion.fechaAplicacion) > new Date()) {
        throw new Error("La fecha de aplicación no puede ser en el futuro.");
    }
    if (datosDesparasitacion.proximaAplicacion) {
        if (new Date(datosDesparasitacion.proximaAplicacion) < new Date(datosDesparasitacion.fechaAplicacion)) {
            throw new Error("La fecha de la próxima aplicación no puede ser anterior a la de aplicación.");
        }
    }
    if (!datosDesparasitacion.responsable || !datosDesparasitacion.responsable.trim()) {
        throw new Error("El veterinario responsable es obligatorio.");
    }
    
    return await guardarDesparasitacion(mascotaId, datosDesparasitacion);
}

/**
 * Actualiza los datos de una desparasitación (interna o externa) del historial clínico.
 */
async function actualizarDesparasitacionMascota(mascotaId, desparasitacionId, datosDesparasitacion) {
    if (!mascotaId || !desparasitacionId) return false;
    
    // Validaciones clínicas
    if (!datosDesparasitacion.producto || !datosDesparasitacion.producto.trim()) {
        throw new Error("El nombre del producto desparasitante es obligatorio.");
    }
    if (!datosDesparasitacion.fechaAplicacion) {
        throw new Error("La fecha de aplicación es obligatoria.");
    }
    if (new Date(datosDesparasitacion.fechaAplicacion) > new Date()) {
        throw new Error("La fecha de aplicación no puede ser en el futuro.");
    }
    if (datosDesparasitacion.proximaAplicacion) {
        if (new Date(datosDesparasitacion.proximaAplicacion) < new Date(datosDesparasitacion.fechaAplicacion)) {
            throw new Error("La fecha de la próxima aplicación no puede ser anterior a la de aplicación.");
        }
    }
    if (!datosDesparasitacion.responsable || !datosDesparasitacion.responsable.trim()) {
        throw new Error("El veterinario responsable es obligatorio.");
    }
    
    return await actualizarDesparasitacion(mascotaId, desparasitacionId, datosDesparasitacion);
}
