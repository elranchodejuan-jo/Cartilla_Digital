/**
 * CARTILLA DIGITAL - Módulo de Almacenamiento y Sincronización API (storage.js)
 * Maneja la persistencia redirigiendo al backend Node.js + PostgreSQL.
 */

const STORAGE_KEYS = {
    VETERINARIA: 'cartilla_digital_veterinaria',
    MASCOTAS: 'cartilla_digital_mascotas',
    BANCO_VACUNAS: 'cartilla_digital_banco_vacunas',
    BANCO_INTERNOS: 'cartilla_digital_banco_internos',
    BANCO_EXTERNOS: 'cartilla_digital_banco_externos'
};

// Generador de UUID v4 estándar como respaldo de compatibilidad
function generarUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Valida y sanea el esquema del objeto Mascota.
 */
function sanearEsquemaMascota(mascota) {
    if (!mascota || typeof mascota !== 'object') return null;
    
    return {
        id: mascota.id || generarUUID(),
        codigo: mascota.codigo || 'CD-UNKNOWN-00',
        fechaRegistro: mascota.fechaRegistro || new Date().toISOString().split('T')[0],
        veterinariaIniciales: (mascota.veterinariaIniciales || 'CD').toUpperCase().trim(),
        nombre: mascota.nombre || 'Mascota sin Nombre',
        especie: mascota.especie || 'Perro',
        raza: mascota.raza || '',
        sexo: mascota.sexo || 'Macho',
        fechaNacimiento: mascota.fechaNacimiento || new Date().toISOString().split('T')[0],
        color: mascota.color || '',
        peso: mascota.peso ? parseFloat(mascota.peso) : '',
        foto: mascota.foto || '',
        tutor: {
            nombre: mascota.tutor?.nombre || 'Sin Tutor',
            telefono: mascota.tutor?.telefono || '',
            direccion: mascota.tutor?.direccion || ''
        },
        vacunas: Array.isArray(mascota.vacunas) ? mascota.vacunas.map(sanearEsquemaVacuna) : [],
        desparasitaciones: Array.isArray(mascota.desparasitaciones) ? mascota.desparasitaciones.map(sanearEsquemaDesparasitacion) : [],
        controles: Array.isArray(mascota.controles) ? mascota.controles.map(sanearEsquemaControl) : [],
        observaciones: mascota.observaciones || ''
    };
}

function sanearEsquemaVacuna(v) {
    return {
        id: v.id || generarUUID(),
        nombre: v.nombre || 'Vacuna',
        enfermedades: v.enfermedades || '',
        laboratorio: v.laboratorio || '',
        fechaAplicacion: v.fechaAplicacion || v.fecha_aplicacion || '',
        proximaDosis: v.proximaDosis || v.proxima_dosis || '',
        lote: v.lote || '',
        responsable: v.responsable || 'Clínica Veterinaria',
        responsableId: v.responsableId || v.responsable_id || null,
        observaciones: v.observaciones || '',
        status: v.status || 'pendiente',
        fechaAsistencia: v.fechaAsistencia || v.fecha_asistencia || null
    };
}

function sanearEsquemaDesparasitacion(d) {
    return {
        id: d.id || generarUUID(),
        tipo: d.tipo || 'interna',
        producto: d.producto || d.nombre || 'Desparasitante',
        tipoProducto: d.tipoProducto || d.tipo_producto || 'tableta',
        rangoPeso: d.rangoPeso || d.rango_peso || '',
        parasitosCubre: d.parasitosCubre || d.parasitos_cubre || '',
        fechaAplicacion: d.fechaAplicacion || d.fecha_aplicacion || '',
        proximaAplicacion: d.proximaAplicacion || d.proxima_aplicacion || '',
        dosis: d.dosis || '',
        via: d.via || 'Oral',
        responsable: d.responsable || 'Clínica Veterinaria',
        responsableId: d.responsableId || d.responsable_id || null,
        observaciones: d.observaciones || '',
        status: d.status || 'pendiente',
        fechaAsistencia: d.fechaAsistencia || d.fecha_asistencia || null
    };
}

function sanearEsquemaControl(c) {
    return {
        id: c.id || generarUUID(),
        fecha: c.fecha || new Date().toISOString().split('T')[0],
        motivo: c.motivo || 'Control General',
        peso: c.peso ? parseFloat(c.peso) : '',
        temperatura: c.temperatura ? parseFloat(c.temperatura) : '',
        fc: c.fc ? parseInt(c.fc) : '',
        fr: c.fr ? parseInt(c.fr) : '',
        hallazgos: c.hallazgos || '',
        diagnostico: c.diagnostico || '',
        tratamiento: c.tratamiento || '',
        recomendaciones: c.recomendaciones || '',
        proximoControl: c.proximoControl || c.proximo_control || '',
        responsable: c.responsable || 'Clínica Veterinaria',
        responsableId: c.responsableId || c.responsable_id || null,
        status: c.status || 'pendiente',
        fechaAsistencia: c.fechaAsistencia || c.fecha_asistencia || null
    };
}

/**
 * Guarda los datos de configuración de la veterinaria.
 */
async function guardarVeterinaria(datos) {
    try {
        await API.actualizarVeterinaria(datos);
        return true;
    } catch (e) {
        console.error('Error al guardar datos de la veterinaria en API:', e);
        return false;
    }
}

/**
 * Obtiene los datos de configuración de la veterinaria.
 */
function obtenerVeterinaria() {
    return API.getSessionVet();
}

/**
 * Obtiene el equipo veterinario de la API.
 */
async function obtenerEquipo() {
    try {
        if (!API.isLoggedIn()) return [];
        return await API.obtenerEquipo();
    } catch (e) {
        console.error('Error al obtener equipo de la API:', e);
        return [];
    }
}

async function guardarResponsableEquipo(datos) {
    try {
        return await API.guardarResponsableEquipo(datos);
    } catch (e) {
        console.error('Error al guardar responsable de equipo:', e);
        throw e;
    }
}

async function editarResponsableEquipo(id, datos) {
    try {
        return await API.editarResponsableEquipo(id, datos);
    } catch (e) {
        console.error('Error al editar responsable de equipo:', e);
        throw e;
    }
}

async function eliminarResponsableEquipo(id) {
    try {
        return await API.eliminarResponsableEquipo(id);
    } catch (e) {
        console.error('Error al eliminar responsable de equipo:', e);
        throw e;
    }
}

/**
 * Obtiene la lista completa de mascotas registradas, saneando sus estructuras.
 */
async function obtenerMascotas() {
    try {
        if (!API.isLoggedIn()) return [];
        const mascotas = await API.obtenerMascotas();
        return mascotas.map(sanearEsquemaMascota).filter(Boolean);
    } catch (e) {
        console.error('Error al obtener mascotas de la API:', e);
        return [];
    }
}

/**
 * Guarda una nueva mascota en el listado.
 */
async function guardarMascota(mascota) {
    try {
        return await API.registrarMascota(mascota);
    } catch (e) {
        console.error('Error al guardar la mascota en API:', e);
        return null;
    }
}

/**
 * Actualiza la información de una mascota existente.
 */
async function actualizarMascota(id, datosActualizados) {
    try {
        await API.editarMascota(id, datosActualizados);
        return true;
    } catch (e) {
        console.error('Error al actualizar mascota en API:', e);
        return false;
    }
}

/**
 * Elimina una mascota por su ID.
 */
async function eliminarMascota(id) {
    try {
        await API.eliminarMascota(id);
        return true;
    } catch (e) {
        console.error('Error al eliminar mascota en API:', e);
        return false;
    }
}

/**
 * Guarda una vacuna en el historial de la mascota.
 */
async function guardarVacuna(mascotaId, vacuna) {
    try {
        await API.guardarVacuna(mascotaId, vacuna);
        return true;
    } catch (e) {
        console.error('Error al guardar vacuna en API:', e);
        return false;
    }
}

/**
 * Guarda una desparasitación en el historial de la mascota.
 */
async function guardarDesparasitacion(mascotaId, desparasitacion) {
    try {
        await API.guardarDesparasitacion(mascotaId, desparasitacion);
        return true;
    } catch (e) {
        console.error('Error al guardar desparasitación en API:', e);
        return false;
    }
}

/**
 * Guarda un control veterinario en el historial de la mascota.
 */
async function guardarControl(mascotaId, control) {
    try {
        await API.guardarControl(mascotaId, control);
        return true;
    } catch (e) {
        console.error('Error al guardar control clínico en API:', e);
        return false;
    }
}

/**
 * Actualiza una vacuna existente en el historial de la mascota.
 */
async function actualizarVacuna(mascotaId, vacunaId, nuevosDatos) {
    try {
        await API.editarVacuna(mascotaId, vacunaId, nuevosDatos);
        return true;
    } catch (e) {
        console.error('Error al actualizar vacuna en API:', e);
        return false;
    }
}

/**
 * Actualiza una desparasitación existente en el historial de la mascota.
 */
async function actualizarDesparasitacion(mascotaId, desparasitacionId, nuevosDatos) {
    try {
        await API.editarDesparasitacion(mascotaId, desparasitacionId, nuevosDatos);
        return true;
    } catch (e) {
        console.error('Error al actualizar desparasitación en API:', e);
        return false;
    }
}

/**
 * Actualiza un control clínico existente en el historial de la mascota.
 */
async function actualizarControl(mascotaId, controlId, nuevosDatos) {
    try {
        await API.editarControl(mascotaId, controlId, nuevosDatos);
        return true;
    } catch (e) {
        console.error('Error al actualizar control clínico en API:', e);
        return false;
    }
}

/**
 * Elimina una vacuna del historial de la mascota.
 */
async function eliminarVacuna(mascotaId, vacunaId) {
    try {
        await API.eliminarVacuna(mascotaId, vacunaId);
        return true;
    } catch (e) {
        console.error('Error al eliminar vacuna en API:', e);
        return false;
    }
}

/**
 * Elimina una desparasitación del historial de la mascota.
 */
async function eliminarDesparasitacion(mascotaId, desparasitacionId) {
    try {
        await API.eliminarDesparasitacion(mascotaId, desparasitacionId);
        return true;
    } catch (e) {
        console.error('Error al eliminar desparasitación en API:', e);
        return false;
    }
}

/**
 * Elimina un control clínico del historial de la mascota.
 */
async function eliminarControl(mascotaId, controlId) {
    try {
        await API.eliminarControl(mascotaId, controlId);
        return true;
    } catch (e) {
        console.error('Error al eliminar control clínico en API:', e);
        return false;
    }
}

/**
 * Guarda las observaciones/notas generales de una mascota.
 */
async function guardarObservacionesMascota(mascotaId, observacionesText) {
    try {
        await API.editarMascota(mascotaId, { observaciones: observacionesText });
        return true;
    } catch (e) {
        console.error('Error al guardar observaciones generales en API:', e);
        return false;
    }
}

// --- BANCO CLÍNICO MODELOS Y OPERACIONES CRUD (Persistencia Local en LocalStorage) ---

function sanearEsquemaVacunaBanco(v) {
    if (!v || typeof v !== 'object') return null;
    return {
        id: v.id || generarUUID(),
        nombre: v.nombre || '',
        tipo: v.tipo || 'Inactivada',
        especie: v.especie || 'Ambos', // Perro, Gato, Ambos
        enfermedades: v.enfermedades || '',
        laboratorio: v.laboratorio || '',
        lote: v.lote || '',
        frecuencia: v.frecuencia || '',
        observaciones: v.observaciones || ''
    };
}

function sanearEsquemaAntiparasitarioInternoBanco(p) {
    if (!p || typeof p !== 'object') return null;
    return {
        id: p.id || generarUUID(),
        nombre: p.nombre || '',
        principioActivo: p.principioActivo || p.principio_activo || '',
        especie: p.especie || 'Ambos', // Perro, Gato, Ambos
        presentacion: p.presentacion || p.tipo || 'tableta', // tableta, suspensión, pipeta, inyectable, pasta, otra
        dosisRecomendada: p.dosisRecomendada || p.dosis || '',
        rangoPeso: p.rangoPeso || p.rango_peso || '',
        viaAdministracion: p.viaAdministracion || p.via || 'Oral',
        frecuenciaRecomendada: p.frecuenciaRecomendada || p.frecuencia || '',
        parasitosCubre: p.parasitosCubre || p.parasitos || '',
        laboratorio: p.laboratorio || '',
        lote: p.lote || '',
        observaciones: p.observaciones || ''
    };
}

function sanearEsquemaAntiparasitarioExternoBanco(p) {
    if (!p || typeof p !== 'object') return null;
    return {
        id: p.id || generarUUID(),
        nombre: p.nombre || '',
        principioActivo: p.principioActivo || p.principio_activo || '',
        especie: p.especie || 'Ambos', // Perro, Gato, Ambos
        tipo: p.tipo || 'Tableta', // Tableta, Pipeta, Collar, Spray, Shampoo, Inyectable, Otro
        rangoPeso: p.rangoPeso || p.rango_peso || '',
        duracionProteccion: p.duracionProteccion || p.duracion || '',
        frecuenciaRecomendada: p.frecuenciaRecomendada || p.frecuencia || p.dosis || '',
        parasitosCubre: p.parasitosCubre || p.parasitos || '',
        laboratorio: p.laboratorio || '',
        lote: p.lote || '',
        observaciones: p.observaciones || '',
        advertencias: p.advertencias || ''
    };
}

// Vacunas Banco
function obtenerVacunasBanco() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.BANCO_VACUNAS);
        if (!data) return inicializarBancoVacunasDemo();
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(sanearEsquemaVacunaBanco).filter(Boolean);
    } catch (e) {
        console.error('Error al obtener vacunas del banco:', e);
        return [];
    }
}

function guardarVacunaBanco(vacuna) {
    try {
        const banco = obtenerVacunasBanco();
        const nuevaVac = sanearEsquemaVacunaBanco(vacuna);
        if (!nuevaVac) return null;
        banco.push(nuevaVac);
        localStorage.setItem(STORAGE_KEYS.BANCO_VACUNAS, JSON.stringify(banco));
        return nuevaVac;
    } catch (e) {
        console.error('Error al guardar vacuna en el banco:', e);
        return null;
    }
}

function actualizarVacunaBanco(id, datosActualizados) {
    try {
        const banco = obtenerVacunasBanco();
        const idx = banco.findIndex(v => v.id === id);
        if (idx === -1) return false;
        banco[idx] = sanearEsquemaVacunaBanco({ ...banco[idx], ...datosActualizados, id });
        localStorage.setItem(STORAGE_KEYS.BANCO_VACUNAS, JSON.stringify(banco));
        return true;
    } catch (e) {
        console.error('Error al actualizar vacuna del banco:', e);
        return false;
    }
}

function eliminarVacunaBanco(id) {
    try {
        const banco = obtenerVacunasBanco();
        const filtrado = banco.filter(v => v.id !== id);
        localStorage.setItem(STORAGE_KEYS.BANCO_VACUNAS, JSON.stringify(filtrado));
        return true;
    } catch (e) {
        console.error('Error al eliminar vacuna del banco:', e);
        return false;
    }
}

// Antiparasitarios Internos Banco
function obtenerAntiparasitariosInternosBanco() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.BANCO_INTERNOS);
        if (!data) return inicializarBancoInternosDemo();
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(sanearEsquemaAntiparasitarioInternoBanco).filter(Boolean);
    } catch (e) {
        console.error('Error al obtener antiparasitarios internos del banco:', e);
        return [];
    }
}

function guardarAntiparasitarioInternoBanco(p) {
    try {
        const banco = obtenerAntiparasitariosInternosBanco();
        const nuevoProd = sanearEsquemaAntiparasitarioInternoBanco(p);
        if (!nuevoProd) return null;
        banco.push(nuevoProd);
        localStorage.setItem(STORAGE_KEYS.BANCO_INTERNOS, JSON.stringify(banco));
        return nuevoProd;
    } catch (e) {
        console.error('Error al guardar antiparasitario interno:', e);
        return null;
    }
}

function actualizarAntiparasitarioInternoBanco(id, datosActualizados) {
    try {
        const banco = obtenerAntiparasitariosInternosBanco();
        const idx = banco.findIndex(p => p.id === id);
        if (idx === -1) return false;
        banco[idx] = sanearEsquemaAntiparasitarioInternoBanco({ ...banco[idx], ...datosActualizados, id });
        localStorage.setItem(STORAGE_KEYS.BANCO_INTERNOS, JSON.stringify(banco));
        return true;
    } catch (e) {
        console.error('Error al actualizar antiparasitario interno:', e);
        return false;
    }
}

function eliminarAntiparasitarioInternoBanco(id) {
    try {
        const banco = obtenerAntiparasitariosInternosBanco();
        const filtrado = banco.filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEYS.BANCO_INTERNOS, JSON.stringify(filtrado));
        return true;
    } catch (e) {
        console.error('Error al eliminar antiparasitario interno:', e);
        return false;
    }
}

// Antiparasitarios Externos Banco
function obtenerAntiparasitariosExternosBanco() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.BANCO_EXTERNOS);
        if (!data) return inicializarBancoExternosDemo();
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(sanearEsquemaAntiparasitarioExternoBanco).filter(Boolean);
    } catch (e) {
        console.error('Error al obtener antiparasitarios externos del banco:', e);
        return [];
    }
}

function guardarAntiparasitarioExternoBanco(p) {
    try {
        const banco = obtenerAntiparasitariosExternosBanco();
        const nuevoProd = sanearEsquemaAntiparasitarioExternoBanco(p);
        if (!nuevoProd) return null;
        banco.push(nuevoProd);
        localStorage.setItem(STORAGE_KEYS.BANCO_EXTERNOS, JSON.stringify(banco));
        return nuevoProd;
    } catch (e) {
        console.error('Error al guardar antiparasitario externo:', e);
        return null;
    }
}

function actualizarAntiparasitarioExternoBanco(id, datosActualizados) {
    try {
        const banco = obtenerAntiparasitariosExternosBanco();
        const idx = banco.findIndex(p => p.id === id);
        if (idx === -1) return false;
        banco[idx] = sanearEsquemaAntiparasitarioExternoBanco({ ...banco[idx], ...datosActualizados, id });
        localStorage.setItem(STORAGE_KEYS.BANCO_EXTERNOS, JSON.stringify(banco));
        return true;
    } catch (e) {
        console.error('Error al actualizar antiparasitario externo:', e);
        return false;
    }
}

function eliminarAntiparasitarioExternoBanco(id) {
    try {
        const banco = obtenerAntiparasitariosExternosBanco();
        const filtrado = banco.filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEYS.BANCO_EXTERNOS, JSON.stringify(filtrado));
        return true;
    } catch (e) {
        console.error('Error al eliminar antiparasitario externo:', e);
        return false;
    }
}

// Inicializadores de Demos
function inicializarBancoVacunasDemo() {
    const vacunasDemo = [
        { nombre: 'Puppy DP', tipo: 'Atenuada', especie: 'Perro', enfermedades: 'Parvovirus y Distemper canino', laboratorio: 'Nobivac', lote: 'P101A', frecuencia: 'Anual', observaciones: 'Vacuna inicial de cachorros' },
        { nombre: 'Sextuple', tipo: 'Combinada', especie: 'Perro', enfermedades: 'Distemper, Parvovirus, Adenovirus tipo 1 y 2, Parainfluenza, Leptospira', laboratorio: 'Zoetis', lote: 'SX202B', frecuencia: 'Anual', observaciones: 'Vacuna multipropósito' },
        { nombre: 'Octuple', tipo: 'Combinada', especie: 'Perro', enfermedades: 'Distemper, Parvovirus, Adenovirus 1 y 2, Parainfluenza, 2 serovares Leptospira, Coronavirus', laboratorio: 'Zoetis', lote: 'OC303C', frecuencia: 'Anual', observaciones: 'Vacuna anual recomendada' },
        { nombre: 'Antirrábica', tipo: 'Inactivada', especie: 'Ambos', enfermedades: 'Rabia', laboratorio: 'Boehringer Ingelheim', lote: 'RB909X', frecuencia: 'Anual o trianual', observaciones: 'Vacuna obligatoria legalmente' },
        { nombre: 'Tos de las perreras', tipo: 'Bacterina', especie: 'Perro', enfermedades: 'Bordetella bronchiseptica', laboratorio: 'MSD', lote: 'KC404D', frecuencia: 'Anual', observaciones: 'Recomendada para hospedajes' },
        { nombre: 'Triple felina', tipo: 'Combinada', especie: 'Gato', enfermedades: 'Calicivirus, Panleucopenia y Rinotraqueitis viral felina', laboratorio: 'Nobivac', lote: 'TF505E', frecuencia: 'Anual', observaciones: 'Vacuna triple esencial' },
        { nombre: 'Leucemia felina', tipo: 'Inactivada', especie: 'Gato', enfermedades: 'Leucemia Viral Felina (ViLeF)', laboratorio: 'Zoetis', lote: 'LF606F', frecuencia: 'Anual', observaciones: 'Recomendada previo test negativo' }
    ];
    const iniciales = vacunasDemo.map(v => sanearEsquemaVacunaBanco(v)).filter(Boolean);
    localStorage.setItem(STORAGE_KEYS.BANCO_VACUNAS, JSON.stringify(iniciales));
    return iniciales;
}

function inicializarBancoInternosDemo() {
    const internosDemo = [
        { nombre: 'Albendazol', principioActivo: 'Albendazol', especie: 'Ambos', presentacion: 'suspensión', dosisRecomendada: '15 mg/kg', rangoPeso: 'Cualquiera', viaAdministracion: 'Oral', frecuenciaRecomendada: 'Cada 3-4 meses', parasitosCubre: 'Nematodos y Cestodos', laboratorio: 'Drag Pharma', lote: 'ALB01', observaciones: 'Frecuente en cachorros' },
        { nombre: 'Fenbendazol', principioActivo: 'Fenbendazol', especie: 'Ambos', presentacion: 'tableta', dosisRecomendada: '50 mg/kg al día por 3 días', rangoPeso: 'Cualquiera', viaAdministracion: 'Oral', frecuenciaRecomendada: 'Según indicación', parasitosCubre: 'Nematodos, Giardia y algunos cestodos', laboratorio: 'Intervet', lote: 'FBZ02', observaciones: 'Seguro en hembras gestantes' },
        { nombre: 'Praziquantel', principioActivo: 'Praziquantel', especie: 'Ambos', presentacion: 'tableta', dosisRecomendada: '5 mg/kg', rangoPeso: 'Cualquiera', viaAdministracion: 'Oral', frecuenciaRecomendada: 'Cada 3 meses', parasitosCubre: 'Tenias / Cestodos únicamente', laboratorio: 'Bayer', lote: 'PZQ03', observaciones: 'A menudo combinado con Pirantel' },
        { nombre: 'Pirantel', principioActivo: 'Pamoato de Pirantel', especie: 'Ambos', presentacion: 'suspensión', dosisRecomendada: '5-10 mg/kg', rangoPeso: 'Cualquiera', viaAdministracion: 'Oral', frecuenciaRecomendada: 'Cada 2 semanas en cachorros', parasitosCubre: 'Nematodos (ascaris, ancilostomas)', laboratorio: 'Zoetis', lote: 'PYR04', observaciones: 'Altamente palatable para cachorros' },
        { nombre: 'Ivermectina', principioActivo: 'Ivermectina', especie: 'Ambos', presentacion: 'inyectable', dosisRecomendada: '0.2 mg/kg', rangoPeso: 'Cualquiera', viaAdministracion: 'Inyectable', frecuenciaRecomendada: 'Mensual o dosis única', parasitosCubre: 'Microfilarias, Nematodos y ácaros', laboratorio: 'Merial', lote: 'IVM05', observaciones: '¡ADVERTENCIA! Uso extremadamente cuidadoso en razas Collie, Shetland, Border Collie y cruzas afines por mutación del gen MDR1.' }
    ];
    const iniciales = internosDemo.map(p => sanearEsquemaAntiparasitarioInternoBanco(p)).filter(Boolean);
    localStorage.setItem(STORAGE_KEYS.BANCO_INTERNOS, JSON.stringify(iniciales));
    return iniciales;
}

function inicializarBancoExternosDemo() {
    const externosDemo = [
        { nombre: 'Bravecto', principioActivo: 'Fluralaner', especie: 'Ambos', tipo: 'Tableta', rangoPeso: '2-4.5 kg, 4.5-10 kg, 10-20 kg, 20-40 kg', duracionProteccion: '12 semanas', frecuenciaRecomendada: 'Cada 12 semanas', parasitosCubre: 'Pulgas, Garrapatas y ácaros (sarna)', laboratorio: 'MSD', lote: 'BRV01', observaciones: 'Administrar con comida. En gatos se suele usar la presentación Pipeta (Spot-on).', advertencias: 'No usar en cachorros menores de 8 semanas o 2 kg.' },
        { nombre: 'NexGard', principioActivo: 'Afoxolaner', especie: 'Perro', tipo: 'Tableta', rangoPeso: '2-4 kg, 4-10 kg, 10-25 kg, 25-50 kg', duracionProteccion: '30 días', frecuenciaRecomendada: 'Mensual', parasitosCubre: 'Pulgas y garrapatas', laboratorio: 'Boehringer Ingelheim', lote: 'NXG02', observaciones: 'Comprimido masticable con sabor a carne.', advertencias: 'Precaución en perros con antecedentes de convulsiones.' },
        { nombre: 'Simparica', principioActivo: 'Sarolaner', especie: 'Perro', tipo: 'Tableta', rangoPeso: '1.3-2.5 kg, 2.5-5 kg, 5-10 kg, 10-20 kg, 20-40 kg', duracionProteccion: '35 días', frecuenciaRecomendada: 'Mensual', parasitosCubre: 'Pulgas, garrapatas y sarnas (Sarcóptica, Demodécica, Otodéctica)', laboratorio: 'Zoetis', lote: 'SMP03', observaciones: 'Alta palatabilidad y rápida acción.', advertencias: 'No administrar en perros menores de 8 semanas de edad o 1.3 kg.' },
        { nombre: 'Credelio', principioActivo: 'Lotilaner', especie: 'Ambos', tipo: 'Tableta', rangoPeso: '1.3-2.5 kg, 2.5-5.5 kg, 5.5-11 kg, 11-22 kg', duracionProteccion: '30 días', frecuenciaRecomendada: 'Mensual', parasitosCubre: 'Pulgas y garrapatas', laboratorio: 'Elanco', lote: 'CRD04', observaciones: 'Pequeño comprimido masticable mensual.', advertencias: 'Administrar junto con alimento o hasta 30 min después.' },
        { nombre: 'Frontline', principioActivo: 'Fipronil + (S)-metopreno', especie: 'Ambos', tipo: 'Pipeta', rangoPeso: 'Perro (según peso) / Gato único', duracionProteccion: '30 días', frecuenciaRecomendada: 'Mensual', parasitosCubre: 'Pulgas (huevos, larvas, adultos), garrapatas y piojos', laboratorio: 'Boehringer Ingelheim', lote: 'FTL05', observaciones: 'Aplicación Spot-on en la nuca.', advertencias: 'Evitar baños 48 horas antes y después de la aplicación.' },
        { nombre: 'Revolution', principioActivo: 'Selamectina', especie: 'Ambos', tipo: 'Pipeta', rangoPeso: 'Según especie y peso', duracionProteccion: '30 días', frecuenciaRecomendada: 'Mensual', parasitosCubre: 'Pulgas, garrapatas (especies limitadas), ácaros del oído, nematodos y dirofilariosis', laboratorio: 'Zoetis', lote: 'REV06', observaciones: 'Excelente opción preventiva integral para gatos.', advertencias: 'No aplicar sobre piel húmeda.' },
        { nombre: 'Seresto', principioActivo: 'Imidacloprid + Flumetrina', especie: 'Ambos', tipo: 'Collar', rangoPeso: 'Perros < 8 kg y Gatos / Perros > 8 kg', duracionProteccion: '8 meses', frecuenciaRecomendada: 'Cada 8 meses', parasitosCubre: 'Pulgas, garrapatas y piojos. Repelente de flebótomos.', laboratorio: 'Elanco', lote: 'SRT07', observaciones: 'Collar resistente al agua e inodoro.', advertencias: 'No usar en cachorros < 7 semanas o gatitos < 10 semanas.' }
    ];
    const iniciales = externosDemo.map(p => sanearEsquemaAntiparasitarioExternoBanco(p)).filter(Boolean);
    localStorage.setItem(STORAGE_KEYS.BANCO_EXTERNOS, JSON.stringify(iniciales));
    return iniciales;
}
