/**
 * CARTILLA DIGITAL - Catálogo de Razas (razas.js)
 * Contiene listados estáticos de razas recomendadas para autocompletado interactivo.
 */

const RAZAS_SUGERIDAS = {
    Perro: [
        'Mestizo',
        'Labrador Retriever',
        'Golden Retriever',
        'Pastor Alemán',
        'Bulldog Francés',
        'Bulldog Inglés',
        'Poodle',
        'Chihuahua',
        'Schnauzer',
        'Beagle',
        'Rottweiler',
        'Pitbull',
        'Husky Siberiano',
        'Shih Tzu',
        'Yorkshire Terrier',
        'Dachshund',
        'Boxer',
        'Border Collie',
        'Cocker Spaniel',
        'Dálmata'
    ],
    Gato: [
        'Mestizo',
        'Persa',
        'Siamés',
        'Maine Coon',
        'Bengalí',
        'Sphynx',
        'Angora',
        'British Shorthair',
        'Scottish Fold',
        'Ragdoll',
        'Azul Ruso',
        'Abisinio',
        'Europeo común'
    ]
};

/**
 * Actualiza dinámicamente las opciones del datalist según la especie.
 * @param {string} especie - Especie ('Perro' o 'Gato')
 * @param {HTMLDataListElement} datalistElement - Elemento datalist en el DOM
 */
function actualizarDatalistRazas(especie, datalistElement) {
    if (!datalistElement) return;
    
    datalistElement.innerHTML = '';
    
    const razas = RAZAS_SUGERIDAS[especie] || [];
    
    razas.forEach(raza => {
        const option = document.createElement('option');
        option.value = raza;
        datalistElement.appendChild(option);
    });
}
