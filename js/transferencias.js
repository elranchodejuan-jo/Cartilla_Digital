/**
 * CARTILLA DIGITAL - Transferencias avanzadas entre clinicas.
 * Pantalla interna con asociaciones, buzon, envio y solicitud de pacientes.
 */

const TransferState = {
    tab: 'movimientos',
    loading: false,
    summary: null,
    clinics: [],
    associations: [],
    mailbox: [],
    patients: [],
    sendWizard: null,
    requestWizard: null,
    detail: null,
    matches: [],
    selectedMatchId: '',
    mailboxFilter: 'todos'
};

const TRANSFER_PERMISSION_FIELDS = [
    ['includePetData', 'Datos de la mascota'],
    ['includeTutorData', 'Datos del tutor'],
    ['includeVaccines', 'Vacunas'],
    ['includeInternalDeworming', 'Desparasitaciones internas'],
    ['includeExternalDeworming', 'Desparasitaciones externas'],
    ['includePreventiveHistory', 'Historial preventivo'],
    ['includeNextAppointments', 'Proximas citas'],
    ['includeObservations', 'Observaciones importantes'],
    ['includePhotos', 'Fotos'],
    ['includeFullHistory', 'Seleccionar todo / Enviar historial completo']
];

function transferDefaultPermissions(full = false) {
    return {
        includePetData: true,
        includeTutorData: true,
        includeVaccines: full,
        includeInternalDeworming: full,
        includeExternalDeworming: full,
        includePreventiveHistory: full,
        includeNextAppointments: full,
        includeObservations: full,
        includePhotos: full,
        includeFullHistory: full
    };
}

function transferEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function transferFormatDate(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return date.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: '2-digit' });
}

function transferStatusLabel(status) {
    const map = {
        pending: 'Pendiente',
        accepted: 'Aceptada',
        rejected: 'Rechazada',
        cancelled: 'Cancelada',
        completed: 'Completada',
        expired: 'Vencida',
        blocked: 'Bloqueada',
        inactive: 'Inactiva',
        none: 'No asociada'
    };
    return map[status] || status || 'Sin estado';
}

function transferTypeLabel(type) {
    const map = {
        send_patient: 'Transferencia de pacientes',
        request_patient: 'Solicitud de paciente',
        association: 'Asociacion',
        reference: 'Referencia clinica',
        definitive: 'Transferencia definitiva',
        continuity: 'Continuidad clinica',
        emergency: 'Urgencia',
        history_consultation: 'Consulta de historial',
        other: 'Otro'
    };
    return map[type] || type || 'Transferencia';
}

function transferInitials(clinic) {
    if (clinic?.iniciales) return transferEscape(String(clinic.iniciales).slice(0, 5).toUpperCase());
    const name = clinic?.nombre || 'CD';
    return transferEscape(name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'CD');
}

async function transferLoadBaseData() {
    const [summary, associations, mailbox, patients] = await Promise.all([
        API.obtenerResumenTransferencias(),
        API.listarAsociacionesTransferencia(),
        API.obtenerBuzonTransferencias(),
        obtenerMascotas()
    ]);
    TransferState.summary = summary;
    TransferState.associations = associations;
    TransferState.mailbox = mailbox;
    TransferState.patients = patients;
}

async function renderizarTransferencias(forceReload = true) {
    const root = document.getElementById('transferencia-root');
    if (!root) return;
    try {
        if (forceReload || !TransferState.summary) {
            TransferState.loading = true;
            root.innerHTML = transferLoadingHtml('Cargando transferencias...');
            await transferLoadBaseData();
        }
    } catch (err) {
        root.innerHTML = `<div class="clinical-section transfer-empty"><h3>No se pudo cargar Transferencia</h3><p>${transferEscape(err.message || 'Error de conexion.')}</p></div>`;
        mostrarToast(err.message || 'Error al cargar transferencias.', 'error');
        return;
    } finally {
        TransferState.loading = false;
    }

    root.innerHTML = `
        <div class="dashboard-title-bar transfer-hero">
            <div class="welcome-box">
                <h1 id="transfer-title">Transferencia de pacientes</h1>
                <p>Envia, solicita y administra pacientes entre clinicas asociadas.</p>
            </div>
        </div>
        ${transferSummaryHtml()}
        <div class="transfer-tabs" role="tablist" aria-label="Secciones de transferencia">
            ${transferTabButton('movimientos', 'Movimientos')}
            ${transferTabButton('buzon', 'Buzon')}
            ${transferTabButton('buscar', 'Buscar clinica')}
            ${transferTabButton('asociadas', 'Clinicas asociadas')}
        </div>
        <div class="transfer-tab-panel">
            ${transferRenderActivePanel()}
        </div>
        <div id="transfer-detail-host">${TransferState.detail ? transferDetailModalHtml() : ''}</div>
    `;
}

function transferLoadingHtml(text) {
    return `<div class="transfer-loading-card"><strong>${transferEscape(text)}</strong><span>Consultando Supabase y preparando la pantalla.</span></div>`;
}

function transferSummaryHtml() {
    const s = TransferState.summary || {};
    const cards = [
        ['Solicitudes pendientes', s.solicitudesPendientes || 0, 'pending'],
        ['Pacientes enviados', s.pacientesEnviados || 0, 'sent'],
        ['Pacientes recibidos', s.pacientesRecibidos || 0, 'received'],
        ['Solicitudes de pacientes', s.solicitudesPacientes || 0, 'requests'],
        ['Clinicas asociadas', s.clinicasAsociadas || 0, 'clinics']
    ];
    return `<div class="transfer-summary-grid">${cards.map(([label, value, tone]) => `
        <article class="transfer-summary-card ${tone}">
            <span>${transferEscape(label)}</span>
            <strong>${Number(value) || 0}</strong>
        </article>`).join('')}</div>`;
}

function transferTabButton(tab, label) {
    return `<button class="filter-btn transfer-tab ${TransferState.tab === tab ? 'active' : ''}" type="button" onclick="transferSetTab('${tab}')">${transferEscape(label)}</button>`;
}

function transferSetTab(tab) {
    TransferState.tab = tab;
    TransferState.sendWizard = null;
    TransferState.requestWizard = null;
    renderizarTransferencias(false);
}

function transferRenderActivePanel() {
    if (TransferState.sendWizard) return transferSendWizardHtml();
    if (TransferState.requestWizard) return transferRequestWizardHtml();
    if (TransferState.tab === 'buzon') return transferMailboxHtml();
    if (TransferState.tab === 'buscar') return transferClinicSearchHtml();
    if (TransferState.tab === 'asociadas') return transferAssociatedHtml();
    return transferMovementsHtml();
}

function transferMovementsHtml() {
    return `
        <div class="transfer-action-grid">
            <article class="clinical-section transfer-action-card">
                <span class="transfer-action-icon">⇢</span>
                <h3>Enviar paciente</h3>
                <p>Transfiere uno o varios pacientes a una clinica asociada.</p>
                <button class="btn btn-primary" type="button" onclick="transferStartSendWizard()">Enviar paciente</button>
            </article>
            <article class="clinical-section transfer-action-card">
                <span class="transfer-action-icon">⇠</span>
                <h3>Solicitar paciente</h3>
                <p>Solicita a una clinica asociada que te comparta un paciente.</p>
                <button class="btn btn-primary" type="button" onclick="transferStartRequestWizard()">Solicitar paciente</button>
            </article>
        </div>
    `;
}

function transferSyncFullHistory(permissions) {
    const detailFields = TRANSFER_PERMISSION_FIELDS
        .map(([field]) => field)
        .filter(field => field !== 'includeFullHistory');
    permissions.includeFullHistory = detailFields.every(field => !!permissions[field]);
}

function transferStartSendWizard(destinationClinicId = '', patientIds = []) {
    TransferState.sendWizard = {
        step: 1,
        query: '',
        species: 'todos',
        preventive: 'todos',
        selected: new Set(),
        destinationClinicId,
        transferType: 'reference',
        reason: '',
        permissions: transferDefaultPermissions(false)
    };
    patientIds.filter(Boolean).forEach(id => TransferState.sendWizard.selected.add(id));
    TransferState.requestWizard = null;
    TransferState.tab = 'movimientos';
    renderizarTransferencias(false);
}

function transferStartRequestWizard(receiverClinicId = '') {
    TransferState.requestWizard = {
        step: receiverClinicId ? 2 : 1,
        receiverClinicId,
        transferType: 'continuity',
        reason: '',
        searchData: {
            patientName: '',
            patientCode: '',
            tutorName: '',
            tutorPhone: '',
            tutorEmail: '',
            species: '',
            breed: '',
            notes: ''
        }
    };
    TransferState.sendWizard = null;
    TransferState.tab = 'movimientos';
    renderizarTransferencias(false);
}

function transferAssociatedClinics() {
    return (TransferState.associations || []).filter(item => item.status === 'accepted');
}

function transferFilterPatients() {
    const wizard = TransferState.sendWizard;
    if (!wizard) return [];
    const q = (wizard.query || '').toLowerCase().trim();
    return (TransferState.patients || []).filter(patient => {
        const haystack = [
            patient.nombre,
            patient.codigo,
            patient.tutor?.nombre,
            patient.tutor?.telefono,
            patient.raza
        ].join(' ').toLowerCase();
        const species = (patient.especie || '').toLowerCase();
        const hasVaccines = (patient.vacunas || []).length > 0;
        const hasDeworming = (patient.desparasitaciones || []).length > 0;
        const hasFull = hasVaccines && hasDeworming;
        if (q && !haystack.includes(q)) return false;
        if (wizard.species === 'canino' && !['perro', 'canino'].includes(species)) return false;
        if (wizard.species === 'felino' && !['gato', 'felino'].includes(species)) return false;
        if (wizard.preventive === 'vacunas' && !hasVaccines) return false;
        if (wizard.preventive === 'desparasitaciones' && !hasDeworming) return false;
        if (wizard.preventive === 'completo' && !hasFull) return false;
        return true;
    });
}

function transferPreventiveStatus(patient) {
    const hasVaccines = (patient.vacunas || []).length > 0;
    const hasDeworming = (patient.desparasitaciones || []).length > 0;
    if (hasVaccines && hasDeworming) return 'Completo';
    if (hasVaccines) return 'Con vacunas';
    if (hasDeworming) return 'Con desparasitaciones';
    return 'Pendiente';
}

function transferPatientCard(patient, selected) {
    return `
        <label class="transfer-patient-card ${selected ? 'selected' : ''}">
            <input type="checkbox" ${selected ? 'checked' : ''} onchange="transferTogglePatient('${patient.id}', this.checked)">
            <span class="transfer-patient-avatar">${(patient.especie || '').toLowerCase().includes('gat') || (patient.especie || '').toLowerCase().includes('fel') ? 'F' : 'C'}</span>
            <span class="transfer-patient-main">
                <strong>${transferEscape(patient.nombre)}</strong>
                <small>Codigo: ${transferEscape(patient.codigo)}</small>
                <small>${transferEscape(mapearEspecie(patient.especie))} · ${transferEscape(patient.raza || 'Mestizo')} · ${transferEscape(patient.sexo || '')}</small>
                <small>Tutor: ${transferEscape(patient.tutor?.nombre || 'Sin tutor')} · ${transferEscape(patient.tutor?.telefono || 'Sin telefono')}</small>
            </span>
            <span class="transfer-status-badge completed">${transferPreventiveStatus(patient)}</span>
        </label>
    `;
}

function transferSendWizardHtml() {
    const wizard = TransferState.sendWizard;
    const selectedCount = wizard.selected.size;
    if (wizard.step === 1) {
        const patients = transferFilterPatients();
        return `
            <div class="clinical-section transfer-wizard">
                <div class="transfer-wizard-header">
                    <div><h3>Enviar paciente · Paso 1</h3><p>Selecciona uno o varios pacientes de tu inventario.</p></div>
                    <button class="btn btn-secondary" type="button" onclick="transferCancelWizard()">Cancelar</button>
                </div>
                <div class="transfer-filter-row">
                    <input class="form-control" value="${transferEscape(wizard.query)}" placeholder="Buscar por mascota, codigo, tutor o telefono" oninput="transferSetSendField('query', this.value)">
                    <select class="form-control" onchange="transferSetSendField('species', this.value)">
                        <option value="todos" ${wizard.species === 'todos' ? 'selected' : ''}>Todas las especies</option>
                        <option value="canino" ${wizard.species === 'canino' ? 'selected' : ''}>Canino</option>
                        <option value="felino" ${wizard.species === 'felino' ? 'selected' : ''}>Felino</option>
                    </select>
                    <select class="form-control" onchange="transferSetSendField('preventive', this.value)">
                        <option value="todos" ${wizard.preventive === 'todos' ? 'selected' : ''}>Todo historial</option>
                        <option value="vacunas" ${wizard.preventive === 'vacunas' ? 'selected' : ''}>Con vacunas</option>
                        <option value="desparasitaciones" ${wizard.preventive === 'desparasitaciones' ? 'selected' : ''}>Con desparasitaciones</option>
                        <option value="completo" ${wizard.preventive === 'completo' ? 'selected' : ''}>Historial completo</option>
                    </select>
                    <button class="btn btn-secondary" type="button" onclick="transferSelectFilteredPatients()">Seleccionar filtrados</button>
                </div>
                <div class="transfer-selected-counter">${selectedCount} pacientes seleccionados</div>
                <div class="transfer-patient-list">${patients.length ? patients.map(p => transferPatientCard(p, wizard.selected.has(p.id))).join('') : transferEmptyHtml('No hay pacientes con esos filtros.')}</div>
                <div class="transfer-wizard-actions">
                    <button class="btn btn-primary" type="button" ${selectedCount ? '' : 'disabled'} onclick="transferGoSendStep(${wizard.destinationClinicId ? 3 : 2})">Continuar</button>
                </div>
            </div>
        `;
    }
    if (wizard.step === 2) {
        const clinics = transferAssociatedClinics();
        return `
            <div class="clinical-section transfer-wizard">
                <div class="transfer-wizard-header">
                    <div><h3>Enviar paciente · Paso 2</h3><p>Elige una clinica asociada activa.</p></div>
                    <button class="btn btn-secondary" type="button" onclick="transferGoSendStep(1)">Volver</button>
                </div>
                ${clinics.length ? `<div class="transfer-clinic-grid">${clinics.map(item => transferClinicCard(item.clinic, {
                    status: 'Asociada',
                    button: `<button class="btn btn-primary" type="button" onclick="transferChooseDestination('${item.clinic.id}')">Elegir clinica</button>`
                })).join('')}</div>` : `
                    ${transferEmptyHtml('Todavia no tienes clinicas asociadas. Busca una clinica y envia una solicitud de asociacion.')}
                    <button class="btn btn-primary" type="button" onclick="transferSetTab('buscar')">Buscar clinica</button>
                `}
            </div>
        `;
    }
    const clinic = transferAssociatedClinics().find(item => item.clinic.id === wizard.destinationClinicId)?.clinic;
    return `
        <div class="clinical-section transfer-wizard">
            <div class="transfer-wizard-header">
                <div><h3>Enviar paciente · Paso 3</h3><p>Revisa permisos y motivo antes de enviar.</p></div>
                <button class="btn btn-secondary" type="button" onclick="transferGoSendStep(${wizard.destinationClinicId ? 2 : 1})">Volver</button>
            </div>
            <div class="transfer-review-grid">
                <div><strong>Pacientes seleccionados</strong><span>${selectedCount}</span></div>
                <div><strong>Clinica destino</strong><span>${transferEscape(clinic?.nombre || 'Selecciona una clinica')}</span></div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Tipo de transferencia</label>
                    <select class="form-control" onchange="transferSetSendField('transferType', this.value)">
                        <option value="reference" ${wizard.transferType === 'reference' ? 'selected' : ''}>Referencia clinica</option>
                        <option value="definitive" ${wizard.transferType === 'definitive' ? 'selected' : ''}>Transferencia definitiva</option>
                    </select>
                </div>
                <div class="form-group form-group-full">
                    <label>Motivo de transferencia</label>
                    <textarea class="form-control" rows="3" placeholder="Referencia para procedimiento quirurgico..." oninput="transferSetSendField('reason', this.value)">${transferEscape(wizard.reason)}</textarea>
                </div>
            </div>
            ${transferPermissionsHtml(wizard.permissions, 'transferToggleSendPermission')}
            <div class="transfer-wizard-actions">
                <button class="btn btn-primary" type="button" onclick="transferSubmitSendWizard()">Enviar solicitud de transferencia</button>
            </div>
        </div>
    `;
}

function transferRequestWizardHtml() {
    const wizard = TransferState.requestWizard;
    if (wizard.step === 1) {
        const clinics = transferAssociatedClinics();
        return `
            <div class="clinical-section transfer-wizard">
                <div class="transfer-wizard-header">
                    <div><h3>Solicitar paciente · Paso 1</h3><p>Elige la clinica asociada que revisara su inventario.</p></div>
                    <button class="btn btn-secondary" type="button" onclick="transferCancelWizard()">Cancelar</button>
                </div>
                ${clinics.length ? `<div class="transfer-clinic-grid">${clinics.map(item => transferClinicCard(item.clinic, {
                    status: 'Asociada',
                    button: `<button class="btn btn-primary" type="button" onclick="transferChooseRequestClinic('${item.clinic.id}')">Solicitar aqui</button>`
                })).join('')}</div>` : transferEmptyHtml('Necesitas al menos una clinica asociada para solicitar pacientes.')}
            </div>
        `;
    }
    if (wizard.step === 2) {
        const d = wizard.searchData;
        return `
            <div class="clinical-section transfer-wizard">
                <div class="transfer-wizard-header">
                    <div><h3>Solicitar paciente · Paso 2</h3><p>Ingresa los datos disponibles. No veras el inventario de la otra clinica.</p></div>
                    <button class="btn btn-secondary" type="button" onclick="transferGoRequestStep(1)">Volver</button>
                </div>
                <div class="form-grid">
                    ${transferInput('Nombre del paciente', 'patientName', d.patientName)}
                    ${transferInput('Codigo unico', 'patientCode', d.patientCode)}
                    ${transferInput('Nombre del tutor', 'tutorName', d.tutorName)}
                    ${transferInput('Telefono del tutor', 'tutorPhone', d.tutorPhone)}
                    ${transferInput('Correo del tutor', 'tutorEmail', d.tutorEmail)}
                    <div class="form-group">
                        <label>Especie</label>
                        <select class="form-control" onchange="transferSetRequestSearch('species', this.value)">
                            <option value="" ${!d.species ? 'selected' : ''}>No seguro</option>
                            <option value="Canino" ${d.species === 'Canino' ? 'selected' : ''}>Canino</option>
                            <option value="Felino" ${d.species === 'Felino' ? 'selected' : ''}>Felino</option>
                        </select>
                    </div>
                    ${transferInput('Raza', 'breed', d.breed)}
                    <div class="form-group">
                        <label>Tipo de solicitud</label>
                        <select class="form-control" onchange="transferSetRequestField('transferType', this.value)">
                            <option value="continuity">Continuidad clinica</option>
                            <option value="reference">Referencia</option>
                            <option value="emergency">Urgencia</option>
                            <option value="definitive">Cambio definitivo de clinica</option>
                            <option value="history_consultation">Consulta de historial</option>
                            <option value="other">Otro</option>
                        </select>
                    </div>
                    <div class="form-group form-group-full">
                        <label>Observaciones</label>
                        <textarea class="form-control" rows="2" oninput="transferSetRequestSearch('notes', this.value)">${transferEscape(d.notes)}</textarea>
                    </div>
                    <div class="form-group form-group-full">
                        <label>Motivo de solicitud</label>
                        <textarea class="form-control" rows="3" oninput="transferSetRequestField('reason', this.value)">${transferEscape(wizard.reason)}</textarea>
                    </div>
                </div>
                <div class="transfer-wizard-actions">
                    <button class="btn btn-primary" type="button" onclick="transferGoRequestStep(3)">Continuar</button>
                </div>
            </div>
        `;
    }
    const clinic = transferAssociatedClinics().find(item => item.clinic.id === wizard.receiverClinicId)?.clinic;
    const d = wizard.searchData;
    return `
        <div class="clinical-section transfer-wizard">
            <div class="transfer-wizard-header">
                <div><h3>Solicitar paciente · Paso 3</h3><p>Confirma los datos de busqueda antes de enviar.</p></div>
                <button class="btn btn-secondary" type="button" onclick="transferGoRequestStep(2)">Volver</button>
            </div>
            <div class="transfer-review-grid">
                <div><strong>Clinica destinataria</strong><span>${transferEscape(clinic?.nombre || '')}</span></div>
                <div><strong>Tipo</strong><span>${transferTypeLabel(wizard.transferType)}</span></div>
                <div><strong>Paciente</strong><span>${transferEscape(d.patientName || d.patientCode || 'Sin nombre')}</span></div>
                <div><strong>Tutor</strong><span>${transferEscape(d.tutorName || d.tutorPhone || 'Sin tutor')}</span></div>
            </div>
            <p class="transfer-note">${transferEscape(wizard.reason || 'Sin motivo especifico.')}</p>
            <div class="transfer-wizard-actions">
                <button class="btn btn-primary" type="button" onclick="transferSubmitRequestWizard()">Enviar solicitud de paciente</button>
            </div>
        </div>
    `;
}

function transferInput(label, field, value) {
    return `<div class="form-group"><label>${transferEscape(label)}</label><input class="form-control" value="${transferEscape(value)}" oninput="transferSetRequestSearch('${field}', this.value)"></div>`;
}

function transferPermissionsHtml(permissions, handler) {
    return `<div class="transfer-permission-grid">
        ${TRANSFER_PERMISSION_FIELDS.map(([field, label]) => `
            <label class="transfer-permission">
                <input type="checkbox" ${permissions[field] ? 'checked' : ''} onchange="${handler}('${field}', this.checked)">
                <span>${transferEscape(label)}</span>
            </label>
        `).join('')}
    </div>`;
}

function transferMailboxHtml() {
    const filters = [
        ['todos', 'Todos'],
        ['received', 'Recibidos'],
        ['sent', 'Enviados'],
        ['pending', 'Pendientes'],
        ['accepted', 'Aceptados'],
        ['rejected', 'Rechazados'],
        ['send_patient', 'Transferencias'],
        ['request_patient', 'Solicitudes'],
        ['association', 'Asociaciones']
    ];
    const items = (TransferState.mailbox || []).filter(item => {
        const f = TransferState.mailboxFilter;
        return f === 'todos' || item.direction === f || item.status === f || item.requestType === f || item.category === f;
    });
    return `
        <div class="clinical-section">
            <div class="transfer-wizard-header">
                <div><h3>Buzon</h3><p>Solicitudes, asociaciones y movimientos entre clinicas.</p></div>
                <button class="btn btn-secondary" type="button" onclick="transferRefresh()">Actualizar</button>
            </div>
            <div class="transfer-filter-pills">${filters.map(([key, label]) => `<button class="filter-btn ${TransferState.mailboxFilter === key ? 'active' : ''}" type="button" onclick="transferSetMailboxFilter('${key}')">${label}</button>`).join('')}</div>
            <div class="transfer-mailbox-list">
                ${items.length ? items.map(transferMailboxItemHtml).join('') : transferEmptyHtml('No hay elementos en este filtro.')}
            </div>
        </div>
    `;
}

function transferMailboxItemHtml(item) {
    const title = item.category === 'association' ? 'Solicitud de asociacion' : transferTypeLabel(item.requestType);
    const details = item.requestType === 'request_patient'
        ? `${item.searchPatientName || 'Paciente solicitado'} · ${item.searchTutorName || 'Tutor no indicado'}`
        : item.patientNames || item.reason || 'Sin pacientes listados';
    return `
        <article class="transfer-mailbox-item">
            <div>
                <div class="transfer-mailbox-title">
                    <strong>${transferEscape(title)}</strong>
                    ${transferStatusBadge(item.status)}
                </div>
                <p>${transferEscape(item.originName || 'Origen')} → ${transferEscape(item.destinationName || 'Destino')}</p>
                <small>${transferEscape(details)} · ${transferFormatDate(item.requestedAt)}</small>
            </div>
            <div class="transfer-mailbox-actions">
                ${item.category === 'association' ? transferAssociationMailboxActions(item) : `<button class="btn btn-secondary" type="button" onclick="transferOpenDetail('${item.id}')">Ver detalle</button>`}
            </div>
        </article>
    `;
}

function transferAssociationMailboxActions(item) {
    if (item.status === 'pending' && item.direction === 'received') {
        return `
            <button class="btn btn-primary" type="button" onclick="transferRespondAssociation('${item.id}', 'accept')">Aceptar</button>
            <button class="btn btn-danger" type="button" onclick="transferRespondAssociation('${item.id}', 'reject')">Rechazar</button>
        `;
    }
    return `<span class="transfer-muted">Asociacion ${transferStatusLabel(item.status)}</span>`;
}

function transferClinicSearchHtml() {
    return `
        <div class="clinical-section">
            <div class="transfer-wizard-header">
                <div><h3>Buscar clinica</h3><p>Busca otras clinicas registradas por nombre, iniciales, ciudad, correo, telefono o propietario.</p></div>
            </div>
            <div class="transfer-filter-row">
                <input id="transfer-clinic-query" class="form-control" placeholder="Nombre, iniciales, ciudad, correo..." onkeydown="if(event.key === 'Enter') transferSearchClinics()">
                <button class="btn btn-primary" type="button" onclick="transferSearchClinics()">Buscar</button>
            </div>
            <div class="transfer-clinic-grid">
                ${TransferState.clinics.length ? TransferState.clinics.map(transferSearchClinicCardHtml).join('') : transferEmptyHtml('Busca una clinica para enviar una solicitud de asociacion.')}
            </div>
        </div>
    `;
}

function transferSearchClinicCardHtml(clinic) {
    let action = '';
    if (clinic.relationshipStatus === 'none' || clinic.relationshipStatus === 'rejected' || clinic.relationshipStatus === 'inactive') {
        action = `<button class="btn btn-primary" type="button" onclick="transferSendAssociation('${clinic.id}')">Enviar solicitud de asociacion</button>`;
    } else if (clinic.relationshipStatus === 'pending' && clinic.isReceiver) {
        action = `<button class="btn btn-primary" type="button" onclick="transferRespondAssociation('${clinic.associationId}', 'accept')">Aceptar</button><button class="btn btn-danger" type="button" onclick="transferRespondAssociation('${clinic.associationId}', 'reject')">Rechazar</button>`;
    } else if (clinic.relationshipStatus === 'accepted') {
        action = `<button class="btn btn-secondary" type="button" onclick="transferSetTab('asociadas')">Ver asociacion</button>`;
    } else {
        action = `<button class="btn btn-secondary" type="button" disabled>Pendiente</button>`;
    }
    return transferClinicCard(clinic, { status: transferStatusLabel(clinic.relationshipStatus), button: action });
}

function transferAssociatedHtml() {
    const clinics = transferAssociatedClinics();
    return `
        <div class="clinical-section">
            <div class="transfer-wizard-header">
                <div><h3>Clinicas asociadas</h3><p>Clinicas con asociacion activa para enviar o solicitar pacientes.</p></div>
                <button class="btn btn-secondary" type="button" onclick="transferRefresh()">Actualizar</button>
            </div>
            <div class="transfer-clinic-grid">
                ${clinics.length ? clinics.map(item => transferClinicCard(item.clinic, {
                    status: 'Asociada',
                    button: `
                        <button class="btn btn-primary" type="button" onclick="transferStartSendWizard('${item.clinic.id}')">Enviar paciente</button>
                        <button class="btn btn-secondary" type="button" onclick="transferStartRequestWizard('${item.clinic.id}')">Solicitar paciente</button>
                        <button class="btn btn-danger" type="button" onclick="transferRespondAssociation('${item.id}', 'remove')">Quitar asociacion</button>
                    `
                })).join('') : transferEmptyHtml('Aun no tienes clinicas asociadas activas.')}
            </div>
        </div>
    `;
}

function transferClinicCard(clinic, options = {}) {
    return `
        <article class="transfer-clinic-card">
            <div class="transfer-clinic-avatar">${transferInitials(clinic)}</div>
            <div class="transfer-clinic-copy">
                <strong>${transferEscape(clinic.nombre)}</strong>
                <span>${transferEscape(clinic.propietario || 'Propietario no registrado')}</span>
                <small>${transferEscape(clinic.ciudad || clinic.direccion || 'Ciudad no registrada')}</small>
                <small>${transferEscape(clinic.telefono || 'Sin telefono')} · ${transferEscape(clinic.email || 'Sin correo')}</small>
                <em>${transferEscape(options.status || '')}</em>
            </div>
            <div class="transfer-clinic-actions">${options.button || ''}</div>
        </article>
    `;
}

function transferStatusBadge(status) {
    return `<span class="transfer-status-badge ${transferEscape(status || 'pending')}">${transferStatusLabel(status)}</span>`;
}

function transferEmptyHtml(text) {
    return `<div class="transfer-empty"><strong>${transferEscape(text)}</strong></div>`;
}

function transferTogglePatient(id, checked) {
    if (!TransferState.sendWizard) return;
    if (checked) TransferState.sendWizard.selected.add(id);
    else TransferState.sendWizard.selected.delete(id);
    renderizarTransferencias(false);
}

function transferSelectFilteredPatients() {
    if (!TransferState.sendWizard) return;
    transferFilterPatients().forEach(patient => TransferState.sendWizard.selected.add(patient.id));
    renderizarTransferencias(false);
}

function transferSetSendField(field, value) {
    if (!TransferState.sendWizard) return;
    TransferState.sendWizard[field] = value;
    renderizarTransferencias(false);
}

function transferGoSendStep(step) {
    if (!TransferState.sendWizard) return;
    if (step === 2 && TransferState.sendWizard.selected.size === 0) {
        mostrarToast('Selecciona al menos un paciente.', 'error');
        return;
    }
    if (step === 3 && !TransferState.sendWizard.destinationClinicId) {
        mostrarToast('Selecciona una clinica destino.', 'error');
        return;
    }
    TransferState.sendWizard.step = step;
    renderizarTransferencias(false);
}

function transferChooseDestination(clinicId) {
    if (!TransferState.sendWizard) return;
    TransferState.sendWizard.destinationClinicId = clinicId;
    TransferState.sendWizard.step = 3;
    renderizarTransferencias(false);
}

function transferToggleSendPermission(field, checked) {
    if (!TransferState.sendWizard) return;
    if (field === 'includeFullHistory') {
        Object.keys(TransferState.sendWizard.permissions).forEach(key => {
            TransferState.sendWizard.permissions[key] = checked;
        });
    } else {
        TransferState.sendWizard.permissions[field] = checked;
        transferSyncFullHistory(TransferState.sendWizard.permissions);
    }
    renderizarTransferencias(false);
}

async function transferSubmitSendWizard() {
    const wizard = TransferState.sendWizard;
    if (!wizard) return;
    if (!wizard.selected.size) return mostrarToast('Selecciona al menos un paciente.', 'error');
    if (!wizard.destinationClinicId) return mostrarToast('Selecciona una clinica destino.', 'error');
    if (!confirm('Enviar solicitud de transferencia a la clinica destino?')) return;
    try {
        mostrarToast('Enviando solicitud de transferencia...', 'info');
        await API.enviarTransferenciaPacientes({
            patientIds: Array.from(wizard.selected),
            destinationClinicId: wizard.destinationClinicId,
            transferType: wizard.transferType,
            reason: wizard.reason,
            permissions: wizard.permissions
        });
        mostrarToast('Solicitud de transferencia enviada.', 'success');
        TransferState.sendWizard = null;
        await transferRefresh();
    } catch (err) {
        mostrarToast(err.message || 'No se pudo enviar la transferencia.', 'error');
    }
}

function transferChooseRequestClinic(clinicId) {
    if (!TransferState.requestWizard) return;
    TransferState.requestWizard.receiverClinicId = clinicId;
    TransferState.requestWizard.step = 2;
    renderizarTransferencias(false);
}

function transferSetRequestField(field, value) {
    if (!TransferState.requestWizard) return;
    TransferState.requestWizard[field] = value;
}

function transferSetRequestSearch(field, value) {
    if (!TransferState.requestWizard) return;
    TransferState.requestWizard.searchData[field] = value;
}

function transferGoRequestStep(step) {
    if (!TransferState.requestWizard) return;
    if (step === 3 && !transferRequestHasMinimumData()) {
        mostrarToast('Ingresa codigo, telefono o nombre del paciente con tutor.', 'error');
        return;
    }
    TransferState.requestWizard.step = step;
    renderizarTransferencias(false);
}

function transferRequestHasMinimumData() {
    const d = TransferState.requestWizard?.searchData || {};
    return !!(
        (d.patientCode || '').trim() ||
        ((d.patientName || '').trim() && (d.tutorName || '').trim()) ||
        ((d.patientName || '').trim() && (d.tutorPhone || '').trim()) ||
        (d.tutorPhone || '').trim()
    );
}

async function transferSubmitRequestWizard() {
    const wizard = TransferState.requestWizard;
    if (!wizard) return;
    if (!wizard.receiverClinicId) return mostrarToast('Selecciona una clinica asociada.', 'error');
    if (!transferRequestHasMinimumData()) return mostrarToast('Faltan datos minimos para solicitar el paciente.', 'error');
    if (!confirm('Enviar solicitud de paciente a la clinica asociada?')) return;
    try {
        mostrarToast('Enviando solicitud de paciente...', 'info');
        await API.solicitarPacienteTransferencia({
            receiverClinicId: wizard.receiverClinicId,
            transferType: wizard.transferType,
            reason: wizard.reason,
            searchData: wizard.searchData
        });
        mostrarToast('Solicitud de paciente enviada.', 'success');
        TransferState.requestWizard = null;
        await transferRefresh();
    } catch (err) {
        mostrarToast(err.message || 'No se pudo solicitar el paciente.', 'error');
    }
}

function transferCancelWizard() {
    TransferState.sendWizard = null;
    TransferState.requestWizard = null;
    renderizarTransferencias(false);
}

async function transferSearchClinics() {
    const input = document.getElementById('transfer-clinic-query');
    const query = input ? input.value.trim() : '';
    try {
        mostrarToast('Buscando clinicas...', 'info');
        TransferState.clinics = await API.buscarClinicasTransferencia(query);
        renderizarTransferencias(false);
    } catch (err) {
        mostrarToast(err.message || 'No se pudo buscar clinicas.', 'error');
    }
}

async function transferSendAssociation(clinicId) {
    const message = prompt('Mensaje opcional para la solicitud de asociacion:', 'Queremos asociarnos para transferencias de pacientes.');
    if (message === null) return;
    try {
        await API.enviarSolicitudAsociacion(clinicId, message);
        mostrarToast('Solicitud de asociacion enviada.', 'success');
        TransferState.clinics = await API.buscarClinicasTransferencia(document.getElementById('transfer-clinic-query')?.value || '');
        await transferRefresh(false);
    } catch (err) {
        mostrarToast(err.message || 'No se pudo enviar la asociacion.', 'error');
    }
}

async function transferRespondAssociation(id, action) {
    const label = action === 'accept' ? 'aceptar' : action === 'reject' ? 'rechazar' : action === 'remove' ? 'quitar' : 'actualizar';
    if (!confirm(`Confirmas ${label} esta asociacion?`)) return;
    try {
        await API.responderAsociacion(id, action);
        mostrarToast('Asociacion actualizada.', 'success');
        await transferRefresh();
    } catch (err) {
        mostrarToast(err.message || 'No se pudo actualizar la asociacion.', 'error');
    }
}

function transferSetMailboxFilter(filter) {
    TransferState.mailboxFilter = filter;
    renderizarTransferencias(false);
}

async function transferOpenDetail(id) {
    try {
        TransferState.detail = await API.obtenerDetalleTransferencia(id);
        TransferState.matches = [];
        TransferState.selectedMatchId = '';
        if (TransferState.detail.requestType === 'request_patient' && TransferState.detail.status === 'pending') {
            try {
                TransferState.matches = await API.buscarCoincidenciasTransferencia(id);
            } catch (e) {
                TransferState.matches = [];
            }
        }
        renderizarTransferencias(false);
    } catch (err) {
        mostrarToast(err.message || 'No se pudo abrir el detalle.', 'error');
    }
}

function transferCloseDetail() {
    TransferState.detail = null;
    TransferState.matches = [];
    TransferState.selectedMatchId = '';
    renderizarTransferencias(false);
}

function transferDetailModalHtml() {
    const d = TransferState.detail;
    const current = API.getSessionVet();
    const isSendReceived = d.requestType === 'send_patient' && d.destinationClinicId === current?.id;
    const isRequestReceived = d.requestType === 'request_patient' && d.receiverClinicId === current?.id;
    const canRespond = d.status === 'pending' && (isSendReceived || isRequestReceived);
    return `
        <div class="modal active transfer-modal" role="dialog" aria-modal="true">
            <div class="modal-content transfer-detail">
                <div class="modal-header">
                    <h3 class="modal-title">${transferTypeLabel(d.requestType)}</h3>
                    <button class="modal-close" type="button" onclick="transferCloseDetail()" aria-label="Cerrar modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="transfer-review-grid">
                        <div><strong>Estado</strong><span>${transferStatusLabel(d.status)}</span></div>
                        <div><strong>Tipo</strong><span>${transferTypeLabel(d.transferType)}</span></div>
                        <div><strong>Origen</strong><span>${transferEscape(d.originClinic?.nombre || d.requesterClinic?.nombre || '')}</span></div>
                        <div><strong>Destino</strong><span>${transferEscape(d.destinationClinic?.nombre || d.receiverClinic?.nombre || '')}</span></div>
                    </div>
                    <p class="transfer-note">${transferEscape(d.reason || 'Sin motivo registrado.')}</p>
                    ${d.items?.length ? `<h4>Pacientes involucrados</h4><div class="transfer-detail-list">${d.items.map(item => `
                        <div><strong>${transferEscape(item.patientName)}</strong><span>${transferEscape(item.patientCode)} · ${transferEscape(item.tutorName)}</span></div>
                    `).join('')}</div>` : ''}
                    ${d.searchData ? `<h4>Datos de busqueda</h4><div class="transfer-review-grid">
                        <div><strong>Paciente</strong><span>${transferEscape(d.searchData.patientName || '-')}</span></div>
                        <div><strong>Codigo</strong><span>${transferEscape(d.searchData.patientCode || '-')}</span></div>
                        <div><strong>Tutor</strong><span>${transferEscape(d.searchData.tutorName || '-')}</span></div>
                        <div><strong>Telefono</strong><span>${transferEscape(d.searchData.tutorPhone || '-')}</span></div>
                    </div>` : ''}
                    ${isRequestReceived && d.status === 'pending' ? transferMatchesHtml() : ''}
                    ${canRespond ? `
                        ${transferPermissionsHtml(d.permissions || transferDefaultPermissions(false), 'transferToggleDetailPermission')}
                        <div class="transfer-wizard-actions">
                            <button class="btn btn-primary" type="button" onclick="transferAcceptDetail()">Aceptar</button>
                            <button class="btn btn-danger" type="button" onclick="transferRejectDetail()">Rechazar</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function transferMatchesHtml() {
    if (!TransferState.matches.length) return transferEmptyHtml('No se encontraron coincidencias automaticas. Puedes buscar datos mas precisos y volver a solicitar.');
    return `<h4>Coincidencias posibles</h4><div class="transfer-match-list">${TransferState.matches.map(match => `
        <label class="transfer-match-card ${TransferState.selectedMatchId === match.id ? 'selected' : ''}">
            <input type="radio" name="transfer-match" ${TransferState.selectedMatchId === match.id ? 'checked' : ''} onchange="transferSelectMatch('${match.id}')">
            <span><strong>${transferEscape(match.nombre)}</strong><small>${transferEscape(match.codigo)} · ${transferEscape(match.tutor?.nombre || '')}</small></span>
            <em>Coincidencia ${transferEscape(match.level)} (${match.score}%)</em>
        </label>
    `).join('')}</div>`;
}

function transferSelectMatch(id) {
    TransferState.selectedMatchId = id;
    renderizarTransferencias(false);
}

function transferToggleDetailPermission(field, checked) {
    if (!TransferState.detail) return;
    if (field === 'includeFullHistory') {
        Object.keys(TransferState.detail.permissions).forEach(key => {
            TransferState.detail.permissions[key] = checked;
        });
    } else {
        TransferState.detail.permissions[field] = checked;
        transferSyncFullHistory(TransferState.detail.permissions);
    }
    renderizarTransferencias(false);
}

async function transferAcceptDetail() {
    const d = TransferState.detail;
    if (!d) return;
    if (d.requestType === 'request_patient' && !TransferState.selectedMatchId) {
        mostrarToast('Selecciona la coincidencia correcta antes de aprobar.', 'error');
        return;
    }
    if (!confirm('Aceptar esta solicitud y copiar el paciente segun permisos?')) return;
    try {
        await API.aceptarTransferencia(d.id, {
            selectedPatientId: TransferState.selectedMatchId || undefined,
            transferType: d.transferType,
            permissions: d.permissions || transferDefaultPermissions(false)
        });
        mostrarToast('Solicitud aceptada.', 'success');
        TransferState.detail = null;
        await transferRefresh();
    } catch (err) {
        mostrarToast(err.message || 'No se pudo aceptar la solicitud.', 'error');
    }
}

async function transferRejectDetail() {
    const d = TransferState.detail;
    if (!d) return;
    const reason = prompt('Motivo opcional de rechazo:', '');
    if (reason === null) return;
    try {
        await API.rechazarTransferencia(d.id, reason);
        mostrarToast('Solicitud rechazada.', 'success');
        TransferState.detail = null;
        await transferRefresh();
    } catch (err) {
        mostrarToast(err.message || 'No se pudo rechazar la solicitud.', 'error');
    }
}

async function transferRefresh(render = true) {
    await transferLoadBaseData();
    if (render) renderizarTransferencias(false);
}

window.renderizarTransferencias = renderizarTransferencias;
window.transferSetTab = transferSetTab;
window.transferStartSendWizard = transferStartSendWizard;
window.transferStartRequestWizard = transferStartRequestWizard;
window.transferTogglePatient = transferTogglePatient;
window.transferSelectFilteredPatients = transferSelectFilteredPatients;
window.transferSetSendField = transferSetSendField;
window.transferGoSendStep = transferGoSendStep;
window.transferChooseDestination = transferChooseDestination;
window.transferToggleSendPermission = transferToggleSendPermission;
window.transferSubmitSendWizard = transferSubmitSendWizard;
window.transferChooseRequestClinic = transferChooseRequestClinic;
window.transferSetRequestField = transferSetRequestField;
window.transferSetRequestSearch = transferSetRequestSearch;
window.transferGoRequestStep = transferGoRequestStep;
window.transferSubmitRequestWizard = transferSubmitRequestWizard;
window.transferCancelWizard = transferCancelWizard;
window.transferSearchClinics = transferSearchClinics;
window.transferSendAssociation = transferSendAssociation;
window.transferRespondAssociation = transferRespondAssociation;
window.transferSetMailboxFilter = transferSetMailboxFilter;
window.transferOpenDetail = transferOpenDetail;
window.transferCloseDetail = transferCloseDetail;
window.transferSelectMatch = transferSelectMatch;
window.transferToggleDetailPermission = transferToggleDetailPermission;
window.transferAcceptDetail = transferAcceptDetail;
window.transferRejectDetail = transferRejectDetail;
window.transferRefresh = transferRefresh;
