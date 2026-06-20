const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

function response(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return data;
        }
    };
}

const dom = new JSDOM('<!doctype html><div id="api-env-indicator"></div>', {
    url: 'http://localhost:5500/'
});

const calls = [];
const context = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    console,
    crypto: {
        randomUUID: () => '00000000-0000-4000-8000-000000000001'
    },
    fetch: async (url, options = {}) => {
        const method = options.method || 'GET';
        calls.push({ url: String(url), method, body: options.body || null });

        if (String(url).endsWith('/mascotas') && method === 'GET') {
            return response([
                {
                    id: 'pet-1',
                    codigo: 'CD-TST-001',
                    nombre: 'Rocco',
                    especie: 'Perro',
                    fechaNacimiento: '2020-01-01',
                    tutor: { nombre: 'Juan' },
                    tutor_email: 'juan@example.com',
                    vacunas: [
                        {
                            id: 'vac-1',
                            nombre: 'Rabia',
                            fecha_aplicacion: '2026-01-01',
                            proxima_dosis: '2027-01-01',
                            responsable_id: 'vet-1',
                            status: 'aplicada',
                            fecha_asistencia: '2026-01-01'
                        }
                    ],
                    desparasitaciones: [
                        {
                            id: 'des-1',
                            nombre: 'Bravecto',
                            tipo_producto: 'Tableta',
                            rango_peso: '10-20 kg',
                            parasitos_cubre: 'Pulgas',
                            fecha_aplicacion: '2026-02-01',
                            proxima_aplicacion: '2026-05-01'
                        }
                    ],
                    controles: [
                        {
                            id: 'ctrl-1',
                            motivo: 'Chequeo',
                            proximo_control: '2026-08-01',
                            responsable_id: 'vet-1'
                        }
                    ]
                }
            ]);
        }

        if (String(url).endsWith('/mascotas') && method === 'POST') {
            return response({ id: 'pet-2', codigo: 'CD-TST-002', nombre: 'Luna' });
        }

        if (String(url).includes('/mascotas/pet-1/vacunas') && method === 'POST') {
            return response({ id: 'vac-2', mensaje: 'ok' });
        }

        return response({ mensaje: 'ok' });
    }
});

context.window.fetch = context.fetch;
context.window.console = console;
context.window.crypto = context.crypto;

[
    'js/api.js',
    'js/storage.js',
    'js/codigo.js',
    'js/mascotas.js',
    'js/vacunas.js'
].forEach(file => {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});

(async () => {
    await vm.runInContext(`
        (async () => {
            API.setToken('test-token');

            const mascotas = await obtenerMascotas();
            if (mascotas.length !== 1) throw new Error('No se saneo la mascota mock.');

            const pet = mascotas[0];
            if (pet.tutor.email !== 'juan@example.com') throw new Error('No se mapeo tutor_email.');
            if (pet.vacunas[0].fechaAplicacion !== '2026-01-01') throw new Error('No se mapeo fecha_aplicacion.');
            if (pet.vacunas[0].responsableId !== 'vet-1') throw new Error('No se preservo responsable_id.');
            if (pet.desparasitaciones[0].tipoProducto !== 'Tableta') throw new Error('No se mapeo tipo_producto.');
            if (pet.controles[0].proximoControl !== '2026-08-01') throw new Error('No se mapeo proximo_control.');

            const nueva = await registrarMascota({
                nombre: 'Luna',
                especie: 'Gato',
                fechaNacimiento: '2021-04-12',
                tutor: { nombre: 'Maria', email: 'maria@example.com' },
                peso: 4.2
            });
            if (!nueva || nueva.codigo !== 'CD-TST-002') throw new Error('No se registro mascota mock.');

            const guardada = await registrarVacunaMascota('pet-1', {
                nombre: 'Rabia',
                fechaAplicacion: '2026-01-01',
                proximaDosis: '2027-01-01',
                responsable: 'Dra. Test'
            });
            if (guardada !== true) throw new Error('No se guardo vacuna mock.');
        })()
    `, context);

    const vacunaCall = calls.find(call => call.url.includes('/mascotas/pet-1/vacunas'));
    assert(vacunaCall, 'No se llamo el endpoint de vacunas.');
    assert.strictEqual(JSON.parse(vacunaCall.body).responsable, 'Dra. Test');
    const mascotaCall = calls.find(call => call.url.endsWith('/mascotas') && call.method === 'POST');
    assert(mascotaCall, 'No se llamo el endpoint de mascotas.');
    assert.strictEqual(JSON.parse(mascotaCall.body).tutor.email, 'maria@example.com');

    console.log('Storage smoke OK');
})();
