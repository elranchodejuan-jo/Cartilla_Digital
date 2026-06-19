const express = require('express');
const db = require('./db');
const authMiddleware = require('./authMiddleware');

const router = express.Router();

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
                SELECT COUNT(*) FILTER (WHERE status IN ('nuevo', 'en_revision'))::int AS nuevos
                FROM admin_feedback
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
        const [clinicas, feedback, vencimientos] = await Promise.all([
            db.query(`SELECT COUNT(*)::int AS suspendidas FROM veterinarias WHERE estado_cuenta = 'suspendida'`),
            db.query(`SELECT COUNT(*)::int AS urgentes FROM admin_feedback WHERE priority = 'urgente' AND status <> 'solucionado'`),
            db.query(`SELECT COUNT(*)::int AS vencidos FROM veterinarias WHERE plan_vencimiento IS NOT NULL AND plan_vencimiento < CURRENT_DATE`)
        ]);
        res.json(construirAlertas(
            { suspendidas: clinicas.rows[0].suspendidas },
            { hoy: 0 },
            Array.from({ length: vencimientos.rows[0].vencidos }, () => ({ estado_plan: 'vencido' })),
            { nuevos: feedback.rows[0].urgentes }
        ));
    } catch (err) {
        console.error('Error cargando alertas:', err);
        res.status(500).json({ error: 'No se pudieron cargar las alertas.' });
    }
});

module.exports = router;
