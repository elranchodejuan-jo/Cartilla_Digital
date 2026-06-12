/**
 * CARTILLA DIGITAL - Módulo de Interfaz (ui.js)
 * Controla la manipulación del DOM, el renderizado de datos, el flujo público y los modales clínicos.
 */

// Cargar tema desde LocalStorage de inmediato para evitar destellos
(function() {
    const temaGuardado = localStorage.getItem('cartilla_digital_theme');
    if (temaGuardado === 'dark') {
        document.body.classList.add('dark-theme');
    }
})();

// Estado global de la interfaz
const UIState = {
    seccionActiva: 'inicio',
    mascotaActivaId: null,
    mascotaEdicionId: null,
    filtroEspecie: 'todos',
    busquedaQuery: '',
    logoBase64: '',
    fotoMascotaBase64: '',
    modoPublico: false // Si es true, oculta navegación y formularios
};

// Referencias del DOM
const DOM = {
    secciones: {
        login: document.getElementById('section-login'),
        registroClinica: document.getElementById('section-registro-clinica'),
        forgotPassword: document.getElementById('section-forgot-password'),
        resetPassword: document.getElementById('section-reset-password'),
        inicio: document.getElementById('section-inicio'),
        configuracion: document.getElementById('section-configuracion'),
        registrarMascota: document.getElementById('section-registrar-mascota'),
        pacientes: document.getElementById('section-pacientes'),
        cartilla: document.getElementById('section-cartilla'),
        banco: document.getElementById('section-banco'),
        equipo: document.getElementById('section-equipo')
    },
    navButtons: document.querySelectorAll('.nav-btn'),
    stats: {
        total: document.getElementById('stat-total'),
        perros: document.getElementById('stat-perros'),
        gatos: document.getElementById('stat-gatos'),
        vacunas: document.getElementById('stat-vacunas'),
        desparasitaciones: document.getElementById('stat-desparasitaciones')
    },
    proximosEventosContainer: document.getElementById('dashboard-proximos-eventos'),
    formVeterinaria: document.getElementById('form-veterinaria'),
    formMascota: document.getElementById('form-mascota'),
    formVacuna: document.getElementById('form-vacuna'),
    formDesparasitacionInterna: document.getElementById('form-desparasitacion-interna'),
    formControlExterno: document.getElementById('form-control-externo'),
    formControl: document.getElementById('form-control'),
    formObservaciones: document.getElementById('form-observaciones'),
    pacientesGrid: document.getElementById('patients-grid'),
    searchBar: document.getElementById('search-bar'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    modales: {
        vacuna: document.getElementById('modal-vacuna'),
        'desparasitacion-interna': document.getElementById('modal-desparasitacion-interna'),
        'control-externo': document.getElementById('modal-control-externo'),
        control: document.getElementById('modal-control'),
        observaciones: document.getElementById('modal-observaciones'),
        'transferencia-recibir': document.getElementById('modal-transferencia-recibir'),
        'transferencia-iniciar': document.getElementById('modal-transferencia-iniciar')
    },
    toastContainer: document.getElementById('toast-container'),
    brandLogo: document.getElementById('brand-logo')
};

/**
 * Inicializa los controladores de la interfaz y configura los filtros.
 */
function inicializarUI() {
    // Eventos de navegación SPA
    DOM.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (UIState.modoPublico) return;
            const seccion = btn.dataset.section;
            navegarA(seccion);
        });
    });
    
    if (DOM.brandLogo) {
        DOM.brandLogo.addEventListener('click', () => {
            if (!UIState.modoPublico) navegarA('inicio');
        });
    }
    
    // Buscador interactivo
    if (DOM.searchBar) {
        DOM.searchBar.addEventListener('input', (e) => {
            UIState.busquedaQuery = e.target.value;
            renderizarListadoPacientes();
        });
    }
    
    // Filtros por especie
    DOM.filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            UIState.filtroEspecie = btn.dataset.specie;
            renderizarListadoPacientes();
        });
    });
    
    // Configurar Modo Oscuro / Claro
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        const esOscuro = document.body.classList.contains('dark-theme');
        themeToggleBtn.textContent = esOscuro ? '☀️' : '🌙';
        themeToggleBtn.title = esOscuro ? 'Activar Modo Claro' : 'Activar Modo Oscuro';
        
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const nuevoEsOscuro = document.body.classList.contains('dark-theme');
            themeToggleBtn.textContent = nuevoEsOscuro ? '☀️' : '🌙';
            themeToggleBtn.title = nuevoEsOscuro ? 'Activar Modo Claro' : 'Activar Modo Oscuro';
            localStorage.setItem('cartilla_digital_theme', nuevoEsOscuro ? 'dark' : 'light');
            mostrarToast(nuevoEsOscuro ? 'Modo Oscuro activado' : 'Modo Claro activado', 'info');
        });
    }
    
    // Subida y codificación de imágenes a Base64
    configurarSubidaArchivos();
}

/**
 * Activa o desactiva el Modo Vista Pública.
 * @param {boolean} activar - True para activar la restricción
 */
function configurarModoPublico(activar) {
    UIState.modoPublico = activar;
    if (activar) {
        document.body.classList.add('public-view');
    } else {
        document.body.classList.remove('public-view');
    }
}

/**
 * Navega a una sección ocultando las demás.
 * @param {string} seccionId - ID de la sección destino
 */
async function navegarA(seccionId) {
    // Si está en modo público, bloquear navegación
    if (UIState.modoPublico && seccionId !== 'cartilla') {
        return;
    }
    
    const vet = obtenerVeterinaria();
    if (!API.isLoggedIn() && seccionId !== 'login' && seccionId !== 'registroClinica' && seccionId !== 'forgotPassword' && seccionId !== 'resetPassword' && !UIState.modoPublico) {
        seccionId = 'login';
    } else if (API.isLoggedIn() && !vet && seccionId !== 'configuracion' && !UIState.modoPublico) {
        mostrarToast('Debe configurar la clínica veterinaria antes de continuar.', 'info');
        seccionId = 'configuracion';
    }
    
    UIState.seccionActiva = seccionId;
    
    // Mostrar/ocultar secciones
    Object.keys(DOM.secciones).forEach(key => {
        if (DOM.secciones[key]) {
            if (key === seccionId) {
                DOM.secciones[key].classList.add('active');
            } else {
                DOM.secciones[key].classList.remove('active');
            }
        }
    });
    
    // Actualizar botones de navegación
    DOM.navButtons.forEach(btn => {
        if (btn.dataset.section === seccionId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Ejecutar lógica por sección
    if (seccionId === 'inicio') {
        await renderizarDashboard();
    } else if (seccionId === 'pacientes') {
        await renderizarListadoPacientes();
    } else if (seccionId === 'configuracion') {
        cargarDatosFormVeterinaria();
    } else if (seccionId === 'registrarMascota') {
        prepararFormularioMascota();
    } else if (seccionId === 'banco') {
        cambiarPestañaBanco(bancoPestañaActiva);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Carga los inputs file y los convierte a Base64.
 */
function configurarSubidaArchivos() {
    const logoInput = document.getElementById('vet-logo-file');
    const logoPreview = document.getElementById('vet-logo-preview');
    
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                procesarComprimirYSubirImagen(file, 600, 600, 'logos', (urlOrBase64) => {
                    UIState.logoBase64 = urlOrBase64;
                    if (logoPreview) {
                        logoPreview.src = urlOrBase64;
                        logoPreview.style.display = 'block';
                    }
                });
            }
        });
    }
    
    const petGallery = document.getElementById('pet-photo-gallery');
    const petCamera = document.getElementById('pet-photo-camera');
    const petPreview = document.getElementById('pet-photo-preview');
    const petPlaceholder = document.getElementById('pet-photo-placeholder');
    
    function manejarSubidaFoto(file) {
        if (file) {
            procesarComprimirYSubirImagen(file, 400, 400, 'mascotas', (urlOrBase64) => {
                UIState.fotoMascotaBase64 = urlOrBase64;
                if (petPreview) {
                    petPreview.src = urlOrBase64;
                    petPreview.style.display = 'block';
                }
                if (petPlaceholder) {
                    petPlaceholder.style.display = 'none';
                }
            });
        }
    }
    
    if (petGallery) {
        petGallery.addEventListener('change', (e) => {
            manejarSubidaFoto(e.target.files[0]);
        });
    }
    if (petCamera) {
        petCamera.addEventListener('change', (e) => {
            manejarSubidaFoto(e.target.files[0]);
        });
    }
    
    const cartillaPhotoInput = document.getElementById('cartilla-pet-photo-input');
    if (cartillaPhotoInput) {
        cartillaPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && UIState.mascotaActivaId) {
                procesarComprimirYSubirImagen(file, 400, 400, 'mascotas', async (urlOrBase64) => {
                    const exito = await actualizarMascota(UIState.mascotaActivaId, { foto: urlOrBase64 });
                    if (exito) {
                        mostrarToast('Foto del paciente actualizada correctamente.', 'success');
                        await verCartillaMascota(UIState.mascotaActivaId);
                    } else {
                        mostrarToast('No se pudo actualizar la foto.', 'error');
                    }
                });
            }
        });
    }
}

/**
 * Carga datos de veterinaria en su formulario.
 */
function cargarDatosFormVeterinaria() {
    const vet = obtenerVeterinaria();
    if (vet) {
        document.getElementById('vet-nombre').value = vet.nombre || '';
        document.getElementById('vet-iniciales').value = vet.iniciales || '';
        document.getElementById('vet-telefono').value = vet.telefono || '';
        document.getElementById('vet-direccion').value = vet.direccion || '';
        
        UIState.logoBase64 = vet.logo || '';
        const preview = document.getElementById('vet-logo-preview');
        if (preview && vet.logo) {
            preview.src = vet.logo;
            preview.style.display = 'block';
        }
    }
}

/**
 * Resetea y prepara el formulario de mascotas.
 */
function prepararFormularioMascota() {
    DOM.formMascota.reset();
    UIState.mascotaEdicionId = null;
    UIState.fotoMascotaBase64 = '';
    
    const preview = document.getElementById('pet-photo-preview');
    const placeholder = document.getElementById('pet-photo-placeholder');
    if (preview) {
        preview.style.display = 'none';
        preview.src = '';
    }
    if (placeholder) {
        placeholder.style.display = 'block';
    }
    
    // Inicializar datalist de razas
    const especieSelect = document.getElementById('pet-especie');
    const datalistRazas = document.getElementById('datalist-razas');
    if (especieSelect && datalistRazas) {
        actualizarDatalistRazas(especieSelect.value, datalistRazas);
        
        if (!especieSelect.dataset.hasChangeListener) {
            especieSelect.addEventListener('change', (e) => {
                actualizarDatalistRazas(e.target.value, datalistRazas);
            });
            especieSelect.dataset.hasChangeListener = 'true';
        }
    }
    
    const title = DOM.secciones.registrarMascota.querySelector('.form-title');
    if (title) title.textContent = "Registrar Nueva Mascota";
}

/**
 * Muestra alertas Toast dinámicas con barra de progreso de cierre.
 */
function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    let icono = '✓';
    if (tipo === 'error') icono = '✗';
    if (tipo === 'info') icono = 'ℹ';
    
    toast.innerHTML = `
        <span><strong>${icono}</strong> ${mensaje}</span>
        <button class="toast-close-btn" aria-label="Cerrar">&times;</button>
    `;
    
    const closeBtn = toast.querySelector('.toast-close-btn');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });
    
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    
    const timer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
    
    toast.dataset.timerId = timer;
}

/**
 * Modales
 */
async function abrirModal(modalId) {
    const modal = DOM.modales[modalId];
    if (modal) {
        // Restablecer títulos y botones a modo "Registrar"
        const title = modal.querySelector('.modal-title');
        const submitBtn = modal.querySelector('form button[type="submit"]');
        const idInput = modal.querySelector('input[type="hidden"]');
        
        if (idInput) idInput.value = '';
        
        if (modalId === 'vacuna') {
            if (title) title.textContent = 'Registrar Vacuna';
            if (submitBtn) submitBtn.textContent = 'Registrar Vacuna';
        } else if (modalId === 'desparasitacion-interna') {
            if (title) title.textContent = 'Registrar Desparasitación Interna';
            if (submitBtn) submitBtn.textContent = 'Registrar';
        } else if (modalId === 'control-externo') {
            if (title) title.textContent = 'Registrar Control Antiparasitario Externo';
            if (submitBtn) submitBtn.textContent = 'Registrar';
        } else if (modalId === 'control') {
            if (title) title.textContent = 'Registrar Control Preventivo';
            if (submitBtn) submitBtn.textContent = 'Registrar';
        }

        modal.classList.add('active');
        
        const dateInputs = modal.querySelectorAll('input[type="date"]');
        dateInputs.forEach(dateInput => {
            if (!dateInput.value) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
        });
        
        if (UIState.mascotaActivaId) {
            const mascotas = await obtenerMascotas();
            const mascota = mascotas.find(m => m.id === UIState.mascotaActivaId);
            if (mascota) {
                const especie = mascota.especie;
                if (modalId === 'vacuna') {
                    cargarSelectVacunasBanco(especie);
                    poblarSelectResponsables('vac-responsable');
                } else if (modalId === 'desparasitacion-interna') {
                    cargarSelectInternosBanco(especie);
                    poblarSelectResponsables('des-int-responsable');
                } else if (modalId === 'control-externo') {
                    cargarSelectExternosBanco(especie);
                    poblarSelectResponsables('des-ext-responsable');
                } else if (modalId === 'control') {
                    poblarSelectResponsables('ctrl-responsable');
                }
            }
        }
    }
}

function cerrarModal(modalId) {
    const modal = DOM.modales[modalId];
    if (modal) {
        modal.classList.remove('active');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

/**
 * Renderiza el dashboard
 */
async function renderizarDashboard() {
    const mascotas = await obtenerMascotas();
    const total = mascotas.length;
    const perros = mascotas.filter(m => m.especie.toLowerCase() === 'perro').length;
    const gatos = mascotas.filter(m => m.especie.toLowerCase() === 'gato').length;
    
    let vacunasProximas = 0;
    let desparasitacionesProximas = 0;
    const eventos = [];
    
    mascotas.forEach(mascota => {
        (mascota.vacunas || []).forEach(v => {
            if (v.proximaDosis) {
                const ev = evaluarEstadoVacuna(v.proximaDosis);
                if (ev.status === 'warning' || ev.status === 'danger') {
                    vacunasProximas++;
                    eventos.push({
                        tipo: 'Vacuna',
                        tipoClase: 'vaccines',
                        nombre: v.nombre,
                        mascota: mascota.nombre,
                        mascotaId: mascota.id,
                        fecha: v.proximaDosis,
                        diasRestantes: ev.daysLeft,
                        alerta: ev.status
                    });
                }
            }
        });
        
        (mascota.desparasitaciones || []).forEach(d => {
            if (d.proximaAplicacion) {
                const ed = evaluarEstadoDesparasitacion(d.proximaAplicacion);
                if (ed.status === 'warning' || ed.status === 'danger') {
                    desparasitacionesProximas++;
                    eventos.push({
                        tipo: 'Desparasitación',
                        tipoClase: 'deworm',
                        nombre: d.producto,
                        mascota: mascota.nombre,
                        mascotaId: mascota.id,
                        fecha: d.proximaAplicacion,
                        diasRestantes: ed.daysLeft,
                        alerta: ed.status
                    });
                }
            }
        });
    });
    
    DOM.stats.total.textContent = total;
    DOM.stats.perros.textContent = perros;
    DOM.stats.gatos.textContent = gatos;
    DOM.stats.vacunas.textContent = vacunasProximas;
    DOM.stats.desparasitaciones.textContent = desparasitacionesProximas;
    
    eventos.sort((a, b) => a.diasRestantes - b.diasRestantes);
    
    if (eventos.length === 0) {
        DOM.proximosEventosContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <p>No hay alertas próximas. Todos los pacientes están al día.</p>
            </div>
        `;
    } else {
        const rows = eventos.slice(0, 6).map(e => {
            const badge = e.diasRestantes < 0
                ? `<span class="status-badge danger">Vencida (${Math.abs(e.diasRestantes)} d)</span>`
                : e.diasRestantes === 0
                    ? `<span class="status-badge warning">Hoy</span>`
                    : `<span class="status-badge warning">En ${e.diasRestantes} días</span>`;
                    
            return `
                <tr style="cursor: pointer;" onclick="verCartillaMascota('${e.mascotaId}')">
                    <td><span class="patient-badge ${e.tipoClase === 'vaccines' ? 'perro' : 'gato'}">${e.tipo}</span></td>
                    <td><strong>${e.nombre}</strong></td>
                    <td>${e.mascota}</td>
                    <td>${formatearFechaLocal(e.fecha)}</td>
                    <td>${badge}</td>
                </tr>
            `;
        }).join('');
        
        DOM.proximosEventosContainer.innerHTML = `
            <div class="table-container">
                <table class="clinic-table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Tratamiento</th>
                            <th>Mascota</th>
                            <th>Fecha Límite</th>
                            <th>Estado / Plazo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
}

/**
 * Renderiza listado de pacientes con filtros y búsquedas
 */
async function renderizarListadoPacientes() {
    let mascotas = await obtenerMascotas();
    const query = UIState.busquedaQuery.toLowerCase().trim();
    const filtro = UIState.filtroEspecie.toLowerCase();
    
    if (filtro !== 'todos') {
        mascotas = mascotas.filter(m => m.especie.toLowerCase() === filtro);
    }
    
    if (query) {
        mascotas = mascotas.filter(m => {
            return m.nombre.toLowerCase().includes(query) ||
                   m.tutor.nombre.toLowerCase().includes(query) ||
                   m.codigo.toLowerCase().includes(query) ||
                   m.raza.toLowerCase().includes(query);
        });
    }
    
    if (mascotas.length === 0) {
        DOM.pacientesGrid.innerHTML = `
            <div style="grid-column: 1 / -1;">
                <div class="empty-state">
                    <div class="empty-state-icon">🐾</div>
                    <p>No se encontraron mascotas que coincidan con la búsqueda.</p>
                </div>
            </div>
        `;
    } else {
        DOM.pacientesGrid.innerHTML = mascotas.map(mascota => {
            const edad = calcularEdadMascota(mascota.fechaNacimiento);
            const avatar = obtenerFotoMascota(mascota);
            const especieClase = mascota.especie.toLowerCase() === 'perro' ? 'perro' : 'gato';
            const ind = obtenerIndicadoresPreventivos(mascota);
            
            let htmlAlertas = '';
            if (ind.vacunasVencidas > 0) {
                htmlAlertas += `<span class="status-badge danger">💉 Vacunas Vencidas (${ind.vacunasVencidas})</span>`;
            } else if (ind.vacunasProximas > 0) {
                htmlAlertas += `<span class="status-badge warning">💉 Vacunas Próximas (${ind.vacunasProximas})</span>`;
            } else if (ind.vacunasAlDia > 0 || (mascota.vacunas && mascota.vacunas.length > 0)) {
                htmlAlertas += `<span class="status-badge success">💉 Vacunas al Día</span>`;
            } else {
                htmlAlertas += `<span class="status-badge secondary">💉 Sin Vacunas</span>`;
            }
            
            if (ind.desparasitacionVencida > 0) {
                htmlAlertas += `<span class="status-badge danger" style="margin-left:4px;">🐛 Parasitario Vencido</span>`;
            } else if (ind.desparasitacionProxima > 0) {
                htmlAlertas += `<span class="status-badge warning" style="margin-left:4px;">🐛 Parasitario Próximo</span>`;
            } else if (mascota.desparasitaciones && mascota.desparasitaciones.length > 0) {
                htmlAlertas += `<span class="status-badge success" style="margin-left:4px;">🐛 Parasitario al Día</span>`;
            } else {
                htmlAlertas += `<span class="status-badge secondary" style="margin-left:4px;">🐛 Sin Antiparasitario</span>`;
            }
            
            return `
                <div class="patient-card">
                    <div class="patient-card-header">
                        <img src="${avatar}" class="patient-avatar" alt="${mascota.nombre}">
                        <div class="patient-header-info">
                            <h3 class="patient-name">${mascota.nombre}</h3>
                            <span class="patient-badge ${especieClase}">${mascota.especie}</span>
                        </div>
                    </div>
                    <div class="patient-card-body">
                        <div class="patient-meta-row">
                            <span class="patient-meta-label">Código:</span>
                            <span class="patient-code-val">${mascota.codigo}</span>
                        </div>
                        <div class="patient-meta-row">
                            <span class="patient-meta-label">Raza:</span>
                            <span class="patient-meta-val">${mascota.raza || 'Mestizo'}</span>
                        </div>
                        <div class="patient-meta-row">
                            <span class="patient-meta-label">Edad:</span>
                            <span class="patient-meta-val">${edad}</span>
                        </div>
                        <div class="patient-meta-row">
                            <span class="patient-meta-label">Tutor:</span>
                            <span class="patient-meta-val">${mascota.tutor.nombre}</span>
                        </div>
                        <div class="patient-meta-row" style="margin-top: 10px; flex-wrap: wrap; gap: 6px; justify-content: flex-start;">
                            ${htmlAlertas}
                        </div>
                    </div>
                    <div class="patient-card-actions">
                        <button class="btn btn-secondary btn-icon-only" onclick="prepararEdicionMascota('${mascota.id}')" title="Editar Mascota">✏️</button>
                        <button class="btn btn-danger btn-icon-only" onclick="confirmarEliminarMascota('${mascota.id}', '${mascota.nombre}')" title="Eliminar Mascota">🗑️</button>
                        <button class="btn btn-primary" onclick="verCartillaMascota('${mascota.id}')">Ver Cartilla</button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

/**
 * Carga la edición de la mascota
 */
async function prepararEdicionMascota(id) {
    const mascotas = await obtenerMascotas();
    const mascota = mascotas.find(m => m.id === id);
    if (!mascota) return;
    
    navegarA('registrarMascota');
    
    const title = DOM.secciones.registrarMascota.querySelector('.form-title');
    if (title) title.textContent = `Editar Mascota: ${mascota.nombre}`;
    
    UIState.mascotaEdicionId = mascota.id;
    
    document.getElementById('pet-nombre').value = mascota.nombre;
    document.getElementById('pet-especie').value = mascota.especie;
    document.getElementById('pet-raza').value = mascota.raza || '';
    document.getElementById('pet-sexo').value = mascota.sexo;
    document.getElementById('pet-nacimiento').value = mascota.fechaNacimiento;
    document.getElementById('pet-color').value = mascota.color || '';
    document.getElementById('pet-peso').value = mascota.peso || '';
    document.getElementById('pet-tutor').value = mascota.tutor.nombre;
    document.getElementById('pet-tutor-tel').value = mascota.tutor.telefono || '';
    document.getElementById('pet-tutor-dir').value = mascota.tutor.direccion || '';
    document.getElementById('pet-obs').value = mascota.observaciones || '';
    
    UIState.fotoMascotaBase64 = mascota.foto || '';
    const preview = document.getElementById('pet-photo-preview');
    const placeholder = document.getElementById('pet-photo-placeholder');
    
    if (preview && mascota.foto) {
        preview.src = mascota.foto;
        preview.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
        if (placeholder) placeholder.style.display = 'block';
    }
    
    const datalistRazas = document.getElementById('datalist-razas');
    if (datalistRazas) {
        actualizarDatalistRazas(mascota.especie, datalistRazas);
    }
}

/**
 * Elimina una mascota tras confirmar
 */
async function confirmarEliminarMascota(id, nombre) {
    const confirmar = confirm(`¿Está totalmente seguro de eliminar a ${nombre}? Se borrará de forma irreversible todo su expediente clínico.`);
    if (confirmar) {
        const exito = await eliminarMascota(id);
        if (exito) {
            mostrarToast(`Expediente de ${nombre} eliminado.`, 'success');
            await renderizarListadoPacientes();
        } else {
            mostrarToast('No se pudo eliminar al paciente.', 'error');
        }
    }
}

/**
 * Visualiza la cartilla digital en pantalla
 */
async function verCartillaMascota(id) {
    let mascota = null;
    try {
        // Obtener el expediente COMPLETO (con vacunas, desparasitaciones y controles)
        // desde el endpoint de detalle, no del listado general que no incluye historial clínico.
        const detalle = await API.obtenerMascotaDetalle(id);
        mascota = sanearEsquemaMascota(detalle);
    } catch (e) {
        console.error('Error al cargar detalle de mascota:', e);
    }
    if (!mascota) {
        mostrarToast('Expediente no encontrado.', 'error');
        navegarA('inicio');
        return;
    }
    
    UIState.mascotaActivaId = id;
    const vet = obtenerVeterinaria() || { nombre: 'Cartilla Digital', iniciales: 'CD', telefono: '', direccion: '', logo: '' };
    
    // Encabezado
    document.getElementById('cartilla-clinic-logo').src = vet.logo || 'assets/logo-placeholder.png';
    document.getElementById('cartilla-clinic-nombre').textContent = vet.nombre;
    document.getElementById('cartilla-clinic-contacto').textContent = `Tel: ${vet.telefono || 'N/A'} | Dirección: ${vet.direccion || 'N/A'}`;
    document.getElementById('cartilla-unique-code').textContent = mascota.codigo;
    
    // Mascota
    document.getElementById('cartilla-pet-photo').src = obtenerFotoMascota(mascota);
    document.getElementById('cartilla-pet-name').textContent = mascota.nombre;
    document.getElementById('cartilla-pet-especie').textContent = mascota.especie;
    document.getElementById('cartilla-pet-raza').textContent = mascota.raza || 'Mestizo';
    document.getElementById('cartilla-pet-sexo').textContent = mascota.sexo;
    document.getElementById('cartilla-pet-edad').textContent = calcularEdadMascota(mascota.fechaNacimiento);
    document.getElementById('cartilla-pet-color').textContent = mascota.color || 'N/A';
    document.getElementById('cartilla-pet-peso').textContent = mascota.peso ? `${mascota.peso} Kg` : 'N/A';
    
    // Tutor
    document.getElementById('cartilla-tutor-nombre').textContent = mascota.tutor.nombre;
    document.getElementById('cartilla-tutor-telefono').textContent = mascota.tutor.telefono || 'N/A';
    document.getElementById('cartilla-tutor-direccion').textContent = mascota.tutor.direccion || 'N/A';
    
    // Observaciones
    document.getElementById('cartilla-observaciones-text').textContent = mascota.observaciones || 'Sin observaciones.';
    const obsSection = document.getElementById('cartilla-observaciones-section');
    if (obsSection) {
        if (!mascota.observaciones || !mascota.observaciones.trim()) {
            obsSection.classList.add('no-print');
        } else {
            obsSection.classList.remove('no-print');
        }
    }
    
    // Historiales clínicos
    renderizarHistorialesCartilla(mascota);
    
    // QR Code
    generarQRCartilla(mascota);
    
    // Navegar
    navegarA('cartilla');
}

/**
 * Renderiza las tablas de vacunas, desparasitaciones y controles
 */
function renderizarHistorialesCartilla(mascota) {
    // Vacunas
    const vBody = document.getElementById('cartilla-vacunas-table-body');
    const vacunas = mascota.vacunas || [];
    
    const vacunasSection = document.getElementById('cartilla-vacunas-section');
    if (vacunasSection) {
        if (vacunas.length === 0) {
            vacunasSection.classList.add('no-print');
        } else {
            vacunasSection.classList.remove('no-print');
        }
    }

    if (vacunas.length === 0) {
        vBody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay vacunas registradas en la cartilla.</td></tr>`;
    } else {
        const ordenadas = [...vacunas].sort((a,b) => new Date(b.fechaAplicacion) - new Date(a.fechaAplicacion));
        vBody.innerHTML = ordenadas.map(v => {
            const ev = evaluarEstadoVacuna(v.proximaDosis);
            const badgeClass = ev.status === 'success' ? 'success' : ev.status === 'warning' ? 'warning' : ev.status === 'danger' ? 'danger' : '';
            return `
                <tr>
                    <td data-label="Vacuna">
                        <strong>${v.nombre}</strong>
                        ${v.enfermedades ? `<br><small style="color:var(--text-muted); font-size:11px;">Cubre: ${v.enfermedades}</small>` : ''}
                    </td>
                    <td data-label="Fecha Aplicación">${formatearFechaLocal(v.fechaAplicacion)}</td>
                    <td data-label="Próxima Dosis">
                        ${v.proximaDosis ? formatearFechaLocal(v.proximaDosis) : 'N/A'}
                        ${v.proximaDosis ? `<br><span class="status-badge ${badgeClass}">${ev.label}</span>` : ''}
                    </td>
                    <td data-label="Lote"><span style="font-family:monospace;">${v.lote || 'N/A'}</span></td>
                    <td data-label="Veterinario">
                        ${v.responsable}
                        ${v.laboratorio ? `<br><small style="color:var(--text-muted); font-size:11px;">${v.laboratorio}</small>` : ''}
                    </td>
                    <td data-label="Obs."><span style="font-size:12px; color:var(--text-muted);">${v.observaciones || ''}</span></td>
                    <td class="no-print no-public" data-label="Acciones">
                        <button class="btn btn-secondary btn-icon-only" onclick="abrirEditarVacuna('${v.id}')" title="Editar">✏️</button>
                        <button class="btn btn-danger btn-icon-only" onclick="confirmarEliminarVacuna('${v.id}')" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Desparasitaciones divididas (Interna / Externa)
    const dIntBody = document.getElementById('cartilla-desparasitaciones-internas-table-body');
    const dExtBody = document.getElementById('cartilla-controles-externos-table-body');
    const desparasitaciones = mascota.desparasitaciones || [];
    
    const desparasitacionesInternas = desparasitaciones.filter(d => d.tipo !== 'externa');
    const desparasitacionesExternas = desparasitaciones.filter(d => d.tipo === 'externa');
    
    const dIntSection = document.getElementById('cartilla-desparasitaciones-internas-section');
    if (dIntSection) {
        if (desparasitacionesInternas.length === 0) {
            dIntSection.classList.add('no-print');
        } else {
            dIntSection.classList.remove('no-print');
        }
    }
    
    const dExtSection = document.getElementById('cartilla-controles-externos-section');
    if (dExtSection) {
        if (desparasitacionesExternas.length === 0) {
            dExtSection.classList.add('no-print');
        } else {
            dExtSection.classList.remove('no-print');
        }
    }
    
    // Render Internas
    if (dIntBody) {
        if (desparasitacionesInternas.length === 0) {
            dIntBody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay desparasitaciones internas registradas.</td></tr>`;
        } else {
            const ordenadas = [...desparasitacionesInternas].sort((a,b) => new Date(b.fechaAplicacion) - new Date(a.fechaAplicacion));
            dIntBody.innerHTML = ordenadas.map(d => {
                const ed = evaluarEstadoDesparasitacion(d.proximaAplicacion);
                const badgeClass = ed.status === 'success' ? 'success' : ed.status === 'warning' ? 'warning' : ed.status === 'danger' ? 'danger' : '';
                return `
                    <tr>
                        <td data-label="Producto"><strong>${d.producto}</strong></td>
                        <td data-label="Fecha Aplicación">${formatearFechaLocal(d.fechaAplicacion)}</td>
                        <td data-label="Próxima Aplicación">
                            ${d.proximaAplicacion ? formatearFechaLocal(d.proximaAplicacion) : 'N/A'}
                            ${d.proximaAplicacion ? `<br><span class="status-badge ${badgeClass}">${ed.label}</span>` : ''}
                        </td>
                        <td data-label="Dosis">${d.dosis || 'N/A'}</td>
                        <td data-label="Vía">${d.via || 'Oral'}</td>
                        <td data-label="Veterinario">${d.responsable}</td>
                        <td data-label="Obs."><span style="font-size:12px; color:var(--text-muted);">${d.observaciones || ''}</span></td>
                        <td class="no-print no-public" data-label="Acciones">
                            <button class="btn btn-secondary btn-icon-only" onclick="abrirEditarDesparasitacionInterna('${d.id}')" title="Editar">✏️</button>
                            <button class="btn btn-danger btn-icon-only" onclick="confirmarEliminarDesparasitacion('${d.id}')" title="Eliminar">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
    
    // Render Externas
    if (dExtBody) {
        if (desparasitacionesExternas.length === 0) {
            dExtBody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay controles antiparasitarios externos registrados.</td></tr>`;
        } else {
            const ordenadas = [...desparasitacionesExternas].sort((a,b) => new Date(b.fechaAplicacion) - new Date(a.fechaAplicacion));
            dExtBody.innerHTML = ordenadas.map(d => {
                const ed = evaluarEstadoDesparasitacion(d.proximaAplicacion);
                const badgeClass = ed.status === 'success' ? 'success' : ed.status === 'warning' ? 'warning' : ed.status === 'danger' ? 'danger' : '';
                return `
                    <tr>
                        <td data-label="Producto"><strong>${d.producto}</strong></td>
                        <td data-label="Tipo"><span class="status-badge warning">${d.tipoProducto || 'Tableta'}</span></td>
                        <td data-label="Fecha Aplicación">${formatearFechaLocal(d.fechaAplicacion)}</td>
                        <td data-label="Próxima Aplicación">
                            ${d.proximaAplicacion ? formatearFechaLocal(d.proximaAplicacion) : 'N/A'}
                            ${d.proximaAplicacion ? `<br><span class="status-badge ${badgeClass}">${ed.label}</span>` : ''}
                        </td>
                        <td data-label="Rango Peso">${d.rangoPeso || 'Cualquiera'}</td>
                        <td data-label="Parásitos Cubiertos"><span style="font-size:12px;">${d.parasitosCubre || 'N/A'}</span></td>
                        <td data-label="Veterinario">${d.responsable}</td>
                        <td data-label="Obs."><span style="font-size:12px; color:var(--text-muted);">${d.observaciones || ''}</span></td>
                        <td class="no-print no-public" data-label="Acciones">
                            <button class="btn btn-secondary btn-icon-only" onclick="abrirEditarControlExterno('${d.id}')" title="Editar">✏️</button>
                            <button class="btn btn-danger btn-icon-only" onclick="confirmarEliminarDesparasitacion('${d.id}')" title="Eliminar">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
    
    // Controles
    const cTimeline = document.getElementById('cartilla-controles-timeline');
    const controles = mascota.controles || [];
    
    const controlesSection = document.getElementById('cartilla-controles-section');
    if (controlesSection) {
        if (controles.length === 0) {
            controlesSection.classList.add('no-print');
        } else {
            controlesSection.classList.remove('no-print');
        }
    }
    if (controles.length === 0) {
        cTimeline.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>No se registran visitas o revisiones en la ficha clínica.</p>
            </div>
        `;
    } else {
        const ordenados = [...controles].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
        cTimeline.innerHTML = ordenados.map(c => {
            return `
                <div class="timeline-item">
                    <div class="timeline-item-header">
                        <span class="timeline-date">${formatearFechaLocal(c.fecha)}</span>
                        <span class="timeline-reason" style="flex: 1; margin-left: 12px;">${c.motivo}</span>
                        <button class="btn btn-secondary btn-icon-only no-print no-public" onclick="abrirEditarControl('${c.id}')" title="Editar" style="padding: 4px 8px; font-size: 11px;">✏️</button>
                        <button class="btn btn-danger btn-icon-only no-print no-public" onclick="confirmarEliminarControl('${c.id}')" title="Eliminar" style="padding: 4px 8px; font-size: 11px; margin-left: 4px;">🗑️</button>
                    </div>
                    <div class="timeline-metrics">
                        <div class="timeline-metric">Peso: <span>${c.peso ? `${c.peso} Kg` : 'N/A'}</span></div>
                        <div class="timeline-metric">T°: <span>${c.temperatura ? `${c.temperatura} °C` : 'N/A'}</span></div>
                        <div class="timeline-metric">FC: <span>${c.fc ? `${c.fc} lpm` : 'N/A'}</span></div>
                        <div class="timeline-metric">FR: <span>${c.fr ? `${c.fr} rpm` : 'N/A'}</span></div>
                    </div>
                    <div class="timeline-details">
                        ${c.hallazgos ? `<div class="timeline-detail-row"><span class="timeline-lbl">Hallazgos:</span><span class="timeline-val">${c.hallazgos}</span></div>` : ''}
                        ${c.diagnostico ? `<div class="timeline-detail-row"><span class="timeline-lbl">Diagnóstico:</span><span class="timeline-val">${c.diagnostico}</span></div>` : ''}
                        ${c.tratamiento ? `<div class="timeline-detail-row"><span class="timeline-lbl">Tratamiento:</span><span class="timeline-val">${c.tratamiento}</span></div>` : ''}
                        ${c.recomendaciones ? `<div class="timeline-detail-row"><span class="timeline-lbl">Indicaciones:</span><span class="timeline-val">${c.recomendaciones}</span></div>` : ''}
                        ${c.proximoControl ? `<div class="timeline-detail-row"><span class="timeline-lbl" style="color:var(--primary);">Próximo Control:</span><span class="timeline-val" style="font-weight:700;">${formatearFechaLocal(c.proximoControl)}</span></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
}

/**
 * Dibuja un QR code realista en un Canvas nativo 2D si la CDN falla o no hay internet.
 * Dibuja un patrón estéticamente idéntico con sus 3 localizadores de esquina.
 */
function dibujarQROfflineCanvas(canvas, url, codigo) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    
    // Limpiar canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    
    // Dibujar los 3 Finder Patterns (localizadores de esquinas)
    const finderSize = Math.floor(size * 0.28); // 28% del tamaño
    
    function dibujarLocalizador(x, y) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, finderSize, finderSize); // Cuadrante exterior negro
        
        ctx.fillStyle = '#FFFFFF';
        const innerPadding = Math.floor(finderSize * 0.15);
        ctx.fillRect(x + innerPadding, y + innerPadding, finderSize - (innerPadding * 2), finderSize - (innerPadding * 2)); // Cuadrante blanco
        
        ctx.fillStyle = '#000000';
        const centerPadding = Math.floor(finderSize * 0.3);
        ctx.fillRect(x + centerPadding, y + centerPadding, finderSize - (centerPadding * 2), finderSize - (centerPadding * 2)); // Centro negro
    }
    
    // Top Left, Top Right, Bottom Left
    dibujarLocalizador(10, 10);
    dibujarLocalizador(size - finderSize - 10, 10);
    dibujarLocalizador(10, size - finderSize - 10);
    
    // Rellenar el resto de la rejilla con bloques aleatorios tipo código de barras bidimensional
    ctx.fillStyle = '#000000';
    const cellSize = Math.floor(size / 21); // Rejilla de 21x21
    
    for (let row = 0; row < 21; row++) {
        for (let col = 0; col < 21; col++) {
            // Evitar dibujar sobre las esquinas de los localizadores
            const enEsquinaTL = row < 7 && col < 7;
            const enEsquinaTR = row < 7 && col > 13;
            const enEsquinaBL = row > 13 && col < 7;
            
            if (!enEsquinaTL && !enEsquinaTR && !enEsquinaBL) {
                // Dibujo determinista basado en caracteres de la URL/código para que no cambie en cada render
                const charCode = url.charCodeAt((row * col) % url.length) || 0;
                if ((charCode + row + col) % 2 === 0) {
                    ctx.fillRect(col * cellSize + 2, row * cellSize + 2, cellSize - 2, cellSize - 2);
                }
            }
        }
    }
}

/**
 * Genera el QR Code
 */
function generarQRCartilla(mascota) {
    const qrContainer = document.getElementById('qrcode');
    const printQrContainer = document.getElementById('print-qrcode');
    
    qrContainer.innerHTML = '';
    if (printQrContainer) printQrContainer.innerHTML = '';
    
    const queryId = `?id=${mascota.id}`;
    const cartillaUrl = window.location.origin + window.location.pathname + queryId;
    
    if (typeof QRCode !== 'undefined') {
        try {
            new QRCode(qrContainer, {
                text: cartillaUrl,
                width: 180,
                height: 180,
                colorDark: "#1C1C1E",
                colorLight: "#FFFFFF",
                correctLevel: QRCode.CorrectLevel.H
            });
            
            if (printQrContainer) {
                new QRCode(printQrContainer, {
                    text: cartillaUrl,
                    width: 90,
                    height: 90,
                    colorDark: "#000000",
                    colorLight: "#FFFFFF",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
            return;
        } catch (e) {
            console.error("Fallo de QRCode.js, recurriendo a Canvas local:", e);
        }
    }
    
    // QR DE RESPALDO (Canvas Offline Híbrido)
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    dibujarQROfflineCanvas(canvas, cartillaUrl, mascota.codigo);
    qrContainer.appendChild(canvas);
    
    if (printQrContainer) {
        const printCanvas = document.createElement('canvas');
        printCanvas.width = 90;
        printCanvas.height = 90;
        dibujarQROfflineCanvas(printCanvas, cartillaUrl, mascota.codigo);
        printQrContainer.appendChild(printCanvas);
    }
}

/**
 * Acciones
 */
function copiarEnlaceCartilla() {
    if (!UIState.mascotaActivaId) return;
    const cartillaUrl = `${window.location.origin}${window.location.pathname}?id=${UIState.mascotaActivaId}`;
    
    navigator.clipboard.writeText(cartillaUrl)
        .then(() => mostrarToast('Enlace de la cartilla digital copiado.', 'success'))
        .catch(() => mostrarToast('Error al copiar el enlace.', 'error'));
}

async function compartirWhatsApp() {
    if (!UIState.mascotaActivaId) return;
    const mascotas = await obtenerMascotas();
    const mascota = mascotas.find(m => m.id === UIState.mascotaActivaId);
    if (!mascota) return;
    
    const vet = obtenerVeterinaria() || { nombre: 'Nuestra Veterinaria' };
    const cartillaUrl = `${window.location.origin}${window.location.pathname}?id=${mascota.id}`;
    
    const txt = `Hola. Te comparto la Cartilla Digital de *${mascota.nombre}* (${mascota.especie}), emitida por *${vet.nombre}*.\n\n` +
                `*Ficha Clínica:* ${mascota.codigo}\n\n` +
                `Historial preventivo de vacunas, desparasitaciones y controles en: ${cartillaUrl}`;
                
    // Descargar el QR automáticamente
    try {
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) {
            let qrUrl = null;
            const canvas = qrContainer.querySelector('canvas');
            if (canvas) {
                qrUrl = canvas.toDataURL('image/png');
            } else {
                const img = qrContainer.querySelector('img');
                if (img && img.src) {
                    qrUrl = img.src;
                }
            }
            if (qrUrl) {
                const a = document.createElement('a');
                a.href = qrUrl;
                a.download = `QR_Cartilla_${mascota.nombre}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                mostrarToast('Descargando QR para adjuntar en WhatsApp...', 'info');
            }
        }
    } catch (e) {
        console.error('No se pudo descargar el QR automáticamente', e);
    }
                
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank');
}

function imprimirCartilla() {
    const originalTitle = document.title;
    const petName = document.getElementById('cartilla-pet-name').textContent || '';
    document.title = `Cartilla Digital - Paciente - ${petName}`;
    window.print();
    setTimeout(() => {
        document.title = originalTitle;
    }, 500);
}

/**
 * Fecha DD/MM/AAAA
 */
function formatearFechaLocal(fechaStr) {
    if (!fechaStr) return '';
    const array = fechaStr.split('-');
    if (array.length === 3) return `${array[2]}/${array[1]}/${array[0]}`;
    
    const date = new Date(fechaStr);
    if (isNaN(date.getTime())) return fechaStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const a = date.getFullYear();
    return `${d}/${m}/${a}`;
}

/**
 * Retorna la foto de la mascota o genera un placeholder SVG específico por especie.
 */
function obtenerFotoMascota(mascota) {
    if (mascota.foto) return mascota.foto;
    const especie = (mascota.especie || '').toLowerCase();
    const emoji = especie === 'perro' ? '🐶' : (especie === 'gato' ? '🐱' : '🐾');
    const colorBg = especie === 'perro' ? '#E8EAF6' : (especie === 'gato' ? '#FCE4EC' : '#E0E0E0');
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${colorBg}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="50">${emoji}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
}

/**
 * Evalúa las vacunas y desparasitaciones para retornar contadores de estados preventivos.
 */
function obtenerIndicadoresPreventivos(mascota) {
    let vacunasAlDia = 0;
    let vacunasProximas = 0;
    let vacunasVencidas = 0;
    let desparasitacionProxima = 0;
    let desparasitacionVencida = 0;
    
    (mascota.vacunas || []).forEach(v => {
        if (v.proximaDosis) {
            const ev = evaluarEstadoVacuna(v.proximaDosis);
            if (ev.status === 'success') vacunasAlDia++;
            else if (ev.status === 'warning') vacunasProximas++;
            else if (ev.status === 'danger') vacunasVencidas++;
        }
    });
    
    (mascota.desparasitaciones || []).forEach(d => {
        if (d.proximaAplicacion) {
            const ed = evaluarEstadoDesparasitacion(d.proximaAplicacion);
            if (ed.status === 'warning') desparasitacionProxima++;
            else if (ed.status === 'danger') desparasitacionVencida++;
        }
    });
    
    return {
        vacunasAlDia,
        vacunasProximas,
        vacunasVencidas,
        desparasitacionProxima,
        desparasitacionVencida
    };
}

/**
 * Abre el modal de vacuna en modo de edición cargando los datos del registro.
 */
async function abrirEditarVacuna(vacunaId) {
    if (!UIState.mascotaActivaId) return;
    let mascota = null;
    try {
        const detalle = await API.obtenerMascotaDetalle(UIState.mascotaActivaId);
        mascota = sanearEsquemaMascota(detalle);
    } catch (e) {
        console.error('Error al cargar detalle de mascota:', e);
    }
    if (!mascota) return;
    
    const v = mascota.vacunas.find(vac => vac.id === vacunaId);
    if (!v) return;
    
    abrirModal('vacuna');
    
    const modal = DOM.modales['vacuna'];
    if (modal) {
        const title = modal.querySelector('.modal-title');
        const submitBtn = modal.querySelector('form button[type="submit"]');
        if (title) title.textContent = 'Editar Vacuna';
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
    }
    
    document.getElementById('vac-id').value = v.id;
    document.getElementById('vac-nombre').value = v.nombre;
    document.getElementById('vac-enfermedades').value = v.enfermedades || '';
    document.getElementById('vac-laboratorio').value = v.laboratorio || '';
    document.getElementById('vac-fecha').value = v.fechaAplicacion;
    document.getElementById('vac-proxima').value = v.proximaDosis || '';
    document.getElementById('vac-lote').value = v.lote || '';
    poblarSelectResponsables('vac-responsable', v.responsableId);
    document.getElementById('vac-responsable').value = v.responsableId || '';
    document.getElementById('vac-obs').value = v.observaciones || '';
}

/**
 * Abre el modal de desparasitación interna en modo de edición cargando los datos.
 */
async function abrirEditarDesparasitacionInterna(desparasitacionId) {
    if (!UIState.mascotaActivaId) return;
    let mascota = null;
    try {
        const detalle = await API.obtenerMascotaDetalle(UIState.mascotaActivaId);
        mascota = sanearEsquemaMascota(detalle);
    } catch (e) {
        console.error('Error al cargar detalle de mascota:', e);
    }
    if (!mascota) return;
    
    const d = mascota.desparasitaciones.find(des => des.id === desparasitacionId);
    if (!d) return;
    
    abrirModal('desparasitacion-interna');
    
    const modal = DOM.modales['desparasitacion-interna'];
    if (modal) {
        const title = modal.querySelector('.modal-title');
        const submitBtn = modal.querySelector('form button[type="submit"]');
        if (title) title.textContent = 'Editar Desparasitación Interna';
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
    }
    
    document.getElementById('des-int-id').value = d.id;
    document.getElementById('des-int-producto').value = d.producto;
    document.getElementById('des-int-fecha').value = d.fechaAplicacion;
    document.getElementById('des-int-proxima').value = d.proximaAplicacion || '';
    document.getElementById('des-int-dosis').value = d.dosis || '';
    document.getElementById('des-int-via').value = d.via || 'Oral';
    poblarSelectResponsables('des-int-responsable', d.responsableId);
    document.getElementById('des-int-responsable').value = d.responsableId || '';
    document.getElementById('des-int-obs').value = d.observaciones || '';
}

/**
 * Abre el modal de control externo en modo de edición cargando los datos.
 */
async function abrirEditarControlExterno(desparasitacionId) {
    if (!UIState.mascotaActivaId) return;
    let mascota = null;
    try {
        const detalle = await API.obtenerMascotaDetalle(UIState.mascotaActivaId);
        mascota = sanearEsquemaMascota(detalle);
    } catch (e) {
        console.error('Error al cargar detalle de mascota:', e);
    }
    if (!mascota) return;
    
    const d = mascota.desparasitaciones.find(des => des.id === desparasitacionId);
    if (!d) return;
    
    abrirModal('control-externo');
    
    const modal = DOM.modales['control-externo'];
    if (modal) {
        const title = modal.querySelector('.modal-title');
        const submitBtn = modal.querySelector('form button[type="submit"]');
        if (title) title.textContent = 'Editar Control Externo';
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
    }
    
    document.getElementById('des-ext-id').value = d.id;
    document.getElementById('des-ext-producto').value = d.producto;
    document.getElementById('des-ext-tipo').value = d.tipoProducto || 'Tableta';
    document.getElementById('des-ext-peso').value = d.rangoPeso || '';
    document.getElementById('des-ext-fecha').value = d.fechaAplicacion;
    document.getElementById('des-ext-proxima').value = d.proximaAplicacion || '';
    document.getElementById('des-ext-parasitos').value = d.parasitosCubre || '';
    poblarSelectResponsables('des-ext-responsable', d.responsableId);
    document.getElementById('des-ext-responsable').value = d.responsableId || '';
    document.getElementById('des-ext-obs').value = d.observaciones || '';
}

/**
 * Abre el modal de control clínico en modo de edición cargando los datos.
 */
async function abrirEditarControl(controlId) {
    if (!UIState.mascotaActivaId) return;
    let mascota = null;
    try {
        const detalle = await API.obtenerMascotaDetalle(UIState.mascotaActivaId);
        mascota = sanearEsquemaMascota(detalle);
    } catch (e) {
        console.error('Error al cargar detalle de mascota:', e);
    }
    if (!mascota) return;
    
    const c = mascota.controles.find(ctrl => ctrl.id === controlId);
    if (!c) return;
    
    abrirModal('control');
    
    const modal = DOM.modales['control'];
    if (modal) {
        const title = modal.querySelector('.modal-title');
        const submitBtn = modal.querySelector('form button[type="submit"]');
        if (title) title.textContent = 'Editar Control Preventivo';
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
    }
    
    document.getElementById('ctrl-id').value = c.id;
    document.getElementById('ctrl-fecha').value = c.fecha;
    document.getElementById('ctrl-motivo').value = c.motivo;
    document.getElementById('ctrl-peso').value = c.peso || '';
    document.getElementById('ctrl-temp').value = c.temperatura || '';
    document.getElementById('ctrl-fc').value = c.fc || '';
    document.getElementById('ctrl-fr').value = c.fr || '';
    document.getElementById('ctrl-hallazgos').value = c.hallazgos || '';
    document.getElementById('ctrl-diag').value = c.diagnostico || '';
    document.getElementById('ctrl-tratamiento').value = c.tratamiento || '';
    document.getElementById('ctrl-rec').value = c.recomendaciones || '';
    document.getElementById('ctrl-proximo').value = c.proximoControl || '';
    poblarSelectResponsables('ctrl-responsable', c.responsableId);
    document.getElementById('ctrl-responsable').value = c.responsableId || '';
}

/**
 * Abre el modal para editar las observaciones generales del paciente.
 */
async function abrirModalObservaciones() {
    const mascotas = await obtenerMascotas();
    const mascota = mascotas.find(m => m.id === UIState.mascotaActivaId);
    if (!mascota) return;
    
    abrirModal('observaciones');
    
    const textarea = document.getElementById('obs-generales-text');
    if (textarea) {
        textarea.value = mascota.observaciones || '';
    }
}

/**
 * Actualiza la visibilidad de los elementos de navegación según el estado de la sesión.
 * @param {boolean} loggedIn - True si el usuario tiene sesión activa
 */
function actualizarUIConEstadoAuth(loggedIn) {
    const nav = document.querySelector('.header .nav');
    const logoutBtn = document.getElementById('nav-btn-logout');
    
    if (nav) {
        nav.style.display = loggedIn ? 'flex' : 'none';
    }
    if (logoutBtn) {
        logoutBtn.style.display = loggedIn ? 'block' : 'none';
    }
}

function abrirModalTransferencia() {
    abrirModal('transferencia-recibir');
}

function cerrarModalTransferencia() {
    cerrarModal('transferencia-recibir');
}

async function iniciarTransferenciaMascota() {
    if (!UIState.mascotaActivaId) {
        mostrarToast('No hay ninguna mascota activa para transferir.', 'error');
        return;
    }
    
    try {
        mostrarToast('Generando código de transferencia...', 'info');
        const res = await API.iniciarTransferencia(UIState.mascotaActivaId);
        
        const display = document.getElementById('tx-codigo-display');
        if (display) {
            display.textContent = res.codigo;
        }
        
        await abrirModal('transferencia-iniciar');
        mostrarToast('Código de transferencia generado con éxito.', 'success');
    } catch (err) {
        mostrarToast(err.message, 'error');
    }
}

async function verCartillaMascotaPublica(id) {
    try {
        mostrarToast('Cargando expediente...', 'info');
        const mascota = await API.obtenerMascotaPublica(id);
        
        UIState.mascotaActivaId = id;
        const vet = mascota.veterinaria || { nombre: 'Cartilla Digital', iniciales: 'CD', telefono: '', direccion: '', logo: '' };
        
        // Encabezado
        document.getElementById('cartilla-clinic-logo').src = vet.logo || 'assets/logo-placeholder.png';
        document.getElementById('cartilla-clinic-nombre').textContent = vet.nombre;
        document.getElementById('cartilla-clinic-contacto').textContent = `Tel: ${vet.telefono || 'N/A'} | Dirección: ${vet.direccion || 'N/A'}`;
        document.getElementById('cartilla-unique-code').textContent = mascota.codigo;
        
        // Mascota
        document.getElementById('cartilla-pet-photo').src = obtenerFotoMascota(mascota);
        document.getElementById('cartilla-pet-name').textContent = mascota.nombre;
        document.getElementById('cartilla-pet-especie').textContent = mascota.especie;
        document.getElementById('cartilla-pet-raza').textContent = mascota.raza || 'Mestizo';
        document.getElementById('cartilla-pet-sexo').textContent = mascota.sexo;
        document.getElementById('cartilla-pet-edad').textContent = calcularEdadMascota(mascota.fechaNacimiento);
        document.getElementById('cartilla-pet-color').textContent = mascota.color || 'N/A';
        document.getElementById('cartilla-pet-peso').textContent = mascota.peso ? `${mascota.peso} Kg` : 'N/A';
        
        // Tutor
        document.getElementById('cartilla-tutor-nombre').textContent = mascota.tutor.nombre;
        document.getElementById('cartilla-tutor-telefono').textContent = mascota.tutor.telefono || 'N/A';
        document.getElementById('cartilla-tutor-direccion').textContent = mascota.tutor.direccion || 'N/A';
        
        // Observaciones
        document.getElementById('cartilla-observaciones-text').textContent = mascota.observaciones || 'Sin observaciones.';
        const obsSection = document.getElementById('cartilla-observaciones-section');
        if (obsSection) {
            if (!mascota.observaciones || !mascota.observaciones.trim()) {
                obsSection.classList.add('no-print');
            } else {
                obsSection.classList.remove('no-print');
            }
        }
        
        // Historiales clínicos
        renderizarHistorialesCartilla(mascota);
        
        // QR Code
        generarQRCartilla(mascota);
        
        // Navegar
        await navegarA('cartilla');
    } catch (err) {
        mostrarToast('Error al cargar la cartilla pública: ' + err.message, 'error');
        throw err;
    }
}

/**
 * Confirmación y eliminación de vacuna
 */
async function confirmarEliminarVacuna(vacunaId) {
    if (!UIState.mascotaActivaId) return;
    const seguro = confirm('¿Está seguro de que desea eliminar esta vacuna de la cartilla? Esta acción no se puede deshacer.');
    if (seguro) {
        const exito = await eliminarVacuna(UIState.mascotaActivaId, vacunaId);
        if (exito) {
            mostrarToast('Vacuna eliminada correctamente.', 'success');
            await verCartillaMascota(UIState.mascotaActivaId);
        } else {
            mostrarToast('No se pudo eliminar la vacuna.', 'error');
        }
    }
}

/**
 * Confirmación y eliminación de desparasitación
 */
async function confirmarEliminarDesparasitacion(desparasitacionId) {
    if (!UIState.mascotaActivaId) return;
    const seguro = confirm('¿Está seguro de que desea eliminar esta desparasitación de la cartilla? Esta acción no se puede deshacer.');
    if (seguro) {
        const exito = await eliminarDesparasitacion(UIState.mascotaActivaId, desparasitacionId);
        if (exito) {
            mostrarToast('Desparasitación eliminada correctamente.', 'success');
            await verCartillaMascota(UIState.mascotaActivaId);
        } else {
            mostrarToast('No se pudo eliminar la desparasitación.', 'error');
        }
    }
}

/**
 * Confirmación y eliminación de control clínico
 */
async function confirmarEliminarControl(controlId) {
    if (!UIState.mascotaActivaId) return;
    const seguro = confirm('¿Está seguro de que desea eliminar este control clínico de la cartilla? Esta acción no se puede deshacer.');
    if (seguro) {
        const exito = await eliminarControl(UIState.mascotaActivaId, controlId);
        if (exito) {
            mostrarToast('Control clínico eliminado correctamente.', 'success');
            await verCartillaMascota(UIState.mascotaActivaId);
        } else {
            mostrarToast('No se pudo eliminar el control clínico.', 'error');
        }
    }
}

/**
 * Lógica de la Cámara WebRTC
 */
let streamCamara = null;
let camaraContexto = 'registro'; // 'registro' o 'cartilla'
let facingMode = 'environment'; // 'environment' (trasera) o 'user' (frontal)

async function abrirModalCamara(contexto) {
    camaraContexto = contexto;
    document.getElementById('modal-camara').style.display = 'flex';
    await iniciarCamara();
}

function cerrarModalCamara() {
    document.getElementById('modal-camara').style.display = 'none';
    detenerCamara();
}

function detenerCamara() {
    if (streamCamara) {
        streamCamara.getTracks().forEach(track => track.stop());
        streamCamara = null;
    }
    const video = document.getElementById('camara-video');
    if (video) video.srcObject = null;
}

async function iniciarCamara() {
    detenerCamara(); // Detener cualquier stream previo
    const video = document.getElementById('camara-video');
    
    try {
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        streamCamara = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = streamCamara;
    } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        mostrarToast('No se pudo acceder a la cámara. Asegúrate de dar permisos.', 'error');
        cerrarModalCamara();
    }
}

async function cambiarCamara() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    await iniciarCamara();
}

function capturarFotoCamara() {
    const video = document.getElementById('camara-video');
    const canvas = document.getElementById('camara-canvas');
    if (!video || !streamCamara) return;

    // Ajustar el canvas al tamaño original del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Si estamos usando la cámara frontal, invertir la imagen horizontalmente
    if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convertir canvas a Blob/File
    canvas.toBlob(blob => {
        if (!blob) {
            mostrarToast('Error al capturar la foto.', 'error');
            return;
        }
        const file = new File([blob], 'captura_camara.jpg', { type: 'image/jpeg' });
        
        cerrarModalCamara();
        
        if (camaraContexto === 'registro') {
            manejarSubidaFoto(file);
        } else if (camaraContexto === 'cartilla') {
            if (UIState.mascotaActivaId) {
                procesarComprimirYSubirImagen(file, 400, 400, 'mascotas', async (urlOrBase64) => {
                    const exito = await actualizarMascota(UIState.mascotaActivaId, { foto: urlOrBase64 });
                    if (exito) {
                        mostrarToast('Foto del paciente actualizada correctamente.', 'success');
                        await verCartillaMascota(UIState.mascotaActivaId);
                    } else {
                        mostrarToast('Error al actualizar la foto.', 'error');
                    }
                });
            }
        }
    }, 'image/jpeg', 0.85);
}
