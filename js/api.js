/**
 * CARTILLA DIGITAL - Módulo de Comunicación con API (api.js)
 * Centraliza las llamadas HTTP (fetch) al backend Node.js + PostgreSQL.
 */

// Determinar la URL base del API de manera dinámica
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    
    // Si estamos en localhost, 127.0.0.1, o abriendo el archivo directamente (file://)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        return 'http://localhost:3000/api';
    }
    
    // Si accedemos por la red local (ej. 192.168.x.x o similar)
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
        return `http://${hostname}:3000/api`;
    }
    
    // Si hay una URL personalizada guardada en localStorage (muy útil para desarrollo en móvil/producción)
    const customApiUrl = localStorage.getItem('cartilla_digital_custom_api_url');
    if (customApiUrl) {
        return customApiUrl;
    }
    
    // URL por defecto en producción/GitHub Pages (cámbiala si subes tu backend a internet)
    return 'https://cartilla-digital.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();

// Actualizar indicador de entorno en la UI
window.addEventListener('DOMContentLoaded', () => {
    const envIndicator = document.getElementById('api-env-indicator');
    if (envIndicator) {
        envIndicator.style.display = 'inline-block';
        if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
            envIndicator.textContent = '🔌 Local';
            envIndicator.style.color = '#10b981'; // Verde
            envIndicator.style.borderColor = '#10b981';
        } else if (API_BASE_URL.includes('onrender.com')) {
            envIndicator.textContent = '☁️ Prod (Render)';
            envIndicator.style.color = '#3b82f6'; // Azul
            envIndicator.style.borderColor = '#3b82f6';
        } else {
            envIndicator.textContent = '🌐 Custom API';
            envIndicator.style.color = '#f59e0b'; // Naranja
            envIndicator.style.borderColor = '#f59e0b';
        }
    }
});

const API = {
    // --- SESIÓN Y TOKEN ---
    getToken() {
        return localStorage.getItem('cartilla_digital_token');
    },

    setToken(token) {
        if (token) {
            localStorage.setItem('cartilla_digital_token', token);
        } else {
            localStorage.removeItem('cartilla_digital_token');
        }
    },

    setSessionVet(vet) {
        if (vet) {
            localStorage.setItem('cartilla_digital_session_vet', JSON.stringify(vet));
        } else {
            localStorage.removeItem('cartilla_digital_session_vet');
        }
    },

    getSessionVet() {
        try {
            const data = localStorage.getItem('cartilla_digital_session_vet');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    logout() {
        this.setToken(null);
        this.setSessionVet(null);
        // Limpiar caché local si existiera
        localStorage.removeItem('cartilla_digital_veterinaria');
        localStorage.removeItem('cartilla_digital_mascotas');
    },

    // --- CABECERAS ---
    getHeaders(requireAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (requireAuth) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return headers;
    },

    // --- LLAMADAS BASE ---
    async handleResponse(response) {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            // Si el token es inválido/expirado, forzar deslogueo
            if (response.status === 401 || response.status === 403) {
                this.logout();
                window.location.reload();
            }
            throw new Error(data.error || 'Ocurrió un error en el servidor.');
        }
        return data;
    },

    // --- AUTENTICACIÓN ---
    async login(email, password) {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ email, password })
        });
        const data = await this.handleResponse(res);
        this.setToken(data.token);
        this.setSessionVet(data.veterinaria);
        return data;
    },

    async register(datos) {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    // --- PERFIL VETERINARIA ---
    async obtenerVeterinaria() {
        const res = await fetch(`${API_BASE_URL}/veterinaria`, {
            method: 'GET',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    async actualizarVeterinaria(datos) {
        const res = await fetch(`${API_BASE_URL}/veterinaria`, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        const data = await this.handleResponse(res);
        if (data.veterinaria) {
            this.setSessionVet(data.veterinaria);
        }
        return data;
    },

    // --- EQUIPO VETERINARIO ---
    async obtenerEquipo() {
        const res = await fetch(`${API_BASE_URL}/equipo`, {
            method: 'GET',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    async guardarResponsableEquipo(datos) {
        const res = await fetch(`${API_BASE_URL}/equipo`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async editarResponsableEquipo(id, datos) {
        const res = await fetch(`${API_BASE_URL}/equipo/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async eliminarResponsableEquipo(id) {
        const res = await fetch(`${API_BASE_URL}/equipo/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    // --- MASCOTAS ---
    async obtenerMascotas() {
        const res = await fetch(`${API_BASE_URL}/mascotas`, {
            method: 'GET',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    async registrarMascota(datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async obtenerMascotaDetalle(id) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${id}`, {
            method: 'GET',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    async editarMascota(id, datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async eliminarMascota(id) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    async obtenerRazas(especie = '') {
        const query = especie ? `?especie=${encodeURIComponent(especie)}` : '';
        const res = await fetch(`${API_BASE_URL}/razas${query}`, {
            method: 'GET',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    async guardarRaza(datos) {
        const res = await fetch(`${API_BASE_URL}/razas`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    // --- HISTORIAL CLÍNICO: VACUNAS ---
    async guardarVacuna(mascotaId, datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/vacunas`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async editarVacuna(mascotaId, vacunaId, datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/vacunas/${vacunaId}`, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async actualizarStatusVacuna(mascotaId, vacunaId, status, fechaAsistencia, proximaDosis) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/vacunas/${vacunaId}/status`, {
            method: 'PATCH',
            headers: this.getHeaders(true),
            body: JSON.stringify({ status, fechaAsistencia, proximaDosis })
        });
        return this.handleResponse(res);
    },

    async eliminarVacuna(mascotaId, vacunaId) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/vacunas/${vacunaId}`, {
            method: 'DELETE',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    // --- HISTORIAL CLÍNICO: DESPARASITACIONES ---
    async guardarDesparasitacion(mascotaId, datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/desparasitaciones`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async editarDesparasitacion(mascotaId, desparasitacionId, datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/desparasitaciones/${desparasitacionId}`, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async actualizarStatusDesparasitacion(mascotaId, desparasitacionId, status, fechaAsistencia, proximaAplicacion) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/desparasitaciones/${desparasitacionId}/status`, {
            method: 'PATCH',
            headers: this.getHeaders(true),
            body: JSON.stringify({ status, fechaAsistencia, proximaAplicacion })
        });
        return this.handleResponse(res);
    },

    async eliminarDesparasitacion(mascotaId, desparasitacionId) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/desparasitaciones/${desparasitacionId}`, {
            method: 'DELETE',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    // --- HISTORIAL CLÍNICO: CONTROLES ---
    async guardarControl(mascotaId, datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/controles`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async editarControl(mascotaId, controlId, datos) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/controles/${controlId}`, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(datos)
        });
        return this.handleResponse(res);
    },

    async actualizarStatusControl(mascotaId, controlId, status, fechaAsistencia) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/controles/${controlId}/status`, {
            method: 'PATCH',
            headers: this.getHeaders(true),
            body: JSON.stringify({ status, fechaAsistencia })
        });
        return this.handleResponse(res);
    },

    async eliminarControl(mascotaId, controlId) {
        const res = await fetch(`${API_BASE_URL}/mascotas/${mascotaId}/controles/${controlId}`, {
            method: 'DELETE',
            headers: this.getHeaders(true)
        });
        return this.handleResponse(res);
    },

    // --- BANCOS CLÍNICOS ---
    async obtenerBancoVacunas() {
        const res = await fetch(`${API_BASE_URL}/banco/vacunas`, { method: 'GET', headers: this.getHeaders(true) });
        return this.handleResponse(res);
    },
    async guardarBancoVacuna(datos) {
        const res = await fetch(`${API_BASE_URL}/banco/vacunas`, { method: 'POST', headers: this.getHeaders(true), body: JSON.stringify(datos) });
        return this.handleResponse(res);
    },
    async editarBancoVacuna(id, datos) {
        const res = await fetch(`${API_BASE_URL}/banco/vacunas/${id}`, { method: 'PUT', headers: this.getHeaders(true), body: JSON.stringify(datos) });
        return this.handleResponse(res);
    },
    async eliminarBancoVacuna(id) {
        const res = await fetch(`${API_BASE_URL}/banco/vacunas/${id}`, { method: 'DELETE', headers: this.getHeaders(true) });
        return this.handleResponse(res);
    },

    async obtenerBancoInternos() {
        const res = await fetch(`${API_BASE_URL}/banco/internos`, { method: 'GET', headers: this.getHeaders(true) });
        return this.handleResponse(res);
    },
    async guardarBancoInterno(datos) {
        const res = await fetch(`${API_BASE_URL}/banco/internos`, { method: 'POST', headers: this.getHeaders(true), body: JSON.stringify(datos) });
        return this.handleResponse(res);
    },
    async editarBancoInterno(id, datos) {
        const res = await fetch(`${API_BASE_URL}/banco/internos/${id}`, { method: 'PUT', headers: this.getHeaders(true), body: JSON.stringify(datos) });
        return this.handleResponse(res);
    },
    async eliminarBancoInterno(id) {
        const res = await fetch(`${API_BASE_URL}/banco/internos/${id}`, { method: 'DELETE', headers: this.getHeaders(true) });
        return this.handleResponse(res);
    },

    async obtenerBancoExternos() {
        const res = await fetch(`${API_BASE_URL}/banco/externos`, { method: 'GET', headers: this.getHeaders(true) });
        return this.handleResponse(res);
    },
    async guardarBancoExterno(datos) {
        const res = await fetch(`${API_BASE_URL}/banco/externos`, { method: 'POST', headers: this.getHeaders(true), body: JSON.stringify(datos) });
        return this.handleResponse(res);
    },
    async editarBancoExterno(id, datos) {
        const res = await fetch(`${API_BASE_URL}/banco/externos/${id}`, { method: 'PUT', headers: this.getHeaders(true), body: JSON.stringify(datos) });
        return this.handleResponse(res);
    },
    async eliminarBancoExterno(id) {
        const res = await fetch(`${API_BASE_URL}/banco/externos/${id}`, { method: 'DELETE', headers: this.getHeaders(true) });
        return this.handleResponse(res);
    },

    // --- TRANSFERENCIA DE PACIENTES ---
    async iniciarTransferencia(mascotaId) {
        const res = await fetch(`${API_BASE_URL}/transferencias/iniciar`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify({ mascotaId })
        });
        return this.handleResponse(res);
    },

    async completarTransferencia(codigo) {
        const res = await fetch(`${API_BASE_URL}/transferencias/completar`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify({ codigo })
        });
        return this.handleResponse(res);
    },

    // --- RECUPERACIÓN DE CONTRASEÑA ---
    async forgotPassword(email) {
        const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ email })
        });
        return this.handleResponse(res);
    },

    async resetPassword(token, newPassword) {
        const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ token, newPassword })
        });
        return this.handleResponse(res);
    },

    // --- SUBIDA DE IMÁGENES ---
    async uploadImage(base64String, carpeta) {
        const res = await fetch(`${API_BASE_URL}/upload-image`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify({ imagen: base64String, carpeta: carpeta || 'general' })
        });
        return this.handleResponse(res);
    },

    // --- RUTA PÚBLICA (QR) ---
    async obtenerMascotaPublica(id) {
        const res = await fetch(`${API_BASE_URL}/public/mascotas/${id}`, {
            method: 'GET',
            headers: this.getHeaders(false) // No requiere JWT
        });
        return this.handleResponse(res);
    }
};

// Los scripts antiguos y varios handlers inline usan window.API de forma explicita.
// Mantenerlo publicado evita fallos en Banco Clinico, camara, estados y fotos.
window.API = API;
window.API_BASE_URL = API_BASE_URL;
