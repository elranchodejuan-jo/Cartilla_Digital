/**
 * CARTILLA DIGITAL - Importacion masiva CSV
 * Primera version funcional: CSV con vista previa y confirmacion explicita.
 */

const IMPORTACION_HEADERS = [
    'tutor_nombre',
    'tutor_telefono',
    'tutor_email',
    'tutor_direccion',
    'mascota_nombre',
    'especie',
    'raza',
    'sexo',
    'color',
    'fecha_nacimiento',
    'peso',
    'esterilizado',
    'observaciones',
    'vacuna_codigo',
    'vacuna_nombre',
    'vacuna_fecha',
    'vacuna_proxima_fecha',
    'vacuna_lote',
    'vacuna_responsable',
    'vacuna_observaciones',
    'desparasitante_interno_codigo',
    'desparasitante_interno_nombre',
    'desparasitante_interno_fecha',
    'desparasitante_interno_proxima_fecha',
    'desparasitante_interno_lote',
    'desparasitante_interno_responsable',
    'desparasitante_interno_observaciones',
    'desparasitante_externo_codigo',
    'desparasitante_externo_nombre',
    'desparasitante_externo_fecha',
    'desparasitante_externo_proxima_fecha',
    'desparasitante_externo_lote',
    'desparasitante_externo_responsable',
    'desparasitante_externo_observaciones',
    'control_preventivo_nombre',
    'control_preventivo_fecha',
    'control_preventivo_proxima_fecha',
    'control_preventivo_responsable',
    'control_preventivo_observaciones'
];

const ImportacionPacientesState = {
    archivo: null,
    filas: [],
    filasValidas: [],
    resumen: null
};

function normalizarHeaderImportacion(valor) {
    return (valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function escaparHtmlImportacion(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parsearCsvImportacion(texto) {
    const limpio = String(texto || '').replace(/^\uFEFF/, '');
    const primeraLinea = limpio.split(/\r?\n/).find(linea => linea.trim()) || '';
    const separador = (primeraLinea.match(/;/g) || []).length > (primeraLinea.match(/,/g) || []).length ? ';' : ',';
    const filas = [];
    let fila = [];
    let celda = '';
    let enComillas = false;

    for (let i = 0; i < limpio.length; i++) {
        const char = limpio[i];
        const siguiente = limpio[i + 1];

        if (char === '"') {
            if (enComillas && siguiente === '"') {
                celda += '"';
                i++;
            } else {
                enComillas = !enComillas;
            }
            continue;
        }

        if (char === separador && !enComillas) {
            fila.push(celda.trim());
            celda = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !enComillas) {
            if (char === '\r' && siguiente === '\n') i++;
            fila.push(celda.trim());
            if (fila.some(valor => valor !== '')) filas.push(fila);
            fila = [];
            celda = '';
            continue;
        }

        celda += char;
    }

    fila.push(celda.trim());
    if (fila.some(valor => valor !== '')) filas.push(fila);
    if (filas.length < 2) return [];

    const headers = filas[0].map(normalizarHeaderImportacion);
    return filas.slice(1).map((valores, index) => {
        const item = { numeroFila: index + 2 };
        headers.forEach((header, colIndex) => {
            if (header) item[header] = valores[colIndex] || '';
        });
        return item;
    });
}

function normalizarFechaImportacion(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    let match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const fecha = new Date(`${texto}T00:00:00`);
        if (Number.isNaN(fecha.getTime())) return null;
        if (fecha.getFullYear() !== Number(match[1]) || fecha.getMonth() + 1 !== Number(match[2]) || fecha.getDate() !== Number(match[3])) {
            return null;
        }
        return texto;
    }
    match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        const dia = match[1].padStart(2, '0');
        const mes = match[2].padStart(2, '0');
        const anio = match[3];
        const iso = `${anio}-${mes}-${dia}`;
        const fecha = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(fecha.getTime())) return null;
        if (fecha.getFullYear() !== Number(anio) || fecha.getMonth() + 1 !== Number(mes) || fecha.getDate() !== Number(dia)) {
            return null;
        }
        return iso;
    }
    return null;
}

function normalizarEspecieImportacion(valor) {
    const texto = String(valor || '').toLowerCase().trim();
    if (['c', 'canino', 'perro'].includes(texto)) return 'Canino';
    if (['f', 'felino', 'gato'].includes(texto)) return 'Felino';
    return '';
}

function normalizarSexoImportacion(valor) {
    const texto = String(valor || '').toLowerCase().trim();
    if (!texto) return '';
    if (['m', 'macho'].includes(texto)) return 'Macho';
    if (['h', 'hembra', 'f', 'female'].includes(texto)) return 'Hembra';
    return '';
}

function normalizarEsterilizadoImportacion(valor) {
    const texto = String(valor || '').toLowerCase().trim();
    if (!texto) return '';
    if (['s', 'si', 'sí', 'yes', 'true'].includes(texto)) return 'Si';
    if (['n', 'no', 'false'].includes(texto)) return 'No';
    return '';
}

function validarEmailImportacion(valor) {
    const email = String(valor || '').trim();
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function hayDatosPreventivos(fila, prefijo) {
    return Object.keys(fila).some(key => key.startsWith(prefijo) && String(fila[key] || '').trim());
}

function validarFilaImportacion(fila, clavesDuplicadas) {
    const errores = [];
    const advertencias = [];
    const especie = normalizarEspecieImportacion(fila.especie);
    const sexo = normalizarSexoImportacion(fila.sexo);
    const fechaNacimiento = normalizarFechaImportacion(fila.fecha_nacimiento);
    const esterilizado = normalizarEsterilizadoImportacion(fila.esterilizado);
    const peso = String(fila.peso || '').trim();

    if (!String(fila.tutor_nombre || '').trim()) errores.push('tutor_nombre es requerido.');
    if (!String(fila.mascota_nombre || '').trim()) errores.push('mascota_nombre es requerido.');
    if (!especie) errores.push('especie debe ser C, F, Canino o Felino.');
    if (fila.sexo && !sexo) errores.push('sexo debe ser M, H, Macho o Hembra.');
    if (!fechaNacimiento) errores.push('fecha_nacimiento es requerida por el esquema actual y debe ser dd/mm/aaaa o yyyy-mm-dd.');
    if (!validarEmailImportacion(fila.tutor_email)) errores.push('tutor_email no tiene formato valido.');
    if (peso && (Number.isNaN(Number(peso)) || Number(peso) < 0)) errores.push('peso debe ser numerico y positivo.');
    if (fila.esterilizado && !esterilizado) advertencias.push('esterilizado no reconocido; se omitira.');

    [
        'vacuna_fecha',
        'vacuna_proxima_fecha',
        'desparasitante_interno_fecha',
        'desparasitante_interno_proxima_fecha',
        'desparasitante_externo_fecha',
        'desparasitante_externo_proxima_fecha',
        'control_preventivo_fecha',
        'control_preventivo_proxima_fecha'
    ].forEach(campo => {
        if (fila[campo] && !normalizarFechaImportacion(fila[campo])) {
            errores.push(`${campo} tiene fecha invalida.`);
        }
    });

    if (hayDatosPreventivos(fila, 'vacuna_') && !(fila.vacuna_nombre || fila.vacuna_codigo)) errores.push('La vacuna necesita vacuna_nombre o vacuna_codigo.');
    if (hayDatosPreventivos(fila, 'vacuna_') && !fila.vacuna_fecha) errores.push('La vacuna necesita vacuna_fecha.');
    if (hayDatosPreventivos(fila, 'desparasitante_interno_') && !(fila.desparasitante_interno_nombre || fila.desparasitante_interno_codigo)) errores.push('El desparasitante interno necesita nombre o codigo.');
    if (hayDatosPreventivos(fila, 'desparasitante_interno_') && !fila.desparasitante_interno_fecha) errores.push('El desparasitante interno necesita fecha.');
    if (hayDatosPreventivos(fila, 'desparasitante_externo_') && !(fila.desparasitante_externo_nombre || fila.desparasitante_externo_codigo)) errores.push('El desparasitante externo necesita nombre o codigo.');
    if (hayDatosPreventivos(fila, 'desparasitante_externo_') && !fila.desparasitante_externo_fecha) errores.push('El desparasitante externo necesita fecha.');
    if (hayDatosPreventivos(fila, 'control_preventivo_') && !fila.control_preventivo_fecha) errores.push('El control preventivo necesita fecha.');

    const claveDuplicado = [
        String(fila.tutor_nombre || '').trim().toLowerCase(),
        String(fila.mascota_nombre || '').trim().toLowerCase(),
        especie.toLowerCase()
    ].join('|');
    if (clavesDuplicadas.has(claveDuplicado)) {
        advertencias.push('Posible duplicado dentro del archivo por tutor + mascota + especie.');
    }
    clavesDuplicadas.add(claveDuplicado);

    const observaciones = [
        String(fila.observaciones || '').trim(),
        esterilizado ? `Esterilizado: ${esterilizado}` : ''
    ].filter(Boolean).join('\n');

    return {
        numeroFila: fila.numeroFila,
        estado: errores.length ? 'error' : (advertencias.length ? 'advertencia' : 'valida'),
        errores,
        advertencias,
        datos: {
            tutor_nombre: String(fila.tutor_nombre || '').trim(),
            tutor_telefono: String(fila.tutor_telefono || '').trim(),
            tutor_email: String(fila.tutor_email || '').trim().toLowerCase(),
            tutor_direccion: String(fila.tutor_direccion || '').trim(),
            mascota_nombre: String(fila.mascota_nombre || '').trim(),
            especie,
            raza: String(fila.raza || '').trim(),
            sexo: sexo || 'Macho',
            color: String(fila.color || '').trim(),
            fecha_nacimiento: fechaNacimiento || '',
            peso: peso ? Number(peso) : '',
            esterilizado,
            observaciones,
            vacuna_codigo: String(fila.vacuna_codigo || '').trim(),
            vacuna_nombre: String(fila.vacuna_nombre || '').trim(),
            vacuna_fecha: normalizarFechaImportacion(fila.vacuna_fecha) || '',
            vacuna_proxima_fecha: normalizarFechaImportacion(fila.vacuna_proxima_fecha) || '',
            vacuna_lote: String(fila.vacuna_lote || '').trim(),
            vacuna_responsable: String(fila.vacuna_responsable || '').trim(),
            vacuna_observaciones: String(fila.vacuna_observaciones || '').trim(),
            desparasitante_interno_codigo: String(fila.desparasitante_interno_codigo || '').trim(),
            desparasitante_interno_nombre: String(fila.desparasitante_interno_nombre || '').trim(),
            desparasitante_interno_fecha: normalizarFechaImportacion(fila.desparasitante_interno_fecha) || '',
            desparasitante_interno_proxima_fecha: normalizarFechaImportacion(fila.desparasitante_interno_proxima_fecha) || '',
            desparasitante_interno_lote: String(fila.desparasitante_interno_lote || '').trim(),
            desparasitante_interno_responsable: String(fila.desparasitante_interno_responsable || '').trim(),
            desparasitante_interno_observaciones: String(fila.desparasitante_interno_observaciones || '').trim(),
            desparasitante_externo_codigo: String(fila.desparasitante_externo_codigo || '').trim(),
            desparasitante_externo_nombre: String(fila.desparasitante_externo_nombre || '').trim(),
            desparasitante_externo_fecha: normalizarFechaImportacion(fila.desparasitante_externo_fecha) || '',
            desparasitante_externo_proxima_fecha: normalizarFechaImportacion(fila.desparasitante_externo_proxima_fecha) || '',
            desparasitante_externo_lote: String(fila.desparasitante_externo_lote || '').trim(),
            desparasitante_externo_responsable: String(fila.desparasitante_externo_responsable || '').trim(),
            desparasitante_externo_observaciones: String(fila.desparasitante_externo_observaciones || '').trim(),
            control_preventivo_nombre: String(fila.control_preventivo_nombre || '').trim(),
            control_preventivo_fecha: normalizarFechaImportacion(fila.control_preventivo_fecha) || '',
            control_preventivo_proxima_fecha: normalizarFechaImportacion(fila.control_preventivo_proxima_fecha) || '',
            control_preventivo_responsable: String(fila.control_preventivo_responsable || '').trim(),
            control_preventivo_observaciones: String(fila.control_preventivo_observaciones || '').trim()
        }
    };
}

function construirResumenImportacion(filasValidadas) {
    const resumen = {
        total: filasValidadas.length,
        validas: filasValidadas.filter(f => f.estado !== 'error').length,
        errores: filasValidadas.filter(f => f.estado === 'error').length,
        advertencias: filasValidadas.filter(f => f.estado === 'advertencia').length,
        vacunas: 0,
        desparasitaciones: 0,
        controles: 0
    };

    filasValidadas.forEach(fila => {
        const d = fila.datos;
        if (d.vacuna_nombre || d.vacuna_codigo) resumen.vacunas++;
        if (d.desparasitante_interno_nombre || d.desparasitante_interno_codigo) resumen.desparasitaciones++;
        if (d.desparasitante_externo_nombre || d.desparasitante_externo_codigo) resumen.desparasitaciones++;
        if (d.control_preventivo_fecha || d.control_preventivo_nombre) resumen.controles++;
    });

    return resumen;
}

function renderizarResumenImportacion() {
    const summary = document.getElementById('import-summary');
    const preview = document.getElementById('import-preview');
    const btnConfirmar = document.getElementById('btn-confirmar-importacion');
    const btnCancelar = document.getElementById('btn-cancelar-importacion');
    if (!summary || !preview || !ImportacionPacientesState.resumen) return;

    const r = ImportacionPacientesState.resumen;
    summary.innerHTML = `
        <div class="import-summary-grid">
            <span><strong>${r.total}</strong> filas leidas</span>
            <span><strong>${r.validas}</strong> filas importables</span>
            <span><strong>${r.errores}</strong> con errores</span>
            <span><strong>${r.advertencias}</strong> con advertencias</span>
            <span><strong>${r.vacunas}</strong> vacunas detectadas</span>
            <span><strong>${r.desparasitaciones}</strong> desparasitaciones detectadas</span>
            <span><strong>${r.controles}</strong> controles detectados</span>
        </div>
    `;

    const filas = ImportacionPacientesState.filas.slice(0, 50).map(fila => {
        const mensajes = [...fila.errores, ...fila.advertencias].join(' ');
        return `
            <tr class="import-row-${fila.estado}">
                <td data-label="Fila">${fila.numeroFila}</td>
                <td data-label="Estado"><span class="status-badge ${fila.estado === 'error' ? 'danger' : fila.estado === 'advertencia' ? 'warning' : 'success'}">${fila.estado}</span></td>
                <td data-label="Tutor">${escaparHtmlImportacion(fila.datos.tutor_nombre)}</td>
                <td data-label="Mascota">${escaparHtmlImportacion(fila.datos.mascota_nombre)}</td>
                <td data-label="Especie">${escaparHtmlImportacion(fila.datos.especie)}</td>
                <td data-label="Mensajes">${escaparHtmlImportacion(mensajes || 'Lista para importar')}</td>
            </tr>
        `;
    }).join('');

    preview.innerHTML = `
        <div class="table-container">
            <table class="clinic-table import-preview-table">
                <thead>
                    <tr>
                        <th>Fila</th>
                        <th>Estado</th>
                        <th>Tutor</th>
                        <th>Mascota</th>
                        <th>Especie</th>
                        <th>Mensajes</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
    `;

    if (btnConfirmar) btnConfirmar.disabled = ImportacionPacientesState.filasValidas.length === 0;
    if (btnCancelar) btnCancelar.disabled = false;
}

function descargarPlantillaImportacion() {
    const ejemplo = [
        'Maria Perez',
        '+593999999999',
        'tutor.demo@example.com',
        'Av. Siempre Viva 123',
        'Luna',
        'C',
        'Mestizo',
        'H',
        'Caramelo',
        '15/03/2024',
        '8.5',
        'N',
        'Paciente ficticio de ejemplo',
        'v001',
        'Polivalente canina',
        '20/06/2026',
        '20/06/2027',
        'LT-001',
        'Dra. Demo',
        'Sin reacciones',
        'di001',
        'Pyrantel',
        '20/06/2026',
        '20/09/2026',
        'DI-001',
        'Dra. Demo',
        'Dosis segun peso',
        'de001',
        'Bravecto',
        '20/06/2026',
        '20/09/2026',
        'DE-001',
        'Dra. Demo',
        'Control externo',
        'Control preventivo general',
        '20/06/2026',
        '20/12/2026',
        'Dra. Demo',
        'Paciente estable'
    ];
    const csv = `${IMPORTACION_HEADERS.join(',')}\n${ejemplo.map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_importacion_cartilla_digital.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function validarArchivoImportacion() {
    const input = document.getElementById('import-file-input');
    if (!input || !input.files || input.files.length === 0) {
        mostrarToast('Selecciona un archivo CSV para validar.', 'error');
        return;
    }

    const archivo = input.files[0];
    if (!/\.csv$/i.test(archivo.name)) {
        mostrarToast('Esta version acepta archivos CSV. Exporta tu Excel como CSV.', 'error');
        return;
    }

    const texto = await archivo.text();
    const filasCrudas = parsearCsvImportacion(texto);
    if (filasCrudas.length === 0) {
        mostrarToast('El CSV no tiene filas de datos.', 'error');
        return;
    }

    const clavesDuplicadas = new Set();
    const filasValidadas = filasCrudas.map(fila => validarFilaImportacion(fila, clavesDuplicadas));
    ImportacionPacientesState.archivo = archivo;
    ImportacionPacientesState.filas = filasValidadas;
    ImportacionPacientesState.filasValidas = filasValidadas.filter(fila => fila.estado !== 'error');
    ImportacionPacientesState.resumen = construirResumenImportacion(filasValidadas);
    renderizarResumenImportacion();
    mostrarToast('Archivo validado. Revisa la vista previa antes de confirmar.', 'success');
}

async function confirmarImportacionPacientes() {
    if (ImportacionPacientesState.filasValidas.length === 0) {
        mostrarToast('No hay filas validas para importar.', 'error');
        return;
    }

    const btnConfirmar = document.getElementById('btn-confirmar-importacion');
    if (btnConfirmar) btnConfirmar.disabled = true;

    try {
        mostrarToast('Importando pacientes...', 'info');
        const resultado = await API.importarPacientes({
            filas: ImportacionPacientesState.filasValidas.map(fila => ({ ...fila.datos, numeroFila: fila.numeroFila }))
        });
        renderizarResultadoImportacion(resultado);
        if (typeof renderizarListadoPacientes === 'function') await renderizarListadoPacientes();
        mostrarToast('Importacion finalizada.', 'success');
    } catch (err) {
        mostrarToast(err.message || 'No se pudo completar la importacion.', 'error');
        if (btnConfirmar) btnConfirmar.disabled = false;
    }
}

function renderizarResultadoImportacion(resultado) {
    const summary = document.getElementById('import-summary');
    if (!summary) return;
    const r = resultado?.resumen || {};
    summary.innerHTML = `
        <div class="import-result">
            <h4>Resumen final</h4>
            <p><strong>${r.pacientesCreados || 0}</strong> pacientes creados, <strong>${r.registrosPreventivosCreados || 0}</strong> registros preventivos creados.</p>
            <p><strong>${r.filasOmitidas || 0}</strong> filas omitidas. ${r.errores ? `${r.errores} errores reportados.` : ''}</p>
        </div>
    `;
    const preview = document.getElementById('import-preview');
    if (preview && Array.isArray(resultado?.filas)) {
        preview.innerHTML = `
            <div class="table-container">
                <table class="clinic-table import-preview-table">
                    <thead><tr><th>Fila</th><th>Estado</th><th>Codigo</th><th>Mensaje</th></tr></thead>
                    <tbody>
                        ${resultado.filas.map(fila => `
                            <tr class="import-row-${fila.estado === 'creada' ? 'valida' : 'error'}">
                                <td data-label="Fila">${fila.numeroFila || '-'}</td>
                                <td data-label="Estado">${escaparHtmlImportacion(fila.estado || '')}</td>
                                <td data-label="Codigo">${escaparHtmlImportacion(fila.codigo || '')}</td>
                                <td data-label="Mensaje">${escaparHtmlImportacion(fila.mensaje || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function cancelarImportacionPacientes() {
    ImportacionPacientesState.archivo = null;
    ImportacionPacientesState.filas = [];
    ImportacionPacientesState.filasValidas = [];
    ImportacionPacientesState.resumen = null;
    const input = document.getElementById('import-file-input');
    const summary = document.getElementById('import-summary');
    const preview = document.getElementById('import-preview');
    const btnConfirmar = document.getElementById('btn-confirmar-importacion');
    const btnCancelar = document.getElementById('btn-cancelar-importacion');
    if (input) input.value = '';
    if (summary) summary.innerHTML = '';
    if (preview) preview.innerHTML = '';
    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
}

function inicializarImportacionPacientes() {
    const btnPlantilla = document.getElementById('btn-descargar-plantilla-importacion');
    const btnValidar = document.getElementById('btn-validar-importacion');
    const btnConfirmar = document.getElementById('btn-confirmar-importacion');
    const btnCancelar = document.getElementById('btn-cancelar-importacion');

    if (btnPlantilla) btnPlantilla.addEventListener('click', descargarPlantillaImportacion);
    if (btnValidar) btnValidar.addEventListener('click', validarArchivoImportacion);
    if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarImportacionPacientes);
    if (btnCancelar) btnCancelar.addEventListener('click', cancelarImportacionPacientes);
}

document.addEventListener('DOMContentLoaded', inicializarImportacionPacientes);

window.ImportacionPacientes = {
    parsearCsvImportacion,
    validarFilaImportacion,
    descargarPlantillaImportacion,
    validarArchivoImportacion,
    confirmarImportacionPacientes
};
