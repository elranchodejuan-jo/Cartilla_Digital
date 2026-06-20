/**
 * CARTILLA DIGITAL - Punto de Entrada (app.js)
 * Coordina el enrutamiento inicial de la SPA, intercepta cambios y maneja formularios de autenticación.
 */

// Estado adicional para prevenir pérdida de datos
let formularioModificado = false;

function normalizarEmailFormulario(valor) {
    return (valor || '').trim().toLowerCase();
}

function esEmailValidoOpcional(valor) {
    const email = normalizarEmailFormulario(valor);
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function esSesionSuperAdmin() {
    const vet = API.getSessionVet ? API.getSessionVet() : null;
    return vet && vet.role === 'super_admin';
}

function debeAbrirAppClinica() {
    const params = new URLSearchParams(window.location.search);
    return params.get('clinic_app') === '1';
}

function abrirAdminCenter() {
    window.location.href = 'admin.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar eventos principales del DOM y filtros
    inicializarUI();
    
    // 2. Vincular controladores de eventos para formularios clínicos y configuración
    configurarManejadoresFormularios();
    
    // 3. Registrar interceptores de cambios no guardados
    configurarControlCambios();
    
    // 4. Enrutamiento inicial (Público vs Privado)
    verificarEnrutamiento();
});

/**
 * Intercepta la navegación para evitar salir de un formulario con cambios no guardados.
 */
function configurarControlCambios() {
    const inputsFormularios = document.querySelectorAll('#form-mascota input, #form-mascota textarea, #form-mascota select, #form-veterinaria input, #form-banco-vacuna input, #form-banco-interno input, #form-banco-externo input, #form-desparasitacion-interna input, #form-control-externo input');
    
    inputsFormularios.forEach(input => {
        input.addEventListener('input', () => {
            formularioModificado = true;
        });
        input.addEventListener('change', () => {
            formularioModificado = true;
        });
    });

    // Interceptar clics de navegación
    DOM.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (formularioModificado) {
                const confirmar = confirm("Tiene cambios sin guardar en el formulario. ¿Está seguro de que desea salir?");
                if (!confirmar) {
                    // Detener cambio de sección y mantener activa la pestaña actual
                    e.stopImmediatePropagation();
                    // Restaurar clase active al botón correspondiente a la sección actual
                    DOM.navButtons.forEach(b => {
                        if (b.dataset.section === UIState.seccionActiva) {
                            b.classList.add('active');
                        } else {
                            b.classList.remove('active');
                        }
                    });
                } else {
                    formularioModificado = false;
                }
            }
        });
    });
}

/**
 * Valida la URL buscando parámetros de visualización pública.
 */
async function verificarEnrutamiento() {
    const urlParams = new URLSearchParams(window.location.search);
    const petId = urlParams.get('id');
    
    // Verificar si hay un token de recuperación de contraseña en la URL
    const resetToken = urlParams.get('reset_token');
    if (resetToken) {
        configurarModoPublico(false);
        navegarA('resetPassword');
        const tokenInput = document.getElementById('reset-token');
        if (tokenInput) tokenInput.value = resetToken;
        return;
    }
    
    if (petId) {
        try {
            // Activar Modo Público (oculta admin header y botones clínicos)
            configurarModoPublico(true);
            
            // Cargar cartilla pública sin requerir autenticación
            await verCartillaMascotaPublica(petId);
            return;
        } catch (err) {
            mostrarToast('La ficha digital solicitada no existe, fue dada de baja o no se pudo cargar.', 'error');
            // Redirigir a login público si falla
            configurarModoPublico(false);
            navegarA('login');
        }
        return;
    }
    
    // Ruta ordinaria de administración (Privada)
    configurarModoPublico(false);
    
    const loggedIn = API.isLoggedIn();
    actualizarUIConEstadoAuth(loggedIn);
    
    if (!loggedIn) {
        navegarA('login');
    } else if (esSesionSuperAdmin() && !debeAbrirAppClinica()) {
        abrirAdminCenter();
    } else {
        await cargarEquipoVeterinario();
        navegarA('inicio');
    }
}

/**
 * Configura los eventos submit de todos los formularios clínicos del sistema.
 */
function configurarManejadoresFormularios() {
    // Formulario de Iniciar Sesión (Login)
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                mostrarToast('Por favor ingresa correo y contraseña.', 'error');
                return;
            }
            
            try {
                mostrarToast('Iniciando sesión...', 'info');
                await API.login(email, password);
                mostrarToast('¡Inicio de sesión correcto!', 'success');
                formularioModificado = false;
                
                // Actualizar visualización del botón Salir e ir a inicio
                const logoutBtn = document.getElementById('nav-btn-logout');
                if (logoutBtn) logoutBtn.style.display = 'block';
                
                // Cargar datos en interfaz y navegar
                verificarEnrutamiento();
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }

    // Formulario de Registro de Clínica Veterinaria
    const formRegistroClinica = document.getElementById('form-registro-clinica');
    if (formRegistroClinica) {
        // Subida de imagen para registro
        const regLogoInput = document.getElementById('reg-logo-file');
        const regLogoPreview = document.getElementById('reg-logo-preview');
        if (regLogoInput) {
            regLogoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    procesarYComprimirImagen(file, 250, 250, (base64) => {
                        UIState.logoBase64 = base64;
                        if (regLogoPreview) {
                            regLogoPreview.src = base64;
                            regLogoPreview.style.display = 'block';
                        }
                    });
                }
            });
        }

        formRegistroClinica.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('reg-nombre').value.trim();
            const propietario = document.getElementById('reg-propietario').value.trim();
            const iniciales = document.getElementById('reg-iniciales').value.trim().toUpperCase();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const telefono = document.getElementById('reg-telefono').value.trim();
            const direccion = document.getElementById('reg-direccion').value.trim();
            
            if (!nombre || !propietario || !iniciales || !email || !password) {
                mostrarToast('El nombre, propietario, iniciales, correo y contraseña son obligatorios.', 'error');
                return;
            }
            
            if (iniciales.length < 2 || iniciales.length > 5) {
                mostrarToast('Las iniciales deben tener entre 2 y 5 caracteres.', 'error');
                return;
            }
            
            const datos = {
                nombre,
                propietario,
                iniciales,
                email,
                password,
                telefono,
                direccion,
                logo: UIState.logoBase64
            };
            
            try {
                mostrarToast('Registrando clínica...', 'info');
                await API.register(datos);
                mostrarToast('Clínica registrada. Iniciando sesión...', 'success');
                
                // Login automático post-registro
                await API.login(email, password);
                formularioModificado = false;
                
                const logoutBtn = document.getElementById('nav-btn-logout');
                if (logoutBtn) logoutBtn.style.display = 'block';
                
                verificarEnrutamiento();
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }

    // Formulario de Configuración Veterinaria (Editar Perfil)
    if (DOM.formVeterinaria) {
        DOM.formVeterinaria.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('vet-nombre').value.trim();
            const propietario = document.getElementById('vet-propietario').value.trim();
            const telefono = document.getElementById('vet-telefono').value.trim();
            const email = normalizarEmailFormulario(document.getElementById('vet-email')?.value || '');
            const direccion = document.getElementById('vet-direccion').value.trim();
            
            if (!nombre) {
                mostrarToast('El nombre de la veterinaria es requerido.', 'error');
                return;
            }

            if (!propietario) {
                mostrarToast('El nombre del propietario es requerido.', 'error');
                return;
            }

            if (!email || !esEmailValidoOpcional(email)) {
                mostrarToast('Ingresa un correo de contacto vÃ¡lido.', 'error');
                return;
            }
            
            const datos = {
                nombre,
                propietario,
                email,
                telefono,
                direccion,
                logo: UIState.logoBase64
            };
            
            try {
                mostrarToast('Actualizando configuración...', 'info');
                const res = await guardarVeterinaria(datos);
                if (res) {
                    if (typeof actualizarSidebarClinica === 'function') {
                        actualizarSidebarClinica();
                    }
                    if (typeof cargarEquipoVeterinario === 'function') {
                        await cargarEquipoVeterinario();
                    }
                    formularioModificado = false;
                    mostrarToast('Configuración guardada correctamente.', 'success');
                    navegarA('inicio');
                } else {
                    mostrarToast('Error al guardar datos clínicos.', 'error');
                }
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }
    
    // Formulario de Paciente (Mascotas)
    if (DOM.formMascota) {
        DOM.formMascota.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('pet-nombre').value.trim();
            const especie = document.getElementById('pet-especie').value;
            const raza = document.getElementById('pet-raza').value.trim();
            const sexo = document.getElementById('pet-sexo').value;
            const fechaNacimiento = document.getElementById('pet-nacimiento').value;
            const color = document.getElementById('pet-color').value.trim();
            const peso = document.getElementById('pet-peso').value.trim();
            const esterilizado = document.getElementById('pet-esterilizado')?.value === 'true';
            const tutorNombre = document.getElementById('pet-tutor').value.trim();
            const tutorTel = document.getElementById('pet-tutor-tel').value.trim();
            const tutorEmail = normalizarEmailFormulario(document.getElementById('pet-tutor-email')?.value || '');
            const tutorDir = document.getElementById('pet-tutor-dir').value.trim();
            const observaciones = document.getElementById('pet-obs').value.trim();

            if (!esEmailValidoOpcional(tutorEmail)) {
                mostrarToast('Ingresa un correo vÃ¡lido o deja el campo vacÃ­o.', 'error');
                return;
            }
            
            const datosMascota = {
                nombre,
                especie,
                raza,
                sexo,
                fechaNacimiento,
                color,
                peso: peso ? parseFloat(peso) : '',
                esterilizado,
                foto: UIState.fotoMascotaBase64,
                tutor: {
                    nombre: tutorNombre,
                    telefono: tutorTel,
                    email: tutorEmail,
                    direccion: tutorDir
                },
                observaciones
            };
            
            try {
                if (UIState.mascotaEdicionId) {
                    mostrarToast('Actualizando paciente...', 'info');
                    const exito = await editarMascota(UIState.mascotaEdicionId, datosMascota);
                    if (exito) {
                        await guardarRazaClinicaSiEsNueva(especie, raza);
                        formularioModificado = false;
                        UIState.mascotaEdicionId = null; // Limpiar el estado de edición
                        mostrarToast('Paciente actualizado correctamente.', 'success');
                        navegarA('pacientes');
                    } else {
                        mostrarToast('No se pudo guardar la edición.', 'error');
                    }
                } else {
                    mostrarToast('Registrando paciente...', 'info');
                    const mascotaNueva = await registrarMascota(datosMascota);
                    if (mascotaNueva) {
                        await guardarRazaClinicaSiEsNueva(especie, raza);
                        formularioModificado = false;
                        mostrarToast(`Mascota registrada: ${mascotaNueva.codigo}`, 'success');
                        navegarA('pacientes');
                    } else {
                        mostrarToast('Error al dar de alta el expediente.', 'error');
                    }
                }
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }
    
    // Formulario de Vacunas (Modal)
    if (DOM.formVacuna) {
        DOM.formVacuna.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('vac-id') ? document.getElementById('vac-id').value : '';
            const nombre = document.getElementById('vac-nombre').value.trim();
            const enfermedades = document.getElementById('vac-enfermedades').value.trim();
            const laboratorio = document.getElementById('vac-laboratorio').value.trim();
            const fechaAplicacion = document.getElementById('vac-fecha').value;
            const proximaDosis = document.getElementById('vac-proxima').value;
            const lote = document.getElementById('vac-lote').value.trim();
            const responsableEl = document.getElementById('vac-responsable');
            const responsableId = responsableEl.value;
            const responsable = responsableEl.options[responsableEl.selectedIndex]?.text.replace(' (Inactivo)', '') || '';
            const observaciones = document.getElementById('vac-obs').value.trim();
            
            const datos = { nombre, enfermedades, laboratorio, fechaAplicacion, proximaDosis, lote, responsable, responsableId, observaciones };
            
            try {
                let exito = false;
                if (id) {
                    exito = await actualizarVacunaMascota(UIState.mascotaActivaId, id, datos);
                } else {
                    exito = await registrarVacunaMascota(UIState.mascotaActivaId, datos);
                }
                
                if (exito) {
                    mostrarToast(id ? 'Vacuna actualizada correctamente.' : 'Vacuna agregada correctamente.', 'success');
                    cerrarModal('vacuna');
                    await verCartillaMascota(UIState.mascotaActivaId);
                } else {
                    mostrarToast('Error al guardar la vacuna.', 'error');
                }
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }
    
    // Formulario de Desparasitación Interna (Modal)
    if (DOM.formDesparasitacionInterna) {
        DOM.formDesparasitacionInterna.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('des-int-id') ? document.getElementById('des-int-id').value : '';
            const producto = document.getElementById('des-int-producto').value.trim();
            const fechaAplicacion = document.getElementById('des-int-fecha').value;
            const proximaAplicacion = document.getElementById('des-int-proxima').value;
            const dosis = document.getElementById('des-int-dosis').value.trim();
            const via = document.getElementById('des-int-via').value;
            const responsableEl = document.getElementById('des-int-responsable');
            const responsableId = responsableEl.value;
            const responsable = responsableEl.options[responsableEl.selectedIndex]?.text.replace(' (Inactivo)', '') || '';
            const observaciones = document.getElementById('des-int-obs').value.trim();
            
            const datos = {
                tipo: 'interna',
                producto,
                fechaAplicacion,
                proximaAplicacion,
                dosis,
                via,
                responsable,
                responsableId,
                observaciones
            };
            
            try {
                let exito = false;
                if (id) {
                    exito = await actualizarDesparasitacionMascota(UIState.mascotaActivaId, id, datos);
                } else {
                    exito = await registrarDesparasitacionMascota(UIState.mascotaActivaId, datos);
                }
                
                if (exito) {
                    mostrarToast(id ? 'Desparasitación interna actualizada.' : 'Desparasitación interna registrada.', 'success');
                    cerrarModal('desparasitacion-interna');
                    await verCartillaMascota(UIState.mascotaActivaId);
                } else {
                    mostrarToast('Error al guardar desparasitación interna.', 'error');
                }
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }

    // Formulario de Control Antiparasitario Externo (Modal)
    if (DOM.formControlExterno) {
        DOM.formControlExterno.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('des-ext-id') ? document.getElementById('des-ext-id').value : '';
            const producto = document.getElementById('des-ext-producto').value.trim();
            const tipoProducto = document.getElementById('des-ext-tipo').value;
            const rangoPeso = document.getElementById('des-ext-peso').value.trim();
            const fechaAplicacion = document.getElementById('des-ext-fecha').value;
            const proximaAplicacion = document.getElementById('des-ext-proxima').value;
            const parasitosCubre = document.getElementById('des-ext-parasitos').value.trim();
            const responsableEl = document.getElementById('des-ext-responsable');
            const responsableId = responsableEl.value;
            const responsable = responsableEl.options[responsableEl.selectedIndex]?.text.replace(' (Inactivo)', '') || '';
            const observaciones = document.getElementById('des-ext-obs').value.trim();
            
            const datos = {
                tipo: 'externa',
                producto,
                tipoProducto,
                rangoPeso,
                fechaAplicacion,
                proximaAplicacion,
                parasitosCubre,
                responsable,
                responsableId,
                observaciones
            };
            
            try {
                let exito = false;
                if (id) {
                    exito = await actualizarDesparasitacionMascota(UIState.mascotaActivaId, id, datos);
                } else {
                    exito = await registrarDesparasitacionMascota(UIState.mascotaActivaId, datos);
                }
                
                if (exito) {
                    mostrarToast(id ? 'Control externo actualizado.' : 'Control externo registrado.', 'success');
                    cerrarModal('control-externo');
                    await verCartillaMascota(UIState.mascotaActivaId);
                } else {
                    mostrarToast('Error al guardar control externo.', 'error');
                }
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }
    
    // Formulario de Controles Clínicos (Modal)
    if (DOM.formControl) {
        DOM.formControl.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('ctrl-id') ? document.getElementById('ctrl-id').value : '';
            const fecha = document.getElementById('ctrl-fecha').value;
            const motivo = document.getElementById('ctrl-motivo').value.trim();
            const peso = document.getElementById('ctrl-peso').value.trim();
            const temperatura = document.getElementById('ctrl-temp').value.trim();
            const fc = document.getElementById('ctrl-fc').value.trim();
            const fr = document.getElementById('ctrl-fr').value.trim();
            const hallazgos = document.getElementById('ctrl-hallazgos').value.trim();
            const diagnostico = document.getElementById('ctrl-diag').value.trim();
            const tratamiento = document.getElementById('ctrl-tratamiento').value.trim();
            const recomendaciones = document.getElementById('ctrl-rec').value.trim();
            const proximoControl = document.getElementById('ctrl-proximo').value;
            const responsableEl = document.getElementById('ctrl-responsable');
            const responsableId = responsableEl.value;
            const responsable = responsableEl.options[responsableEl.selectedIndex]?.text.replace(' (Inactivo)', '') || '';
            
            const datos = {
                fecha,
                motivo,
                peso: peso ? parseFloat(peso) : '',
                temperatura: temperatura ? parseFloat(temperatura) : '',
                fc: fc ? parseInt(fc) : '',
                fr: fr ? parseInt(fr) : '',
                hallazgos,
                diagnostico,
                tratamiento,
                recomendaciones,
                proximoControl,
                responsable,
                responsableId
            };
            
            try {
                let exito = false;
                if (id) {
                    exito = await actualizarControlMascota(UIState.mascotaActivaId, id, datos);
                } else {
                    exito = await registrarControlMascota(UIState.mascotaActivaId, datos);
                }
                
                if (exito) {
                    mostrarToast(id ? 'Control preventivo actualizado.' : 'Control preventivo registrado.', 'success');
                    cerrarModal('control');
                    await verCartillaMascota(UIState.mascotaActivaId);
                } else {
                    mostrarToast('Error al guardar control.', 'error');
                }
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }

    // Formulario de Observaciones Generales (Modal)
    const formObs = document.getElementById('form-observaciones');
    if (formObs) {
        formObs.addEventListener('submit', async (e) => {
            e.preventDefault();
            const texto = document.getElementById('obs-generales-text').value.trim();
            try {
                const exito = await guardarObservacionesMascota(UIState.mascotaActivaId, texto);
                if (exito) {
                    mostrarToast('Notas y observaciones generales actualizadas.', 'success');
                    cerrarModal('observaciones');
                    await verCartillaMascota(UIState.mascotaActivaId);
                } else {
                    mostrarToast('Error al guardar observaciones.', 'error');
                }
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }

    // Formulario de Recibir Transferencia
    const formTxRecibir = document.getElementById('form-transferencia-recibir');
    if (formTxRecibir) {
        formTxRecibir.addEventListener('submit', async (e) => {
            e.preventDefault();
            mostrarToast('La recepcion por codigo fue reemplazada por el Buzon de Transferencia.', 'info');
            cerrarModal('transferencia-recibir');
            if (typeof transferSetTab === 'function') transferSetTab('buzon');
            navegarA('transferencia');
            return;
            const codigo = document.getElementById('tx-codigo-input').value.trim();
            
            if (!codigo) {
                mostrarToast('Ingresa un código de transferencia.', 'error');
                return;
            }
            
            try {
                mostrarToast('Verificando código y transfiriendo...', 'info');
                const res = await API.completarTransferencia(codigo);
                mostrarToast(res.mensaje, 'success');
                cerrarModal('transferencia-recibir');
                
                // Recargar listado
                navegarA('pacientes');
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }

    // Formulario de Olvidé mi Contraseña
    const formForgot = document.getElementById('form-forgot-password');
    if (formForgot) {
        formForgot.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();
            
            if (!email) {
                mostrarToast('Ingresa tu correo electrónico.', 'error');
                return;
            }
            
            try {
                mostrarToast('Enviando enlace de recuperación...', 'info');
                const res = await API.forgotPassword(email);
                mostrarToast(res.mensaje || 'Si el correo está registrado, recibirás un enlace de recuperación.', 'success');
                document.getElementById('forgot-email').value = '';
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }

    // Formulario de Restablecer Contraseña
    const formReset = document.getElementById('form-reset-password');
    if (formReset) {
        formReset.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('reset-token').value;
            const newPassword = document.getElementById('reset-new-password').value;
            const confirmPassword = document.getElementById('reset-confirm-password').value;
            
            if (!newPassword || !confirmPassword) {
                mostrarToast('Completa ambos campos de contraseña.', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                mostrarToast('Las contraseñas no coinciden.', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                mostrarToast('La contraseña debe tener al menos 6 caracteres.', 'error');
                return;
            }
            
            try {
                mostrarToast('Restableciendo contraseña...', 'info');
                const res = await API.resetPassword(token, newPassword);
                mostrarToast(res.mensaje || '¡Contraseña actualizada! Ya puedes iniciar sesión.', 'success');
                
                // Limpiar el token de la URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Redirigir al login después de 2 segundos
                setTimeout(() => { navegarA('login'); }, 2000);
            } catch (err) {
                mostrarToast(err.message, 'error');
            }
        });
    }
}

/**
 * Cierra sesión y redirige al panel de ingreso.
 */
function cerrarSesionClinica() {
    API.logout();
    mostrarToast('Sesión cerrada correctamente.', 'info');
    const logoutBtn = document.getElementById('nav-btn-logout');
    if (logoutBtn) logoutBtn.style.display = 'none';
    actualizarUIConEstadoAuth(false);
    navegarA('login');
}

/**
 * Mostrar/Ocultar contraseña
 */
window.togglePassword = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
            btn.setAttribute('aria-label', 'Ocultar contraseña');
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
            btn.setAttribute('aria-label', 'Mostrar contraseña');
        }
    }
};
