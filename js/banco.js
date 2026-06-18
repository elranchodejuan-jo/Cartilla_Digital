/**
 * CARTILLA DIGITAL - Módulo de Banco Clínico (banco.js)
 * Controla la visualización del catálogo clínico (vacunas y desparasitantes),
 * su administración y el autocompletado en el historial de pacientes.
 */

let bancoPestañaActiva = 'vacunas';

let cacheVacunas = [];
let cacheInternos = [];
let cacheExternos = [];

const CATALOGO_ECUADOR = {
    vacunas: [
        {
            nombre: 'Nobivac Puppy DP',
            tipo: 'Cachorros / viral',
            especie: 'Canino',
            enfermedades: 'Distemper canino y parvovirus canino',
            laboratorio: 'MSD Animal Health',
            lote: '',
            frecuencia: 'Segun esquema veterinario; refuerzos de cachorro',
            observaciones: 'Catalogo referencial Ecuador. Verificar etiqueta, disponibilidad y registro local antes de aplicar.'
        },
        {
            nombre: 'Nobivac DHPPi / DAPPi',
            tipo: 'Multiple canina',
            especie: 'Canino',
            enfermedades: 'Distemper, adenovirus/hepatitis, parvovirus y parainfluenza',
            laboratorio: 'MSD Animal Health',
            lote: '',
            frecuencia: 'Refuerzo anual o segun criterio veterinario',
            observaciones: 'Puede combinarse con leptospira segun presentacion. Verificar etiqueta del producto disponible.'
        },
        {
            nombre: 'Vanguard Plus 5',
            tipo: 'Multiple canina',
            especie: 'Canino',
            enfermedades: 'Distemper, adenovirus tipo 1 y 2, parainfluenza y parvovirus',
            laboratorio: 'Zoetis',
            lote: '',
            frecuencia: 'Refuerzo anual o segun criterio veterinario',
            observaciones: 'Catalogo referencial. Revisar cepas y cobertura segun presentacion importada.'
        },
        {
            nombre: 'Vanguard Plus 5/L4',
            tipo: 'Multiple canina + leptospira',
            especie: 'Canino',
            enfermedades: 'Componentes Vanguard Plus 5 y leptospirosis segun presentacion',
            laboratorio: 'Zoetis',
            lote: '',
            frecuencia: 'Refuerzo anual o segun riesgo epidemiologico',
            observaciones: 'Usar solo segun etiqueta y evaluacion clinica.'
        },
        {
            nombre: 'Eurican DAPPi-L',
            tipo: 'Multiple canina + leptospira',
            especie: 'Canino',
            enfermedades: 'Distemper, adenovirus, parvovirus, parainfluenza y leptospira',
            laboratorio: 'Boehringer Ingelheim',
            lote: '',
            frecuencia: 'Refuerzo anual o segun criterio veterinario',
            observaciones: 'Verificar presentacion exacta y cadena de frio.'
        },
        {
            nombre: 'Canigen MHA2PPi/L',
            tipo: 'Multiple canina + leptospira',
            especie: 'Canino',
            enfermedades: 'Moquillo, hepatitis/adenovirus, parvovirus, parainfluenza y leptospira',
            laboratorio: 'Virbac',
            lote: '',
            frecuencia: 'Refuerzo anual o segun criterio veterinario',
            observaciones: 'Catalogo referencial para banco clinico.'
        },
        {
            nombre: 'Biocan DHPPi + L',
            tipo: 'Multiple canina + leptospira',
            especie: 'Canino',
            enfermedades: 'Distemper, hepatitis/adenovirus, parvovirus, parainfluenza y leptospira',
            laboratorio: 'Bioveta',
            lote: '',
            frecuencia: 'Refuerzo anual o segun criterio veterinario',
            observaciones: 'Confirmar importador, lote y registro vigente.'
        },
        {
            nombre: 'Antirrabica canina/felina',
            tipo: 'Rabia',
            especie: 'Ambos',
            enfermedades: 'Rabia',
            laboratorio: 'Varios',
            lote: '',
            frecuencia: 'Segun normativa local y criterio veterinario',
            observaciones: 'Registrar lote, laboratorio y fecha real de aplicacion.'
        },
        {
            nombre: 'Nobivac KC',
            tipo: 'Respiratoria canina',
            especie: 'Canino',
            enfermedades: 'Bordetella bronchiseptica y parainfluenza canina segun presentacion',
            laboratorio: 'MSD Animal Health',
            lote: '',
            frecuencia: 'Segun riesgo: hospedaje, guarderia, exposiciones',
            observaciones: 'Confirmar via de administracion de la presentacion disponible.'
        },
        {
            nombre: 'Nobivac Tricat Trio',
            tipo: 'Triple felina',
            especie: 'Felino',
            enfermedades: 'Rinotraqueitis viral felina, calicivirus y panleucopenia',
            laboratorio: 'MSD Animal Health',
            lote: '',
            frecuencia: 'Refuerzo anual o segun criterio veterinario',
            observaciones: 'Catalogo referencial. Verificar edad minima y esquema.'
        },
        {
            nombre: 'Purevax RCP',
            tipo: 'Triple felina',
            especie: 'Felino',
            enfermedades: 'Rinotraqueitis, calicivirus y panleucopenia felina',
            laboratorio: 'Boehringer Ingelheim',
            lote: '',
            frecuencia: 'Refuerzo anual o segun criterio veterinario',
            observaciones: 'Confirmar disponibilidad y presentacion local.'
        },
        {
            nombre: 'Purevax FeLV / Leucemia felina',
            tipo: 'Leucemia felina',
            especie: 'Felino',
            enfermedades: 'Virus de leucemia felina',
            laboratorio: 'Boehringer Ingelheim',
            lote: '',
            frecuencia: 'Segun test, riesgo y criterio veterinario',
            observaciones: 'Recomendado registrar prueba FeLV/FIV previa cuando aplique.'
        }
    ],
    internos: [
        {
            nombre: 'Relampago',
            principioActivo: 'Por confirmar segun etiqueta',
            especie: 'Ambos',
            presentacion: 'Tableta / suspension segun distribuidor',
            dosisRecomendada: 'Segun peso y etiqueta del producto',
            rangoPeso: 'Por presentacion',
            viaAdministracion: 'Oral',
            frecuenciaRecomendada: 'Cada 3 meses o segun plan preventivo',
            parasitosCubre: 'Verificar espectro en etiqueta',
            laboratorio: 'Por confirmar',
            lote: '',
            observaciones: 'Producto indicado por el usuario. Completar principio activo al revisar envase o ficha tecnica local.'
        },
        {
            nombre: 'Total Full',
            principioActivo: 'Por confirmar segun etiqueta',
            especie: 'Ambos',
            presentacion: 'Tableta / suspension segun distribuidor',
            dosisRecomendada: 'Segun peso y etiqueta del producto',
            rangoPeso: 'Por presentacion',
            viaAdministracion: 'Oral',
            frecuenciaRecomendada: 'Cada 3 meses o segun plan preventivo',
            parasitosCubre: 'Verificar espectro en etiqueta',
            laboratorio: 'Por confirmar',
            lote: '',
            observaciones: 'Tambien puede encontrarse escrito como Totalfull. Confirmar composicion antes de usar.'
        },
        {
            nombre: 'Pirantel',
            principioActivo: 'Pamoato de pirantel',
            especie: 'Ambos',
            presentacion: 'Suspension / tableta',
            dosisRecomendada: 'Segun peso, especie y etiqueta',
            rangoPeso: 'Cachorros, adultos; ajustar por presentacion',
            viaAdministracion: 'Oral',
            frecuenciaRecomendada: 'Segun edad, riesgo y plan preventivo',
            parasitosCubre: 'Nematodos gastrointestinales sensibles',
            laboratorio: 'Varios',
            lote: '',
            observaciones: 'Registrar concentracion exacta del producto usado.'
        },
        {
            nombre: 'Fenbendazol',
            principioActivo: 'Fenbendazol',
            especie: 'Ambos',
            presentacion: 'Tableta / pasta / suspension',
            dosisRecomendada: 'Segun peso, especie y etiqueta',
            rangoPeso: 'Variable',
            viaAdministracion: 'Oral',
            frecuenciaRecomendada: 'Segun diagnostico o plan preventivo',
            parasitosCubre: 'Nematodos y algunos protozoarios segun pauta veterinaria',
            laboratorio: 'Varios',
            lote: '',
            observaciones: 'No reemplaza coprologico cuando hay sospecha clinica.'
        },
        {
            nombre: 'Praziquantel',
            principioActivo: 'Praziquantel',
            especie: 'Ambos',
            presentacion: 'Tableta / inyectable segun producto',
            dosisRecomendada: 'Segun peso, especie y etiqueta',
            rangoPeso: 'Variable',
            viaAdministracion: 'Oral / segun producto',
            frecuenciaRecomendada: 'Segun riesgo de cestodos',
            parasitosCubre: 'Cestodos sensibles',
            laboratorio: 'Varios',
            lote: '',
            observaciones: 'Frecuente en combinaciones con pirantel/febantel.'
        }
    ],
    externos: [
        {
            nombre: 'Blinker',
            principioActivo: 'Por confirmar segun etiqueta',
            especie: 'Ambos',
            tipo: 'Pipeta / collar / spray segun presentacion',
            rangoPeso: 'Por presentacion',
            duracionProteccion: 'Ver etiqueta',
            frecuenciaRecomendada: 'Segun etiqueta y riesgo',
            parasitosCubre: 'Pulgas/garrapatas u otros segun presentacion',
            laboratorio: 'Por confirmar',
            lote: '',
            observaciones: 'Producto indicado por el usuario. Completar principio activo y duracion desde envase local.',
            advertencias: 'No extrapolar entre perros y gatos sin etiqueta especifica.'
        },
        {
            nombre: 'NexGard',
            principioActivo: 'Afoxolaner',
            especie: 'Canino',
            tipo: 'Comprimido masticable',
            rangoPeso: 'Por rango de peso de la caja',
            duracionProteccion: 'Aproximadamente 1 mes segun etiqueta',
            frecuenciaRecomendada: 'Mensual o segun plan preventivo',
            parasitosCubre: 'Pulgas y garrapatas',
            laboratorio: 'Boehringer Ingelheim',
            lote: '',
            observaciones: 'Registrar presentacion por peso.',
            advertencias: 'Uso canino segun etiqueta. Precaucion si hay antecedentes neurologicos.'
        },
        {
            nombre: 'NexGard Spectra',
            principioActivo: 'Afoxolaner + milbemicina oxima',
            especie: 'Canino',
            tipo: 'Comprimido masticable',
            rangoPeso: 'Por rango de peso de la caja',
            duracionProteccion: 'Aproximadamente 1 mes segun etiqueta',
            frecuenciaRecomendada: 'Mensual o segun plan preventivo',
            parasitosCubre: 'Pulgas, garrapatas y parasitos internos indicados por etiqueta',
            laboratorio: 'Boehringer Ingelheim',
            lote: '',
            observaciones: 'Producto combinado; no duplicar preventivos internos sin revisar plan.',
            advertencias: 'Verificar edad/peso minimo y contraindicaciones.'
        },
        {
            nombre: 'Simparica',
            principioActivo: 'Sarolaner',
            especie: 'Canino',
            tipo: 'Comprimido masticable',
            rangoPeso: 'Por rango de peso de la caja',
            duracionProteccion: 'Aproximadamente 35 dias segun etiqueta',
            frecuenciaRecomendada: 'Mensual o segun plan preventivo',
            parasitosCubre: 'Pulgas, garrapatas y acaros indicados por etiqueta',
            laboratorio: 'Zoetis',
            lote: '',
            observaciones: 'Registrar peso actual antes de seleccionar presentacion.',
            advertencias: 'Uso segun etiqueta.'
        },
        {
            nombre: 'Simparica Trio',
            principioActivo: 'Sarolaner + moxidectina + pirantel',
            especie: 'Canino',
            tipo: 'Comprimido masticable combinado',
            rangoPeso: 'Por rango de peso de la caja',
            duracionProteccion: 'Aproximadamente 1 mes segun etiqueta',
            frecuenciaRecomendada: 'Mensual o segun plan preventivo',
            parasitosCubre: 'Pulgas, garrapatas, algunos internos y dirofilaria segun etiqueta',
            laboratorio: 'Zoetis',
            lote: '',
            observaciones: 'Evitar duplicar pirantel/moxidectina con otro preventivo sin revisar.',
            advertencias: 'Verificar edad/peso minimo y riesgo individual.'
        },
        {
            nombre: 'Bravecto',
            principioActivo: 'Fluralaner',
            especie: 'Ambos',
            tipo: 'Comprimido / pipeta segun especie',
            rangoPeso: 'Por rango de peso de la caja',
            duracionProteccion: 'Hasta 12 semanas segun presentacion',
            frecuenciaRecomendada: 'Cada 12 semanas o segun etiqueta',
            parasitosCubre: 'Pulgas y garrapatas; otros segun etiqueta',
            laboratorio: 'MSD Animal Health',
            lote: '',
            observaciones: 'Seleccionar formulacion especifica para perro o gato.',
            advertencias: 'No intercambiar presentaciones entre especies.'
        },
        {
            nombre: 'Frontline',
            principioActivo: 'Fipronil +/- (S)-metopreno segun presentacion',
            especie: 'Ambos',
            tipo: 'Pipeta / spray',
            rangoPeso: 'Por especie y peso',
            duracionProteccion: 'Ver etiqueta',
            frecuenciaRecomendada: 'Mensual o segun etiqueta',
            parasitosCubre: 'Pulgas y garrapatas segun presentacion',
            laboratorio: 'Boehringer Ingelheim / marcas autorizadas',
            lote: '',
            observaciones: 'Registrar presentacion exacta aplicada.',
            advertencias: 'Respetar especie, edad y peso minimo.'
        }
    ]
};

function normalizarTexto(valor, fallback = '') {
    return valor === null || valor === undefined ? fallback : String(valor);
}

function normalizarVacunaBanco(v = {}) {
    return {
        id: v.id,
        nombre: normalizarTexto(v.nombre),
        tipo: normalizarTexto(v.tipo, 'Vacuna'),
        especie: normalizarTexto(v.especie, 'Ambos'),
        enfermedades: normalizarTexto(v.enfermedades),
        laboratorio: normalizarTexto(v.laboratorio),
        lote: normalizarTexto(v.lote),
        frecuencia: normalizarTexto(v.frecuencia),
        observaciones: normalizarTexto(v.observaciones)
    };
}

function normalizarInternoBanco(p = {}) {
    return {
        id: p.id,
        nombre: normalizarTexto(p.nombre),
        principioActivo: normalizarTexto(p.principioActivo || p.principio_activo),
        especie: normalizarTexto(p.especie, 'Ambos'),
        presentacion: normalizarTexto(p.presentacion || p.tipo, 'tableta'),
        dosisRecomendada: normalizarTexto(p.dosisRecomendada || p.dosis),
        rangoPeso: normalizarTexto(p.rangoPeso || p.rango_peso),
        viaAdministracion: normalizarTexto(p.viaAdministracion || p.via, 'Oral'),
        frecuenciaRecomendada: normalizarTexto(p.frecuenciaRecomendada || p.frecuencia),
        parasitosCubre: normalizarTexto(p.parasitosCubre || p.parasitos),
        laboratorio: normalizarTexto(p.laboratorio),
        lote: normalizarTexto(p.lote),
        observaciones: normalizarTexto(p.observaciones)
    };
}

function normalizarExternoBanco(p = {}) {
    return {
        id: p.id,
        nombre: normalizarTexto(p.nombre),
        principioActivo: normalizarTexto(p.principioActivo || p.principio_activo),
        especie: normalizarTexto(p.especie, 'Ambos'),
        tipo: normalizarTexto(p.tipo, 'Tableta'),
        rangoPeso: normalizarTexto(p.rangoPeso || p.rango_peso),
        duracionProteccion: normalizarTexto(p.duracionProteccion || p.duracion),
        frecuenciaRecomendada: normalizarTexto(p.frecuenciaRecomendada || p.frecuencia || p.dosis),
        parasitosCubre: normalizarTexto(p.parasitosCubre || p.parasitos),
        laboratorio: normalizarTexto(p.laboratorio),
        lote: normalizarTexto(p.lote),
        observaciones: normalizarTexto(p.observaciones),
        advertencias: normalizarTexto(p.advertencias)
    };
}

function normalizarEspecieParaBanco(especie) {
    const valor = normalizarTexto(especie, 'Ambos').toLowerCase().trim();
    if (valor === 'perro' || valor === 'canino' || valor === 'p') return 'canino';
    if (valor === 'gato' || valor === 'felino' || valor === 'g') return 'felino';
    if (valor === 'ambos') return 'ambos';
    return valor;
}

function bancoCompatibleConEspecie(especieItem, especiePaciente) {
    const item = normalizarEspecieParaBanco(especieItem);
    const paciente = normalizarEspecieParaBanco(especiePaciente);
    return item === 'ambos' || item === paciente;
}

async function cargarCacheBancoClinico(force = false) {
    if (!window.API || !window.API.isLoggedIn()) return;

    const tareas = [];
    if (force || cacheVacunas.length === 0) {
        tareas.push(window.API.obtenerBancoVacunas().then(data => {
            cacheVacunas = (data || []).map(normalizarVacunaBanco);
        }));
    }
    if (force || cacheInternos.length === 0) {
        tareas.push(window.API.obtenerBancoInternos().then(data => {
            cacheInternos = (data || []).map(normalizarInternoBanco);
        }));
    }
    if (force || cacheExternos.length === 0) {
        tareas.push(window.API.obtenerBancoExternos().then(data => {
            cacheExternos = (data || []).map(normalizarExternoBanco);
        }));
    }

    await Promise.all(tareas);
}

function nombreCatalogoNormalizado(nombre) {
    return normalizarTexto(nombre)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function insertarFaltantesCatalogo(items, existentes, guardarFn) {
    const nombresExistentes = new Set((existentes || []).map(item => nombreCatalogoNormalizado(item.nombre)));
    let insertados = 0;

    for (const item of items) {
        const clave = nombreCatalogoNormalizado(item.nombre);
        if (!clave || nombresExistentes.has(clave)) continue;
        await guardarFn(item);
        nombresExistentes.add(clave);
        insertados++;
    }

    return insertados;
}

async function cargarCatalogoEcuador() {
    if (!window.API || !window.API.isLoggedIn()) {
        mostrarToast('Inicia sesion para cargar el catalogo en Supabase.', 'error');
        return;
    }

    try {
        mostrarToast('Cargando catalogo veterinario Ecuador...', 'info');
        await cargarCacheBancoClinico(true);

        const vacunas = await insertarFaltantesCatalogo(
            CATALOGO_ECUADOR.vacunas,
            cacheVacunas,
            datos => window.API.guardarBancoVacuna(datos)
        );
        const internos = await insertarFaltantesCatalogo(
            CATALOGO_ECUADOR.internos,
            cacheInternos,
            datos => window.API.guardarBancoInterno(datos)
        );
        const externos = await insertarFaltantesCatalogo(
            CATALOGO_ECUADOR.externos,
            cacheExternos,
            datos => window.API.guardarBancoExterno(datos)
        );

        await cargarCacheBancoClinico(true);
        cambiarPestañaBanco(bancoPestañaActiva || 'vacunas');
        mostrarToast(`Catalogo cargado: ${vacunas} vacunas, ${internos} internos, ${externos} externos.`, 'success');
    } catch (err) {
        console.error('Error cargando catalogo Ecuador:', err);
        mostrarToast(err.message || 'No se pudo cargar el catalogo Ecuador.', 'error');
    }
}

// Inicializar el Banco Clínico cuando sea necesario
document.addEventListener('DOMContentLoaded', () => {
    configurarManejadoresBanco();
});

/**
 * Cambia la pestaña activa del Banco Clínico y renderiza sus datos.
 * @param {string} tabName - 'vacunas' | 'internos' | 'externos'
 */
function cambiarPestañaBanco(tabName) {
    bancoPestañaActiva = tabName;
    
    // Actualizar estados visuales de los botones de pestañas
    const tabs = ['vacunas', 'internos', 'externos', 'medicamentos', 'codigos'];
    tabs.forEach(t => {
        const btn = document.getElementById(`btn-tab-banco-${t}`);
        const pane = document.getElementById(`banco-tab-content-${t}`);
        
        if (t === tabName) {
            if (btn) btn.classList.add('active');
            if (pane) pane.classList.add('active');
        } else {
            if (btn) btn.classList.remove('active');
            if (pane) pane.classList.remove('active');
        }
    });
    
    // Renderizar la tabla correspondiente
    // Renderizar la tabla correspondiente
    if (tabName === 'vacunas') {
        renderizarBancoVacunas();
    } else if (tabName === 'internos') {
        renderizarBancoInternos();
    } else if (tabName === 'externos') {
        renderizarBancoExternos();
    }
}

/**
 * Renderiza el listado del Banco de Vacunas.
 */
function renderizarBancoVacunas() {
    const tbody = document.getElementById('banco-vacunas-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Cargando...</td></tr>`;
    
    window.API.obtenerBancoVacunas().then(vacunas => {
        cacheVacunas = (vacunas || []).map(normalizarVacunaBanco);
        if (!cacheVacunas || cacheVacunas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay vacunas registradas en el banco.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = cacheVacunas.map(v => {
            return `
                <tr>
                    <td data-label="Nombre Comercial"><strong>${v.nombre}</strong></td>
                    <td data-label="Tipo"><span class="status-badge info">${v.tipo || 'Vacuna'}</span></td>
                    <td data-label="Especie"><span class="patient-badge ${normalizarEspecieParaBanco(v.especie) === 'canino' ? 'perro' : normalizarEspecieParaBanco(v.especie) === 'felino' ? 'gato' : ''}">${v.especie}</span></td>
                    <td data-label="Enfermedades"><span style="font-size:12px;">${v.enfermedades || 'N/A'}</span></td>
                    <td data-label="Laboratorio">${v.laboratorio || 'N/A'}</td>
                    <td data-label="Lote"><span style="font-family:monospace; font-size:12px;">${v.lote || 'N/A'}</span></td>
                    <td data-label="Frecuencia">${v.frecuencia || 'N/A'}</td>
                    <td data-label="Acciones">
                        <div style="display:flex; gap:6px; justify-content: flex-end;">
                            <button class="btn btn-secondary btn-icon-only" onclick="abrirModalBanco('vacuna', '${v.id}')" title="Editar">✏️</button>
                            <button class="btn btn-danger btn-icon-only" onclick="eliminarDeBanco('vacuna', '${v.id}', '${v.nombre}')" title="Eliminar">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }).catch(err => {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Error al cargar vacunas.</td></tr>`;
    });
}

/**
 * Renderiza el listado del Banco de Antiparasitarios Internos.
 */
function renderizarBancoInternos() {
    const tbody = document.getElementById('banco-internos-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Cargando...</td></tr>`;

    window.API.obtenerBancoInternos().then(productos => {
        cacheInternos = (productos || []).map(normalizarInternoBanco);
        if (!cacheInternos || cacheInternos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay antiparasitarios internos en el banco.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = cacheInternos.map(p => {
            return `
                <tr>
                    <td data-label="Nombre"><strong>${p.nombre}</strong></td>
                    <td data-label="Principio Activo"><span style="font-size:12px; color:var(--text-muted);">${p.principioActivo || 'N/A'}</span></td>
                    <td data-label="Especie"><span class="patient-badge ${normalizarEspecieParaBanco(p.especie) === 'canino' ? 'perro' : normalizarEspecieParaBanco(p.especie) === 'felino' ? 'gato' : ''}">${p.especie}</span></td>
                    <td data-label="Presentación"><span class="status-badge info" style="text-transform: capitalize;">${p.presentacion || 'N/A'}</span></td>
                    <td data-label="Dosis">${p.dosisRecomendada || 'N/A'}</td>
                    <td data-label="Vía">${p.viaAdministracion || 'N/A'}</td>
                    <td data-label="Rango Peso">${p.rangoPeso || 'N/A'}</td>
                    <td data-label="Acciones">
                        <div style="display:flex; gap:6px; justify-content: flex-end;">
                            <button class="btn btn-secondary btn-icon-only" onclick="abrirModalBanco('interno', '${p.id}')" title="Editar">✏️</button>
                            <button class="btn btn-danger btn-icon-only" onclick="eliminarDeBanco('interno', '${p.id}', '${p.nombre}')" title="Eliminar">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }).catch(err => {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Error al cargar antiparasitarios internos.</td></tr>`;
    });
}

/**
 * Renderiza el listado del Banco de Antiparasitarios Externos.
 */
function renderizarBancoExternos() {
    const tbody = document.getElementById('banco-externos-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Cargando...</td></tr>`;

    window.API.obtenerBancoExternos().then(productos => {
        cacheExternos = (productos || []).map(normalizarExternoBanco);
        if (!cacheExternos || cacheExternos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay antiparasitarios externos en el banco.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = cacheExternos.map(p => {
            return `
                <tr>
                    <td data-label="Nombre"><strong>${p.nombre}</strong></td>
                    <td data-label="Principio Activo"><span style="font-size:12px; color:var(--text-muted);">${p.principioActivo || 'N/A'}</span></td>
                    <td data-label="Especie"><span class="patient-badge ${normalizarEspecieParaBanco(p.especie) === 'canino' ? 'perro' : normalizarEspecieParaBanco(p.especie) === 'felino' ? 'gato' : ''}">${p.especie}</span></td>
                    <td data-label="Tipo"><span class="status-badge warning">${p.tipo || 'N/A'}</span></td>
                    <td data-label="Rango Peso">${p.rangoPeso || 'N/A'}</td>
                    <td data-label="Dosis">${p.frecuenciaRecomendada || p.duracionProteccion || 'N/A'}</td>
                    <td data-label="Acciones">
                        <div style="display:flex; gap:6px; justify-content: flex-end;">
                            <button class="btn btn-secondary btn-icon-only" onclick="abrirModalBanco('externo', '${p.id}')" title="Editar">✏️</button>
                            <button class="btn btn-danger btn-icon-only" onclick="eliminarDeBanco('externo', '${p.id}', '${p.nombre}')" title="Eliminar">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }).catch(err => {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Error al cargar antiparasitarios externos.</td></tr>`;
    });
}

/**
 * Abre los modales de creación o edición del Banco Clínico.
 * @param {string} tipo - 'vacuna' | 'interno' | 'externo'
 * @param {string|null} id - ID del objeto si es una edición
 */
function abrirModalBanco(tipo, id = null) {
    const modal = document.getElementById(`modal-banco-${tipo}`);
    if (!modal) return;
    
    const form = document.getElementById(`form-banco-${tipo}`);
    if (form) form.reset();
    
    const idInput = document.getElementById(`banco-${tipo.substring(0,3)}-id`);
    if (idInput) idInput.value = id || '';
    
    // Cargar datos si es edición
    if (id) {
        if (tipo === 'vacuna') {
            const v = cacheVacunas.find(item => item.id === id);
            if (v) {
                document.getElementById('banco-vac-nombre').value = v.nombre;
                document.getElementById('banco-vac-tipo').value = v.tipo;
                document.getElementById('banco-vac-especie').value = v.especie;
                document.getElementById('banco-vac-enfermedades').value = v.enfermedades;
                document.getElementById('banco-vac-laboratorio').value = v.laboratorio;
                document.getElementById('banco-vac-lote').value = v.lote;
                document.getElementById('banco-vac-frecuencia').value = v.frecuencia;
                document.getElementById('banco-vac-obs').value = v.observaciones;
            }
        } else if (tipo === 'interno') {
            const p = cacheInternos.find(item => item.id === id);
            if (p) {
                document.getElementById('banco-int-nombre').value = p.nombre;
                document.getElementById('banco-int-principio').value = p.principioActivo;
                document.getElementById('banco-int-especie').value = p.especie;
                document.getElementById('banco-int-presentacion').value = p.presentacion;
                document.getElementById('banco-int-dosis').value = p.dosisRecomendada;
                document.getElementById('banco-int-peso').value = p.rangoPeso;
                document.getElementById('banco-int-via').value = p.viaAdministracion;
                document.getElementById('banco-int-frecuencia').value = p.frecuenciaRecomendada;
                document.getElementById('banco-int-parasitos').value = p.parasitosCubre;
                document.getElementById('banco-int-laboratorio').value = p.laboratorio;
                document.getElementById('banco-int-lote').value = p.lote;
                document.getElementById('banco-int-obs').value = p.observaciones;
            }
        } else if (tipo === 'externo') {
            const p = cacheExternos.find(item => item.id === id);
            if (p) {
                document.getElementById('banco-ext-nombre').value = p.nombre;
                document.getElementById('banco-ext-principio').value = p.principioActivo;
                document.getElementById('banco-ext-especie').value = p.especie;
                document.getElementById('banco-ext-tipo').value = p.tipo;
                document.getElementById('banco-ext-peso').value = p.rangoPeso;
                document.getElementById('banco-ext-duracion').value = p.duracionProteccion;
                document.getElementById('banco-ext-frecuencia').value = p.frecuenciaRecomendada;
                document.getElementById('banco-ext-parasitos').value = p.parasitosCubre;
                document.getElementById('banco-ext-laboratorio').value = p.laboratorio;
                document.getElementById('banco-ext-lote').value = p.lote;
                document.getElementById('banco-ext-obs').value = p.observaciones;
                document.getElementById('banco-ext-advertencias').value = p.advertencias || '';
            }
        }
    }
    
    modal.classList.add('active');
}

/**
 * Cierra el modal del banco clínico.
 * @param {string} tipo - 'vacuna' | 'interno' | 'externo'
 */
function cerrarModalBanco(tipo) {
    const modal = document.getElementById(`modal-banco-${tipo}`);
    if (modal) modal.classList.remove('active');
}

/**
 * Elimina un registro del banco clínico previa confirmación.
 */
async function eliminarDeBanco(tipo, id, nombre) {
    if (confirm(`¿Está seguro de eliminar "${nombre}" del Banco Clínico? Ya no estará disponible para autocompletar nuevos registros.`)) {
        try {
            let res;
            if (tipo === 'vacuna') res = await window.API.eliminarBancoVacuna(id);
            else if (tipo === 'interno') res = await window.API.eliminarBancoInterno(id);
            else if (tipo === 'externo') res = await window.API.eliminarBancoExterno(id);
            
            if (res && res.mensaje) {
                mostrarToast('Producto eliminado del banco clínico.', 'success');
                cambiarPestañaBanco(bancoPestañaActiva);
            } else {
                mostrarToast('Error al eliminar del banco.', 'error');
            }
        } catch (e) {
            console.error("Error eliminando:", e);
            mostrarToast('Error al comunicar con el servidor.', 'error');
        }
    }
}

/**
 * Vincula los submits de formularios del banco clínico.
 */
function configurarManejadoresBanco() {
    // Vacuna Banco Form
    const fVac = document.getElementById('form-banco-vacuna');
    if (fVac) {
        fVac.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('banco-vac-id').value;
            const datos = {
                nombre: document.getElementById('banco-vac-nombre').value.trim(),
                tipo: document.getElementById('banco-vac-tipo').value.trim(),
                especie: document.getElementById('banco-vac-especie').value,
                enfermedades: document.getElementById('banco-vac-enfermedades').value.trim(),
                laboratorio: document.getElementById('banco-vac-laboratorio').value.trim(),
                lote: document.getElementById('banco-vac-lote').value.trim(),
                frecuencia: document.getElementById('banco-vac-frecuencia').value.trim(),
                observaciones: document.getElementById('banco-vac-obs').value.trim()
            };
            
            if (!datos.nombre || !datos.enfermedades) {
                mostrarToast('Nombre y Enfermedades son obligatorios.', 'error');
                return;
            }
            
            try {
                let res;
                if (id) {
                    res = await window.API.editarBancoVacuna(id, datos);
                } else {
                    res = await window.API.guardarBancoVacuna(datos);
                }
                
                if (res && (res.id || res.mensaje)) {
                    mostrarToast(id ? 'Vacuna actualizada en banco.' : 'Vacuna guardada en banco.', 'success');
                    cerrarModalBanco('vacuna');
                    cambiarPestañaBanco('vacunas');
                } else {
                    mostrarToast('Error al guardar vacuna.', 'error');
                }
            } catch (err) {
                console.error(err);
                mostrarToast('Error de conexión', 'error');
            }
        });
    }

    // Antiparasitario Interno Form
    const fInt = document.getElementById('form-banco-interno');
    if (fInt) {
        fInt.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('banco-int-id').value;
            const datos = {
                nombre: document.getElementById('banco-int-nombre').value.trim(),
                principioActivo: document.getElementById('banco-int-principio').value.trim(),
                especie: document.getElementById('banco-int-especie').value,
                presentacion: document.getElementById('banco-int-presentacion').value,
                tipo: document.getElementById('banco-int-presentacion').value,
                dosisRecomendada: document.getElementById('banco-int-dosis').value.trim(),
                dosis: document.getElementById('banco-int-dosis').value.trim(),
                rangoPeso: document.getElementById('banco-int-peso').value.trim(),
                rango_peso: document.getElementById('banco-int-peso').value.trim(),
                viaAdministracion: document.getElementById('banco-int-via').value.trim(),
                via: document.getElementById('banco-int-via').value.trim(),
                frecuenciaRecomendada: document.getElementById('banco-int-frecuencia').value.trim(),
                frecuencia: document.getElementById('banco-int-frecuencia').value.trim(),
                parasitosCubre: document.getElementById('banco-int-parasitos').value.trim(),
                parasitos: document.getElementById('banco-int-parasitos').value.trim(),
                laboratorio: document.getElementById('banco-int-laboratorio').value.trim(),
                lote: document.getElementById('banco-int-lote').value.trim(),
                observaciones: document.getElementById('banco-int-obs').value.trim()
            };
            
            if (!datos.nombre) {
                mostrarToast('El nombre comercial es obligatorio.', 'error');
                return;
            }
            
            try {
                let res;
                if (id) {
                    res = await window.API.editarBancoInterno(id, datos);
                } else {
                    res = await window.API.guardarBancoInterno(datos);
                }
                
                if (res && (res.id || res.mensaje)) {
                    mostrarToast(id ? 'Producto actualizado en banco.' : 'Producto guardado en banco.', 'success');
                    cerrarModalBanco('interno');
                    cambiarPestañaBanco('internos');
                } else {
                    mostrarToast('Error al guardar el producto.', 'error');
                }
            } catch (err) {
                console.error(err);
                mostrarToast('Error de conexión', 'error');
            }
        });
    }

    // Antiparasitario Externo Form
    const fExt = document.getElementById('form-banco-externo');
    if (fExt) {
        fExt.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('banco-ext-id').value;
            const datos = {
                nombre: document.getElementById('banco-ext-nombre').value.trim(),
                principioActivo: document.getElementById('banco-ext-principio').value.trim(),
                especie: document.getElementById('banco-ext-especie').value,
                tipo: document.getElementById('banco-ext-tipo').value,
                rangoPeso: document.getElementById('banco-ext-peso').value.trim(),
                rango_peso: document.getElementById('banco-ext-peso').value.trim(),
                duracionProteccion: document.getElementById('banco-ext-duracion').value.trim(),
                duracion: document.getElementById('banco-ext-duracion').value.trim(),
                frecuenciaRecomendada: document.getElementById('banco-ext-frecuencia').value.trim(),
                frecuencia: document.getElementById('banco-ext-frecuencia').value.trim(),
                parasitosCubre: document.getElementById('banco-ext-parasitos').value.trim(),
                parasitos: document.getElementById('banco-ext-parasitos').value.trim(),
                dosis: document.getElementById('banco-ext-frecuencia').value.trim(),
                via: 'Tópica/Oral',
                laboratorio: document.getElementById('banco-ext-laboratorio').value.trim(),
                lote: document.getElementById('banco-ext-lote').value.trim(),
                observaciones: document.getElementById('banco-ext-obs').value.trim(),
                advertencias: document.getElementById('banco-ext-advertencias').value.trim()
            };
            
            if (!datos.nombre) {
                mostrarToast('El nombre comercial es obligatorio.', 'error');
                return;
            }
            
            try {
                let res;
                if (id) {
                    res = await window.API.editarBancoExterno(id, datos);
                } else {
                    res = await window.API.guardarBancoExterno(datos);
                }
                
                if (res && (res.id || res.mensaje)) {
                    mostrarToast(id ? 'Producto actualizado en banco.' : 'Producto guardado en banco.', 'success');
                    cerrarModalBanco('externo');
                    cambiarPestañaBanco('externos');
                } else {
                    mostrarToast('Error al guardar el producto.', 'error');
                }
            } catch (err) {
                console.error(err);
                mostrarToast('Error de conexión', 'error');
            }
        });
    }
}

// ================= AUTOCOMPLETADO CLÍNICO EN PACIENTES =================

/**
 * Llena el selector de vacunas del banco en el modal del paciente.
 * @param {string} especiePaciente - 'Perro' | 'Gato'
 */
function cargarSelectVacunasBanco(especiePaciente) {
    const select = document.getElementById('vac-banco-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar para autocompletar --</option>';
    const vacunas = cacheVacunas;
    
    // Filtrar por especie recomendada ('Perro', 'Gato', o 'Ambos')
    const filtradas = vacunas.filter(v => bancoCompatibleConEspecie(v.especie, especiePaciente));
    
    filtradas.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.nombre} (${v.laboratorio || 'Sin Lab'}) - Lote: ${v.lote || 'N/A'}`;
        select.appendChild(opt);
    });
}

/**
 * Llena el selector de desparasitantes internos del banco.
 * @param {string} especiePaciente - 'Perro' | 'Gato'
 */
function cargarSelectInternosBanco(especiePaciente) {
    const select = document.getElementById('des-int-banco-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar para autocompletar --</option>';
    const productos = cacheInternos;
    
    const filtrados = productos.filter(p => bancoCompatibleConEspecie(p.especie, especiePaciente));
    
    filtrados.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre} (${p.principioActivo || 'N/A'}) - Vía: ${p.viaAdministracion || 'N/A'}`;
        select.appendChild(opt);
    });
}

/**
 * Llena el selector de desparasitantes externos del banco.
 * @param {string} especiePaciente - 'Perro' | 'Gato'
 */
function cargarSelectExternosBanco(especiePaciente) {
    const select = document.getElementById('des-ext-banco-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar para autocompletar --</option>';
    const productos = cacheExternos;
    
    const filtrados = productos.filter(p => bancoCompatibleConEspecie(p.especie, especiePaciente));
    
    filtrados.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre} (${p.tipo || 'Producto'}) - Peso: ${p.rangoPeso || 'Cualquiera'}`;
        select.appendChild(opt);
    });
}

/**
 * Autocompleta los campos del formulario de vacuna al seleccionar del banco.
 * @param {string} id - ID de la vacuna en el banco.
 */
function autocompletarVacunaDesdeBanco(id) {
    if (!id) return;
    const v = cacheVacunas.find(item => item.id === id);
    if (!v) return;
    
    document.getElementById('vac-nombre').value = v.nombre;
    document.getElementById('vac-enfermedades').value = v.enfermedades || '';
    document.getElementById('vac-laboratorio').value = v.laboratorio || '';
    document.getElementById('vac-lote').value = v.lote || '';
    document.getElementById('vac-obs').value = v.observaciones || '';
    
    mostrarToast(`Autocompletada vacuna: ${v.nombre}`, 'info');
}

/**
 * Autocompleta los campos de desparasitación interna.
 * @param {string} id - ID del producto.
 */
function autocompletarInternoDesdeBanco(id) {
    if (!id) return;
    const p = cacheInternos.find(item => item.id === id);
    if (!p) return;
    
    document.getElementById('des-int-producto').value = p.nombre;
    document.getElementById('des-int-dosis').value = p.dosisRecomendada || '';
    document.getElementById('des-int-via').value = p.viaAdministracion || 'Oral';
    
    let obs = '';
    if (p.parasitosCubre) obs += `Parásitos: ${p.parasitosCubre}. `;
    if (p.frecuenciaRecomendada) obs += `Frecuencia: ${p.frecuenciaRecomendada}. `;
    if (p.lote) obs += `Lote: ${p.lote}. `;
    if (p.observaciones) obs += p.observaciones;
    document.getElementById('des-int-obs').value = obs.trim();
    
    mostrarToast(`Autocompletado antiparasitario interno: ${p.nombre}`, 'info');
}

/**
 * Autocompleta los campos de control antiparasitario externo.
 * @param {string} id - ID del producto.
 */
function autocompletarExternoDesdeBanco(id) {
    if (!id) return;
    const p = cacheExternos.find(item => item.id === id);
    if (!p) return;
    
    document.getElementById('des-ext-producto').value = p.nombre;
    document.getElementById('des-ext-tipo').value = p.tipo || 'Tableta';
    document.getElementById('des-ext-peso').value = p.rangoPeso || '';
    document.getElementById('des-ext-parasitos').value = p.parasitosCubre || '';
    
    let obs = '';
    if (p.duracionProteccion) obs += `Duración: ${p.duracionProteccion}. `;
    if (p.frecuenciaRecomendada) obs += `Frecuencia: ${p.frecuenciaRecomendada}. `;
    if (p.lote) obs += `Lote: ${p.lote}. `;
    if (p.observaciones) obs += p.observaciones;
    if (p.advertencias) obs += ` Advertencias: ${p.advertencias}`;
    document.getElementById('des-ext-obs').value = obs.trim();
    
    mostrarToast(`Autocompletado antiparasitario externo: ${p.nombre}`, 'info');
}
