(function() {
    const state = {
        view: 'dashboard',
        me: null,
        data: {},
        query: '',
        filter: 'todos'
    };

    const titles = {
        dashboard: 'Dashboard',
        clinics: 'Clinicas',
        patients: 'Pacientes globales',
        tutors: 'Tutores',
        plans: 'Planes',
        payments: 'Pagos',
        usage: 'Metricas de uso',
        trials: 'Pruebas gratis',
        feedback: 'Comentarios / Reportes',
        support: 'Soporte tecnico',
        activity: 'Actividad del sistema',
        alerts: 'Alertas',
        settings: 'Configuracion global',
        internal: 'Usuarios internos',
        security: 'Seguridad'
    };

    document.addEventListener('DOMContentLoaded', initAdmin);

    async function initAdmin() {
        applyStoredTheme();
        bindShellEvents();

        if (!API.isLoggedIn()) {
            showBlocked('Debes iniciar sesion para acceder al Centro de Control.', 'Ir al login', 'index.html');
            return;
        }

        try {
            const me = await AdminService.getMe();
            state.me = me.user;
            renderUserbar();
            hideStatus();
            await navigate('dashboard');
        } catch (err) {
            if (err.status === 403) {
                showBlocked('No tienes permiso para acceder al Centro de Control.', 'Volver a Cartilla Digital', 'index.html?clinic_app=1');
            } else {
                showBlocked(err.message || 'No se pudo abrir el Centro de Control.', 'Reintentar', 'admin.html');
            }
        }
    }

    function bindShellEvents() {
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => navigate(btn.dataset.view));
        });

        const menu = document.getElementById('admin-menu');
        const backdrop = document.getElementById('admin-backdrop');
        if (menu) {
            menu.addEventListener('click', () => {
                const open = !document.body.classList.contains('admin-sidebar-open');
                document.body.classList.toggle('admin-sidebar-open', open);
                menu.setAttribute('aria-expanded', String(open));
            });
        }
        if (backdrop) {
            backdrop.addEventListener('click', closeSidebar);
        }

        const logout = document.getElementById('admin-logout');
        if (logout) {
            logout.addEventListener('click', () => {
                API.logout();
                window.location.href = 'index.html';
            });
        }

        const theme = document.getElementById('admin-theme');
        if (theme) {
            theme.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
                localStorage.setItem('cartilla_digital_theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
                syncThemeButton();
            });
        }

        document.addEventListener('click', handleActions);
        document.addEventListener('change', handleChanges);
        window.addEventListener('resize', () => {
            if (window.innerWidth > 860) closeSidebar();
        });
    }

    function applyStoredTheme() {
        if (localStorage.getItem('cartilla_digital_theme') === 'dark') {
            document.body.classList.add('dark-theme');
        }
        syncThemeButton();
    }

    function syncThemeButton() {
        const btn = document.getElementById('admin-theme');
        if (!btn) return;
        btn.textContent = document.body.classList.contains('dark-theme') ? 'Modo claro' : 'Modo oscuro';
    }

    function closeSidebar() {
        document.body.classList.remove('admin-sidebar-open');
        const menu = document.getElementById('admin-menu');
        if (menu) menu.setAttribute('aria-expanded', 'false');
    }

    async function navigate(view) {
        state.view = view || 'dashboard';
        state.query = '';
        state.filter = 'todos';
        document.getElementById('admin-title').textContent = titles[state.view] || 'Centro de Control';
        document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
        document.querySelectorAll('.admin-view').forEach(section => section.classList.toggle('active', section.id === `view-${state.view}`));
        closeSidebar();
        await renderActiveView();
    }

    async function renderActiveView() {
        const section = getView();
        section.innerHTML = panel('Cargando', '<div class="admin-empty">Cargando datos...</div>');

        try {
            if (state.view === 'dashboard') return renderDashboard(await load('summary', () => AdminService.getSummary()));
            if (state.view === 'clinics') return renderClinics(await load('clinics', () => AdminService.getClinics()));
            if (state.view === 'patients') return renderPatients(await load('patients', () => AdminService.getPatients()));
            if (state.view === 'tutors') return renderTutors(await load('tutors', () => AdminService.getTutors()));
            if (state.view === 'plans') return renderPlans(await load('plans', () => AdminService.getPlans()));
            if (state.view === 'payments') return renderPayments(
                await load('payments', () => AdminService.getPayments()),
                await load('clinics', () => AdminService.getClinics())
            );
            if (state.view === 'usage') return renderUsage(await load('usage', () => AdminService.getUsageMetrics()));
            if (state.view === 'feedback') return renderTickets(await load('tickets', () => AdminService.getTickets()));
            if (state.view === 'support') return renderSupport(await load('support', () => AdminService.getSupportUsers()));
            if (state.view === 'activity') return renderActivity(await load('activity', () => AdminService.getActivity()));
            if (state.view === 'alerts') return renderAlerts(await load('alerts', () => AdminService.getAlerts()));
            if (state.view === 'trials') return renderTrials(await load('plans', () => AdminService.getPlans()));
            return renderPreparedView(state.view);
        } catch (err) {
            section.innerHTML = panel('Error al cargar', `<div class="admin-empty">${escapeHtml(err.message)}<br><button class="admin-action primary" data-action="reload-view">Reintentar</button></div>`);
        }
    }

    async function load(key, loader) {
        if (!state.data[key]) state.data[key] = await loader();
        return state.data[key];
    }

    function renderUserbar() {
        const bar = document.getElementById('admin-userbar');
        if (!bar || !state.me) return;
        document.getElementById('admin-user-name').textContent = state.me.nombre || 'Super admin';
        document.getElementById('admin-user-email').textContent = state.me.email || '';
        bar.hidden = false;
    }

    function showBlocked(message, label, href) {
        hideStatus();
        document.querySelectorAll('.admin-view').forEach(section => section.classList.remove('active'));
        const dashboard = document.getElementById('view-dashboard');
        dashboard.classList.add('active');
        dashboard.innerHTML = `
            <div class="admin-panel">
                <div class="admin-panel-header"><h2>Acceso protegido</h2></div>
                <div class="admin-panel-body">
                    <p class="admin-muted">${escapeHtml(message)}</p>
                    <a class="admin-link" href="${escapeAttr(href)}">${escapeHtml(label)}</a>
                </div>
            </div>
        `;
    }

    function hideStatus() {
        const status = document.getElementById('admin-status');
        if (status) status.hidden = true;
    }

    function getView() {
        return document.getElementById(`view-${state.view}`);
    }

    function renderDashboard(data) {
        const stats = data.stats || {};
        getView().innerHTML = `
            <div class="admin-grid stats">
                ${stat('Clinicas registradas', stats.totalClinicas, 'Activas: ' + value(stats.clinicasActivas))}
                ${stat('Pacientes', stats.totalPacientes, 'Caninos ' + value(stats.totalCaninos) + ' / Felinos ' + value(stats.totalFelinos))}
                ${stat('Tutores', stats.totalTutores, 'Contactos unificados por clinica')}
                ${stat('Planes por caducar', stats.planesPorCaducar, 'Vencidos: ' + value(stats.planesVencidos))}
                ${stat('Pruebas gratis', stats.clinicasPruebaGratis, 'Clinicas en evaluacion')}
                ${stat('Comentarios nuevos', stats.feedbackNuevos, 'Pendientes de revision')}
                ${stat('Pacientes hoy', stats.pacientesHoy, 'Semana: ' + value(stats.pacientesSemana))}
                ${stat('Pacientes este mes', stats.pacientesMes, 'Crecimiento reciente')}
            </div>

            <div class="admin-grid two">
                ${listPanel('Ultimas clinicas registradas', data.latestClinics, clinic => `
                    <li><div><strong>${escapeHtml(clinic.nombre)}</strong><br><span class="admin-muted">${escapeHtml(clinic.email || '')}</span></div>${badge(clinic.estado_cuenta)}</li>
                `)}
                ${listPanel('Ultimos pacientes registrados', data.latestPatients, pet => `
                    <li><div><strong>${escapeHtml(pet.nombre)}</strong><br><span class="admin-muted">${escapeHtml(pet.clinica || '')}</span></div>${badge(pet.especie || 'Paciente')}</li>
                `)}
                ${listPanel('Planes proximos a caducar', data.expiringPlans, plan => `
                    <li><div><strong>${escapeHtml(plan.nombre)}</strong><br><span class="admin-muted">${formatDate(plan.plan_vencimiento) || 'Sin vencimiento'}</span></div>${badge(plan.estado_plan)}</li>
                `)}
                ${listPanel('Alertas del sistema', data.alerts, alert => `
                    <li><div><strong>${escapeHtml(alert.title)}</strong><br><span class="admin-muted">${escapeHtml(alert.detail)}</span></div>${badge(alert.level)}</li>
                `)}
            </div>
        `;
    }

    function renderClinics(rows) {
        renderTableView('Clinicas registradas', rows, [
            col('Clinica', row => mainCell(row.nombre, row.email)),
            col('Propietario', row => row.propietario || 'Sin propietario'),
            col('Telefono', row => row.telefono || 'No registrado'),
            col('Registro', row => formatDate(row.fecha_registro)),
            col('Plan', row => `${escapeHtml(row.plan_actual || 'Free')}<br>${badge(row.estado_plan)}`),
            col('Pacientes', row => value(row.pacientes)),
            col('Equipo', row => value(row.equipo)),
            col('Acciones', row => `
                <div class="admin-form-row" data-clinic-editor="${escapeAttr(row.id)}">
                    <select class="admin-select" data-field="estadoCuenta">
                        ${option('activa', row.estado_cuenta)}${option('prueba_gratis', row.estado_cuenta)}${option('suspendida', row.estado_cuenta)}
                    </select>
                    <select class="admin-select" data-field="planActual">
                        ${option('Free', row.plan_actual)}${option('Basico', row.plan_actual)}${option('Pro', row.plan_actual)}${option('Plus', row.plan_actual)}
                    </select>
                    <button class="admin-action primary" data-action="save-clinic" data-id="${escapeAttr(row.id)}">Guardar</button>
                </div>
            `)
        ], { search: true, filterField: 'estado_cuenta' });
    }

    function renderPatients(rows) {
        renderTableView('Pacientes globales', rows, [
            col('Paciente', row => mainCell(row.nombre, row.codigo)),
            col('Especie', row => badge(row.especie || 'Mascota')),
            col('Raza', row => row.raza || 'Mestizo'),
            col('Sexo', row => row.sexo || 'N/A'),
            col('Tutor', row => mainCell(row.tutor_nombre, row.tutor_email || row.tutor_telefono)),
            col('Clinica', row => row.clinica),
            col('Registro', row => formatDate(row.fecha_registro)),
            col('Proxima vacuna', row => formatDate(row.proxima_vacuna) || 'Sin fecha'),
            col('Proxima desparasitacion', row => formatDate(row.proxima_desparasitacion) || 'Sin fecha')
        ], { search: true, filterField: 'especie' });
    }

    function renderTutors(rows) {
        renderTableView('Tutores', rows, [
            col('Tutor', row => mainCell(row.nombre, row.email || row.telefono)),
            col('Telefono', row => row.telefono || 'Sin telefono'),
            col('Direccion', row => row.direccion || 'Sin direccion'),
            col('Clinica', row => row.clinica),
            col('Mascotas', row => value(row.mascotas)),
            col('Registro', row => formatDate(row.fecha_registro)),
            col('Datos', row => badge(row.estado_datos))
        ], { search: true, filterField: 'estado_datos' });
    }

    function renderPlans(rows) {
        renderTableView('Planes y suscripciones', rows, [
            col('Clinica', row => mainCell(row.clinica, row.email)),
            col('Plan', row => row.plan_actual || 'Free'),
            col('Inicio', row => formatDate(row.plan_inicio) || 'Sin fecha'),
            col('Vencimiento', row => formatDate(row.plan_vencimiento) || 'Sin fecha'),
            col('Dias restantes', row => row.dias_restantes === null ? 'Sin limite' : value(row.dias_restantes)),
            col('Estado', row => badge(row.estado_plan)),
            col('Pacientes', row => value(row.pacientes))
        ], { search: true, filterField: 'estado_plan' });
    }

    function renderTrials(rows) {
        const trials = rows.filter(row => row.estado_cuenta === 'prueba_gratis' || row.estado_plan === 'prueba gratis');
        renderTableView('Pruebas gratis', trials, [
            col('Clinica', row => mainCell(row.clinica, row.email)),
            col('Inicio', row => formatDate(row.trial_inicio) || 'Sin fecha'),
            col('Final', row => formatDate(row.trial_fin) || 'Sin fecha'),
            col('Uso actual', row => `${value(row.pacientes)} pacientes`),
            col('Recomendacion', row => row.pacientes > 20 ? badge('convertir a plan') : badge('seguimiento'))
        ], { search: true });
    }

    function renderFeedback(rows) {
        renderTableView('Comentarios y reportes', rows, [
            col('Clinica', row => mainCell(row.clinica || 'Sin clinica', row.user_email)),
            col('Tipo', row => badge(row.type || 'sugerencia')),
            col('Prioridad', row => badge(row.priority || 'media')),
            col('Mensaje', row => `<span>${escapeHtml(row.message || '')}</span>`),
            col('Fecha', row => formatDate(row.created_at)),
            col('Estado', row => `
                <select class="admin-select" data-action="feedback-status" data-id="${escapeAttr(row.id)}">
                    ${option('nuevo', row.status)}${option('en_revision', row.status)}${option('en_desarrollo', row.status)}${option('solucionado', row.status)}${option('rechazado', row.status)}
                </select>
            `)
        ], { search: true, filterField: 'status' });
    }

    function renderTickets(rows) {
        renderTableView('Gestion avanzada de tickets', rows, [
            col('Solicitud', row => mainCell(row.subject, row.message)),
            col('Clinica', row => mainCell(row.clinica, row.clinic_email)),
            col('Tipo', row => badge(labelTicket(row.type))),
            col('Prioridad', row => badge(row.priority || 'media')),
            col('Modulo', row => row.related_module || 'otro'),
            col('Tiempo abierto', row => formatOpenTime(row.open_seconds)),
            col('Estado', row => `
                <select class="admin-select" data-action="ticket-status" data-id="${escapeAttr(row.id)}">
                    ${ticketOption('enviado', row.status)}${ticketOption('recibido', row.status)}${ticketOption('revisado', row.status)}${ticketOption('en_proceso', row.status)}${ticketOption('en_desarrollo', row.status)}${ticketOption('solucionado', row.status)}${ticketOption('rechazado', row.status)}${ticketOption('cerrado', row.status)}
                </select>
            `),
            col('Respuesta', row => `
                <div class="admin-ticket-actions">
                    <span class="admin-muted">${escapeHtml(row.admin_response || 'Sin respuesta')}</span>
                    <button class="admin-action" data-action="ticket-reply" data-id="${escapeAttr(row.id)}">Responder</button>
                </div>
            `)
        ], { search: true, filterField: 'status' });
    }

    function renderPayments(data, clinics) {
        const stats = data.stats || {};
        const payments = data.payments || [];
        getView().innerHTML = `
            <div class="admin-grid stats">
                ${stat('Ingresos del mes', money(stats.ingresos_mes), 'Pagos verificados')}
                ${stat('Ingresos semana', money(stats.ingresos_semana), 'Semana actual')}
                ${stat('Pagos pendientes', stats.pagos_pendientes, 'Requieren revision')}
                ${stat('Pagos vencidos', stats.pagos_vencidos, 'Seguimiento financiero')}
                ${stat('Plan mas vendido', stats.plan_mas_vendido || 'Sin datos', 'Historico de pagos')}
                ${stat('Clinicas al dia', stats.clinicas_al_dia, 'Con pagos registrados')}
            </div>
            <div class="admin-panel">
                <div class="admin-panel-header">
                    <h2>Registrar pago manual</h2>
                    <span class="admin-muted">Pasarela futura preparada</span>
                </div>
                <div class="admin-panel-body">
                    <form class="admin-payment-form" id="admin-payment-form">
                        <select class="admin-select" name="clinicId" required>
                            <option value="">Seleccionar clinica</option>
                            ${(clinics || []).map(clinic => `<option value="${escapeAttr(clinic.id)}">${escapeHtml(clinic.nombre)} · ${escapeHtml(clinic.email || '')}</option>`).join('')}
                        </select>
                        <input class="admin-input" name="planName" placeholder="Plan" value="Pro">
                        <input class="admin-input" name="amount" type="number" min="0" step="0.01" placeholder="Monto">
                        <select class="admin-select" name="paymentStatus">
                            ${option('manual', 'manual')}${option('pagado')}${option('pendiente')}${option('verificado')}${option('vencido')}${option('fallido')}${option('reembolsado')}
                        </select>
                        <input class="admin-input" name="reference" placeholder="Referencia">
                        <input class="admin-input" name="notes" placeholder="Observacion">
                        <button class="admin-action primary" type="submit">Registrar pago</button>
                    </form>
                </div>
            </div>
        `;

        const tableHtml = table([
            col('Clinica', row => mainCell(row.clinica, row.clinic_email)),
            col('Plan', row => row.plan_name || 'Sin plan'),
            col('Monto', row => money(row.amount, row.currency)),
            col('Metodo', row => row.payment_method || 'manual'),
            col('Estado', row => `
                <select class="admin-select" data-action="payment-status" data-id="${escapeAttr(row.id)}">
                    ${option('manual', row.payment_status)}${option('pagado', row.payment_status)}${option('pendiente', row.payment_status)}${option('verificado', row.payment_status)}${option('vencido', row.payment_status)}${option('fallido', row.payment_status)}${option('reembolsado', row.payment_status)}
                </select>
            `),
            col('Fecha', row => formatDate(row.payment_date || row.created_at)),
            col('Referencia', row => row.reference || 'Sin referencia'),
            col('Observacion', row => row.notes || '')
        ], payments);

        getView().insertAdjacentHTML('beforeend', panel('Historial de pagos', tableHtml));

        const form = document.getElementById('admin-payment-form');
        if (form) {
            form.addEventListener('submit', async event => {
                event.preventDefault();
                const formData = new FormData(form);
                const payload = Object.fromEntries(formData.entries());
                try {
                    await AdminService.createManualPayment(payload);
                    state.data.payments = null;
                    state.data.summary = null;
                    toast('Pago manual registrado.');
                    await renderActiveView();
                } catch (err) {
                    toast(err.message, 'error');
                }
            });
        }
    }

    function renderUsage(data) {
        const summary = data.summary || {};
        getView().innerHTML = `
            <div class="admin-grid stats">
                ${stat('Clinicas activas hoy', summary.clinicas_hoy, 'Ultimo login hoy')}
                ${stat('Clinicas activas semana', summary.clinicas_semana, 'Semana actual')}
                ${stat('Clinicas activas mes', summary.clinicas_mes, 'Mes actual')}
                ${stat('Pacientes hoy', summary.pacientes_hoy, 'Nuevos registros')}
                ${stat('Pacientes semana', summary.pacientes_semana, 'Nuevos registros')}
                ${stat('Tickets enviados', summary.tickets_enviados, 'Soporte clinicas')}
                ${stat('Vacunas', summary.vacunas_registradas, 'Registros totales')}
                ${stat('Controles', summary.controles_preventivos, 'Preventivos totales')}
            </div>
        `;

        const clinicRows = data.clinicUsage || [];
        getView().insertAdjacentHTML('beforeend', panel('Uso por clinica', table([
            col('Clinica', row => mainCell(row.clinica, row.plan_actual)),
            col('Pacientes', row => value(row.pacientes)),
            col('Vacunas', row => value(row.vacunas)),
            col('Desparasitaciones', row => value(row.desparasitaciones)),
            col('Controles', row => value(row.controles)),
            col('Tickets', row => value(row.tickets)),
            col('Banco', row => value(row.banco_vacunas)),
            col('Ultima actividad', row => formatDate(row.ultimo_login, true) || 'Sin login')
        ], clinicRows)));

        getView().insertAdjacentHTML('beforeend', `
            <div class="admin-grid two">
                ${listPanel('Clinicas mas activas', data.mostActiveClinics || [], row => `
                    <li><div><strong>${escapeHtml(row.clinica)}</strong><br><span class="admin-muted">${formatDate(row.ultimo_login, true) || 'Sin login'}</span></div>${badge(row.plan_actual || 'Free')}</li>
                `)}
                ${listPanel('Clinicas inactivas', data.inactiveClinics || [], row => `
                    <li><div><strong>${escapeHtml(row.clinica)}</strong><br><span class="admin-muted">${formatDate(row.ultimo_login, true) || 'Sin login reciente'}</span></div>${badge(row.plan_actual || 'Free')}</li>
                `)}
            </div>
        `);
    }

    function renderSupport(rows) {
        renderTableView('Soporte tecnico', rows, [
            col('Usuario', row => mainCell(row.propietario || row.nombre, row.email)),
            col('Clinica', row => row.nombre),
            col('Rol', row => badge(row.role || 'clinic_owner')),
            col('Estado', row => badge(row.estado_cuenta || 'activa')),
            col('Plan', row => row.plan_actual || 'Free'),
            col('Ultimo inicio', row => formatDate(row.ultimo_login) || 'Sin registro'),
            col('Acciones seguras', row => `
                <button class="admin-action" data-action="recover-password" data-email="${escapeAttr(row.email)}">Enviar recuperacion</button>
            `)
        ], { search: true, filterField: 'role' });
    }

    function renderActivity(rows) {
        renderTableView('Actividad del sistema', rows, [
            col('Fecha', row => formatDate(row.created_at, true)),
            col('Usuario', row => row.actor_email || 'Sistema'),
            col('Clinica', row => row.clinica || 'Global'),
            col('Accion', row => row.action),
            col('Modulo', row => row.module || 'admin'),
            col('Detalle', row => row.description || 'Sin detalle'),
            col('Nivel', row => badge(row.level || 'info'))
        ], { search: true, filterField: 'level' });
    }

    function renderAlerts(rows) {
        getView().innerHTML = listPanel('Alertas', rows, alert => `
            <li><div><strong>${escapeHtml(alert.title)}</strong><br><span class="admin-muted">${escapeHtml(alert.detail)}</span></div>${badge(alert.level)}</li>
        `);
    }

    function renderPreparedView(view) {
        const descriptions = {
            payments: 'La estructura esta preparada para conectarse a una tabla de pagos o pasarela cuando exista.',
            settings: 'Configuracion global preparada para logo, colores, correos de soporte, limites de planes y mensajes automaticos.',
            internal: 'Usuarios internos preparados para roles super_admin, soporte, ventas, finanzas y desarrollador.',
            security: 'Panel de seguridad preparado para auditoria, cambios de rol, sesiones y politicas de acceso.'
        };

        getView().innerHTML = panel(titles[view], `
            <div class="admin-empty">
                <strong>Modulo preparado para fase 2.</strong><br>
                ${escapeHtml(descriptions[view] || 'Este modulo esta listo para conectarse cuando exista la tabla correspondiente.')}
            </div>
        `);
    }

    function renderTableView(title, rows, columns, options = {}) {
        let filtered = rows || [];
        const allText = row => JSON.stringify(row || {}).toLowerCase();

        if (state.query) {
            filtered = filtered.filter(row => allText(row).includes(state.query));
        }
        if (options.filterField && state.filter !== 'todos') {
            filtered = filtered.filter(row => String(row[options.filterField] || '').toLowerCase() === state.filter);
        }

        const filterValues = options.filterField
            ? Array.from(new Set((rows || []).map(row => row[options.filterField]).filter(Boolean))).sort()
            : [];

        getView().innerHTML = `
            <div class="admin-panel">
                <div class="admin-panel-header">
                    <h2>${escapeHtml(title)}</h2>
                    <span class="admin-muted">${filtered.length} registro(s)</span>
                </div>
                <div class="admin-panel-body">
                    <div class="admin-toolbar">
                        ${options.search ? '<input class="admin-search" id="admin-search" type="search" placeholder="Buscar..." value="' + escapeAttr(state.query) + '">' : ''}
                        ${filterValues.length ? '<select class="admin-select" id="admin-filter"><option value="todos">Todos</option>' + filterValues.map(v => option(v, state.filter)).join('') + '</select>' : ''}
                    </div>
                    ${table(columns, filtered)}
                </div>
            </div>
        `;

        const search = document.getElementById('admin-search');
        if (search) {
            search.addEventListener('input', event => {
                state.query = event.target.value.trim().toLowerCase();
                renderTableView(title, rows, columns, options);
            });
        }

        const filter = document.getElementById('admin-filter');
        if (filter) {
            filter.addEventListener('change', event => {
                state.filter = event.target.value;
                renderTableView(title, rows, columns, options);
            });
        }
    }

    function table(columns, rows) {
        if (!rows || rows.length === 0) {
            return '<div class="admin-empty">No hay datos para mostrar todavia.</div>';
        }

        return `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                ${columns.map(column => `<td data-label="${escapeAttr(column.label)}">${column.render(row)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function col(label, render) {
        return { label, render: row => render(row) == null ? '' : String(render(row)) };
    }

    function stat(label, number, note) {
        const display = Number.isFinite(Number(number)) && String(number).trim() !== ''
            ? value(number)
            : escapeHtml(number);
        return `<article class="admin-card"><small>${escapeHtml(label)}</small><strong>${display}</strong><span>${escapeHtml(note || '')}</span></article>`;
    }

    function listPanel(title, rows, renderItem) {
        const body = rows && rows.length
            ? `<ul class="admin-list">${rows.map(renderItem).join('')}</ul>`
            : '<div class="admin-empty">No hay datos para mostrar todavia.</div>';
        return panel(title, body);
    }

    function panel(title, body) {
        return `<div class="admin-panel"><div class="admin-panel-header"><h2>${escapeHtml(title)}</h2></div><div class="admin-panel-body">${body}</div></div>`;
    }

    function mainCell(title, subtitle) {
        return `<strong>${escapeHtml(title || 'Sin dato')}</strong>${subtitle ? `<br><span class="admin-muted">${escapeHtml(subtitle)}</span>` : ''}`;
    }

    function badge(text) {
        const valueText = String(text || 'sin estado').replace(/_/g, ' ');
        const normalized = valueText.toLowerCase();
        let type = 'info';
        if (['activa', 'activo', 'success', 'resuelto', 'solucionado', 'completo'].some(t => normalized.includes(t))) type = 'success';
        if (['prueba', 'caducar', 'warning', 'revision', 'media', 'seguimiento'].some(t => normalized.includes(t))) type = 'warning';
        if (['suspend', 'vencido', 'danger', 'urgente', 'error', 'rechazado', 'incompleto'].some(t => normalized.includes(t))) type = 'danger';
        return `<span class="admin-badge ${type}">${escapeHtml(valueText)}</span>`;
    }

    function option(valueOption, selected) {
        const valueString = String(valueOption);
        const isSelected = String(selected || '').toLowerCase() === valueString.toLowerCase() ? ' selected' : '';
        return `<option value="${escapeAttr(valueString)}"${isSelected}>${escapeHtml(valueString.replace(/_/g, ' '))}</option>`;
    }

    function ticketOption(valueOption, selected) {
        return option(valueOption, selected);
    }

    function labelTicket(valueText) {
        const labels = {
            problema_tecnico: 'Problema tecnico',
            error_sistema: 'Error del sistema',
            sugerencia: 'Sugerencia',
            solicitud_mejora: 'Solicitud de mejora',
            duda: 'Duda',
            pago_plan: 'Pago / plan',
            impresion_pdf: 'Impresion / PDF',
            qr_cartilla_publica: 'QR / cartilla publica',
            recordatorios: 'Recordatorios',
            otro: 'Otro'
        };
        return labels[valueText] || String(valueText || 'otro').replace(/_/g, ' ');
    }

    function formatOpenTime(seconds) {
        const total = Number(seconds) || 0;
        const days = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        if (days > 0) return `${days} d ${hours} h`;
        if (hours > 0) return `${hours} h`;
        return 'Hoy';
    }

    function money(amount, currency = 'USD') {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: currency || 'USD'
        }).format(Number(amount) || 0);
    }

    async function handleActions(event) {
        const action = event.target.closest('[data-action]');
        if (!action) return;

        if (action.dataset.action === 'reload-view') {
            state.data[state.view] = null;
            await renderActiveView();
        }

        if (action.dataset.action === 'save-clinic') {
            const editor = document.querySelector(`[data-clinic-editor="${cssEscape(action.dataset.id)}"]`);
            if (!editor) return;
            const payload = {};
            editor.querySelectorAll('[data-field]').forEach(field => {
                payload[field.dataset.field] = field.value;
            });
            action.disabled = true;
            try {
                await AdminService.updateClinic(action.dataset.id, payload);
                state.data.clinics = null;
                state.data.summary = null;
                toast('Clinica actualizada correctamente.');
                await renderActiveView();
            } catch (err) {
                toast(err.message, 'error');
            } finally {
                action.disabled = false;
            }
        }

        if (action.dataset.action === 'recover-password') {
            if (!confirm('Enviar enlace de recuperacion de contrasena a este usuario?')) return;
            try {
                await AdminService.sendPasswordRecovery(action.dataset.email);
                toast('Se envio o preparo el enlace de recuperacion.');
            } catch (err) {
                toast(err.message, 'error');
            }
        }

        if (action.dataset.action === 'ticket-reply') {
            const message = prompt('Respuesta visible para la clinica:');
            if (!message || !message.trim()) return;
            try {
                await AdminService.updateTicket(action.dataset.id, { adminResponse: message.trim(), status: 'revisado' });
                state.data.tickets = null;
                state.data.summary = null;
                toast('Respuesta enviada a la clinica.');
                await renderActiveView();
            } catch (err) {
                toast(err.message, 'error');
            }
        }
    }

    async function handleChanges(event) {
        const target = event.target;
        if (target.dataset.action === 'feedback-status') {
            try {
                await AdminService.updateFeedback(target.dataset.id, { status: target.value });
                state.data.feedback = null;
                state.data.summary = null;
                toast('Comentario actualizado.');
            } catch (err) {
                toast(err.message, 'error');
            }
        }

        if (target.dataset.action === 'ticket-status') {
            try {
                await AdminService.updateTicket(target.dataset.id, { status: target.value });
                state.data.tickets = null;
                state.data.summary = null;
                state.data.alerts = null;
                toast('Estado de ticket actualizado.');
            } catch (err) {
                toast(err.message, 'error');
            }
        }

        if (target.dataset.action === 'payment-status') {
            try {
                await AdminService.updatePayment(target.dataset.id, { paymentStatus: target.value });
                state.data.payments = null;
                state.data.summary = null;
                toast('Estado de pago actualizado.');
            } catch (err) {
                toast(err.message, 'error');
            }
        }
    }

    function toast(message, type = 'success') {
        const wrap = document.getElementById('admin-toast-wrap');
        if (!wrap) return;
        const el = document.createElement('div');
        el.className = 'admin-toast';
        el.textContent = message;
        if (type === 'error') el.style.borderColor = 'var(--cd-danger)';
        wrap.appendChild(el);
        setTimeout(() => el.remove(), 3600);
    }

    function formatDate(valueDate, withTime = false) {
        if (!valueDate) return '';
        const date = new Date(valueDate);
        if (Number.isNaN(date.getTime())) return '';
        const options = withTime
            ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
            : { year: 'numeric', month: '2-digit', day: '2-digit' };
        return new Intl.DateTimeFormat('es-EC', options).format(date);
    }

    function value(number) {
        if (number === null || number === undefined || number === '') return '0';
        return new Intl.NumberFormat('es-EC').format(Number(number) || 0);
    }

    function escapeHtml(valueHtml) {
        return String(valueHtml ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function escapeAttr(valueAttr) {
        return escapeHtml(valueAttr).replace(/`/g, '&#96;');
    }

    function cssEscape(valueCss) {
        if (window.CSS && CSS.escape) return CSS.escape(valueCss);
        return String(valueCss).replace(/["\\]/g, '\\$&');
    }
})();
