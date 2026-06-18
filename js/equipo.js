/**
 * CARTILLA DIGITAL - Módulo Equipo Veterinario (equipo.js)
 */

let equipoVeterinario = [];

const PREFIJOS_CARGO = {
    'Medico veterinario': 'MV.',
    'Médico veterinario': 'MV.',
    'Doctor': 'Dr.',
    'Doctora': 'Dra.',
    'Auxiliar veterinario': 'Aux.',
    'Ayudante': 'Ayud.',
    'Administrador': 'Admin.',
    'Recepcionista': 'Recep.',
    'Groomer': 'Groomer',
    'Pasante': 'Pas.',
    'Especialista': 'Esp.'
};

function limpiarPrefijoProfesional(nombre = '') {
    return String(nombre).replace(/^(MV\.|Dr\.|Dra\.|Aux\.|Ayud\.|Admin\.|Recep\.|Pas\.|Esp\.)\s+/i, '').trim();
}

function generarNombreProfesional(nombre = '', cargo = '') {
    const base = limpiarPrefijoProfesional(nombre);
    const prefijo = PREFIJOS_CARGO[cargo] || '';
    return prefijo ? `${prefijo} ${base}`.trim() : base;
}

async function cargarEquipoVeterinario() {
    equipoVeterinario = await obtenerEquipo();
    renderizarTablaEquipo();
}

function renderizarTablaEquipo() {
    const tbody = document.getElementById('equipo-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (equipoVeterinario.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay responsables registrados.</td></tr>`;
        return;
    }
    
    equipoVeterinario.forEach(miembro => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${miembro.nombre}</strong>${miembro.es_principal ? '<br><small>Principal</small>' : ''}</td>
            <td>${miembro.cargo}</td>
            <td>
                <span class="badge ${miembro.estado === 'activo' ? 'badge-success' : 'badge-danger'}">
                    ${miembro.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="abrirModalEquipo('${miembro.id}')">✏️ Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalEquipo(id = null) {
    const form = document.getElementById('form-equipo');
    form.reset();
    document.getElementById('eq-id').value = '';
    document.getElementById('eq-estado-group').style.display = 'none';
    document.getElementById('modal-equipo-title').textContent = 'Registrar Responsable';
    
    if (id) {
        const miembro = equipoVeterinario.find(m => m.id === id);
        if (miembro) {
            document.getElementById('eq-id').value = miembro.id;
            document.getElementById('eq-nombre').value = limpiarPrefijoProfesional(miembro.nombre);
            document.getElementById('eq-cargo').value = miembro.cargo;
            document.getElementById('eq-estado').value = miembro.estado;
            document.getElementById('eq-estado-group').style.display = 'block';
            document.getElementById('modal-equipo-title').textContent = 'Editar Responsable';
        }
    }
    actualizarPreviewProfesional();
    
    document.getElementById('modal-equipo').classList.add('active');
}

function cerrarModalEquipo() {
    document.getElementById('modal-equipo').classList.remove('active');
}

// Inicializar listener de formulario
document.addEventListener('DOMContentLoaded', () => {
    const formEquipo = document.getElementById('form-equipo');
    const nombreInput = document.getElementById('eq-nombre');
    const cargoInput = document.getElementById('eq-cargo');
    if (nombreInput) nombreInput.addEventListener('input', actualizarPreviewProfesional);
    if (cargoInput) cargoInput.addEventListener('change', actualizarPreviewProfesional);
    if (formEquipo) {
        formEquipo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('eq-id').value;
            const cargo = document.getElementById('eq-cargo').value;
            const nombreProfesional = generarNombreProfesional(document.getElementById('eq-nombre').value.trim(), cargo);
            const datos = {
                nombre: nombreProfesional,
                cargo,
                estado: id ? document.getElementById('eq-estado').value : 'activo'
            };
            
            try {
                if (id) {
                    await editarResponsableEquipo(id, datos);
                    mostrarToast('Responsable actualizado correctamente.', 'success');
                } else {
                    await guardarResponsableEquipo(datos);
                    mostrarToast('Responsable registrado correctamente.', 'success');
                }
                cerrarModalEquipo();
                await cargarEquipoVeterinario();
            } catch (error) {
                mostrarToast(error.message || 'Error al guardar responsable', 'error');
            }
        });
    }
});

// Función para poblar selects en los modales de historial médico
function actualizarPreviewProfesional() {
    const preview = document.getElementById('eq-profesional-preview');
    const nombre = document.getElementById('eq-nombre')?.value || 'Nombre Apellido';
    const cargo = document.getElementById('eq-cargo')?.value || 'Medico veterinario';
    if (preview) preview.textContent = generarNombreProfesional(nombre, cargo);
}

function poblarSelectResponsables(selectId, responsableActualId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Limpiar opciones
    select.innerHTML = '<option value="">Seleccione un responsable</option>';
    
    // Agregar responsables activos (o el inactivo si ya está asignado al registro)
    equipoVeterinario.forEach(miembro => {
        if (miembro.estado === 'activo' || miembro.id === responsableActualId) {
            const option = document.createElement('option');
            option.value = miembro.id;
            // Si es inactivo pero está asignado, mostrar "(Inactivo)" en el texto
            option.textContent = miembro.nombre + (miembro.estado !== 'activo' ? ' (Inactivo)' : '');
            if (miembro.id === responsableActualId) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    });
}
