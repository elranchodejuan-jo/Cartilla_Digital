const SOPORTE_LABELS = {
    tipos: {
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
    },
    prioridades: {
        baja: 'Baja',
        media: 'Media',
        alta: 'Alta',
        urgente: 'Urgente'
    },
    estados: {
        enviado: 'Enviado',
        recibido: 'Recibido',
        revisado: 'Revisado',
        en_proceso: 'En proceso',
        en_desarrollo: 'En desarrollo',
        solucionado: 'Solucionado',
        rechazado: 'Rechazado',
        cerrado: 'Cerrado'
    },
    modulos: {
        pacientes: 'Pacientes',
        registro_mascota: 'Registro de mascota',
        vacunas: 'Vacunas',
        desparasitaciones_internas: 'Desparasitaciones internas',
        desparasitaciones_externas: 'Desparasitaciones externas',
        historial_preventivo: 'Historial clinico preventivo',
        banco: 'Banco',
        configuraciones: 'Configuraciones',
        equipo_veterinario: 'Equipo veterinario',
        planes: 'Planes',
        pagos: 'Pagos',
        impresion_pdf: 'Impresion / PDF',
        qr: 'QR',
        cartilla_publica: 'Cartilla publica',
        otro: 'Otro'
    }
};

const SoporteState = {
    tickets: [],
    selectedId: null,
    filterStatus: 'todos',
    filterType: 'todos',
    query: '',
    loading: false
};

document.addEventListener('submit', async event => {
    if (event.target && event.target.id === 'form-support-ticket') {
        event.preventDefault();
        await enviarSolicitudSoporte(event.target);
    }
    if (event.target && event.target.id === 'form-support-message') {
        event.preventDefault();
        await enviarMensajeSoporte(event.target);
    }
});

document.addEventListener('click', async event => {
    const action = event.target.closest('[data-support-action]');
    if (!action) return;

    if (action.dataset.supportAction === 'detail') {
        SoporteState.selectedId = action.dataset.id;
        await renderizarDetalleSoporte(action.dataset.id);
    }

    if (action.dataset.supportAction === 'new') {
        SoporteState.selectedId = null;
        renderizarSoporteClinica(false);
        const subject = document.getElementById('support-subject');
        if (subject) subject.focus();
    }
});

document.addEventListener('input', event => {
    if (event.target && event.target.id === 'support-search') {
        SoporteState.query = event.target.value.trim().toLowerCase();
        renderizarListaSoporte();
    }
});

document.addEventListener('change', event => {
    if (event.target && event.target.id === 'support-status-filter') {
        SoporteState.filterStatus = event.target.value;
        renderizarListaSoporte();
    }
    if (event.target && event.target.id === 'support-type-filter') {
        SoporteState.filterType = event.target.value;
        renderizarListaSoporte();
    }
});

async function renderizarSoporteClinica(forceReload = true) {
    const root = document.getElementById('support-root');
    if (!root) return;

    if (!root.dataset.ready) {
        root.innerHTML = soporteLayout();
        root.dataset.ready = 'true';
    }

    if (forceReload || !SoporteState.tickets.length) {
        await cargarTicketsSoporte();
    }

    renderizarResumenSoporte();
    renderizarListaSoporte();

    if (SoporteState.selectedId) {
        await renderizarDetalleSoporte(SoporteState.selectedId);
    } else {
        renderizarPanelDetalleVacio();
    }
}

async function cargarTicketsSoporte() {
    const list = document.getElementById('support-list');
    SoporteState.loading = true;
    if (list) list.innerHTML = '<div class="support-empty">Cargando solicitudes...</div>';

    try {
        SoporteState.tickets = await API.obtenerTicketsSoporte();
        actualizarBadgeSoporteClinica();
    } catch (err) {
        console.error('Error cargando soporte:', err);
        SoporteState.tickets = [];
        const root = document.getElementById('support-list');
        if (root) root.innerHTML = `<div class="support-empty">Error al cargar datos. <button class="btn btn-secondary" type="button" onclick="renderizarSoporteClinica(true)">Reintentar</button></div>`;
    } finally {
        SoporteState.loading = false;
    }
}

async function enviarSolicitudSoporte(form) {
    const submit = form.querySelector('[type="submit"]');
    const fields = form.elements;
    const payload = {
        type: fields.type.value,
        priority: fields.priority.value,
        subject: fields.subject.value.trim(),
        message: fields.message.value.trim(),
        relatedModule: fields.relatedModule.value
    };

    if (!payload.subject || !payload.message || !payload.type || !payload.priority) {
        mostrarToast('Completa asunto, mensaje, tipo y prioridad.', 'warning');
        return;
    }

    submit.disabled = true;
    try {
        const data = await API.crearTicketSoporte(payload);
        mostrarToast(data.mensaje || 'Solicitud enviada correctamente.', 'success');
        form.reset();
        SoporteState.selectedId = data.ticket && data.ticket.id;
        await cargarTicketsSoporte();
        renderizarResumenSoporte();
        renderizarListaSoporte();
        if (SoporteState.selectedId) await renderizarDetalleSoporte(SoporteState.selectedId);
    } catch (err) {
        mostrarToast(err.message || 'No se pudo enviar la solicitud.', 'error');
    } finally {
        submit.disabled = false;
    }
}

async function enviarMensajeSoporte(form) {
    const message = form.elements.message.value.trim();
    const ticketId = form.elements.ticketId.value;
    if (!message || !ticketId) return;

    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
        await API.agregarMensajeTicketSoporte(ticketId, message);
        form.reset();
        mostrarToast('Mensaje agregado correctamente.', 'success');
        await cargarTicketsSoporte();
        await renderizarDetalleSoporte(ticketId);
    } catch (err) {
        mostrarToast(err.message || 'No se pudo agregar el mensaje.', 'error');
    } finally {
        submit.disabled = false;
    }
}

function soporteLayout() {
    return `
        <div class="support-shell">
            <div class="support-hero">
                <div>
                    <span class="support-kicker">Comunicacion directa</span>
                    <h2>Soporte / Comentarios</h2>
                    <p>Envia problemas, dudas, sugerencias o solicitudes y sigue el estado desde tu clinica.</p>
                </div>
                <button class="btn btn-primary" type="button" data-support-action="new">Nueva solicitud</button>
            </div>

            <div class="support-stats" id="support-stats"></div>

            <div class="support-grid">
                <section class="support-panel support-form-panel" aria-labelledby="support-form-title">
                    <h3 id="support-form-title">Nueva solicitud</h3>
                    <form id="form-support-ticket">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="support-type">Tipo de solicitud *</label>
                                <select id="support-type" name="type" class="form-control" required>
                                    ${options(SOPORTE_LABELS.tipos)}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="support-priority">Prioridad *</label>
                                <select id="support-priority" name="priority" class="form-control" required>
                                    ${options(SOPORTE_LABELS.prioridades, 'media')}
                                </select>
                            </div>
                            <div class="form-group form-group-full">
                                <label for="support-subject">Asunto *</label>
                                <input id="support-subject" name="subject" class="form-control" type="text" maxlength="160" placeholder="Ej. No puedo generar el PDF de una cartilla" required>
                            </div>
                            <div class="form-group">
                                <label for="support-related-module">Modulo relacionado</label>
                                <select id="support-related-module" name="relatedModule" class="form-control">
                                    ${options(SOPORTE_LABELS.modulos, 'otro')}
                                </select>
                            </div>
                            <div class="form-group form-group-full">
                                <label for="support-message">Mensaje *</label>
                                <textarea id="support-message" name="message" class="form-control" rows="5" placeholder="Describe que paso, en que pantalla estabas y que esperabas ver." required></textarea>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" type="submit">Enviar solicitud</button>
                        </div>
                    </form>
                </section>

                <section class="support-panel" aria-labelledby="support-list-title">
                    <div class="support-panel-header">
                        <div>
                            <h3 id="support-list-title">Solicitudes enviadas</h3>
                            <p>Estados, prioridad y ultima actualizacion.</p>
                        </div>
                    </div>
                    <div class="support-filters">
                        <input id="support-search" class="form-control" type="search" placeholder="Buscar por asunto..." aria-label="Buscar solicitudes">
                        <select id="support-status-filter" class="form-control" aria-label="Filtrar por estado">
                            <option value="todos">Todos los estados</option>
                            ${options(SOPORTE_LABELS.estados)}
                        </select>
                        <select id="support-type-filter" class="form-control" aria-label="Filtrar por tipo">
                            <option value="todos">Todos los tipos</option>
                            ${options(SOPORTE_LABELS.tipos)}
                        </select>
                    </div>
                    <div id="support-list" class="support-list"></div>
                </section>

                <section class="support-panel support-detail-panel" aria-labelledby="support-detail-title">
                    <h3 id="support-detail-title">Detalle</h3>
                    <div id="support-detail" class="support-detail"></div>
                </section>
            </div>
        </div>
    `;
}

function renderizarResumenSoporte() {
    const stats = document.getElementById('support-stats');
    if (!stats) return;
    const tickets = SoporteState.tickets || [];
    const abiertos = tickets.filter(t => !['solucionado', 'cerrado', 'rechazado'].includes(t.status)).length;
    const respondidos = tickets.filter(t => t.admin_response).length;
    const urgentes = tickets.filter(t => t.priority === 'urgente' && !['solucionado', 'cerrado'].includes(t.status)).length;
    stats.innerHTML = `
        ${statCard('Solicitudes', tickets.length, 'Total enviado')}
        ${statCard('Abiertas', abiertos, 'Requieren seguimiento')}
        ${statCard('Respondidas', respondidos, 'Con nota del admin')}
        ${statCard('Urgentes', urgentes, 'Prioridad critica')}
    `;
}

function renderizarListaSoporte() {
    const list = document.getElementById('support-list');
    if (!list) return;
    if (SoporteState.loading) return;

    let tickets = [...(SoporteState.tickets || [])];
    if (SoporteState.filterStatus !== 'todos') {
        tickets = tickets.filter(ticket => ticket.status === SoporteState.filterStatus);
    }
    if (SoporteState.filterType !== 'todos') {
        tickets = tickets.filter(ticket => ticket.type === SoporteState.filterType);
    }
    if (SoporteState.query) {
        tickets = tickets.filter(ticket => JSON.stringify(ticket).toLowerCase().includes(SoporteState.query));
    }

    if (!tickets.length) {
        list.innerHTML = '<div class="support-empty">No hay tickets todavia.</div>';
        return;
    }

    list.innerHTML = tickets.map(ticket => `
        <article class="support-ticket-card ${SoporteState.selectedId === ticket.id ? 'active' : ''}">
            <div class="support-ticket-main">
                <strong>${escapeSoporte(ticket.subject)}</strong>
                <span>${label('tipos', ticket.type)} · ${label('modulos', ticket.related_module)}</span>
            </div>
            <div class="support-ticket-meta">
                ${badgeEstado(ticket.status)}
                ${badgePrioridad(ticket.priority)}
                <span>${formatDateSoporte(ticket.updated_at || ticket.created_at, true)}</span>
            </div>
            <button class="btn btn-secondary" type="button" data-support-action="detail" data-id="${escapeSoporte(ticket.id)}">Ver detalle</button>
        </article>
    `).join('');
}

async function renderizarDetalleSoporte(ticketId) {
    const detail = document.getElementById('support-detail');
    if (!detail) return;
    detail.innerHTML = '<div class="support-empty">Cargando detalle...</div>';

    try {
        const ticket = await API.obtenerTicketSoporte(ticketId);
        SoporteState.selectedId = ticket.id;
        renderizarListaSoporte();
        detail.innerHTML = `
            <article class="support-detail-card">
                <div class="support-detail-top">
                    <div>
                        <h4>${escapeSoporte(ticket.subject)}</h4>
                        <p>${label('tipos', ticket.type)} · ${label('modulos', ticket.related_module)}</p>
                    </div>
                    <div class="support-detail-badges">
                        ${badgeEstado(ticket.status)}
                        ${badgePrioridad(ticket.priority)}
                    </div>
                </div>

                <dl class="support-detail-grid">
                    <div><dt>Fecha de envio</dt><dd>${formatDateSoporte(ticket.created_at, true)}</dd></div>
                    <div><dt>Ultima actualizacion</dt><dd>${formatDateSoporte(ticket.updated_at, true)}</dd></div>
                </dl>

                <div class="support-message-box">
                    <strong>Mensaje enviado</strong>
                    <p>${escapeSoporte(ticket.message)}</p>
                </div>

                <div class="support-message-box admin-response">
                    <strong>Respuesta del administrador</strong>
                    <p>${ticket.admin_response ? escapeSoporte(ticket.admin_response) : 'Aun no hay respuesta del administrador.'}</p>
                </div>

                <div class="support-timeline">
                    <h4>Historial</h4>
                    ${timeline(ticket)}
                </div>

                <form id="form-support-message" class="support-followup-form">
                    <input type="hidden" name="ticketId" value="${escapeSoporte(ticket.id)}">
                    <label for="support-followup-message">Agregar comentario adicional</label>
                    <textarea id="support-followup-message" name="message" class="form-control" rows="3" placeholder="Agrega contexto si el problema continua o cambia."></textarea>
                    <button class="btn btn-secondary" type="submit">Agregar mensaje</button>
                </form>
            </article>
        `;
    } catch (err) {
        detail.innerHTML = `<div class="support-empty">Error al cargar detalle. ${escapeSoporte(err.message || '')}</div>`;
    }
}

function renderizarPanelDetalleVacio() {
    const detail = document.getElementById('support-detail');
    if (!detail) return;
    detail.innerHTML = '<div class="support-empty">Selecciona una solicitud para ver el detalle y la respuesta del administrador.</div>';
}

function actualizarBadgeSoporteClinica() {
    const badge = document.getElementById('support-nav-badge');
    if (!badge) return;
    const count = (SoporteState.tickets || []).filter(ticket => ticket.admin_response && !['cerrado', 'rechazado'].includes(ticket.status)).length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
}

function timeline(ticket) {
    const statusItems = (ticket.statusHistory || []).map(item => `
        <li>
            <span>${formatDateSoporte(item.created_at, true)}</span>
            <strong>${label('estados', item.new_status)}</strong>
            <p>${escapeSoporte(item.note || 'Cambio de estado')}</p>
        </li>
    `);
    const messageItems = (ticket.messages || []).map(item => `
        <li>
            <span>${formatDateSoporte(item.created_at, true)}</span>
            <strong>${item.sender_role === 'admin' ? 'Admin respondio' : 'Clinica envio mensaje'}</strong>
            <p>${escapeSoporte(item.message)}</p>
        </li>
    `);
    const items = [...statusItems, ...messageItems].join('');
    return items ? `<ul>${items}</ul>` : '<div class="support-empty">Sin historial adicional todavia.</div>';
}

function statCard(labelText, value, note) {
    return `<article class="support-stat"><span>${escapeSoporte(labelText)}</span><strong>${Number(value) || 0}</strong><small>${escapeSoporte(note)}</small></article>`;
}

function badgeEstado(status) {
    return `<span class="support-badge support-status-${escapeSoporte(status || 'enviado')}">${label('estados', status)}</span>`;
}

function badgePrioridad(priority) {
    return `<span class="support-badge support-priority-${escapeSoporte(priority || 'media')}">${label('prioridades', priority)}</span>`;
}

function options(source, selected = '') {
    return Object.entries(source).map(([value, text]) => {
        const isSelected = selected === value ? ' selected' : '';
        return `<option value="${escapeSoporte(value)}"${isSelected}>${escapeSoporte(text)}</option>`;
    }).join('');
}

function label(group, value) {
    return SOPORTE_LABELS[group][value] || String(value || 'Sin dato').replace(/_/g, ' ');
}

function formatDateSoporte(value, withTime = false) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-EC', withTime
        ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: '2-digit', day: '2-digit' }
    ).format(date);
}

function escapeSoporte(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

window.renderizarSoporteClinica = renderizarSoporteClinica;
