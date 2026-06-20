const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

function response(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return data;
        }
    };
}

const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', err => errors.push(err.message));

const dom = new JSDOM(html, {
    url: 'http://localhost:5500/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole
});

const context = dom.getInternalVMContext();
context.console = {
    ...console,
    error: (...args) => {
        errors.push(args.map(String).join(' '));
        console.error(...args);
    }
};
context.confirm = () => true;
context.alert = () => {};
context.QRCode = function QRCode() {};
context.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const href = String(url);

    if (href.endsWith('/mascotas') && method === 'GET') return response([]);
    if (href.endsWith('/equipo') && method === 'GET') return response([]);
    if (href.endsWith('/razas') && method === 'GET') return response([]);
    if (href.endsWith('/razas') && method === 'POST') return response({ id: 'raza-1', nombre: 'Criollo Especial', especie: 'Felino' }, 201);
    if (href.includes('/banco/') && method === 'GET') return response([]);
    if (href.endsWith('/veterinaria') && method === 'GET') {
        return response({ nombre: 'Clinica Test', iniciales: 'TST' });
    }

    return response({ mensaje: 'ok' });
};

context.window.console = context.console;
context.window.confirm = context.confirm;
context.window.alert = context.alert;
context.window.QRCode = context.QRCode;
context.window.fetch = context.fetch;
context.window.scrollTo = () => {};
context.window.addEventListener('error', event => errors.push(event.message));
context.window.addEventListener('unhandledrejection', event => {
    errors.push(event.reason && event.reason.message ? event.reason.message : String(event.reason));
});

const localScripts = Array.from(dom.window.document.querySelectorAll('script[src^="js/"]'))
    .map(script => new URL(script.getAttribute('src'), dom.window.location.href).pathname.replace(/^\//, ''));

for (const script of localScripts) {
    vm.runInContext(fs.readFileSync(script, 'utf8'), context, { filename: script });
}

(async () => {
    context.document.dispatchEvent(new context.window.Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    await new Promise(resolve => setTimeout(resolve, 25));

    assert.strictEqual(typeof context.window.API, 'object', 'window.API no fue publicado.');
    assert.strictEqual(context.window.API_BASE_URL, 'http://localhost:5500/api');
    assert(context.document.getElementById('pet-tutor-email'), 'Debe existir el campo Correo del Tutor.');
    assert(context.document.getElementById('vet-email'), 'Debe existir el campo Correo de Contacto de la veterinaria.');

    const loginSection = context.document.getElementById('section-login');
    assert(loginSection.classList.contains('active'), 'La pantalla de login no quedo activa sin sesion.');

    const envIndicator = context.document.getElementById('api-env-indicator');
    assert.strictEqual(envIndicator, null, 'El indicador de entorno no debe mostrarse en la interfaz principal.');

    const themeToggle = context.document.getElementById('theme-toggle');
    assert(themeToggle && themeToggle.classList.contains('theme-switch'), 'El cambio de tema debe estar en un switch visible.');
    assert(themeToggle.closest('[data-config-panel="tema"]'), 'El switch de tema debe vivir dentro de Configuraciones > Apariencia.');

    await context.window.prepararFormularioMascota();

    const especieSelect = context.document.getElementById('pet-especie');
    const razaInput = context.document.getElementById('pet-raza');
    const razaList = context.document.getElementById('pet-raza-options');

    assert(razaInput, 'No existe el campo combobox de raza.');
    assert(razaList, 'No existe la lista desplegable de razas.');
    assert.strictEqual(razaInput.getAttribute('role'), 'combobox', 'Raza debe ser un combobox.');

    razaInput.focus();
    const opcionesIniciales = Array.from(razaList.querySelectorAll('.combo-option')).map(option => option.textContent.trim());
    assert(opcionesIniciales.includes('Seleccione primero la especie'), 'Debe orientar cuando aun no hay especie.');

    especieSelect.value = 'Canino';
    especieSelect.dispatchEvent(new context.window.Event('change', { bubbles: true }));
    razaInput.focus();

    const opcionesCaninas = Array.from(razaList.querySelectorAll('.combo-option')).map(option => option.textContent.trim());
    assert(opcionesCaninas.length > 30, 'La lista de razas caninas debe tener mas de 30 opciones.');
    assert(opcionesCaninas.includes('Mestizo'), 'La lista canina debe incluir Mestizo.');
    assert(opcionesCaninas.includes('Caramelo'), 'La lista canina debe incluir Caramelo.');

    razaInput.value = 'cara';
    razaInput.dispatchEvent(new context.window.Event('input', { bubbles: true }));
    const opcionesFiltradas = Array.from(razaList.querySelectorAll('.combo-option')).map(option => option.textContent.trim());
    assert(opcionesFiltradas.includes('Caramelo'), 'La busqueda debe encontrar Caramelo.');
    razaList.querySelector('.combo-option[data-value="Caramelo"]').click();
    assert.strictEqual(razaInput.value, 'Caramelo', 'La raza seleccionada no se sincronizo al input real.');

    razaInput.value = 'Raza Nueva Test';
    razaInput.dispatchEvent(new context.window.Event('input', { bubbles: true }));
    const opcionManual = Array.from(razaList.querySelectorAll('.combo-option')).find(option => option.textContent.includes('Raza Nueva Test'));
    assert(opcionManual, 'Debe permitir usar una raza escrita manualmente.');

    await context.window.inicializarSelectorRazaMascota('Felino', 'Criollo Especial');
    razaInput.focus();
    assert.strictEqual(razaInput.value, 'Criollo Especial', 'La raza personalizada no se cargo en el campo manual.');

    razaInput.value = '';
    razaInput.dispatchEvent(new context.window.Event('input', { bubbles: true }));
    const opcionesFelinas = Array.from(razaList.querySelectorAll('.combo-option')).map(option => option.textContent.trim());
    assert(opcionesFelinas.length > 30, 'La lista de razas felinas debe tener mas de 30 opciones.');
    assert(opcionesFelinas.includes('Mestizo'), 'La lista felina debe incluir Mestizo.');
    assert(opcionesFelinas.includes('Persa'), 'La lista felina debe incluir Persa.');

    await context.window.guardarRazaClinicaSiEsNueva('Felino', 'Criollo Especial');
    await context.window.inicializarSelectorRazaMascota('Felino', '');
    razaInput.focus();
    const opcionesFelinasActualizadas = Array.from(razaList.querySelectorAll('.combo-option')).map(option => option.textContent.trim());
    assert(opcionesFelinasActualizadas.includes('Criollo Especial'), 'La raza nueva debe quedar disponible para la clinica.');

    if (errors.length) {
        throw new Error(`Errores de arranque UI: ${errors.join(' | ')}`);
    }

    console.log('UI flow smoke OK');
})();
