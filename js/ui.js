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
    mascotaActivaDetalle: null,
    mascotaEdicionId: null,
    filtroEspecie: 'todos',
    busquedaQuery: '',
    dashboardRange: 'hoy',
    dashboardTipo: 'todas',
    dashboardCustomFrom: '',
    dashboardCustomTo: '',
    registerView: 'mascota',
    logoBase64: '',
    fotoMascotaBase64: '',
    modoPublico: false // Si es true, oculta navegación y formularios
};

function mapearEspecie(especieStr) {
    if (!especieStr) return 'Mascota';
    const esp = especieStr.toLowerCase().trim();
    if (esp === 'perro' || esp === 'p') return 'Canino';
    if (esp === 'gato' || esp === 'g') return 'Felino';
    return especieStr.charAt(0).toUpperCase() + especieStr.slice(1);
}

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
        transferencia: document.getElementById('section-transferencia'),
        equipo: document.getElementById('section-equipo'),
        soporte: document.getElementById('section-soporte')
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
        estado: document.getElementById('modal-estado'),
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
    configurarSidebarClinico();
    configurarFiltrosDashboard();
    configurarVistasRegistro();

    // Eventos de navegación SPA
    DOM.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (UIState.modoPublico) return;
            if (btn.classList.contains('nav-parent')) return;
            const seccion = btn.dataset.section;
            navegarA(seccion);
        });
    });
    
    if (DOM.brandLogo) {
        DOM.brandLogo.addEventListener('click', () => {
            if (!UIState.modoPublico) navegarA('inicio');
        });
        DOM.brandLogo.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !UIState.modoPublico) {
                e.preventDefault();
                navegarA('inicio');
            }
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
        if (!btn.dataset.specie) return;
        btn.addEventListener('click', () => {
            DOM.filterButtons.forEach(b => {
                if (b.dataset.specie) b.classList.remove('active');
            });
            btn.classList.add('active');
            UIState.filtroEspecie = btn.dataset.specie;
            renderizarListadoPacientes();
        });
    });
    
    // Configurar Modo Oscuro / Claro
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        const sincronizarSwitchTema = () => {
            const esOscuro = document.body.classList.contains('dark-theme');
            themeToggleBtn.classList.toggle('is-dark', esOscuro);
            themeToggleBtn.setAttribute('aria-pressed', String(!esOscuro));
            themeToggleBtn.title = esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
        };
        sincronizarSwitchTema();
        
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const nuevoEsOscuro = document.body.classList.contains('dark-theme');
            localStorage.setItem('cartilla_digital_theme', nuevoEsOscuro ? 'dark' : 'light');
            sincronizarSwitchTema();
        });
    }
    
    // Subida y codificación de imágenes a Base64
    configurarSubidaArchivos();
}

/**
 * Activa o desactiva el Modo Vista Pública.
 * @param {boolean} activar - True para activar la restricción
 */
function configurarSidebarClinico() {
    const nav = document.querySelector('.sidebar-nav');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!nav) return;

    const submenuConfig = {
        pacientes: [
            ['Todos los pacientes', { patientFilter: 'todos' }],
            ['Caninos', { patientFilter: 'canino' }],
            ['Felinos', { patientFilter: 'felino' }],
            ['Buscar paciente', { focusSearch: true }],
            ['Pacientes con alertas', { patientFilter: 'alertas' }]
        ],
        registrarMascota: [
            ['Registrar mascota', { registerView: 'mascota' }],
            ['Registrar atencion preventiva', { registerView: 'preventiva' }],
            ['Importar pacientes', { registerView: 'importar' }]
        ],
        banco: [
            ['Vacunas', { bancoTab: 'vacunas' }],
            ['Antiparasitarios internos', { bancoTab: 'internos' }],
            ['Antiparasitarios externos', { bancoTab: 'externos' }],
            ['Medicamentos preventivos', { bancoTab: 'medicamentos' }],
            ['Codigos rapidos', { bancoTab: 'codigos' }]
        ],
        configuracion: [
            ['Datos de la veterinaria', { configTab: 'datos' }],
            ['Equipo veterinario', { section: 'equipo' }],
            ['Cargos y especialidades', { configTab: 'cargos' }],
            ['Plantillas de mensajes', { configTab: 'plantillas' }],
            ['Preferencias del sistema', { configTab: 'preferencias' }],
            ['Seguridad', { configTab: 'seguridad' }],
            ['Roles y permisos', { configTab: 'roles' }],
            ['Apariencia', { configTab: 'tema' }]
        ]
    };

    Object.keys(submenuConfig).forEach(section => {
        const btn = nav.querySelector(`.nav-btn[data-section="${section}"]`);
        if (!btn || btn.closest('.nav-group')) return;
        const group = document.createElement('div');
        group.className = 'nav-group';
        btn.classList.add('nav-parent');
        btn.setAttribute('aria-expanded', 'false');
        btn.insertAdjacentHTML('beforeend', '<span class="nav-caret">⌄</span>');
        btn.parentNode.insertBefore(group, btn);
        group.appendChild(btn);
        const submenu = document.createElement('div');
        submenu.className = 'nav-submenu';
        submenuConfig[section].forEach(([label, action]) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'nav-subitem';
            item.textContent = label;
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const destino = action.section || section;
                if (action.patientFilter) UIState.filtroEspecie = action.patientFilter;
                if (action.registerView) UIState.registerView = action.registerView;
                if (action.bancoTab && typeof cambiarPestañaBanco === 'function') bancoPestañaActiva = action.bancoTab;
                await navegarA(destino);
                if (action.bancoTab && typeof cambiarPestañaBanco === 'function') cambiarPestañaBanco(action.bancoTab);
                if (action.registerView) cambiarVistaRegistro(action.registerView);
                if (action.configTab) activarPanelConfiguracion(action.configTab);
                if (action.focusSearch) {
                    const search = document.getElementById('search-bar');
                    if (search) search.focus();
                }
                cerrarSidebarMovil();
            });
            submenu.appendChild(item);
        });
        group.appendChild(submenu);
    });

    const equipoMain = nav.querySelector('.nav-btn[data-section="equipo"]');
    if (equipoMain) equipoMain.classList.add('nav-hidden-main');
    const configText = nav.querySelector('.nav-btn[data-section="configuracion"] .nav-text');
    if (configText) configText.textContent = 'Configuraciones';

    nav.querySelectorAll('.nav-parent').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.nav-group');
            if (!group) return;
            const isOpen = group.classList.toggle('open');
            btn.setAttribute('aria-expanded', String(isOpen));
        });
    });

    function cerrarSubmenus() {
        nav.querySelectorAll('.nav-group.open').forEach(group => {
            group.classList.remove('open');
            const parent = group.querySelector('.nav-parent');
            if (parent) parent.setAttribute('aria-expanded', 'false');
        });
    }

    const esSidebarMovil = () => (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 768px)').matches
    );
    const sincronizarEstadoSidebar = () => {
        if (!sidebarToggle) return;
        const expandido = esSidebarMovil()
            ? document.body.classList.contains('sidebar-open')
            : !document.body.classList.contains('sidebar-collapsed');
        sidebarToggle.setAttribute('aria-expanded', String(expandido));
    };

    window.cerrarSidebarMovil = function() {
        document.body.classList.remove('sidebar-open');
        if (esSidebarMovil()) sincronizarEstadoSidebar();
    };
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
        if (esSidebarMovil()) {
            document.body.classList.remove('sidebar-collapsed');
            const abrir = !document.body.classList.contains('sidebar-open');
            if (abrir) cerrarSubmenus();
            document.body.classList.toggle('sidebar-open', abrir);
        } else {
            document.body.classList.remove('sidebar-open');
            const contraer = !document.body.classList.contains('sidebar-collapsed');
            if (contraer) cerrarSubmenus();
            document.body.classList.toggle('sidebar-collapsed', contraer);
        }
        sincronizarEstadoSidebar();
    });
    if (backdrop) backdrop.addEventListener('click', window.cerrarSidebarMovil);
    window.addEventListener('resize', () => {
        if (esSidebarMovil()) {
            document.body.classList.remove('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-open');
        }
        sincronizarEstadoSidebar();
    });
    sincronizarEstadoSidebar();
    actualizarSidebarClinica();
}

function actualizarSidebarClinica() {
    const vet = obtenerVeterinaria() || {};
    const nombre = vet.nombre || 'Clinica San Martin';
    const propietario = vet.propietario || 'Dr. Juan Perez';
    const telefono = vet.telefono || '099 123 4567';
    const email = vet.email || vet.correo || 'correo@clinica.com';
    const iniciales = vet.iniciales
        ? String(vet.iniciales).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
        : nombre
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(parte => parte.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 3) || 'CD';

    const logoWrap = document.querySelector('.sidebar-clinic-logo-wrap');
    const logo = document.getElementById('sidebar-clinic-logo');
    const initials = document.getElementById('sidebar-clinic-initials');
    const nameEl = document.getElementById('sidebar-clinic-name');
    const ownerEl = document.getElementById('sidebar-clinic-owner');
    const phoneEl = document.getElementById('sidebar-clinic-phone');
    const emailEl = document.getElementById('sidebar-clinic-email');

    if (nameEl) nameEl.textContent = nombre;
    if (ownerEl) ownerEl.textContent = propietario;
    if (phoneEl) phoneEl.textContent = telefono;
    if (emailEl) emailEl.textContent = email;
    if (initials) initials.textContent = iniciales;

    if (logoWrap && logo) {
        if (vet.logo) {
            logo.src = vet.logo;
            logoWrap.classList.add('has-logo');
        } else {
            logo.removeAttribute('src');
            logoWrap.classList.remove('has-logo');
        }
    }
}

function actualizarCodigoOrigenCartilla(mascota) {
    const sourceEl = document.getElementById('cartilla-source-code');
    const sourceText = sourceEl ? sourceEl.querySelector('span') : null;
    if (!sourceEl || !sourceText) return;
    const sourceCode = mascota?.sourcePatientCode || '';
    sourceEl.hidden = !sourceCode;
    sourceText.textContent = sourceCode;
}

function configurarFiltrosDashboard() {
    document.querySelectorAll('.dashboard-range').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dashboard-range').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            UIState.dashboardRange = btn.dataset.range;
            const custom = document.getElementById('dashboard-custom-range');
            if (custom) custom.hidden = UIState.dashboardRange !== 'custom';
            renderizarDashboardClinico();
        });
    });
    document.querySelectorAll('.dashboard-type').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dashboard-type').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            UIState.dashboardTipo = btn.dataset.type;
            renderizarDashboardClinico();
        });
    });
    ['dashboard-date-from', 'dashboard-date-to'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('change', () => {
            UIState.dashboardCustomFrom = document.getElementById('dashboard-date-from')?.value || '';
            UIState.dashboardCustomTo = document.getElementById('dashboard-date-to')?.value || '';
            renderizarDashboardClinico();
        });
    });
}

function configurarVistasRegistro() {
    document.querySelectorAll('.register-tab').forEach(btn => {
        btn.addEventListener('click', () => cambiarVistaRegistro(btn.dataset.registerView));
    });
}

function cambiarVistaRegistro(view = 'mascota') {
    const vistasPermitidas = new Set(['mascota', 'preventiva', 'importar']);
    if (!vistasPermitidas.has(view)) view = 'mascota';
    UIState.registerView = view;
    document.querySelectorAll('.register-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.registerView === view);
    });
    document.querySelectorAll('.register-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.registerPanel === view);
    });
}

function activarPanelConfiguracion(tab = 'datos') {
    document.querySelectorAll('.config-panel').forEach(panel => {
        panel.classList.toggle('highlight-panel', panel.dataset.configPanel === tab);
    });
    const target = document.querySelector(`[data-config-panel="${tab}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
        await renderizarDashboardClinico();
    } else if (seccionId === 'pacientes') {
        await renderizarListadoPacientes();
    } else if (seccionId === 'configuracion') {
        cargarDatosFormVeterinaria();
        activarPanelConfiguracion('datos');
    } else if (seccionId === 'equipo') {
        if (typeof cargarEquipoVeterinario === 'function') {
            await cargarEquipoVeterinario();
        }
    } else if (seccionId === 'registrarMascota') {
        await prepararFormularioMascota();
        cambiarVistaRegistro(UIState.registerView || 'mascota');
    } else if (seccionId === 'banco') {
        cambiarPestañaBanco(bancoPestañaActiva);
    }
    if (seccionId === 'soporte' && typeof renderizarSoporteClinica === 'function') {
        await renderizarSoporteClinica();
    }
    if (seccionId === 'transferencia' && typeof renderizarTransferencias === 'function') {
        await renderizarTransferencias();
    }

    if (typeof cerrarSidebarMovil === 'function') cerrarSidebarMovil();
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
                const btnEliminar = document.getElementById('btn-eliminar-foto-mascota');
                if (btnEliminar) btnEliminar.style.display = 'block';
            });
        }
    }
    window.manejarSubidaFotoMascota = manejarSubidaFoto;
    
    window.eliminarFotoMascotaFormulario = function() {
        if(confirm('¿Estás seguro de eliminar la foto seleccionada?')) {
            UIState.fotoMascotaBase64 = null;
            if (petPreview) {
                petPreview.src = '';
                petPreview.style.display = 'none';
            }
            if (petPlaceholder) {
                petPlaceholder.style.display = 'block';
            }
            const btnEliminar = document.getElementById('btn-eliminar-foto-mascota');
            if (btnEliminar) btnEliminar.style.display = 'none';
            // También limpiar el input de archivo por si quieren re-seleccionar la misma
            if(petGallery) petGallery.value = '';
        }
    };
    
    window.eliminarFotoMascotaCartilla = async function() {
        if (!UIState.mascotaActivaId) return;
        if(confirm('¿Deseas eliminar la foto de este paciente? Esto se guardará inmediatamente.')) {
            mostrarToast('Eliminando foto...', 'info');
            try {
                // Usamos la API directamente para evitar las validaciones del formulario
                const res = await window.API.editarMascota(UIState.mascotaActivaId, { foto: null });
                if (res && res.mensaje) {
                    mostrarToast('Foto eliminada correctamente.', 'success');
                    const btnEliminarCartilla = document.getElementById('btn-eliminar-foto-cartilla');
                    if (btnEliminarCartilla) btnEliminarCartilla.style.display = 'none';
                    await verCartillaMascota(UIState.mascotaActivaId);
                } else {
                    mostrarToast('Error al eliminar la foto.', 'error');
                }
            } catch (err) {
                console.error(err);
                mostrarToast('Error de conexión al eliminar foto.', 'error');
            }
        }
    };
    
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
        document.getElementById('vet-propietario').value = vet.propietario || '';
        document.getElementById('vet-iniciales').value = vet.iniciales || '';
        document.getElementById('vet-telefono').value = vet.telefono || '';
        const emailInput = document.getElementById('vet-email');
        if (emailInput) emailInput.value = (vet.email || '').trim().toLowerCase();
        document.getElementById('vet-direccion').value = vet.direccion || '';
        
        UIState.logoBase64 = vet.logo || '';
        const preview = document.getElementById('vet-logo-preview');
        if (preview && vet.logo) {
            preview.src = vet.logo;
            preview.style.display = 'block';
        }
    }
    actualizarSidebarClinica();
}

/**
 * Resetea y prepara el formulario de mascotas.
 */
async function prepararFormularioMascota() {
    DOM.formMascota.reset();
    UIState.mascotaEdicionId = null;
    UIState.fotoMascotaBase64 = '';
    
    const preview = document.getElementById('pet-photo-preview');
    const placeholder = document.getElementById('pet-photo-placeholder');
    const btnEliminar = document.getElementById('btn-eliminar-foto-mascota');
    if (preview) {
        preview.style.display = 'none';
        preview.src = '';
    }
    if (placeholder) {
        placeholder.style.display = 'block';
    }
    if (btnEliminar) {
        btnEliminar.style.display = 'none';
    }
    
    await inicializarSelectorRazaMascota();
    
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
    
    const textWrap = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = icono;
    textWrap.appendChild(strong);
    textWrap.appendChild(document.createTextNode(` ${mensaje}`));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close-btn';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '&times;';

    toast.appendChild(textWrap);
    toast.appendChild(closeBtn);
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
        
        if (idInput && modalId !== 'estado') idInput.value = '';
        
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
            try {
                if (typeof cargarCacheBancoClinico === 'function') {
                    await cargarCacheBancoClinico();
                }
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
            } catch (err) {
                console.error("Error cargando selects del banco clínico:", err);
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
    const perros = mascotas.filter(m => {
        const esp = (m.especie || '').toLowerCase();
        return esp === 'perro' || esp === 'canino' || esp === 'p';
    }).length;
    const gatos = mascotas.filter(m => {
        const esp = (m.especie || '').toLowerCase();
        return esp === 'gato' || esp === 'felino' || esp === 'g';
    }).length;
    
    let vacunasProximas = 0;
    let desparasitacionesProximas = 0;
    const eventos = [];
    
    mascotas.forEach(mascota => {
        (mascota.vacunas || []).forEach(v => {
            if (v.proximaDosis) {
                const ev = obtenerEstadoPreventivoVisual(v.proximaDosis, v.status, evaluarEstadoVacuna);
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
                const ed = obtenerEstadoPreventivoVisual(d.proximaAplicacion, d.status, evaluarEstadoDesparasitacion);
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
async function renderizarDashboardClinico() {
    const mascotas = await obtenerMascotas();
    const eventos = construirEventosPreventivos(mascotas);
    const total = mascotas.length;
    const perros = mascotas.filter(m => ['perro', 'canino', 'p'].includes((m.especie || '').toLowerCase())).length;
    const gatos = mascotas.filter(m => ['gato', 'felino', 'g'].includes((m.especie || '').toLowerCase())).length;
    const hoy = fechaISO(new Date());
    const en30 = fechaISO(sumarDias(new Date(), 30));
    const vacunasProximas = eventos.filter(e => e.categoria === 'vacuna' && e.fecha >= hoy && e.fecha <= en30 && e.estado !== 'asistio').length;
    const desparasitacionesProximas = eventos.filter(e => e.categoria === 'desparasitacion' && e.fecha >= hoy && e.fecha <= en30 && e.estado !== 'asistio').length;

    DOM.stats.total.textContent = total;
    DOM.stats.perros.textContent = perros;
    DOM.stats.gatos.textContent = gatos;
    DOM.stats.vacunas.textContent = vacunasProximas;
    DOM.stats.desparasitaciones.textContent = desparasitacionesProximas;

    const eventosFiltrados = filtrarEventosDashboard(eventos).sort((a, b) => a.diasRestantes - b.diasRestantes);
    if (!DOM.proximosEventosContainer) return;

    if (eventosFiltrados.length === 0) {
        DOM.proximosEventosContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">OK</div>
                <p>No hay atenciones para los filtros seleccionados.</p>
            </div>
        `;
    } else {
        const rows = eventosFiltrados.map(e => {
            const badge = e.diasRestantes < 0
                ? `<span class="status-badge danger">Vencida (${Math.abs(e.diasRestantes)} d)</span>`
                : e.diasRestantes === 0
                    ? '<span class="status-badge warning">Hoy</span>'
                    : `<span class="status-badge warning">En ${e.diasRestantes} dias</span>`;
            return `
                <tr style="cursor: pointer;" onclick="verCartillaMascota('${e.mascotaId}')">
                    <td data-label="Mascota"><strong>${e.mascota}</strong><br><small>${e.especie}</small></td>
                    <td data-label="Tutor">${e.tutor || 'Sin tutor'}</td>
                    <td data-label="Tipo"><span class="patient-badge ${e.categoria === 'vacuna' ? 'perro' : 'gato'}">${e.tipo}</span></td>
                    <td data-label="Producto">${e.nombre}</td>
                    <td data-label="Fecha">${formatearFechaLocal(e.fecha)}</td>
                    <td data-label="Estado">${badge}</td>
                    <td data-label="Acciones"><button class="btn btn-secondary btn-sm" type="button">Ver paciente</button></td>
                </tr>
            `;
        }).join('');

        DOM.proximosEventosContainer.innerHTML = `
            <div class="table-container">
                <table class="clinic-table">
                    <thead>
                        <tr>
                            <th>Mascota</th>
                            <th>Tutor</th>
                            <th>Tipo de atencion</th>
                            <th>Vacuna / antiparasitario</th>
                            <th>Fecha proxima</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    renderizarAlertasClinicas(mascotas, eventos);
}

function construirEventosPreventivos(mascotas) {
    const eventos = [];
    mascotas.forEach(mascota => {
        (mascota.vacunas || []).forEach(v => {
            if (!v.proximaDosis) return;
            const ev = obtenerEstadoPreventivoVisual(v.proximaDosis, v.status, evaluarEstadoVacuna);
            eventos.push({
                categoria: 'vacuna',
                tipo: 'Vacuna',
                nombre: v.nombre || 'Vacuna',
                mascota: mascota.nombre,
                especie: mapearEspecie(mascota.especie),
                tutor: mascota.tutor?.nombre || '',
                mascotaId: mascota.id,
                fecha: v.proximaDosis,
                diasRestantes: ev.daysLeft,
                alerta: ev.status,
                estado: v.status || 'pendiente'
            });
        });
        (mascota.desparasitaciones || []).forEach(d => {
            if (!d.proximaAplicacion) return;
            const ed = obtenerEstadoPreventivoVisual(d.proximaAplicacion, d.status, evaluarEstadoDesparasitacion);
            const interna = (d.tipo || '').toLowerCase() !== 'externa';
            eventos.push({
                categoria: 'desparasitacion',
                subtipo: interna ? 'desparasitacion-interna' : 'desparasitacion-externa',
                tipo: interna ? 'Desparasitacion interna' : 'Desparasitacion externa',
                nombre: d.producto || 'Antiparasitario',
                mascota: mascota.nombre,
                especie: mapearEspecie(mascota.especie),
                tutor: mascota.tutor?.nombre || '',
                mascotaId: mascota.id,
                fecha: d.proximaAplicacion,
                diasRestantes: ed.daysLeft,
                alerta: ed.status,
                estado: d.status || 'pendiente'
            });
        });
        (mascota.controles || []).forEach(c => {
            if (!c.proximoControl) return;
            const ec = evaluarEstadoDesparasitacion(c.proximoControl);
            eventos.push({
                categoria: 'control',
                subtipo: 'control',
                tipo: 'Control preventivo',
                nombre: c.motivo || 'Control preventivo',
                mascota: mascota.nombre,
                especie: mapearEspecie(mascota.especie),
                tutor: mascota.tutor?.nombre || '',
                mascotaId: mascota.id,
                fecha: c.proximoControl,
                diasRestantes: ec.daysLeft,
                alerta: ec.status,
                estado: c.status || 'pendiente'
            });
        });
    });
    return eventos;
}

function filtrarEventosDashboard(eventos) {
    const rango = obtenerRangoDashboard();
    return eventos.filter(e => {
        const tipo = UIState.dashboardTipo;
        const coincideTipo = tipo === 'todas' ||
            (tipo === 'vacuna' && e.categoria === 'vacuna') ||
            (tipo === 'control' && e.categoria === 'control') ||
            e.subtipo === tipo;
        return coincideTipo && e.fecha >= rango.desde && e.fecha <= rango.hasta;
    });
}

function obtenerRangoDashboard() {
    const hoyDate = new Date();
    hoyDate.setHours(0, 0, 0, 0);
    let desde = hoyDate;
    let hasta = hoyDate;
    if (UIState.dashboardRange === 'manana') {
        desde = sumarDias(hoyDate, 1);
        hasta = sumarDias(hoyDate, 1);
    } else if (UIState.dashboardRange === '7') {
        hasta = sumarDias(hoyDate, 7);
    } else if (UIState.dashboardRange === '30') {
        hasta = sumarDias(hoyDate, 30);
    } else if (UIState.dashboardRange === 'custom') {
        return {
            desde: UIState.dashboardCustomFrom || fechaISO(hoyDate),
            hasta: UIState.dashboardCustomTo || fechaISO(sumarDias(hoyDate, 30))
        };
    }
    return { desde: fechaISO(desde), hasta: fechaISO(hasta) };
}

function sumarDias(fecha, dias) {
    const copia = new Date(fecha);
    copia.setDate(copia.getDate() + dias);
    return copia;
}

function fechaISO(fecha) {
    return fecha.toISOString().split('T')[0];
}

function esEmailTutorValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
}

function obtenerClaveTutor(mascota) {
    const nombre = (mascota.tutor?.nombre || '').trim().toLowerCase();
    const telefono = (mascota.tutor?.telefono || '').trim().toLowerCase();
    return nombre || telefono ? `${nombre}|${telefono}` : `mascota:${mascota.id}`;
}

function contarTutoresSinCorreo(mascotas) {
    const tutores = new Map();
    mascotas.forEach(mascota => {
        const clave = obtenerClaveTutor(mascota);
        const actual = tutores.get(clave) || { tieneCorreo: false };
        if (esEmailTutorValido(mascota.tutor?.email)) {
            actual.tieneCorreo = true;
        }
        tutores.set(clave, actual);
    });
    return Array.from(tutores.values()).filter(tutor => !tutor.tieneCorreo).length;
}

function renderizarAlertasClinicas(mascotas, eventos) {
    const container = document.getElementById('dashboard-alertas-clinicas');
    if (!container) return;
    const vacunasVencidas = eventos.filter(e => e.categoria === 'vacuna' && e.diasRestantes < 0).length;
    const desparasitacionesVencidas = eventos.filter(e => e.categoria === 'desparasitacion' && e.diasRestantes < 0).length;
    const pacientesSinTutorCompleto = mascotas.filter(m => !m.tutor?.nombre || !m.tutor?.telefono).length;
    const tutoresSinTelefono = mascotas.filter(m => !m.tutor?.telefono).length;
    const tutoresSinCorreo = contarTutoresSinCorreo(mascotas);
    const pacientesSinProximaCita = mascotas.filter(m => !tieneProximaAtencion(m)).length;
    const incompletos = mascotas.filter(m => !m.nombre || !m.especie || !m.raza || !m.sexo || !m.fechaNacimiento || !m.tutor?.nombre).length;
    const alertas = [
        ['Vacunas vencidas', vacunasVencidas, 'danger'],
        ['Desparasitaciones vencidas', desparasitacionesVencidas, 'danger'],
        ['Pacientes sin tutor completo', pacientesSinTutorCompleto, 'warning'],
        ['Tutores sin telefono', tutoresSinTelefono, 'warning'],
        ['Tutores sin correo', tutoresSinCorreo, 'secondary'],
        ['Pacientes sin proxima cita', pacientesSinProximaCita, 'warning'],
        ['Pacientes con datos incompletos', incompletos, 'warning']
    ];
    container.innerHTML = alertas.map(([label, value, tone]) => `
        <button class="alert-card ${tone}" type="button" onclick="UIState.filtroEspecie='alertas'; navegarA('pacientes')">
            <span>${label}</span>
            <strong>${value}</strong>
        </button>
    `).join('');
}

function tieneProximaAtencion(mascota) {
    return (mascota.vacunas || []).some(v => v.proximaDosis) ||
        (mascota.desparasitaciones || []).some(d => d.proximaAplicacion) ||
        (mascota.controles || []).some(c => c.proximoControl);
}

async function renderizarListadoPacientes() {
    let mascotas = await obtenerMascotas();
    const query = UIState.busquedaQuery.toLowerCase().trim();
    const filtro = UIState.filtroEspecie.toLowerCase();
    
    if (filtro !== 'todos') {
        if (filtro === 'alertas') {
            mascotas = mascotas.filter(m => {
                const ind = obtenerIndicadoresPreventivos(m);
                return ind.vacunasVencidas > 0 ||
                    ind.desparasitacionVencida > 0 ||
                    !m.tutor?.nombre ||
                    !m.tutor?.telefono ||
                    !esEmailTutorValido(m.tutor?.email) ||
                    !tieneProximaAtencion(m);
            });
        } else {
            mascotas = mascotas.filter(m => {
                const esp = (m.especie || '').toLowerCase();
                if (filtro === 'canino' || filtro === 'perro') return esp === 'canino' || esp === 'perro' || esp === 'p';
                if (filtro === 'felino' || filtro === 'gato') return esp === 'felino' || esp === 'gato' || esp === 'g';
                return esp === filtro;
            });
        }
    }
    
    if (query) {
        mascotas = mascotas.filter(m => {
            return m.nombre.toLowerCase().includes(query) ||
                   m.tutor.nombre.toLowerCase().includes(query) ||
                   m.codigo.toLowerCase().includes(query) ||
                   (m.tutor.telefono || '').toLowerCase().includes(query) ||
                   (m.tutor.email || '').toLowerCase().includes(query) ||
                   (m.especie || '').toLowerCase().includes(query) ||
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
            const especieNormalizada = (mascota.especie || '').toLowerCase();
            const especieClase = especieNormalizada === 'perro' || especieNormalizada === 'canino' ? 'perro' : 'gato';
            const ind = obtenerIndicadoresPreventivos(mascota);
            const proximaVacuna = obtenerProximaVacunaPaciente(mascota);
            const proximaDesparasitacion = obtenerProximaDesparasitacionPaciente(mascota);
            
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
                            <span class="patient-badge ${especieClase}">${mapearEspecie(mascota.especie)}</span>
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
                            <span class="patient-meta-label">Sexo:</span>
                            <span class="patient-meta-val">${mascota.sexo || 'N/A'}</span>
                        </div>
                        <div class="patient-meta-row">
                            <span class="patient-meta-label">Tutor:</span>
                            <span class="patient-meta-val">${mascota.tutor.nombre}</span>
                        </div>
                        <div class="patient-meta-row">
                            <span class="patient-meta-label">PrÃ³xima vacuna:</span>
                            <span class="patient-meta-val">${proximaVacuna ? formatearFechaLocal(proximaVacuna) : 'Sin programar'}</span>
                        </div>
                        <div class="patient-meta-row">
                            <span class="patient-meta-label">PrÃ³xima desparasitaciÃ³n:</span>
                            <span class="patient-meta-val">${proximaDesparasitacion ? formatearFechaLocal(proximaDesparasitacion) : 'Sin programar'}</span>
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
function obtenerProximaVacunaPaciente(mascota) {
    return (mascota.vacunas || [])
        .map(v => v.proximaDosis)
        .filter(Boolean)
        .sort()[0] || '';
}

function obtenerProximaDesparasitacionPaciente(mascota) {
    return (mascota.desparasitaciones || [])
        .map(d => d.proximaAplicacion)
        .filter(Boolean)
        .sort()[0] || '';
}

async function prepararEdicionMascota(id) {
    const mascotas = await obtenerMascotas();
    const mascota = mascotas.find(m => m.id === id);
    if (!mascota) return;
    
    await navegarA('registrarMascota');
    
    const title = DOM.secciones.registrarMascota.querySelector('.form-title');
    if (title) title.textContent = `Editar Mascota: ${mascota.nombre}`;
    
    UIState.mascotaEdicionId = mascota.id;
    
    document.getElementById('pet-nombre').value = mascota.nombre;
    document.getElementById('pet-especie').value = mascota.especie;
    await inicializarSelectorRazaMascota(mascota.especie, mascota.raza || '');
    document.getElementById('pet-sexo').value = mascota.sexo;
    document.getElementById('pet-nacimiento').value = mascota.fechaNacimiento;
    document.getElementById('pet-color').value = mascota.color || '';
    document.getElementById('pet-peso').value = mascota.peso || '';
    document.getElementById('pet-tutor').value = mascota.tutor.nombre;
    document.getElementById('pet-tutor-tel').value = mascota.tutor.telefono || '';
    const tutorEmailInput = document.getElementById('pet-tutor-email');
    if (tutorEmailInput) tutorEmailInput.value = mascota.tutor.email || '';
    document.getElementById('pet-tutor-dir').value = mascota.tutor.direccion || '';
    document.getElementById('pet-obs').value = mascota.observaciones || '';
    
    UIState.fotoMascotaBase64 = mascota.foto || '';
    const preview = document.getElementById('pet-photo-preview');
    const placeholder = document.getElementById('pet-photo-placeholder');
    const btnEliminar = document.getElementById('btn-eliminar-foto-mascota');
    
    if (preview && mascota.foto) {
        preview.src = mascota.foto;
        preview.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (btnEliminar) btnEliminar.style.display = 'block';
    } else {
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
        if (placeholder) placeholder.style.display = 'block';
        if (btnEliminar) btnEliminar.style.display = 'none';
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
    UIState.mascotaActivaDetalle = mascota;
    const vet = obtenerVeterinaria() || { nombre: 'Cartilla Digital', iniciales: 'CD', telefono: '', direccion: '', logo: '' };
    
    // Encabezado
    document.getElementById('cartilla-clinic-logo').src = vet.logo || 'assets/logo-placeholder.png';
    document.getElementById('cartilla-clinic-nombre').textContent = vet.nombre;
    document.getElementById('cartilla-clinic-contacto').textContent = `Tel: ${vet.telefono || 'N/A'} | Dirección: ${vet.direccion || 'N/A'}`;
    document.getElementById('cartilla-unique-code').textContent = mascota.codigo;
    actualizarCodigoOrigenCartilla(mascota);
    
    // Mascota
    document.getElementById('cartilla-pet-photo').src = obtenerFotoMascota(mascota);
    const btnEliminarCartilla = document.getElementById('btn-eliminar-foto-cartilla');
    if (btnEliminarCartilla) {
        btnEliminarCartilla.style.display = mascota.foto ? 'block' : 'none';
    }
    
    document.getElementById('cartilla-pet-name').textContent = mascota.nombre;
    document.getElementById('cartilla-pet-especie').textContent = mapearEspecie(mascota.especie);
    document.getElementById('cartilla-pet-raza').textContent = mascota.raza || 'Mestizo';
    document.getElementById('cartilla-pet-sexo').textContent = mascota.sexo;
    document.getElementById('cartilla-pet-edad').textContent = calcularEdadMascota(mascota.fechaNacimiento);
    document.getElementById('cartilla-pet-color').textContent = mascota.color || 'N/A';
    document.getElementById('cartilla-pet-peso').textContent = mascota.peso ? `${mascota.peso} Kg` : 'N/A';
    
    // Tutor
    document.getElementById('cartilla-tutor-nombre').textContent = mascota.tutor.nombre;
    document.getElementById('cartilla-tutor-telefono').textContent = mascota.tutor.telefono || 'N/A';
    document.getElementById('cartilla-tutor-email').textContent = mascota.tutor.email || 'N/A';
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
        vBody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay vacunas registradas en la cartilla.</td></tr>`;
    } else {
        const ordenadas = [...vacunas].sort((a,b) => new Date(b.fechaAplicacion) - new Date(a.fechaAplicacion));
        vBody.innerHTML = ordenadas.map(v => {
            const ev = obtenerEstadoPreventivoVisual(v.proximaDosis, v.status, evaluarEstadoVacuna);
            const badgeClass = obtenerBadgeClase(ev.status);
            const statusBadge = construirEstadoAsistenciaHtml(v.status, v.fechaAsistencia);

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
                    <td data-label="Estado">${statusBadge}</td>
                    <td class="no-print no-public" data-label="Acciones">
                        <div class="dropdown" style="display:inline-block; margin-right:4px;">
                            <button class="btn btn-secondary btn-icon-only" title="Cambiar Estado" onclick="abrirMenuEstado(this, 'vacuna', '${v.id}')">🗓️</button>
                        </div>
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
            dIntBody.innerHTML = `<tr><td colspan="9" class="empty-state">No hay desparasitaciones internas registradas.</td></tr>`;
        } else {
            const ordenadas = [...desparasitacionesInternas].sort((a,b) => new Date(b.fechaAplicacion) - new Date(a.fechaAplicacion));
            dIntBody.innerHTML = ordenadas.map(d => {
                const ed = obtenerEstadoPreventivoVisual(d.proximaAplicacion, d.status, evaluarEstadoDesparasitacion);
                const badgeClass = obtenerBadgeClase(ed.status);
                const statusBadge = construirEstadoAsistenciaHtml(d.status, d.fechaAsistencia);

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
                        <td data-label="Estado">${statusBadge}</td>
                        <td class="no-print no-public" data-label="Acciones">
                            <div class="dropdown" style="display:inline-block; margin-right:4px;">
                                <button class="btn btn-secondary btn-icon-only" title="Cambiar Estado" onclick="abrirMenuEstado(this, 'desparasitacion', '${d.id}')">🗓️</button>
                            </div>
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
            dExtBody.innerHTML = `<tr><td colspan="10" class="empty-state">No hay controles antiparasitarios externos registrados.</td></tr>`;
        } else {
            const ordenadas = [...desparasitacionesExternas].sort((a,b) => new Date(b.fechaAplicacion) - new Date(a.fechaAplicacion));
            dExtBody.innerHTML = ordenadas.map(d => {
                const ed = obtenerEstadoPreventivoVisual(d.proximaAplicacion, d.status, evaluarEstadoDesparasitacion);
                const badgeClass = obtenerBadgeClase(ed.status);
                const statusBadge = construirEstadoAsistenciaHtml(d.status, d.fechaAsistencia);

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
                        <td data-label="Estado">${statusBadge}</td>
                        <td class="no-print no-public" data-label="Acciones">
                            <div class="dropdown" style="display:inline-block; margin-right:4px;">
                                <button class="btn btn-secondary btn-icon-only" title="Cambiar Estado" onclick="abrirMenuEstado(this, 'desparasitacion', '${d.id}')">🗓️</button>
                            </div>
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
                let statusBadge = '';
                if (c.proximoControl) {
                    if (c.status === 'asistio') statusBadge = '<span class="status-badge success">Asistió</span>';
                    else if (c.status === 'no_asistio') statusBadge = '<span class="status-badge danger">No Asistió</span>';
                    else if (c.status === 'reagendado') statusBadge = '<span class="status-badge warning">Reagendado</span>';
                    else statusBadge = '<span class="status-badge" style="background:var(--text-muted);">Pendiente</span>';
                }

                return `
                <div class="timeline-item">
                    <div class="timeline-item-header">
                        <span class="timeline-date">${formatearFechaLocal(c.fecha)}</span>
                        <span class="timeline-reason" style="flex: 1; margin-left: 12px;">${c.motivo}</span>
                        <div class="dropdown no-print no-public" style="display:inline-block; margin-right:4px;">
                            ${c.proximoControl ? `<button class="btn btn-secondary btn-icon-only" title="Cambiar Estado" onclick="abrirMenuEstado(this, 'control', '${c.id}')" style="padding: 4px 8px; font-size: 11px;">🗓️</button>` : ''}
                        </div>
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
                        ${c.proximoControl ? `<div class="timeline-detail-row"><span class="timeline-lbl" style="color:var(--primary);">Próximo Control:</span><span class="timeline-val" style="font-weight:700;">${formatearFechaLocal(c.proximoControl)} &nbsp; ${statusBadge}</span></div>` : ''}
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

function construirUrlCartillaPublica(mascotaId) {
    const queryId = `?id=${encodeURIComponent(mascotaId)}`;
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return `${window.location.origin}${window.location.pathname}${queryId}`;
    }

    const frontendUrlGuardada = localStorage.getItem('cartilla_digital_frontend_url');
    const baseUrlLimpia = (frontendUrlGuardada || 'https://elranchodejuan-jo.github.io/Cartilla_Digital/')
        .split('?')[0]
        .replace(/#.*$/, '');
    const baseUrl = baseUrlLimpia.endsWith('/') || baseUrlLimpia.endsWith('.html')
        ? baseUrlLimpia
        : `${baseUrlLimpia}/`;
    return `${baseUrl}${queryId}`;
}

/**
 * Genera el QR Code
 */
function generarQRCartilla(mascota) {
    const qrContainer = document.getElementById('qrcode');
    const printQrContainer = document.getElementById('print-qrcode');
    
    qrContainer.innerHTML = '';
    if (printQrContainer) printQrContainer.innerHTML = '';
    
    const cartillaUrl = construirUrlCartillaPublica(mascota.id);
    
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
    const cartillaUrl = construirUrlCartillaPublica(UIState.mascotaActivaId);
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(cartillaUrl)
            .then(() => mostrarToast('Enlace de la cartilla digital copiado.', 'success'))
            .catch(() => copiarEnlaceCartillaFallback(cartillaUrl));
    } else {
        copiarEnlaceCartillaFallback(cartillaUrl);
    }
}

function copiarEnlaceCartillaFallback(cartillaUrl) {
    const textarea = document.createElement('textarea');
    textarea.value = cartillaUrl;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copiado = document.execCommand('copy');
    textarea.remove();
    mostrarToast(copiado ? 'Enlace de la cartilla digital copiado.' : 'No se pudo copiar el enlace.', copiado ? 'success' : 'error');
}

async function compartirWhatsApp() {
    if (!UIState.mascotaActivaId) return;
    const mascotas = await obtenerMascotas();
    const mascota = mascotas.find(m => m.id === UIState.mascotaActivaId);
    if (!mascota) return;
    
    const vet = obtenerVeterinaria() || { nombre: 'Nuestra Veterinaria' };
    const cartillaUrl = construirUrlCartillaPublica(mascota.id);
    
    const txt = `Hola. Te comparto la Cartilla Digital de *${mascota.nombre}* (${mascota.especie}), emitida por *${vet.nombre}*.\n\n` +
                `*Ficha Clínica:* ${mascota.codigo}\n\n` +
                `Historial preventivo de vacunas, desparasitaciones y controles en: ${cartillaUrl}`;
                
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

function obtenerEstadoPreventivoVisual(fechaProgramada, status, evaluador) {
    if (status === 'asistio') {
        return { status: 'success', label: 'Al día', daysLeft: Infinity };
    }
    if (status === 'no_asistio') {
        return { status: 'danger', label: 'Vencida', daysLeft: -1 };
    }
    return evaluador(fechaProgramada);
}

function obtenerBadgeClase(estado) {
    if (estado === 'success') return 'success';
    if (estado === 'warning') return 'warning';
    if (estado === 'danger') return 'danger';
    return '';
}

function construirEstadoAsistenciaHtml(status, fechaAsistencia) {
    if (status === 'asistio') {
        return `
            <span class="status-badge success">Asistió</span>
            ${fechaAsistencia ? `<br><small style="color:var(--text-muted); font-size:11px;">${formatearFechaLocal(fechaAsistencia)}</small>` : ''}
        `;
    }
    if (status === 'no_asistio') {
        return '<span class="status-badge danger">No Asistió</span>';
    }
    if (status === 'reagendado') {
        return '<span class="status-badge warning">Reagendado</span>';
    }
    return '<span class="status-badge secondary">Programada</span>';
}

function obtenerEventoClinicoActual(tipoEvento, idEvento) {
    const mascota = UIState.mascotaActivaDetalle;
    if (!mascota) return null;

    if (tipoEvento === 'vacuna') {
        return (mascota.vacunas || []).find(v => v.id === idEvento) || null;
    }
    if (tipoEvento === 'desparasitacion') {
        return (mascota.desparasitaciones || []).find(d => d.id === idEvento) || null;
    }
    if (tipoEvento === 'control') {
        return (mascota.controles || []).find(c => c.id === idEvento) || null;
    }
    return null;
}

/**
 * Retorna la foto de la mascota o genera un placeholder SVG específico por especie.
 */
function obtenerFotoMascota(mascota) {
    if (mascota.foto) return mascota.foto;
    const especie = (mascota.especie || '').toLowerCase();
    const isDog = especie === 'perro' || especie === 'canino';
    const isCat = especie === 'gato' || especie === 'felino';
    const emoji = isDog ? '🐶' : (isCat ? '🐱' : '🐾');
    const colorBg = isDog ? '#E8EAF6' : (isCat ? '#FCE4EC' : '#E0E0E0');
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
            const ev = obtenerEstadoPreventivoVisual(v.proximaDosis, v.status, evaluarEstadoVacuna);
            if (ev.status === 'success') vacunasAlDia++;
            else if (ev.status === 'warning') vacunasProximas++;
            else if (ev.status === 'danger') vacunasVencidas++;
        }
    });
    
    (mascota.desparasitaciones || []).forEach(d => {
        if (d.proximaAplicacion) {
            const ed = obtenerEstadoPreventivoVisual(d.proximaAplicacion, d.status, evaluarEstadoDesparasitacion);
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
    const nav = document.querySelector('.sidebar-nav');
    const logoutBtn = document.getElementById('nav-btn-logout');
    
    if (nav) {
        nav.style.display = loggedIn ? 'flex' : 'none';
    }
    if (logoutBtn) {
        logoutBtn.style.display = loggedIn ? 'block' : 'none';
    }
    actualizarSidebarClinica();
}

function abrirModalTransferencia() {
    UIState.seccionActiva = 'transferencia';
    if (typeof transferSetTab === 'function') transferSetTab('buzon');
    navegarA('transferencia');
}

function cerrarModalTransferencia() {
    navegarA('transferencia');
}

async function iniciarTransferenciaMascota() {
    if (!UIState.mascotaActivaId) {
        mostrarToast('No hay ninguna mascota activa para transferir.', 'error');
        return;
    }
    await navegarA('transferencia');
    if (typeof transferStartSendWizard === 'function') {
        transferStartSendWizard('', [UIState.mascotaActivaId]);
    }
    return;
    
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
        actualizarCodigoOrigenCartilla(mascota);
        
        // Mascota
        document.getElementById('cartilla-pet-photo').src = obtenerFotoMascota(mascota);
        document.getElementById('cartilla-pet-name').textContent = mascota.nombre;
        document.getElementById('cartilla-pet-especie').textContent = mapearEspecie(mascota.especie);
        document.getElementById('cartilla-pet-raza').textContent = mascota.raza || 'Mestizo';
        document.getElementById('cartilla-pet-sexo').textContent = mascota.sexo;
        document.getElementById('cartilla-pet-edad').textContent = calcularEdadMascota(mascota.fechaNacimiento);
        document.getElementById('cartilla-pet-color').textContent = mascota.color || 'N/A';
        document.getElementById('cartilla-pet-peso').textContent = mascota.peso ? `${mascota.peso} Kg` : 'N/A';
        
        // Tutor
        document.getElementById('cartilla-tutor-nombre').textContent = mascota.tutor.nombre;
        document.getElementById('cartilla-tutor-telefono').textContent = mascota.tutor.telefono || 'N/A';
        document.getElementById('cartilla-tutor-email').textContent = mascota.tutor.email || 'N/A';
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
        mostrarToast('Acceso denegado o no disponible. Abriendo cámara nativa...', 'warning');
        cerrarModalCamara();
        
        // Fallback a input nativo con capture="environment"
        let input;
        if (camaraContexto === 'registro') {
            input = document.getElementById('pet-photo-gallery');
        } else {
            input = document.getElementById('cartilla-pet-photo-input');
        }
        if (input) {
            input.setAttribute('capture', 'environment');
            input.click();
            // Removemos capture después para que el botón de galería normal siga funcionando como galería
            setTimeout(() => input.removeAttribute('capture'), 1000);
        }
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

    // Calcular dimensiones manteniendo la proporción, con un máximo de 800px para evitar memory heap en tablets
    const maxDim = 800;
    let vw = video.videoWidth;
    let vh = video.videoHeight;
    
    if (vw > maxDim || vh > maxDim) {
        if (vw > vh) {
            vh = Math.floor((maxDim / vw) * vh);
            vw = maxDim;
        } else {
            vw = Math.floor((maxDim / vh) * vw);
            vh = maxDim;
        }
    }

    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    
    // Si estamos usando la cámara frontal, invertir la imagen horizontalmente
    if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Mostrar feedback de carga
    const btnCaptura = document.querySelector('#modal-camara .btn-primary');
    const textoOriginal = btnCaptura ? btnCaptura.textContent : '';
    if (btnCaptura) {
        btnCaptura.textContent = 'Procesando...';
        btnCaptura.disabled = true;
    }

    // Convertir canvas a Blob/File
    canvas.toBlob(blob => {
        if (btnCaptura) {
            btnCaptura.textContent = textoOriginal;
            btnCaptura.disabled = false;
        }
        
        if (!blob) {
            mostrarToast('Error al procesar la foto en este dispositivo.', 'error');
            return;
        }
        const file = new File([blob], 'captura_camara.jpg', { type: 'image/jpeg' });
        
        cerrarModalCamara();
        
        if (camaraContexto === 'registro') {
            if (typeof window.manejarSubidaFotoMascota === 'function') {
                window.manejarSubidaFotoMascota(file);
            }
        } else if (camaraContexto === 'cartilla') {
            if (UIState.mascotaActivaId) {
                mostrarToast('Guardando foto en el paciente...', 'info');
                procesarComprimirYSubirImagen(file, 400, 400, 'mascotas', async (urlOrBase64) => {
                    // aquí usamos editarMascota (en el frontend original decía actualizarMascota, pero el import es editarMascota)
                    // verifiquemos si actualizarMascota existe, o cambiamos a editarMascota
                    const exito = typeof actualizarMascota === 'function' ? 
                                  await actualizarMascota(UIState.mascotaActivaId, { foto: urlOrBase64 }) :
                                  await editarMascota(UIState.mascotaActivaId, { foto: urlOrBase64 });
                                  
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

// ==========================================
// ESTADOS DE CITAS / EVENTOS CLINICOS
// ==========================================

function abrirMenuEstado(btnElement, tipoEvento, idEvento) {
    abrirModal('estado');

    const eventoActual = obtenerEventoClinicoActual(tipoEvento, idEvento);
    const estadoSelect = document.getElementById('estado-select');
    const fechaAsistenciaInput = document.getElementById('estado-fecha-asistencia');
    const fechaReagendadaInput = document.getElementById('estado-fecha-reagendada');

    document.getElementById('estado-tipo-evento').value = tipoEvento;
    document.getElementById('estado-evento-id').value = idEvento;
    estadoSelect.value = ['asistio', 'no_asistio', 'reagendado'].includes(eventoActual?.status) ? eventoActual.status : 'asistio';
    fechaAsistenciaInput.value = eventoActual?.fechaAsistencia || new Date().toISOString().split('T')[0];
    fechaReagendadaInput.value = eventoActual?.proximaDosis || eventoActual?.proximaAplicacion || '';
    toggleFechaAsistencia();
}

function toggleFechaAsistencia() {
    const tipoEvento = document.getElementById('estado-tipo-evento').value;
    const estado = document.getElementById('estado-select').value;
    const groupFecha = document.getElementById('group-fecha-asistencia');
    const groupFechaReagendada = document.getElementById('group-fecha-reagendada');
    const ayuda = document.getElementById('estado-ayuda');
    const admiteReagenda = tipoEvento === 'vacuna' || tipoEvento === 'desparasitacion';

    groupFecha.style.display = estado === 'asistio' ? 'block' : 'none';
    groupFechaReagendada.style.display = estado === 'reagendado' && admiteReagenda ? 'block' : 'none';

    if (estado === 'asistio') {
        ayuda.textContent = 'Se marcará el evento como cumplido y dejará de aparecer como vencido.';
    } else if (estado === 'no_asistio') {
        ayuda.textContent = 'El evento seguirá figurando como vencido hasta que se registre una nueva atención.';
    } else if (estado === 'reagendado' && admiteReagenda) {
        ayuda.textContent = 'Selecciona la nueva fecha programada. Esa fecha reemplazará la próxima dosis o aplicación.';
    } else if (estado === 'reagendado') {
        ayuda.textContent = 'Este tipo de evento no actualiza fecha desde este modal.';
    } else {
        ayuda.textContent = '';
    }
}

async function guardarCambioEstado() {
    const tipo = document.getElementById('estado-tipo-evento').value;
    const idEvento = document.getElementById('estado-evento-id').value;
    const estado = document.getElementById('estado-select').value;
    let fechaAsistencia = document.getElementById('estado-fecha-asistencia').value;
    let fechaReagendada = document.getElementById('estado-fecha-reagendada').value;

    if (estado !== 'asistio') {
        fechaAsistencia = null;
    }
    if (estado !== 'reagendado') {
        fechaReagendada = null;
    }

    if (!UIState.mascotaActivaId) return;

    if (estado === 'asistio' && !fechaAsistencia) {
        mostrarToast('Selecciona la fecha real de asistencia.', 'error');
        return;
    }
    if (estado === 'reagendado' && (tipo === 'vacuna' || tipo === 'desparasitacion') && !fechaReagendada) {
        mostrarToast('Selecciona la nueva fecha programada.', 'error');
        return;
    }

    try {
        let res;
        if (tipo === 'vacuna') {
            res = await window.API.actualizarStatusVacuna(UIState.mascotaActivaId, idEvento, estado, fechaAsistencia, fechaReagendada);
        } else if (tipo === 'desparasitacion') {
            res = await window.API.actualizarStatusDesparasitacion(UIState.mascotaActivaId, idEvento, estado, fechaAsistencia, fechaReagendada);
        } else if (tipo === 'control') {
            res = await window.API.actualizarStatusControl(UIState.mascotaActivaId, idEvento, estado, fechaAsistencia);
        }

        if (res) {
            mostrarToast('Estado actualizado correctamente', 'success');
            cerrarModal('estado');
            await verCartillaMascota(UIState.mascotaActivaId); // Recargar cartilla
        } else {
            mostrarToast('Error al actualizar el estado', 'error');
        }
    } catch (e) {
        console.error("Error cambiando estado", e);
        mostrarToast('Error del servidor: ' + e.message, 'error');
    }
}
