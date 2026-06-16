/**
 * CARTILLA DIGITAL - Catalogo de razas (razas.js)
 * Combobox rapido para seleccionar, buscar o escribir razas por especie.
 */

const RAZAS_BASE = {
    Canino: [
        'Mestizo',
        'Caramelo',
        'Labrador Retriever',
        'Golden Retriever',
        'Pastor Alemán',
        'Bulldog Francés',
        'Bulldog Inglés',
        'Poodle',
        'French Poodle',
        'Chihuahua',
        'Beagle',
        'Boxer',
        'Rottweiler',
        'Doberman',
        'Schnauzer',
        'Shih Tzu',
        'Yorkshire Terrier',
        'Dachshund',
        'Husky Siberiano',
        'Pitbull',
        'American Bully',
        'Cocker Spaniel',
        'Border Collie',
        'Dálmata',
        'Pug',
        'Akita Inu',
        'Chow Chow',
        'Samoyedo',
        'Gran Danés',
        'San Bernardo',
        'Cane Corso',
        'Pastor Belga Malinois',
        'Bichón Maltés'
    ],
    Felino: [
        'Mestizo',
        'Persa',
        'Siamés',
        'Maine Coon',
        'Bengalí',
        'Ragdoll',
        'Sphynx',
        'British Shorthair',
        'American Shorthair',
        'Azul Ruso',
        'Scottish Fold',
        'Angora Turco',
        'Bosque de Noruega',
        'Abisinio',
        'Birmano',
        'Devon Rex',
        'Cornish Rex',
        'Exótico de Pelo Corto',
        'Himalayo',
        'Manx',
        'Oriental Shorthair',
        'Savannah',
        'Somali',
        'Tonkinés',
        'Chartreux',
        'Europeo Común',
        'Balinés',
        'Siberiano',
        'Korat',
        'Bombay',
        'Burmés',
        'LaPerm'
    ]
};

const RAZAS_CACHE_CLINICA = {
    Canino: [],
    Felino: []
};

let razasClinicaCargadas = false;

function normalizarEspecieRazas(especie) {
    const valor = (especie || '').toLowerCase().trim();

    if (valor === 'perro' || valor === 'canino' || valor === 'p') return 'Canino';
    if (valor === 'gato' || valor === 'felino' || valor === 'g') return 'Felino';

    return especie === 'Canino' || especie === 'Felino' ? especie : '';
}

function normalizarNombreRaza(nombre) {
    return (nombre || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function formatearNombreRaza(nombre) {
    return (nombre || '').trim().replace(/\s+/g, ' ');
}

function mezclarRazasSinDuplicados(...listas) {
    const vistas = new Set();
    const resultado = [];

    listas.flat().forEach(raza => {
        const nombre = formatearNombreRaza(raza);
        const clave = normalizarNombreRaza(nombre);

        if (!nombre || vistas.has(clave)) return;

        vistas.add(clave);
        resultado.push(nombre);
    });

    return resultado;
}

function obtenerRazasPorEspecie(especie) {
    const especieNormalizada = normalizarEspecieRazas(especie);
    if (!especieNormalizada) return [];

    return mezclarRazasSinDuplicados(
        RAZAS_BASE[especieNormalizada] || [],
        RAZAS_CACHE_CLINICA[especieNormalizada] || []
    );
}

async function cargarRazasClinica() {
    if (razasClinicaCargadas || !window.API || !API.isLoggedIn()) return;

    try {
        const razas = await API.obtenerRazas();
        RAZAS_CACHE_CLINICA.Canino = [];
        RAZAS_CACHE_CLINICA.Felino = [];

        (Array.isArray(razas) ? razas : []).forEach(item => {
            const especie = normalizarEspecieRazas(item.especie);
            if (especie) RAZAS_CACHE_CLINICA[especie].push(item.nombre);
        });

        razasClinicaCargadas = true;
    } catch (err) {
        console.warn('No se pudieron cargar razas personalizadas:', err.message);
    }
}

function abrirListaRazas(combo) {
    combo.list.hidden = false;
    combo.input.setAttribute('aria-expanded', 'true');
}

function cerrarListaRazas(combo) {
    combo.list.hidden = true;
    combo.input.setAttribute('aria-expanded', 'false');
    combo.activeIndex = -1;
}

function obtenerOpcionesFiltradas(especie, query) {
    const busqueda = normalizarNombreRaza(query);
    const razas = obtenerRazasPorEspecie(especie);

    if (!busqueda) return razas;

    return razas.filter(raza => normalizarNombreRaza(raza).includes(busqueda));
}

function renderizarOpcionesRaza(combo) {
    const especie = combo.especieSelect.value;
    const query = combo.input.value;
    const opciones = obtenerOpcionesFiltradas(especie, query);
    const razaManual = formatearNombreRaza(query);
    const existeExacta = opciones.some(raza => normalizarNombreRaza(raza) === normalizarNombreRaza(razaManual));

    combo.list.innerHTML = '';

    if (!normalizarEspecieRazas(especie)) {
        combo.list.appendChild(crearOpcionRaza('Seleccione primero la especie', '', true));
        return;
    }

    opciones.forEach((raza, index) => {
        const option = crearOpcionRaza(raza, raza, false);
        option.id = `pet-raza-option-${index}`;
        combo.list.appendChild(option);
    });

    if (razaManual && !existeExacta) {
        const manual = crearOpcionRaza(`Usar "${razaManual}"`, razaManual, false);
        manual.classList.add('combo-option-manual');
        combo.list.appendChild(manual);
    }

    if (!opciones.length && !razaManual) {
        combo.list.appendChild(crearOpcionRaza('Escriba una raza nueva', '', true));
    }
}

function crearOpcionRaza(texto, valor, disabled) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'combo-option';
    option.textContent = texto;
    option.dataset.value = valor;
    option.setAttribute('role', 'option');
    option.disabled = Boolean(disabled);
    return option;
}

function seleccionarRaza(combo, valor) {
    combo.input.value = formatearNombreRaza(valor);
    cerrarListaRazas(combo);
}

function moverOpcionActiva(combo, direccion) {
    const opciones = Array.from(combo.list.querySelectorAll('.combo-option:not(:disabled)'));
    if (!opciones.length) return;

    combo.activeIndex = (combo.activeIndex + direccion + opciones.length) % opciones.length;
    opciones.forEach(option => option.classList.remove('active'));
    opciones[combo.activeIndex].classList.add('active');
    opciones[combo.activeIndex].scrollIntoView({ block: 'nearest' });
    combo.input.setAttribute('aria-activedescendant', opciones[combo.activeIndex].id || '');
}

function configurarSelectorRazaMascota(especie = '', razaActual = '') {
    const especieSelect = document.getElementById('pet-especie');
    const input = document.getElementById('pet-raza');
    const toggle = document.getElementById('pet-raza-toggle');
    const list = document.getElementById('pet-raza-options');

    if (!especieSelect || !input || !toggle || !list) return;

    const combo = {
        especieSelect,
        input,
        toggle,
        list,
        activeIndex: -1
    };

    if (especie) especieSelect.value = especie;
    input.value = formatearNombreRaza(razaActual);
    list.hidden = true;
    renderizarOpcionesRaza(combo);

    if (input.dataset.razaComboReady) return;

    input.addEventListener('focus', () => {
        renderizarOpcionesRaza(combo);
        abrirListaRazas(combo);
    });

    input.addEventListener('input', () => {
        renderizarOpcionesRaza(combo);
        abrirListaRazas(combo);
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            abrirListaRazas(combo);
            moverOpcionActiva(combo, 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moverOpcionActiva(combo, -1);
        } else if (event.key === 'Enter') {
            const activa = combo.list.querySelector('.combo-option.active');
            if (activa && !activa.disabled) {
                event.preventDefault();
                seleccionarRaza(combo, activa.dataset.value);
            }
        } else if (event.key === 'Escape') {
            cerrarListaRazas(combo);
        }
    });

    toggle.addEventListener('click', () => {
        renderizarOpcionesRaza(combo);
        if (list.hidden) {
            input.focus();
            abrirListaRazas(combo);
        } else {
            cerrarListaRazas(combo);
        }
    });

    list.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });

    list.addEventListener('click', (event) => {
        const option = event.target.closest('.combo-option');
        if (!option || option.disabled) return;
        seleccionarRaza(combo, option.dataset.value);
    });

    especieSelect.addEventListener('change', () => {
        input.value = '';
        renderizarOpcionesRaza(combo);
        cerrarListaRazas(combo);
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('#pet-raza-combo')) cerrarListaRazas(combo);
    });

    input.dataset.razaComboReady = 'true';
}

async function inicializarSelectorRazaMascota(especie = '', razaActual = '') {
    await cargarRazasClinica();
    configurarSelectorRazaMascota(especie, razaActual);
}

function razaExisteEnCatalogo(especie, raza) {
    const clave = normalizarNombreRaza(raza);
    return obtenerRazasPorEspecie(especie).some(item => normalizarNombreRaza(item) === clave);
}

async function guardarRazaClinicaSiEsNueva(especie, raza) {
    const especieNormalizada = normalizarEspecieRazas(especie);
    const nombre = formatearNombreRaza(raza);

    if (!especieNormalizada || !nombre || razaExisteEnCatalogo(especieNormalizada, nombre)) return;

    RAZAS_CACHE_CLINICA[especieNormalizada].push(nombre);

    if (!window.API || !API.isLoggedIn()) return;

    try {
        await API.guardarRaza({ especie: especieNormalizada, nombre });
        razasClinicaCargadas = false;
    } catch (err) {
        console.warn('No se pudo guardar la raza personalizada:', err.message);
    }
}
