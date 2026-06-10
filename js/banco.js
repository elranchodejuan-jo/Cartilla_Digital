/**
 * CARTILLA DIGITAL - Módulo de Banco Clínico (banco.js)
 * Controla la visualización del catálogo clínico (vacunas y desparasitantes),
 * su administración y el autocompletado en el historial de pacientes.
 */

let bancoPestañaActiva = 'vacunas';

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
    const tabs = ['vacunas', 'internos', 'externos'];
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
    
    const vacunas = obtenerVacunasBanco();
    if (vacunas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay vacunas registradas en el banco.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = vacunas.map(v => {
        return `
            <tr>
                <td data-label="Nombre Comercial"><strong>${v.nombre}</strong></td>
                <td data-label="Tipo"><span class="status-badge info">${v.tipo}</span></td>
                <td data-label="Especie"><span class="patient-badge ${v.especie.toLowerCase() === 'perro' ? 'perro' : v.especie.toLowerCase() === 'gato' ? 'gato' : ''}">${v.especie}</span></td>
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
}

/**
 * Renderiza el listado del Banco de Antiparasitarios Internos.
 */
function renderizarBancoInternos() {
    const tbody = document.getElementById('banco-internos-table-body');
    if (!tbody) return;
    
    const productos = obtenerAntiparasitariosInternosBanco();
    if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay antiparasitarios internos en el banco.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = productos.map(p => {
        return `
            <tr>
                <td data-label="Nombre"><strong>${p.nombre}</strong></td>
                <td data-label="Principio Activo"><span style="font-size:12px; color:var(--text-muted);">${p.principioActivo || 'N/A'}</span></td>
                <td data-label="Especie"><span class="patient-badge ${p.especie.toLowerCase() === 'perro' ? 'perro' : p.especie.toLowerCase() === 'gato' ? 'gato' : ''}">${p.especie}</span></td>
                <td data-label="Presentación"><span class="status-badge info" style="text-transform: capitalize;">${p.presentacion}</span></td>
                <td data-label="Dosis">${p.dosisRecomendada || 'N/A'}</td>
                <td data-label="Vía">${p.viaAdministracion}</td>
                <td data-label="Frecuencia">${p.frecuenciaRecomendada || 'N/A'}</td>
                <td data-label="Acciones">
                    <div style="display:flex; gap:6px; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-icon-only" onclick="abrirModalBanco('interno', '${p.id}')" title="Editar">✏️</button>
                        <button class="btn btn-danger btn-icon-only" onclick="eliminarDeBanco('interno', '${p.id}', '${p.nombre}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Renderiza el listado del Banco de Antiparasitarios Externos.
 */
function renderizarBancoExternos() {
    const tbody = document.getElementById('banco-externos-table-body');
    if (!tbody) return;
    
    const productos = obtenerAntiparasitariosExternosBanco();
    if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay antiparasitarios externos en el banco.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = productos.map(p => {
        return `
            <tr>
                <td data-label="Nombre"><strong>${p.nombre}</strong></td>
                <td data-label="Principio Activo"><span style="font-size:12px; color:var(--text-muted);">${p.principioActivo || 'N/A'}</span></td>
                <td data-label="Especie"><span class="patient-badge ${p.especie.toLowerCase() === 'perro' ? 'perro' : p.especie.toLowerCase() === 'gato' ? 'gato' : ''}">${p.especie}</span></td>
                <td data-label="Tipo"><span class="status-badge warning">${p.tipo}</span></td>
                <td data-label="Rango Peso">${p.rangoPeso || 'N/A'}</td>
                <td data-label="Duración">${p.duracionProteccion || 'N/A'}</td>
                <td data-label="Acciones">
                    <div style="display:flex; gap:6px; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-icon-only" onclick="abrirModalBanco('externo', '${p.id}')" title="Editar">✏️</button>
                        <button class="btn btn-danger btn-icon-only" onclick="eliminarDeBanco('externo', '${p.id}', '${p.nombre}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
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
            const v = obtenerVacunasBanco().find(item => item.id === id);
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
            const p = obtenerAntiparasitariosInternosBanco().find(item => item.id === id);
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
            const p = obtenerAntiparasitariosExternosBanco().find(item => item.id === id);
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
function eliminarDeBanco(tipo, id, nombre) {
    if (confirm(`¿Está seguro de eliminar "${nombre}" del Banco Clínico? Ya no estará disponible para autocompletar nuevos registros.`)) {
        let exito = false;
        if (tipo === 'vacuna') exito = eliminarVacunaBanco(id);
        else if (tipo === 'interno') exito = eliminarAntiparasitarioInternoBanco(id);
        else if (tipo === 'externo') exito = eliminarAntiparasitarioExternoBanco(id);
        
        if (exito) {
            mostrarToast('Producto eliminado del banco clínico.', 'success');
            cambiarPestañaBanco(bancoPestañaActiva);
        } else {
            mostrarToast('Error al eliminar del banco.', 'error');
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
        fVac.addEventListener('submit', (e) => {
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
            
            let exito = false;
            if (id) {
                exito = actualizarVacunaBanco(id, datos);
            } else {
                exito = guardarVacunaBanco(datos);
            }
            
            if (exito) {
                mostrarToast(id ? 'Vacuna actualizada en banco.' : 'Vacuna guardada en banco.', 'success');
                cerrarModalBanco('vacuna');
                cambiarPestañaBanco('vacunas');
            } else {
                mostrarToast('Error al guardar vacuna.', 'error');
            }
        });
    }

    // Antiparasitario Interno Form
    const fInt = document.getElementById('form-banco-interno');
    if (fInt) {
        fInt.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('banco-int-id').value;
            const datos = {
                nombre: document.getElementById('banco-int-nombre').value.trim(),
                principioActivo: document.getElementById('banco-int-principio').value.trim(),
                especie: document.getElementById('banco-int-especie').value,
                presentacion: document.getElementById('banco-int-presentacion').value,
                dosisRecomendada: document.getElementById('banco-int-dosis').value.trim(),
                rangoPeso: document.getElementById('banco-int-peso').value.trim(),
                viaAdministracion: document.getElementById('banco-int-via').value.trim(),
                frecuenciaRecomendada: document.getElementById('banco-int-frecuencia').value.trim(),
                parasitosCubre: document.getElementById('banco-int-parasitos').value.trim(),
                laboratorio: document.getElementById('banco-int-laboratorio').value.trim(),
                lote: document.getElementById('banco-int-lote').value.trim(),
                observaciones: document.getElementById('banco-int-obs').value.trim()
            };
            
            if (!datos.nombre) {
                mostrarToast('El nombre comercial es obligatorio.', 'error');
                return;
            }
            
            let exito = false;
            if (id) {
                exito = actualizarAntiparasitarioInternoBanco(id, datos);
            } else {
                exito = guardarAntiparasitarioInternoBanco(datos);
            }
            
            if (exito) {
                mostrarToast(id ? 'Producto actualizado en banco.' : 'Producto guardado en banco.', 'success');
                cerrarModalBanco('interno');
                cambiarPestañaBanco('internos');
            } else {
                mostrarToast('Error al guardar el producto.', 'error');
            }
        });
    }

    // Antiparasitario Externo Form
    const fExt = document.getElementById('form-banco-externo');
    if (fExt) {
        fExt.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('banco-ext-id').value;
            const datos = {
                nombre: document.getElementById('banco-ext-nombre').value.trim(),
                principioActivo: document.getElementById('banco-ext-principio').value.trim(),
                especie: document.getElementById('banco-ext-especie').value,
                tipo: document.getElementById('banco-ext-tipo').value,
                rangoPeso: document.getElementById('banco-ext-peso').value.trim(),
                duracionProteccion: document.getElementById('banco-ext-duracion').value.trim(),
                frecuenciaRecomendada: document.getElementById('banco-ext-frecuencia').value.trim(),
                parasitosCubre: document.getElementById('banco-ext-parasitos').value.trim(),
                laboratorio: document.getElementById('banco-ext-laboratorio').value.trim(),
                lote: document.getElementById('banco-ext-lote').value.trim(),
                observaciones: document.getElementById('banco-ext-obs').value.trim(),
                advertencias: document.getElementById('banco-ext-advertencias').value.trim()
            };
            
            if (!datos.nombre) {
                mostrarToast('El nombre comercial es obligatorio.', 'error');
                return;
            }
            
            let exito = false;
            if (id) {
                exito = actualizarAntiparasitarioExternoBanco(id, datos);
            } else {
                exito = guardarAntiparasitarioExternoBanco(datos);
            }
            
            if (exito) {
                mostrarToast(id ? 'Producto actualizado en banco.' : 'Producto guardado en banco.', 'success');
                cerrarModalBanco('externo');
                cambiarPestañaBanco('externos');
            } else {
                mostrarToast('Error al guardar el producto.', 'error');
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
    const vacunas = obtenerVacunasBanco();
    
    // Filtrar por especie recomendada ('Perro', 'Gato', o 'Ambos')
    const filtradas = vacunas.filter(v => {
        return v.especie === 'Ambos' || v.especie.toLowerCase() === especiePaciente.toLowerCase();
    });
    
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
    const productos = obtenerAntiparasitariosInternosBanco();
    
    const filtrados = productos.filter(p => {
        return p.especie === 'Ambos' || p.especie.toLowerCase() === especiePaciente.toLowerCase();
    });
    
    filtrados.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre} (${p.principioActivo || 'N/A'}) - Vía: ${p.viaAdministracion}`;
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
    const productos = obtenerAntiparasitariosExternosBanco();
    
    const filtrados = productos.filter(p => {
        return p.especie === 'Ambos' || p.especie.toLowerCase() === especiePaciente.toLowerCase();
    });
    
    filtrados.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre} (${p.tipo}) - Peso: ${p.rangoPeso || 'Cualquiera'}`;
        select.appendChild(opt);
    });
}

/**
 * Autocompleta los campos del formulario de vacuna al seleccionar del banco.
 * @param {string} id - ID de la vacuna en el banco.
 */
function autocompletarVacunaDesdeBanco(id) {
    if (!id) return;
    const v = obtenerVacunasBanco().find(item => item.id === id);
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
    const p = obtenerAntiparasitariosInternosBanco().find(item => item.id === id);
    if (!p) return;
    
    document.getElementById('des-int-producto').value = p.nombre;
    document.getElementById('des-int-dosis').value = p.dosisRecomendada || '';
    document.getElementById('des-int-via').value = p.viaAdministracion || 'Oral';
    
    let obs = '';
    if (p.principioActivo) obs += `Principio activo: ${p.principioActivo}. `;
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
    const p = obtenerAntiparasitariosExternosBanco().find(item => item.id === id);
    if (!p) return;
    
    document.getElementById('des-ext-producto').value = p.nombre;
    document.getElementById('des-ext-tipo').value = p.tipo || 'Tableta';
    document.getElementById('des-ext-peso').value = p.rangoPeso || '';
    document.getElementById('des-ext-parasitos').value = p.parasitosCubre || '';
    
    let obs = '';
    if (p.principioActivo) obs += `Principio activo: ${p.principioActivo}. `;
    if (p.duracionProteccion) obs += `Protección: ${p.duracionProteccion}. `;
    if (p.lote) obs += `Lote: ${p.lote}. `;
    if (p.observaciones) obs += p.observaciones;
    document.getElementById('des-ext-obs').value = obs.trim();
    
    mostrarToast(`Autocompletado antiparasitario externo: ${p.nombre}`, 'info');
}
