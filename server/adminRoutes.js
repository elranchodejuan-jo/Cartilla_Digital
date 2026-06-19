const express = require('express');
const db = require('./db');
const authMiddleware = require('./authMiddleware');

const router = express.Router();

const TICKET_ESTADOS = new Set(['enviado', 'recibido', 'revisado', 'en_proceso', 'en_desarrollo', 'solucionado', 'rechazado', 'cerrado']);
const PAYMENT_STATUS = new Set(['pagado', 'pendiente', 'fallido', 'vencido', 'reembolsado', 'manual', 'verificado']);

function fechaSql(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function diasDesdeHoy(dias) {
    const date = new Date();
    date.setDate(date.getDate() + dias);
    return fechaSql(date);
}

function estadoPlan(row) {
    if (row.estado_cuenta === 'suspendida') return 'suspendido';
    if (row.estado_cuenta === 'prueba_gratis') return 'prueba gratis';
    if (!row.plan_vencimiento) return row.estado_cuenta || 'activo';

    const hoy = fechaSql();
    const limite = diasDesdeHoy(7);
    const vencimiento = fechaSql(new Date(row.plan_vencimiento));

    if (vencimiento < hoy) return 'vencido';
    if (vencimiento <= limite) return 'por caducar';
    return row.estado_cuenta || 'activo';
}

async function registrarActividad(req, action, module, description, metadata = {}, clinicId = null, level = 'info') {
    try {
        await db.query(
            `INSERT INTO activity_logs (actor_user_id, actor_email, clinic_id, action, module, description, metadata, level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                req.veterinaria.id,
                req.veterinaria.email,
                clinicId,
                action,
                module,
                description,
                JSON.stringify(metadata || {}),
                level
            ]
        );
    } catch (err) {
        console.warn('No se pudo registrar actividad admin:', err.message);
    }
}

async function requireSuperAdmin(req, res, next) {
    try {
        const result = await db.query(
            `SELECT id, email, nombre, propietario, iniciales, telefono, direccion, logo_base64 AS logo,
                    role, estado_cuenta, plan_actual
             FROM veterinarias
             WHERE id = $1`,
            [req.veterinaria.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Sesion invalida. Vuelve a iniciar sesion.' });
        }

        const cuenta = result.rows[0];
        if (cuenta.role !== 'super_admin') {
            return res.status(403).json({ error: 'No tienes permiso para acceder al Centro de Control.' });
        }

        req.adminUser = cuenta;
        next();
    } catch (err) {
        console.error('Error validando super_admin:', err);
        res.status(500).json({ error: 'No se pudo validar el acceso administrativo.' });
    }
}

router.use(authMiddleware);
router.use(requireSuperAdmin);

router.get('/me', (req, res) => {
    res.json({ user: req.adminUser });
});

router.get('/summary', async (req, res) => {
    try {
        const [clinicasRes, mascotasRes, tutoresRes, feedbackRes, planStatsRes, ultimasClinicasRes, ultimosPacientesRes, planesRes] = await Promise.all([
            db.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE estado_cuenta = 'activa')::int AS activas,
                    COUNT(*) FILTER (WHERE estado_cuenta = 'suspendida')::int AS suspendidas,
                    COUNT(*) FILTER (WHERE estado_cuenta = 'prueba_gratis')::int AS prueba_gratis
                FROM veterinarias
            `),
            db.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE LOWER(especie) IN ('perro', 'canino', 'p'))::int AS caninos,
                    COUNT(*) FILTER (WHERE LOWER(especie) IN ('gato', 'felino', 'g'))::int AS felinos,
                    COUNT(*) FILTER (WHERE fecha_registro::date = CURRENT_DATE)::int AS hoy,
                    COUNT(*) FILTER (WHERE fecha_registro >= date_trunc('week', CURRENT_DATE))::int AS semana,
                    COUNT(*) FILTER (WHERE fecha_registro >= date_trunc('month', CURRENT_DATE))::int AS mes
                FROM mascotas
            `),
            db.query(`
                SELECT COUNT(*)::int AS total
                FROM (
                    SELECT DISTINCT veterinaria_id, LOWER(TRIM(COALESCE(tutor_nombre, ''))) AS nombre,
                           LOWER(TRIM(COALESCE(tutor_telefono, ''))) AS telefono,
                           LOWER(TRIM(COALESCE(tutor_email, ''))) AS email
                    FROM mascotas
                    WHERE COALESCE(TRIM(tutor_nombre), '') <> ''
                ) t
            `),
            db.query(`
                SELECT (
                    (SELECT COUNT(*) FROM admin_feedback WHERE status IN ('nuevo', 'en_revision')) +
                    (SELECT COUNT(*) FROM support_tickets WHERE status IN ('enviado', 'recibido', 'revisado'))
                )::int AS nuevos
            `),
            db.query(`
                SELECT
                    COUNT(*) FILTER (
                        WHERE estado_cuenta <> 'suspendida'
                          AND (plan_vencimiento IS NULL OR plan_vencimiento >= CURRENT_DATE)
                    )::int AS activos,
                    COUNT(*) FILTER (
                        WHERE plan_vencimiento IS NOT NULL
                          AND plan_vencimiento >= CURRENT_DATE
                          AND plan_vencimiento <= CURRENT_DATE + INTERVAL '7 days'
                    )::int AS por_caducar,
                    COUNT(*) FILTER (
                        WHERE plan_vencimiento IS NOT NULL
                          AND plan_vencimiento < CURRENT_DATE
                    )::int AS vencidos
                FROM veterinarias
            `),
            db.query(`
                SELECT id, nombre, propietario, email, fecha_registro, estado_cuenta, plan_actual
                FROM veterinarias
                ORDER BY fecha_registro DESC
                LIMIT 5
            `),
            db.query(`
                SELECT m.id, m.nombre, m.especie, m.raza, m.fecha_registro, m.tutor_nombre,
                       v.nombre AS clinica
                FROM mascotas m
                JOIN veterinarias v ON v.id = m.veterinaria_id
                ORDER BY m.fecha_registro DESC
                LIMIT 5
            `),
            db.query(`
                SELECT id, nombre, email, plan_actual, estado_cuenta, plan_vencimiento
                FROM veterinarias
                WHERE plan_vencimiento IS NOT NULL
                ORDER BY plan_vencimiento ASC
                LIMIT 8
            `)
        ]);

        const plans = planesRes.rows.map(row => ({ ...row, estado_plan: estadoPlan(row) }));
        const planesActivos = planStatsRes.rows[0].activos;
        const planesPorCaducar = planStatsRes.rows[0].por_caducar;
        const planesVencidos = planStatsRes.rows[0].vencidos;

        res.json({
            stats: {
                totalClinicas: clinicasRes.rows[0].total,
                clinicasActivas: clinicasRes.rows[0].activas,
                clinicasSuspendidas: clinicasRes.rows[0].suspendidas,
                clinicasPruebaGratis: clinicasRes.rows[0].prueba_gratis,
                totalPacientes: mascotasRes.rows[0].total,
                totalCaninos: mascotasRes.rows[0].caninos,
                totalFelinos: mascotasRes.rows[0].felinos,
                totalTutores: tutoresRes.rows[0].total,
                pacientesHoy: mascotasRes.rows[0].hoy,
                pacientesSemana: mascotasRes.rows[0].semana,
                pacientesMes: mascotasRes.rows[0].mes,
                planesActivos,
                planesPorCaducar,
                planesVencidos,
                feedbackNuevos: feedbackRes.rows[0].nuevos
            },
            latestClinics: ultimasClinicasRes.rows,
            latestPatients: ultimosPacientesRes.rows,
            expiringPlans: plans,
            alerts: construirAlertas(clinicasRes.rows[0], mascotasRes.rows[0], plans, feedbackRes.rows[0])
        });
    } catch (err) {
        console.error('Error cargando resumen admin:', err);
        res.status(500).json({ error: 'No se pudo cargar el resumen administrativo.' });
    }
});

function construirAlertas(clinicas, mascotas, plans, feedback) {
    const alerts = [];
    if (clinicas.suspendidas > 0) {
        alerts.push({ level: 'warning', title: 'Clinicas suspendidas', detail: `${clinicas.suspendidas} cuenta(s) requieren seguimiento.` });
    }
    const vencidos = plans.filter(row => row.estado_plan === 'vencido').length;
    if (vencidos > 0) {
        alerts.push({ level: 'danger', title: 'Planes vencidos', detail: `${vencidos} plan(es) estan vencidos.` });
    }
    if (feedback.nuevos > 0) {
        alerts.push({ level: 'info', title: 'Comentarios pendientes', detail: `${feedback.nuevos} comentario(s) nuevos o en revision.` });
    }
    if (mascotas.hoy > 0) {
        alerts.push({ level: 'success', title: 'Actividad de hoy', detail: `${mascotas.hoy} paciente(s) registrados hoy.` });
    }
    if (alerts.length === 0) {
        alerts.push({ level: 'success', title: 'Sistema estable', detail: 'No hay alertas criticas en este momento.' });
    }
    return alerts;
}

router.get('/clinics', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT v.id, v.nombre, v.propietario, v.email, v.telefono, v.direccion, v.fecha_registro,
                   v.role, v.estado_cuenta, v.plan_actual, v.plan_inicio, v.plan_vencimiento,
                   v.trial_inicio, v.trial_fin, v.ultimo_login, v.notas_internas,
                   COUNT(DISTINCT m.id)::int AS pacientes,
                   COUNT(DISTINCT e.id)::int AS equipo
            FROM veterinarias v
            LEFT JOIN mascotas m ON m.veterinaria_id = v.id
            LEFT JOIN equipo_veterinario e ON e.veterinaria_id = v.id
            GROUP BY v.id
            ORDER BY v.fecha_registro DESC
        `);

        res.json(result.rows.map(row => ({ ...row, estado_plan: estadoPlan(row) })));
    } catch (err) {
        console.error('Error cargando clinicas admin:', err);
        res.status(500).json({ error: 'No se pudieron cargar las clinicas.' });
    }
});

router.patch('/clinics/:id', async (req, res) => {
    const { estadoCuenta, planActual, planVencimiento, notasInternas } = req.body;
    const id = req.params.id;

    try {
        const result = await db.query(
            `UPDATE veterinarias
             SET estado_cuenta = COALESCE($1, estado_cuenta),
                 plan_actual = COALESCE($2, plan_actual),
                 plan_vencimiento = COALESCE($3, plan_vencimiento),
                 notas_internas = COALESCE($4, notas_internas)
             WHERE id = $5
             RETURNING id, nombre, email, estado_cuenta, plan_actual, plan_vencimiento, notas_internas`,
            [estadoCuenta || null, planActual || null, planVencimiento || null, notasInternas || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Clinica no encontrada.' });
        }

        await registrarActividad(req, 'admin_clinic_update', 'clinics', 'Actualizacion administrativa de clinica.', req.body, id);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error actualizando clinica admin:', err);
        res.status(500).json({ error: 'No se pudo actualizar la clinica.' });
    }
});

router.get('/patients', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.id, m.codigo, m.nombre, m.especie, m.raza, m.sexo, m.fecha_nacimiento,
                   m.color, m.peso, m.tutor_nombre, m.tutor_telefono, m.tutor_email,
                   m.fecha_registro, v.id AS clinica_id, v.nombre AS clinica,
                   (SELECT MIN(proxima_dosis) FROM vacunas WHERE mascota_id = m.id AND proxima_dosis >= CURRENT_DATE) AS proxima_vacuna,
                   (SELECT MIN(proxima_aplicacion) FROM desparasitaciones WHERE mascota_id = m.id AND proxima_aplicacion >= CURRENT_DATE) AS proxima_desparasitacion
            FROM mascotas m
            JOIN veterinarias v ON v.id = m.veterinaria_id
            ORDER BY m.fecha_registro DESC
            LIMIT 500
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error cargando pacientes globales:', err);
        res.status(500).json({ error: 'No se pudieron cargar los pacientes globales.' });
    }
});

router.get('/tutors', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT MIN(m.id::text) AS id, m.veterinaria_id AS clinica_id, v.nombre AS clinica,
                   COALESCE(MAX(NULLIF(TRIM(m.tutor_nombre), '')), 'Sin tutor') AS nombre,
                   COALESCE(MAX(NULLIF(TRIM(m.tutor_telefono), '')), '') AS telefono,
                   COALESCE(MAX(NULLIF(TRIM(m.tutor_email), '')), '') AS email,
                   COALESCE(MAX(NULLIF(TRIM(m.tutor_direccion), '')), '') AS direccion,
                   COUNT(m.id)::int AS mascotas,
                   MIN(m.fecha_registro) AS fecha_registro,
                   CASE
                       WHEN COALESCE(MAX(NULLIF(TRIM(m.tutor_telefono), '')), '') = ''
                         OR COALESCE(MAX(NULLIF(TRIM(m.tutor_email), '')), '') = '' THEN 'incompleto'
                       ELSE 'completo'
                   END AS estado_datos
            FROM mascotas m
            JOIN veterinarias v ON v.id = m.veterinaria_id
            GROUP BY m.veterinaria_id, v.nombre, LOWER(TRIM(COALESCE(m.tutor_nombre, ''))), LOWER(TRIM(COALESCE(m.tutor_telefono, '')))
            ORDER BY MIN(m.fecha_registro) DESC
            LIMIT 500
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error cargando tutores admin:', err);
        res.status(500).json({ error: 'No se pudieron cargar los tutores.' });
    }
});

router.get('/plans', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT v.id, v.nombre AS clinica, v.email, v.plan_actual, v.plan_inicio, v.plan_vencimiento,
                   v.estado_cuenta, v.trial_inicio, v.trial_fin,
                   COUNT(m.id)::int AS pacientes
            FROM veterinarias v
            LEFT JOIN mascotas m ON m.veterinaria_id = v.id
            GROUP BY v.id
            ORDER BY v.plan_vencimiento ASC NULLS LAST, v.fecha_registro DESC
        `);

        res.json(result.rows.map(row => ({
            ...row,
            estado_plan: estadoPlan(row),
            dias_restantes: row.plan_vencimiento
                ? Math.ceil((new Date(row.plan_vencimiento) - new Date()) / 86400000)
                : null
        })));
    } catch (err) {
        console.error('Error cargando planes admin:', err);
        res.status(500).json({ error: 'No se pudieron cargar los planes.' });
    }
});

router.get('/feedback', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT f.id, f.user_email, f.type, f.priority, f.message, f.attachment_url,
                   f.status, f.internal_response, f.internal_notes, f.created_at, f.updated_at,
                   v.nombre AS clinica, v.id AS clinica_id
            FROM admin_feedback f
            LEFT JOIN veterinarias v ON v.id = f.veterinaria_id
            ORDER BY f.created_at DESC
            LIMIT 300
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error cargando feedback admin:', err);
        res.status(500).json({ error: 'No se pudieron cargar los comentarios.' });
    }
});

router.patch('/feedback/:id', async (req, res) => {
    const { status, internalResponse, internalNotes } = req.body;

    try {
        const result = await db.query(
            `UPDATE admin_feedback
             SET status = COALESCE($1, status),
                 internal_response = COALESCE($2, internal_response),
                 internal_notes = COALESCE($3, internal_notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [status || null, internalResponse || null, internalNotes || null, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comentario no encontrado.' });
        }

        await registrarActividad(req, 'admin_feedback_update', 'feedback', 'Actualizacion de comentario/reporte.', req.body);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error actualizando feedback:', err);
        res.status(500).json({ error: 'No se pudo actualizar el comentario.' });
    }
});

router.get('/tickets', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT t.id, t.subject, t.message, t.type, t.priority, t.status, t.related_module,
                   t.admin_response, t.admin_notes, t.attachment_url, t.assigned_to,
                   t.created_at, t.updated_at, t.resolved_at, t.closed_at,
                   v.nombre AS clinica, v.email AS clinic_email, v.id AS clinic_id,
                   u.email AS assigned_email,
                   EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.created_at))::int AS open_seconds
            FROM support_tickets t
            JOIN veterinarias v ON v.id = t.clinic_id
            LEFT JOIN veterinarias u ON u.id = t.assigned_to
            ORDER BY
                CASE t.priority WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
                t.updated_at DESC,
                t.created_at DESC
            LIMIT 500
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error cargando tickets admin:', err);
        res.status(500).json({ error: 'No se pudieron cargar los tickets de soporte.' });
    }
});

router.patch('/tickets/:id', async (req, res) => {
    const { status, adminResponse, adminNotes, assignedTo, note } = req.body;
    if (status && !TICKET_ESTADOS.has(status)) {
        return res.status(400).json({ error: 'Estado de ticket no valido.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query('SELECT * FROM support_tickets WHERE id = $1 FOR UPDATE', [req.params.id]);
        if (current.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Ticket no encontrado.' });
        }

        const previous = current.rows[0];
        const newStatus = status || previous.status;
        const resolvedAtSql = newStatus === 'solucionado' && previous.status !== 'solucionado'
            ? 'CURRENT_TIMESTAMP'
            : 'resolved_at';
        const closedAtSql = newStatus === 'cerrado' && previous.status !== 'cerrado'
            ? 'CURRENT_TIMESTAMP'
            : 'closed_at';

        const result = await client.query(
            `UPDATE support_tickets
             SET status = $1,
                 admin_response = COALESCE($2, admin_response),
                 admin_notes = COALESCE($3, admin_notes),
                 assigned_to = COALESCE($4, assigned_to),
                 updated_at = CURRENT_TIMESTAMP,
                 resolved_at = ${resolvedAtSql},
                 closed_at = ${closedAtSql}
             WHERE id = $5
             RETURNING *`,
            [newStatus, adminResponse || null, adminNotes || null, assignedTo || null, req.params.id]
        );

        if (newStatus !== previous.status) {
            await client.query(
                `INSERT INTO support_ticket_status_history (ticket_id, previous_status, new_status, changed_by, note)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.params.id, previous.status, newStatus, req.veterinaria.id, note || 'Cambio realizado desde Admin Center.']
            );
        }

        if (adminResponse && adminResponse !== previous.admin_response) {
            await client.query(
                `INSERT INTO support_ticket_messages (ticket_id, sender_user_id, sender_role, message)
                 VALUES ($1, $2, 'admin', $3)`,
                [req.params.id, req.veterinaria.id, adminResponse]
            );
        }

        await client.query('COMMIT');
        await registrarActividad(req, 'ticket_admin_update', 'support', 'Actualizacion administrativa de ticket.', {
            ticketId: req.params.id,
            previousStatus: previous.status,
            newStatus
        }, previous.clinic_id, newStatus === 'rechazado' ? 'warning' : 'info');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error actualizando ticket admin:', err);
        res.status(500).json({ error: 'No se pudo actualizar el ticket.' });
    } finally {
        client.release();
    }
});

router.get('/payments', async (req, res) => {
    try {
        const [paymentsRes, statsRes, planRes] = await Promise.all([
            db.query(`
                SELECT p.id, p.clinic_id, v.nombre AS clinica, v.email AS clinic_email,
                       p.plan_name, p.amount, p.currency, p.payment_method, p.payment_status,
                       p.payment_date, p.period_start, p.period_end, p.reference,
                       p.receipt_url, p.notes, p.created_at, p.updated_at
                FROM payments p
                JOIN veterinarias v ON v.id = p.clinic_id
                ORDER BY COALESCE(p.payment_date, p.created_at) DESC
                LIMIT 500
            `),
            db.query(`
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE payment_status IN ('pagado', 'verificado') AND payment_date >= date_trunc('month', CURRENT_DATE)), 0)::numeric AS ingresos_mes,
                    COALESCE(SUM(amount) FILTER (WHERE payment_status IN ('pagado', 'verificado') AND payment_date >= date_trunc('week', CURRENT_DATE)), 0)::numeric AS ingresos_semana,
                    COUNT(*) FILTER (WHERE payment_status = 'pendiente')::int AS pagos_pendientes,
                    COUNT(*) FILTER (WHERE payment_status = 'vencido')::int AS pagos_vencidos,
                    COUNT(DISTINCT clinic_id) FILTER (WHERE payment_status IN ('pagado', 'verificado'))::int AS clinicas_al_dia,
                    COUNT(DISTINCT clinic_id) FILTER (WHERE payment_status = 'vencido')::int AS clinicas_vencidas
                FROM payments
            `),
            db.query(`
                SELECT COALESCE(plan_name, 'Sin plan') AS plan_name, COUNT(*)::int AS total
                FROM payments
                WHERE payment_status IN ('pagado', 'verificado')
                GROUP BY COALESCE(plan_name, 'Sin plan')
                ORDER BY total DESC
                LIMIT 1
            `)
        ]);

        res.json({
            stats: {
                ...statsRes.rows[0],
                plan_mas_vendido: planRes.rows[0]?.plan_name || 'Sin datos'
            },
            payments: paymentsRes.rows
        });
    } catch (err) {
        console.error('Error cargando pagos admin:', err);
        res.status(500).json({ error: 'No se pudo cargar el historial de pagos.' });
    }
});

router.post('/payments', async (req, res) => {
    const clinicId = req.body.clinicId || req.body.clinic_id;
    const amount = Number(req.body.amount || 0);
    const paymentStatus = req.body.paymentStatus || req.body.payment_status || 'manual';

    if (!clinicId) return res.status(400).json({ error: 'Selecciona una clinica.' });
    if (!PAYMENT_STATUS.has(paymentStatus)) return res.status(400).json({ error: 'Estado de pago no valido.' });

    try {
        const result = await db.query(
            `INSERT INTO payments (clinic_id, plan_name, amount, currency, payment_method, payment_status,
                                   payment_date, period_start, period_end, reference, receipt_url, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP), $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                clinicId,
                req.body.planName || req.body.plan_name || null,
                Number.isFinite(amount) ? amount : 0,
                req.body.currency || 'USD',
                req.body.paymentMethod || req.body.payment_method || 'manual',
                paymentStatus,
                req.body.paymentDate || req.body.payment_date || null,
                req.body.periodStart || req.body.period_start || null,
                req.body.periodEnd || req.body.period_end || null,
                req.body.reference || null,
                req.body.receiptUrl || req.body.receipt_url || null,
                req.body.notes || null,
                req.veterinaria.id
            ]
        );
        await registrarActividad(req, 'payment_manual_created', 'payments', 'Pago manual registrado desde Admin Center.', {
            paymentId: result.rows[0].id,
            amount: result.rows[0].amount,
            status: result.rows[0].payment_status
        }, clinicId);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creando pago manual:', err);
        res.status(500).json({ error: 'No se pudo registrar el pago manual.' });
    }
});

router.patch('/payments/:id', async (req, res) => {
    const paymentStatus = req.body.paymentStatus || req.body.payment_status;
    if (paymentStatus && !PAYMENT_STATUS.has(paymentStatus)) {
        return res.status(400).json({ error: 'Estado de pago no valido.' });
    }

    try {
        const result = await db.query(
            `UPDATE payments
             SET payment_status = COALESCE($1, payment_status),
                 notes = COALESCE($2, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [paymentStatus || null, req.body.notes || null, req.params.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado.' });
        await registrarActividad(req, 'payment_update', 'payments', 'Pago actualizado desde Admin Center.', req.body, result.rows[0].clinic_id);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error actualizando pago:', err);
        res.status(500).json({ error: 'No se pudo actualizar el pago.' });
    }
});

router.get('/usage-metrics', async (req, res) => {
    try {
        const [summary, clinicUsage, activeClinics, inactiveClinics] = await Promise.all([
            db.query(`
                SELECT
                    COUNT(DISTINCT v.id) FILTER (WHERE v.ultimo_login::date = CURRENT_DATE)::int AS clinicas_hoy,
                    COUNT(DISTINCT v.id) FILTER (WHERE v.ultimo_login >= date_trunc('week', CURRENT_DATE))::int AS clinicas_semana,
                    COUNT(DISTINCT v.id) FILTER (WHERE v.ultimo_login >= date_trunc('month', CURRENT_DATE))::int AS clinicas_mes,
                    (SELECT COUNT(*)::int FROM mascotas WHERE fecha_registro::date = CURRENT_DATE) AS pacientes_hoy,
                    (SELECT COUNT(*)::int FROM mascotas WHERE fecha_registro >= date_trunc('week', CURRENT_DATE)) AS pacientes_semana,
                    (SELECT COUNT(*)::int FROM mascotas WHERE fecha_registro >= date_trunc('month', CURRENT_DATE)) AS pacientes_mes,
                    (SELECT COUNT(*)::int FROM vacunas) AS vacunas_registradas,
                    (SELECT COUNT(*)::int FROM desparasitaciones WHERE tipo = 'interna') AS desparasitaciones_internas,
                    (SELECT COUNT(*)::int FROM desparasitaciones WHERE tipo = 'externa') AS desparasitaciones_externas,
                    (SELECT COUNT(*)::int FROM controles) AS controles_preventivos,
                    (SELECT COUNT(*)::int FROM support_tickets) AS tickets_enviados
                FROM veterinarias v
            `),
            db.query(`
                SELECT v.id, v.nombre AS clinica, v.plan_actual, v.ultimo_login,
                       COUNT(DISTINCT m.id)::int AS pacientes,
                       COUNT(DISTINCT vac.id)::int AS vacunas,
                       COUNT(DISTINCT des.id)::int AS desparasitaciones,
                       COUNT(DISTINCT c.id)::int AS controles,
                       COUNT(DISTINCT st.id)::int AS tickets,
                       COUNT(DISTINCT bv.id)::int AS banco_vacunas
                FROM veterinarias v
                LEFT JOIN mascotas m ON m.veterinaria_id = v.id
                LEFT JOIN vacunas vac ON vac.mascota_id = m.id
                LEFT JOIN desparasitaciones des ON des.mascota_id = m.id
                LEFT JOIN controles c ON c.mascota_id = m.id
                LEFT JOIN support_tickets st ON st.clinic_id = v.id
                LEFT JOIN banco_vacunas bv ON bv.veterinaria_id = v.id
                GROUP BY v.id
                ORDER BY pacientes DESC, v.ultimo_login DESC NULLS LAST
                LIMIT 300
            `),
            db.query(`
                SELECT id, nombre AS clinica, ultimo_login, plan_actual
                FROM veterinarias
                ORDER BY ultimo_login DESC NULLS LAST
                LIMIT 10
            `),
            db.query(`
                SELECT id, nombre AS clinica, ultimo_login, plan_actual
                FROM veterinarias
                WHERE ultimo_login IS NULL OR ultimo_login < CURRENT_DATE - INTERVAL '15 days'
                ORDER BY ultimo_login ASC NULLS FIRST
                LIMIT 10
            `)
        ]);

        res.json({
            summary: summary.rows[0],
            clinicUsage: clinicUsage.rows,
            mostActiveClinics: activeClinics.rows,
            inactiveClinics: inactiveClinics.rows
        });
    } catch (err) {
        console.error('Error cargando metricas de uso:', err);
        res.status(500).json({ error: 'No se pudieron cargar las metricas de uso.' });
    }
});

router.get('/support-users', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, nombre, propietario, email, telefono, role, estado_cuenta, plan_actual,
                   fecha_registro, ultimo_login
            FROM veterinarias
            ORDER BY fecha_registro DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error cargando usuarios de soporte:', err);
        res.status(500).json({ error: 'No se pudieron cargar los usuarios de soporte.' });
    }
});

router.get('/activity', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.id, a.actor_email, a.action, a.module, a.description, a.level,
                   a.metadata, a.created_at, v.nombre AS clinica
            FROM activity_logs a
            LEFT JOIN veterinarias v ON v.id = a.clinic_id
            ORDER BY a.created_at DESC
            LIMIT 300
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error cargando actividad:', err);
        res.status(500).json({ error: 'No se pudo cargar la actividad del sistema.' });
    }
});

router.get('/alerts', async (req, res) => {
    try {
        const [persisted, suspendidas, vencidos, porVencer, ticketsUrgentes, ticketsSinRespuesta] = await Promise.all([
            db.query(`
                SELECT a.id, a.alert_type, a.title, a.description, a.severity, a.status,
                       a.source_module, a.related_id, a.created_at, v.nombre AS clinica
                FROM admin_alerts a
                LEFT JOIN veterinarias v ON v.id = a.clinic_id
                WHERE a.status IN ('pendiente', 'en_revision')
                ORDER BY
                    CASE a.severity WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
                    a.created_at DESC
                LIMIT 100
            `),
            db.query(`SELECT id, nombre FROM veterinarias WHERE estado_cuenta = 'suspendida' ORDER BY nombre ASC LIMIT 20`),
            db.query(`SELECT id, nombre, plan_vencimiento FROM veterinarias WHERE plan_vencimiento IS NOT NULL AND plan_vencimiento < CURRENT_DATE ORDER BY plan_vencimiento ASC LIMIT 20`),
            db.query(`SELECT id, nombre, plan_vencimiento FROM veterinarias WHERE plan_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' ORDER BY plan_vencimiento ASC LIMIT 20`),
            db.query(`
                SELECT t.id, t.subject, t.priority, t.status, t.created_at, v.nombre AS clinica
                FROM support_tickets t
                JOIN veterinarias v ON v.id = t.clinic_id
                WHERE t.priority = 'urgente' AND t.status NOT IN ('solucionado', 'cerrado', 'rechazado')
                ORDER BY t.created_at ASC
                LIMIT 20
            `),
            db.query(`
                SELECT t.id, t.subject, t.priority, t.status, t.created_at, v.nombre AS clinica
                FROM support_tickets t
                JOIN veterinarias v ON v.id = t.clinic_id
                WHERE t.status IN ('enviado', 'recibido', 'revisado')
                  AND t.created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
                ORDER BY t.created_at ASC
                LIMIT 20
            `)
        ]);

        const alerts = persisted.rows.map(row => ({
            id: row.id,
            level: row.severity === 'critica' ? 'danger' : row.severity === 'alta' ? 'warning' : 'info',
            severity: row.severity,
            status: row.status,
            title: row.title,
            detail: row.description || row.clinica || 'Alerta registrada',
            source: row.source_module,
            relatedId: row.related_id,
            persistent: true
        }));

        suspendidas.rows.forEach(row => alerts.push({
            level: 'warning',
            severity: 'alta',
            title: 'Clinica suspendida',
            detail: row.nombre,
            source: 'clinics',
            relatedId: row.id
        }));

        vencidos.rows.forEach(row => alerts.push({
            level: 'danger',
            severity: 'critica',
            title: 'Plan vencido',
            detail: `${row.nombre} vencio el ${fechaSql(new Date(row.plan_vencimiento))}.`,
            source: 'plans',
            relatedId: row.id
        }));

        porVencer.rows.forEach(row => alerts.push({
            level: 'warning',
            severity: 'media',
            title: 'Plan por caducar',
            detail: `${row.nombre} vence el ${fechaSql(new Date(row.plan_vencimiento))}.`,
            source: 'plans',
            relatedId: row.id
        }));

        ticketsUrgentes.rows.forEach(row => alerts.push({
            level: 'danger',
            severity: 'critica',
            title: 'Ticket urgente',
            detail: `${row.clinica}: ${row.subject}`,
            source: 'support',
            relatedId: row.id
        }));

        ticketsSinRespuesta.rows.forEach(row => alerts.push({
            level: 'warning',
            severity: 'alta',
            title: 'Ticket sin respuesta 24h',
            detail: `${row.clinica}: ${row.subject}`,
            source: 'support',
            relatedId: row.id
        }));

        if (alerts.length === 0) {
            alerts.push({ level: 'success', severity: 'baja', title: 'Sistema estable', detail: 'No hay alertas pendientes.' });
        }

        res.json(alerts);
    } catch (err) {
        console.error('Error cargando alertas:', err);
        res.status(500).json({ error: 'No se pudieron cargar las alertas.' });
    }
});

module.exports = router;
