/**
 * CARTILLA DIGITAL - Módulo de Procesamiento de Imágenes (fotos.js)
 * Contiene utilidades para redimensionar y comprimir fotos antes de almacenarlas.
 */

/**
 * Lee un archivo de imagen, lo escala para que no exceda las dimensiones máximas
 * manteniendo su relación de aspecto, y lo comprime a formato JPEG Base64.
 * 
 * @param {File} archivo - Archivo de imagen desde un input de tipo file.
 * @param {number} maxAncho - Ancho máximo en píxeles.
 * @param {number} maxAlto - Alto máximo en píxeles.
 * @param {function} callback - Función que se ejecuta al terminar, recibe el string Base64.
 */
function procesarYComprimirImagen(archivo, maxAncho, maxAlto, callback) {
    if (!archivo) return;
    
    // Validar tipo de archivo
    if (!archivo.type.startsWith('image/')) {
        console.error('El archivo no es una imagen válida.');
        return;
    }
    
    const lector = new FileReader();
    lector.onload = function(evento) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let anchoOriginal = img.width;
            let altoOriginal = img.height;
            let anchoFinal = anchoOriginal;
            let altoFinal = altoOriginal;
            
            // Lógica de escalado proporcional
            if (anchoOriginal > altoOriginal) {
                if (anchoOriginal > maxAncho) {
                    altoFinal = Math.round((altoOriginal * maxAncho) / anchoOriginal);
                    anchoFinal = maxAncho;
                }
            } else {
                if (altoOriginal > maxAlto) {
                    anchoFinal = Math.round((anchoOriginal * maxAlto) / altoOriginal);
                    altoFinal = maxAlto;
                }
            }
            
            canvas.width = anchoFinal;
            canvas.height = altoFinal;
            
            // Dibujar en el canvas
            ctx.drawImage(img, 0, 0, anchoFinal, altoFinal);
            
            // Convertir a JPEG con calidad al 75%
            const imagenBase64 = canvas.toDataURL('image/jpeg', 0.75);
            callback(imagenBase64);
        };
        img.src = evento.target.result;
    };
    lector.readAsDataURL(archivo);
}

/**
 * Procesa, comprime y sube una imagen al servidor, devolviendo la URL pública.
 * Si la subida falla o el usuario no está autenticado, devuelve el Base64 como fallback.
 * 
 * @param {File} archivo - Archivo de imagen desde un input de tipo file.
 * @param {number} maxAncho - Ancho máximo en píxeles.
 * @param {number} maxAlto - Alto máximo en píxeles.
 * @param {string} carpeta - Carpeta de destino en Storage ('logos', 'mascotas', 'general').
 * @param {function} callback - Función que se ejecuta al terminar, recibe la URL o Base64.
 */
function procesarComprimirYSubirImagen(archivo, maxAncho, maxAlto, carpeta, callback) {
    procesarYComprimirImagen(archivo, maxAncho, maxAlto, async (base64) => {
        // Intentar subir al servidor si el usuario está autenticado
        if (API.isLoggedIn()) {
            try {
                const res = await API.uploadImage(base64, carpeta);
                if (res && res.url) {
                    callback(res.url);
                    return;
                }
            } catch (err) {
                console.warn('No se pudo subir imagen a Storage, usando Base64:', err.message);
            }
        }
        // Fallback: devolver Base64
        callback(base64);
    });
}
