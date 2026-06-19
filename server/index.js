const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const authMiddleware = require('./authMiddleware');
const adminRoutes = require('./adminRoutes');
require('dotenv').config();

const crypto = require('crypto');
const supabase = require('./supabaseClient');

let resend = null;
try {
    const { Resend } = require('resend');
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'PENDIENTE_CONFIGURAR') {
        resend = new Resend(process.env.RESEND_API_KEY);
        console.log('Cliente de Resend (email) inicializado correctamente.');
    } else {
        console.warn('⚠️  Resend no configurado. La recuperación de contraseña por email no estará disponible.');
    }
} catch (e) {
    console.warn('⚠️  Módulo Resend no disponible:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar CORS y límites de carga para imágenes Base64 grandes
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            status: 'ok',
            database: 'ok',
            service: 'cartilla-digital-api',
            time: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({
            status: 'degraded',
            database: 'error',
            service: 'cartilla-digital-api',
            error: err.message
        });
    }
});

function normalizarEspecieRaza(especie) {
    const valor = (especie || '').toLowerCase().trim();
    if (valor === 'perro' || valor === 'canino' || valor === 'p') return 'Canino';
    if (valor === 'gato' || valor === 'felino' || valor === 'g') return 'Felino';
    return '';
}

function normalizarNombreRaza(nombre) {
    return (nombre || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function formatearNombreRaza(nombre) {
    return (nombre || '').trim().replace(/\s+/g, ' ');
}

function normalizarTextoPerfil(valor) {
    return (valor || '').trim().replace(/\s+/g, ' ');
}

function normalizarEmail(valor) {
    return (valor || '').trim().toLowerCase();
}

function esEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function sincronizarPropietarioConEquipo(veterinariaId, propietario, queryable = db) {
    const nombrePropietario = normalizarTextoPerfil(propietario);
    if (!nombrePropietario) return;

    const query = queryable.query.bind(queryable);
    await query(
        `
        WITH actualizado AS (
            UPDATE equipo_veterinario
            SET nombre = $2, estado = 'activo', es_principal = TRUE
            WHERE veterinaria_id = $1 AND es_principal = TRUE
            RETURNING id
        )
        INSERT INTO equipo_veterinario (veterinaria_id, nombre, cargo, estado, es_principal)
        SELECT $1, $2, 'Medico veterinario', 'activo', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM actualizado)
        `,
        [veterinariaId, nombrePropietario]
    );
}

// --- RUTAS DE AUTENTICACIÓN ---

/**
 * Registro de nueva clínica veterinaria
 */
app.post('/api/auth/register', async (req, res) => {
    const { email, password, nombre, propietario, iniciales, telefono, direccion, logo } = req.body;
    const propietarioLimpio = normalizarTextoPerfil(propietario);
    const emailRegistro = normalizarEmail(email);
    
    if (!email || !password || !nombre || !propietarioLimpio || !iniciales) {
        return res.status(400).json({ error: 'Faltan campos requeridos (email, contrasena, nombre, propietario, iniciales).' });
    }

    if (!esEmailValido(emailRegistro)) {
        return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    }
    
    const inicialesUpper = iniciales.trim().toUpperCase();
    if (inicialesUpper.length < 2 || inicialesUpper.length > 5) {
        return res.status(400).json({ error: 'Las iniciales deben tener entre 2 y 5 caracteres.' });
    }
    
    try {
        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const queryText = `
            INSERT INTO veterinarias (email, password_hash, nombre, propietario, iniciales, telefono, direccion, logo_base64)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, email, nombre, propietario, iniciales
        `;
        // Subir logo a Storage si es Base64
        const logoFinal = await subirImagenAStorage(logo, 'logos');
        const values = [emailRegistro, passwordHash, nombre.trim(), propietarioLimpio, inicialesUpper, telefono, direccion, logoFinal];
        
        const result = await db.query(queryText, values);
        const vetId = result.rows[0].id;
        
        // Sincronizar el propietario como responsable principal del equipo.
        await sincronizarPropietarioConEquipo(vetId, propietarioLimpio);
        
        res.status(201).json({ mensaje: 'Clínica registrada con éxito.', veterinaria: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') { // Violación de unicidad en PostgreSQL
            if (err.detail.includes('email')) {
                return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
            }
            if (err.detail.includes('iniciales')) {
                return res.status(400).json({ error: 'Las iniciales ya están en uso por otra clínica.' });
            }
        }
        console.error('Error al registrar clínica:', err);
        res.status(500).json({ error: 'Error interno del servidor al procesar el registro.' });
    }
});

/**
 * Inicio de sesión de clínica veterinaria
 */
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
    }
    
    try {
        const queryText = 'SELECT * FROM veterinarias WHERE email = $1';
        const result = await db.query(queryText, [email.trim().toLowerCase()]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        
        const vet = result.rows[0];
        
        // Verificar contraseña
        const passwordCorrect = await bcrypt.compare(password, vet.password_hash);
        if (!passwordCorrect) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        
        await db.query('UPDATE veterinarias SET ultimo_login = CURRENT_TIMESTAMP WHERE id = $1', [vet.id]);
        const role = vet.role || 'clinic_owner';
        
        // Generar JWT
        const token = jwt.sign(
            { id: vet.id, email: vet.email, nombre: vet.nombre, iniciales: vet.iniciales, role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' } // Token válido por 30 días
        );
        
        res.json({
            token,
            veterinaria: {
                id: vet.id,
                email: vet.email,
                nombre: vet.nombre,
                propietario: vet.propietario,
                iniciales: vet.iniciales,
                telefono: vet.telefono,
                direccion: vet.direccion,
                logo: vet.logo_base64,
                role,
                estadoCuenta: vet.estado_cuenta || 'activa',
                planActual: vet.plan_actual || 'Free'
            }
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Solicitar recuperación de contraseña
 */
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }
    
    try {
        // Buscar la veterinaria por correo
        const result = await db.query('SELECT id, nombre FROM veterinarias WHERE email = $1', [email.trim().toLowerCase()]);
        
        // Por seguridad, siempre responder con éxito incluso si no existe el correo
        if (result.rows.length === 0) {
            return res.json({ mensaje: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
        }
        
        const vet = result.rows[0];
        
        // Invalidar tokens anteriores no usados
        await db.query("UPDATE password_resets SET usado = TRUE WHERE veterinaria_id = $1 AND usado = FALSE", [vet.id]);
        
        // Generar token seguro
        const token = crypto.randomBytes(32).toString('hex');
        const expiraEn = new Date();
        expiraEn.setMinutes(expiraEn.getMinutes() + 15); // Expira en 15 minutos
        
        // Guardar en base de datos
        await db.query(
            'INSERT INTO password_resets (veterinaria_id, token, expira_en) VALUES ($1, $2, $3)',
            [vet.id, token, expiraEn]
        );
        
        // Enviar correo electrónico
        const frontendUrl = process.env.FRONTEND_URL || 'https://elranchodejuan-jo.github.io/Cartilla_Digital';
        const resetLink = `${frontendUrl}?reset_token=${token}`;
        
        if (resend) {
            await resend.emails.send({
                from: 'Cartilla Digital <onboarding@resend.dev>',
                to: [email.trim().toLowerCase()],
                subject: '🔐 Cartilla Digital - Recuperar Contraseña',
                html: `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #2563eb, #1e40af); padding: 32px 24px; text-align: center;">
                            <h1 style="color: #fff; margin: 0; font-size: 22px;">🐾 Cartilla Digital</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Recuperación de Contraseña</p>
                        </div>
                        <div style="padding: 32px 24px;">
                            <p style="color: #333; font-size: 15px; line-height: 1.6;">Hola <strong>${vet.nombre}</strong>,</p>
                            <p style="color: #333; font-size: 15px; line-height: 1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en Cartilla Digital.</p>
                            <div style="text-align: center; margin: 28px 0;">
                                <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1e40af); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px;">Restablecer Contraseña</a>
                            </div>
                            <p style="color: #666; font-size: 13px; line-height: 1.5;">Este enlace expirará en <strong>15 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
                        </div>
                        <div style="background: #e9ecef; padding: 16px 24px; text-align: center;">
                            <p style="color: #888; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Cartilla Digital - Control Veterinario Preventivo</p>
                        </div>
                    </div>
                `
            });
        } else {
            console.log('⚠️  Resend no configurado. Token de recuperación generado:', token);
            console.log('Enlace de recuperación:', resetLink);
        }
        
        res.json({ mensaje: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
    } catch (err) {
        console.error('Error en forgot-password:', err);
        res.status(500).json({ error: 'Error al procesar la solicitud de recuperación.' });
    }
});

/**
 * Restablecer contraseña con token
 */
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token y nueva contraseña son requeridos.' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    
    try {
        // Buscar token válido
        const result = await db.query(
            'SELECT * FROM password_resets WHERE token = $1 AND usado = FALSE AND expira_en > NOW()',
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.' });
        }
        
        const resetRecord = result.rows[0];
        
        // Encriptar nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        
        // Actualizar contraseña
        await db.query('UPDATE veterinarias SET password_hash = $1 WHERE id = $2', [passwordHash, resetRecord.veterinaria_id]);
        
        // Marcar token como usado
        await db.query('UPDATE password_resets SET usado = TRUE WHERE id = $1', [resetRecord.id]);
        
        res.json({ mensaje: '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tu nueva contraseña.' });
    } catch (err) {
        console.error('Error en reset-password:', err);
        res.status(500).json({ error: 'Error al restablecer la contraseña.' });
    }
});

app.use('/api/admin', adminRoutes);

// --- PERFIL DE VETERINARIA ---

app.get('/api/veterinaria', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT id, email, nombre, propietario, iniciales, telefono, direccion, logo_base64 AS logo FROM veterinarias WHERE id = $1', [req.veterinaria.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Clínica no encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/api/veterinaria', authMiddleware, async (req, res) => {
    const { nombre, propietario, email, telefono, direccion, logo } = req.body;
    const propietarioLimpio = normalizarTextoPerfil(propietario);
    const emailContacto = normalizarEmail(email || req.veterinaria.email);
    
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    if (!propietarioLimpio) {
        return res.status(400).json({ error: 'El nombre del propietario es obligatorio.' });
    }

    if (!emailContacto || !esEmailValido(emailContacto)) {
        return res.status(400).json({ error: 'Ingresa un correo de contacto válido.' });
    }
    
    try {
        const queryText = `
            UPDATE veterinarias
            SET nombre = $1, propietario = $2, email = $3, telefono = $4, direccion = $5, logo_base64 = $6
            WHERE id = $7
            RETURNING id, email, nombre, propietario, iniciales, telefono, direccion, logo_base64 AS logo
        `;
        // Subir logo a Storage si es Base64
        const logoFinal = await subirImagenAStorage(logo, 'logos');
        const values = [nombre.trim(), propietarioLimpio, emailContacto, telefono, direccion, logoFinal, req.veterinaria.id];
        const result = await db.query(queryText, values);
        await sincronizarPropietarioConEquipo(req.veterinaria.id, propietarioLimpio);
        
        res.json({ mensaje: 'Perfil actualizado con éxito.', veterinaria: result.rows[0] });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'El correo de contacto ya está registrado en otra clínica.' });
        }
        res.status(500).json({ error: 'Error al actualizar perfil.' });
    }
});


// --- RUTAS DE MASCOTAS ---

/**
 * Obtener razas personalizadas de la veterinaria autenticada
 */
app.get('/api/razas', authMiddleware, async (req, res) => {
    try {
        const especie = normalizarEspecieRaza(req.query.especie);
        const params = [req.veterinaria.id];
        let where = 'WHERE veterinaria_id = $1';

        if (especie) {
            params.push(especie);
            where += ' AND especie = $2';
        }

        const result = await db.query(
            `SELECT id, especie, nombre
             FROM razas_clinica
             ${where}
             ORDER BY especie ASC, nombre ASC`,
            params
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener razas personalizadas.' });
    }
});

/**
 * Guardar una raza nueva de la veterinaria autenticada
 */
app.post('/api/razas', authMiddleware, async (req, res) => {
    const especie = normalizarEspecieRaza(req.body.especie);
    const nombre = formatearNombreRaza(req.body.nombre);
    const nombreNormalizado = normalizarNombreRaza(nombre);

    if (!especie || !nombre) {
        return res.status(400).json({ error: 'Especie y raza son obligatorias.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO razas_clinica (veterinaria_id, especie, nombre, nombre_normalizado)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (veterinaria_id, especie, nombre_normalizado)
             DO UPDATE SET nombre = EXCLUDED.nombre
             RETURNING id, especie, nombre`,
            [req.veterinaria.id, especie, nombre, nombreNormalizado]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al guardar la raza personalizada.' });
    }
});

/**
 * Obtener listado de mascotas de la veterinaria autenticada
 */
app.get('/api/mascotas', authMiddleware, async (req, res) => {
    try {
        const queryText = `
            SELECT m.*, 
                   COALESCE(m.foto_base64, '') AS foto
            FROM mascotas m
            WHERE m.veterinaria_id = $1
            ORDER BY m.fecha_registro DESC
        `;
        const result = await db.query(queryText, [req.veterinaria.id]);
        
        // Obtener todas las vacunas y desparasitaciones de las mascotas de esta veterinaria
        const mascotaIds = result.rows.map(r => r.id);
        
        let vacunasMap = {};
        let desparasitacionesMap = {};
        
        if (mascotaIds.length > 0) {
            const vacRes = await db.query(
                'SELECT * FROM vacunas WHERE mascota_id = ANY($1) ORDER BY fecha_aplicacion DESC',
                [mascotaIds]
            );
            vacRes.rows.forEach(v => {
                if (!vacunasMap[v.mascota_id]) vacunasMap[v.mascota_id] = [];
                vacunasMap[v.mascota_id].push({
                    id: v.id,
                    nombre: v.nombre,
                    enfermedades: v.enfermedades || '',
                    laboratorio: v.laboratorio || '',
                    fechaAplicacion: v.fecha_aplicacion.toISOString().split('T')[0],
                    proximaDosis: v.proxima_dosis ? v.proxima_dosis.toISOString().split('T')[0] : '',
                    lote: v.lote || '',
                    responsable: v.responsable,
                    responsableId: v.responsable_id || null,
                    observaciones: v.observaciones || '',
                    status: v.status || 'pendiente',
                    fechaAsistencia: v.fecha_asistencia ? v.fecha_asistencia.toISOString().split('T')[0] : null
                });
            });
            
            const desRes = await db.query(
                'SELECT * FROM desparasitaciones WHERE mascota_id = ANY($1) ORDER BY fecha_aplicacion DESC',
                [mascotaIds]
            );
            desRes.rows.forEach(d => {
                if (!desparasitacionesMap[d.mascota_id]) desparasitacionesMap[d.mascota_id] = [];
                desparasitacionesMap[d.mascota_id].push({
                    id: d.id,
                    tipo: d.tipo,
                    producto: d.producto,
                    tipoProducto: d.tipo_producto || 'tableta',
                    rangoPeso: d.rango_peso || '',
                    parasitosCubre: d.parasitos_cubre || '',
                    fechaAplicacion: d.fecha_aplicacion.toISOString().split('T')[0],
                    proximaAplicacion: d.proxima_aplicacion ? d.proxima_aplicacion.toISOString().split('T')[0] : '',
                    dosis: d.dosis || '',
                    via: d.via || 'Oral',
                    responsable: d.responsable,
                    responsableId: d.responsable_id || null,
                    observaciones: d.observaciones || '',
                    status: d.status || 'pendiente',
                    fechaAsistencia: d.fecha_asistencia ? d.fecha_asistencia.toISOString().split('T')[0] : null
                });
            });
        }
        
        const mascotasFormateadas = result.rows.map(row => ({
            id: row.id,
            codigo: row.codigo,
            fechaRegistro: row.fecha_registro.toISOString().split('T')[0],
            veterinariaIniciales: row.veterinaria_iniciales,
            nombre: row.nombre,
            especie: row.especie,
            raza: row.raza || '',
            sexo: row.sexo,
            fechaNacimiento: row.fecha_nacimiento.toISOString().split('T')[0],
            color: row.color || '',
            peso: row.peso || '',
            foto: row.foto || '',
            sourcePatientCode: row.source_patient_code || '',
            receivedByTransfer: !!row.received_by_transfer,
            transferStatus: row.transfer_status || 'active',
            tutor: {
                nombre: row.tutor_nombre || 'Sin Tutor',
                telefono: row.tutor_telefono || '',
                email: row.tutor_email || '',
                direccion: row.tutor_direccion || ''
            },
            observaciones: row.observaciones || '',
            vacunas: vacunasMap[row.id] || [],
            desparasitaciones: desparasitacionesMap[row.id] || []
        }));
        
        res.json(mascotasFormateadas);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener mascotas.' });
    }
});

// Helper para generar el código de paciente en el backend
function formatearFechaAAMMDD(date) {
    const y = String(date.getFullYear()).slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
}

function normalizarCodigoEspecie(especie) {
    const espLower = (especie || '').toLowerCase().trim();
    if (espLower === 'perro' || espLower === 'canino' || espLower === 'c') return 'C';
    if (espLower === 'gato' || espLower === 'felino' || espLower === 'f') return 'F';
    return '';
}

function formatearContadorPaciente(contador) {
    const numero = Number(contador);
    if (!Number.isInteger(numero) || numero < 1) {
        throw new Error('Contador de paciente invalido.');
    }
    return numero < 100 ? String(numero).padStart(2, '0') : String(numero);
}

async function generarCodigoPacienteParaClinica(queryable, clinica, especie, fecha = new Date()) {
    if (!clinica?.id) {
        throw new Error('No se pudo generar codigo sin clinica actual.');
    }
    const iniciales = (clinica.iniciales || '').trim().toUpperCase();
    if (!iniciales) {
        throw new Error('No se pudo generar codigo sin iniciales de clinica.');
    }

    const especieCodigo = normalizarCodigoEspecie(especie);
    if (!especieCodigo) {
        throw new Error('Especie invalida para generar codigo. Usa Canino o Felino.');
    }

    const fechaCodigo = formatearFechaAAMMDD(fecha);
    const codigoPrefix = `CD-${iniciales}-${especieCodigo}-${fechaCodigo}-`;
    const secuenciaRes = await queryable.query(
        `SELECT COALESCE(MAX(code_counter), 0)::int AS max_counter
         FROM mascotas
         WHERE veterinaria_id = $1
           AND code_species = $2
           AND code_date = $3`,
        [clinica.id, especieCodigo, fechaCodigo]
    );

    const codigosRes = await queryable.query(
        `SELECT codigo
         FROM mascotas
         WHERE veterinaria_id = $1
           AND codigo LIKE $2`,
        [clinica.id, `${codigoPrefix}%`]
    );
    const maxDesdeCodigo = codigosRes.rows.reduce((max, row) => {
        const match = String(row.codigo || '').match(/-(\d+)$/);
        const numero = match ? parseInt(match[1], 10) : 0;
        return Number.isFinite(numero) && numero > max ? numero : max;
    }, 0);
    const maxDesdeMetadata = secuenciaRes.rows[0]?.max_counter || 0;
    const contador = Math.max(maxDesdeMetadata, maxDesdeCodigo) + 1;

    return {
        codigo: `${codigoPrefix}${formatearContadorPaciente(contador)}`,
        codeSpecies: especieCodigo,
        codeDate: fechaCodigo,
        codeCounter: contador
    };
}

/**
 * Registrar mascota (paciente)
 */
app.post('/api/mascotas', authMiddleware, async (req, res) => {
    const { nombre, especie, raza, sexo, fechaNacimiento, color, peso, foto, tutor, observaciones } = req.body;
    const tutorEmail = normalizarEmail(tutor?.email);
    
    if (!nombre || !especie || !fechaNacimiento || !tutor?.nombre) {
        return res.status(400).json({ error: 'Nombre, especie, fecha de nacimiento y tutor son obligatorios.' });
    }

    if (tutorEmail && !esEmailValido(tutorEmail)) {
        return res.status(400).json({ error: 'Ingresa un correo válido o deja el campo vacío.' });
    }
    
    try {
        const hoy = new Date();
        
        // 1. Contar pacientes de hoy de esta misma clínica y especie para el correlativo
        const countQuery = `
            SELECT COUNT(*) 
            FROM mascotas 
            WHERE veterinaria_id = $1 
              AND LOWER(especie) = LOWER($2) 
              AND fecha_registro::date = CURRENT_DATE
        `;
        const countRes = await db.query(countQuery, [req.veterinaria.id, especie]);
        const correlativo = parseInt(countRes.rows[0].count) + 1;
        
        // 2. Generar el código único de cartilla
        let especieCodigo = normalizarCodigoEspecie(especie);
        if (!especieCodigo) {
            return res.status(400).json({ error: 'Especie invalida para generar codigo. Usa Canino o Felino.' });
        }
        
        const fechaCodigo = formatearFechaAAMMDD(hoy);
        const codigoPrefix = `CD-${req.veterinaria.iniciales.toUpperCase()}-${especieCodigo}-${fechaCodigo}-`;
        const codigosRes = await db.query(
            `SELECT codigo
             FROM mascotas
             WHERE veterinaria_id = $1
               AND codigo LIKE $2
             ORDER BY codigo DESC`,
            [req.veterinaria.id, `${codigoPrefix}%`]
        );
        const mayorCorrelativo = codigosRes.rows.reduce((max, row) => {
            const match = String(row.codigo || '').match(/-(\d+)$/);
            const numero = match ? parseInt(match[1], 10) : 0;
            return Number.isFinite(numero) && numero > max ? numero : max;
        }, 0);
        const codeCounter = Math.max(correlativo, mayorCorrelativo + 1);
        const contadorStr = formatearContadorPaciente(codeCounter);
        let codigoUnico = `CD-${req.veterinaria.iniciales.toUpperCase()}-${especieCodigo}-${fechaCodigo}-${contadorStr}`;
        const codigoGenerado = await generarCodigoPacienteParaClinica(
            db,
            { id: req.veterinaria.id, iniciales: req.veterinaria.iniciales },
            especie
        );
        codigoUnico = codigoGenerado.codigo;
        
        // 3. Insertar mascota
        const insertQuery = `
            INSERT INTO mascotas 
            (codigo, veterinaria_iniciales, veterinaria_id, nombre, especie, raza, sexo, fecha_nacimiento, color, peso, foto_base64, tutor_nombre, tutor_telefono, tutor_email, tutor_direccion, observaciones, code_species, code_date, code_counter)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `;
        const fotoFinal = await subirImagenAStorage(foto, 'mascotas');
        const values = [
            codigoUnico,
            req.veterinaria.iniciales,
            req.veterinaria.id,
            nombre.trim(),
            especie.trim(),
            raza ? raza.trim() : '',
            sexo,
            fechaNacimiento,
            color ? color.trim() : '',
            peso !== undefined && peso !== '' ? parseFloat(peso) : null,
            fotoFinal || '',
            tutor.nombre.trim(),
            tutor.telefono ? tutor.telefono.trim() : '',
            tutorEmail || null,
            tutor.direccion ? tutor.direccion.trim() : '',
            observaciones ? observaciones.trim() : '',
            codigoGenerado.codeSpecies,
            codigoGenerado.codeDate,
            codigoGenerado.codeCounter
        ];
        
        const result = await db.query(insertQuery, values);
        const row = result.rows[0];
        
        res.status(201).json({
            id: row.id,
            codigo: row.codigo,
            fechaRegistro: row.fecha_registro.toISOString().split('T')[0],
            veterinariaIniciales: row.veterinaria_iniciales,
            nombre: row.nombre,
            especie: row.especie,
            raza: row.raza || '',
            sexo: row.sexo,
            fechaNacimiento: row.fecha_nacimiento.toISOString().split('T')[0],
            color: row.color || '',
            peso: row.peso || '',
            foto: row.foto_base64 || '',
            sourcePatientCode: row.source_patient_code || '',
            receivedByTransfer: !!row.received_by_transfer,
            transferStatus: row.transfer_status || 'active',
            tutor: {
                nombre: row.tutor_nombre,
                telefono: row.tutor_telefono || '',
                email: row.tutor_email || '',
                direccion: row.tutor_direccion || ''
            },
            observaciones: row.observaciones || '',
            vacunas: [],
            desparasitaciones: [],
            controles: []
        });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'No se pudo generar un codigo unico para el paciente. Intenta guardar nuevamente.' });
        }
        res.status(500).json({ error: 'Error al registrar la mascota.' });
    }
});

/**
 * Obtener expediente completo de mascota por ID
 */
app.get('/api/mascotas/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const mResult = await db.query('SELECT * FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mResult.rows.length === 0) {
            return res.status(404).json({ error: 'Paciente no encontrado.' });
        }
        
        const row = mResult.rows[0];
        
        // Obtener vacunas
        const vacRes = await db.query('SELECT * FROM vacunas WHERE mascota_id = $1 ORDER BY fecha_aplicacion DESC', [id]);
        const vacunas = vacRes.rows.map(v => ({
            id: v.id,
            nombre: v.nombre,
            enfermedades: v.enfermedades || '',
            laboratorio: v.laboratorio || '',
            fechaAplicacion: v.fecha_aplicacion.toISOString().split('T')[0],
            proximaDosis: v.proxima_dosis ? v.proxima_dosis.toISOString().split('T')[0] : '',
            lote: v.lote || '',
            responsable: v.responsable,
            responsableId: v.responsable_id || null,
            observaciones: v.observaciones || '',
            status: v.status || 'pendiente',
            fechaAsistencia: v.fecha_asistencia ? v.fecha_asistencia.toISOString().split('T')[0] : null
        }));
        
        // Obtener desparasitaciones
        const desRes = await db.query('SELECT * FROM desparasitaciones WHERE mascota_id = $1 ORDER BY fecha_aplicacion DESC', [id]);
        const desparasitaciones = desRes.rows.map(d => ({
            id: d.id,
            tipo: d.tipo,
            producto: d.producto,
            tipoProducto: d.tipo_producto || 'tableta',
            rangoPeso: d.rango_peso || '',
            parasitosCubre: d.parasitos_cubre || '',
            fechaAplicacion: d.fecha_aplicacion.toISOString().split('T')[0],
            proximaAplicacion: d.proxima_aplicacion ? d.proxima_aplicacion.toISOString().split('T')[0] : '',
            dosis: d.dosis || '',
            via: d.via || 'Oral',
            responsable: d.responsable,
            responsableId: d.responsable_id || null,
            observaciones: d.observaciones || '',
            status: d.status || 'pendiente',
            fechaAsistencia: d.fecha_asistencia ? d.fecha_asistencia.toISOString().split('T')[0] : null
        }));
        
        // Obtener controles
        const ctrlRes = await db.query('SELECT * FROM controles WHERE mascota_id = $1 ORDER BY fecha DESC', [id]);
        const controles = ctrlRes.rows.map(c => ({
            id: c.id,
            fecha: c.fecha.toISOString().split('T')[0],
            motivo: c.motivo,
            peso: c.peso || '',
            temperatura: c.temperatura || '',
            fc: c.fc || '',
            fr: c.fr || '',
            hallazgos: c.hallazgos || '',
            diagnostico: c.diagnostico || '',
            tratamiento: c.tratamiento || '',
            recomendaciones: c.recomendaciones || '',
            proximoControl: c.proximo_control ? c.proximo_control.toISOString().split('T')[0] : '',
            responsable: c.responsable || '',
            responsableId: c.responsable_id || null,
            status: c.status || 'pendiente',
            fechaAsistencia: c.fecha_asistencia ? c.fecha_asistencia.toISOString().split('T')[0] : null
        }));
        
        res.json({
            id: row.id,
            codigo: row.codigo,
            fechaRegistro: row.fecha_registro.toISOString().split('T')[0],
            veterinariaIniciales: row.veterinaria_iniciales,
            nombre: row.nombre,
            especie: row.especie,
            raza: row.raza || '',
            sexo: row.sexo,
            fechaNacimiento: row.fecha_nacimiento.toISOString().split('T')[0],
            color: row.color || '',
            peso: row.peso || '',
            foto: row.foto_base64 || '',
            sourcePatientCode: row.source_patient_code || '',
            receivedByTransfer: !!row.received_by_transfer,
            transferStatus: row.transfer_status || 'active',
            tutor: {
                nombre: row.tutor_nombre,
                telefono: row.tutor_telefono || '',
                email: row.tutor_email || '',
                direccion: row.tutor_direccion || ''
            },
            observaciones: row.observaciones || '',
            vacunas,
            desparasitaciones,
            controles
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener detalles del paciente.' });
    }
});

/**
 * Actualizar mascota
 */
app.put('/api/mascotas/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { nombre, especie, raza, sexo, fechaNacimiento, color, peso, foto, tutor, observaciones } = req.body;
    
    try {
        const mCheck = await db.query('SELECT * FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        const orig = mCheck.rows[0];
        
        // Fusión segura (conservar original si es undefined)
        const finalNombre = nombre !== undefined ? nombre.trim() : orig.nombre;
        const finalEspecie = especie !== undefined ? especie.trim() : orig.especie;
        const finalRaza = raza !== undefined ? raza.trim() : orig.raza;
        const finalSexo = sexo !== undefined ? sexo : orig.sexo;
        const finalFechaNac = fechaNacimiento !== undefined ? fechaNacimiento : orig.fecha_nacimiento;
        const finalColor = color !== undefined ? color.trim() : orig.color;
        const finalPeso = peso !== undefined && peso !== '' ? parseFloat(peso) : (peso === '' ? null : orig.peso);
        let finalFoto = foto !== undefined ? foto : orig.foto_base64;
        // Subir nueva foto a Storage si es Base64
        if (foto !== undefined && foto && foto.startsWith('data:image/')) {
            finalFoto = await subirImagenAStorage(foto, 'mascotas');
        }
        const finalTutorNombre = tutor?.nombre !== undefined ? tutor.nombre.trim() : orig.tutor_nombre;
        const finalTutorTel = tutor?.telefono !== undefined ? tutor.telefono.trim() : orig.tutor_telefono;
        const finalTutorEmail = tutor?.email !== undefined ? normalizarEmail(tutor.email) : (orig.tutor_email || null);
        const finalTutorDir = tutor?.direccion !== undefined ? tutor.direccion.trim() : orig.tutor_direccion;
        const finalObs = observaciones !== undefined ? observaciones.trim() : orig.observaciones;
        
        // Validar los valores finales (después del merge)
        if (!finalNombre || !finalEspecie || !finalFechaNac || !finalTutorNombre) {
            return res.status(400).json({ error: 'Nombre, especie, fecha de nacimiento y tutor son obligatorios.' });
        }

        if (finalTutorEmail && !esEmailValido(finalTutorEmail)) {
            return res.status(400).json({ error: 'Ingresa un correo válido o deja el campo vacío.' });
        }
        
        const updateQuery = `
            UPDATE mascotas
            SET nombre = $1, especie = $2, raza = $3, sexo = $4, fecha_nacimiento = $5, color = $6, peso = $7, foto_base64 = $8, tutor_nombre = $9, tutor_telefono = $10, tutor_email = $11, tutor_direccion = $12, observaciones = $13
            WHERE id = $14 AND veterinaria_id = $15
        `;
        const values = [finalNombre, finalEspecie, finalRaza, finalSexo, finalFechaNac, finalColor, finalPeso, finalFoto, finalTutorNombre, finalTutorTel, finalTutorEmail || null, finalTutorDir, finalObs, id, req.veterinaria.id];
        await db.query(updateQuery, values);
        
        res.json({ mensaje: 'Paciente actualizado con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar paciente.' });
    }
});

/**
 * Eliminar mascota
 */
app.delete('/api/mascotas/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        res.json({ mensaje: 'Expediente clínico eliminado permanentemente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar el expediente.' });
    }
});


// --- HISTORIAL CLÍNICO: VACUNAS ---

app.post('/api/mascotas/:id/vacunas', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { nombre, enfermedades, laboratorio, fechaAplicacion, proximaDosis, lote, responsable, responsableId, observaciones, status, fechaAsistencia } = req.body;
    
    if (!nombre || !fechaAplicacion || !responsable) {
        return res.status(400).json({ error: 'Nombre, fecha de aplicación y responsable son obligatorios.' });
    }
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        const queryText = `
            INSERT INTO vacunas (mascota_id, nombre, enfermedades, laboratorio, fecha_aplicacion, proxima_dosis, lote, responsable, responsable_id, observaciones, status, fecha_asistencia)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        const values = [
            id,
            nombre.trim(),
            enfermedades ? enfermedades.trim() : '',
            laboratorio ? laboratorio.trim() : '',
            fechaAplicacion,
            proximaDosis || null,
            lote ? lote.trim() : '',
            responsable.trim(),
            responsableId || null,
            observaciones ? observaciones.trim() : '',
            status || 'pendiente',
            fechaAsistencia || null
        ];
        
        await db.query(queryText, values);
        res.status(201).json({ mensaje: 'Vacuna agregada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al guardar la vacuna.' });
    }
});

app.put('/api/mascotas/:id/vacunas/:vacunaId', authMiddleware, async (req, res) => {
    const { id, vacunaId } = req.params;
    const { nombre, enfermedades, laboratorio, fechaAplicacion, proximaDosis, lote, responsable, responsableId, observaciones, status, fechaAsistencia } = req.body;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        const queryText = `
            UPDATE vacunas
            SET nombre = $1, enfermedades = $2, laboratorio = $3, fecha_aplicacion = $4, proxima_dosis = $5, lote = $6, responsable = $7, responsable_id = $8, observaciones = $9, status = $10, fecha_asistencia = $11
            WHERE id = $12 AND mascota_id = $13
        `;
        const values = [nombre.trim(), enfermedades, laboratorio, fechaAplicacion, proximaDosis || null, lote, responsable, responsableId || null, observaciones, status || 'pendiente', fechaAsistencia || null, vacunaId, id];
        const result = await db.query(queryText, values);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vacuna no encontrada.' });
        }
        
        res.json({ mensaje: 'Vacuna actualizada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar la vacuna.' });
    }
});

app.patch('/api/mascotas/:id/vacunas/:vacunaId/status', authMiddleware, async (req, res) => {
    const { id, vacunaId } = req.params;
    const { status, fechaAsistencia, proximaDosis } = req.body;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        if (status === 'reagendado' && !proximaDosis) {
            return res.status(400).json({ error: 'La nueva fecha de próxima dosis es obligatoria al reagendar.' });
        }

        const queryText = `
            UPDATE vacunas
            SET status = $1,
                fecha_asistencia = $2,
                proxima_dosis = CASE WHEN $3::date IS NOT NULL THEN $3::date ELSE proxima_dosis END
            WHERE id = $4 AND mascota_id = $5
        `;
        const result = await db.query(queryText, [
            status,
            fechaAsistencia || null,
            status === 'reagendado' ? proximaDosis : null,
            vacunaId,
            id
        ]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vacuna no encontrada.' });
        }
        
        res.json({ mensaje: 'Estado de vacuna actualizado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar estado.' });
    }
});

app.delete('/api/mascotas/:id/vacunas/:vacunaId', authMiddleware, async (req, res) => {
    const { id, vacunaId } = req.params;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada o sin permisos.' });
        }
        
        const result = await db.query('DELETE FROM vacunas WHERE id = $1 AND mascota_id = $2', [vacunaId, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vacuna no encontrada.' });
        }
        
        res.json({ mensaje: 'Vacuna eliminada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar la vacuna.' });
    }
});


// --- HISTORIAL CLÍNICO: DESPARASITACIONES ---

app.post('/api/mascotas/:id/desparasitaciones', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { tipo, producto, tipoProducto, rangoPeso, parasitosCubre, fechaAplicacion, proximaAplicacion, dosis, via, responsable, responsableId, observaciones, status, fechaAsistencia } = req.body;
    
    if (!producto || !fechaAplicacion || !responsable) {
        return res.status(400).json({ error: 'Producto, fecha de aplicación y responsable son obligatorios.' });
    }
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        const queryText = `
            INSERT INTO desparasitaciones (mascota_id, tipo, producto, tipo_producto, rango_peso, parasitos_cubre, fecha_aplicacion, proxima_aplicacion, dosis, via, responsable, responsable_id, observaciones, status, fecha_asistencia)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `;
        const values = [
            id,
            tipo || 'interna',
            producto.trim(),
            tipoProducto || 'tableta',
            rangoPeso || '',
            parasitosCubre || '',
            fechaAplicacion,
            proximaAplicacion || null,
            dosis || '',
            via || 'Oral',
            responsable.trim(),
            responsableId || null,
            observaciones ? observaciones.trim() : '',
            status || 'pendiente',
            fechaAsistencia || null
        ];
        
        await db.query(queryText, values);
        res.status(201).json({ mensaje: 'Desparasitación agregada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al registrar desparasitación.' });
    }
});

app.put('/api/mascotas/:id/desparasitaciones/:desparasitacionId', authMiddleware, async (req, res) => {
    const { id, desparasitacionId } = req.params;
    const { tipo, producto, tipoProducto, rangoPeso, parasitosCubre, fechaAplicacion, proximaAplicacion, dosis, via, responsable, responsableId, observaciones, status, fechaAsistencia } = req.body;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        const queryText = `
            UPDATE desparasitaciones
            SET tipo = $1, producto = $2, tipo_producto = $3, rango_peso = $4, parasitos_cubre = $5, fecha_aplicacion = $6, proxima_aplicacion = $7, dosis = $8, via = $9, responsable = $10, responsable_id = $11, observaciones = $12, status = $13, fecha_asistencia = $14
            WHERE id = $15 AND mascota_id = $16
        `;
        const values = [tipo || 'interna', producto.trim(), tipoProducto, rangoPeso, parasitosCubre, fechaAplicacion, proximaAplicacion || null, dosis, via, responsable, responsableId || null, observaciones, status || 'pendiente', fechaAsistencia || null, desparasitacionId, id];
        const result = await db.query(queryText, values);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Desparasitación no encontrada.' });
        }
        res.json({ mensaje: 'Desparasitación actualizada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar desparasitación.' });
    }
});

app.patch('/api/mascotas/:id/desparasitaciones/:desparasitacionId/status', authMiddleware, async (req, res) => {
    const { id, desparasitacionId } = req.params;
    const { status, fechaAsistencia, proximaAplicacion } = req.body;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        if (status === 'reagendado' && !proximaAplicacion) {
            return res.status(400).json({ error: 'La nueva fecha de próxima aplicación es obligatoria al reagendar.' });
        }

        const queryText = `
            UPDATE desparasitaciones
            SET status = $1,
                fecha_asistencia = $2,
                proxima_aplicacion = CASE WHEN $3::date IS NOT NULL THEN $3::date ELSE proxima_aplicacion END
            WHERE id = $4 AND mascota_id = $5
        `;
        const result = await db.query(queryText, [
            status,
            fechaAsistencia || null,
            status === 'reagendado' ? proximaAplicacion : null,
            desparasitacionId,
            id
        ]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Desparasitación no encontrada.' });
        }
        
        res.json({ mensaje: 'Estado de desparasitación actualizado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar estado.' });
    }
});

app.delete('/api/mascotas/:id/desparasitaciones/:desparasitacionId', authMiddleware, async (req, res) => {
    const { id, desparasitacionId } = req.params;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada o sin permisos.' });
        }
        
        const result = await db.query('DELETE FROM desparasitaciones WHERE id = $1 AND mascota_id = $2', [desparasitacionId, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Desparasitación no encontrada.' });
        }
        
        res.json({ mensaje: 'Desparasitación eliminada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar desparasitación.' });
    }
});


// --- HISTORIAL CLÍNICO: CONTROLES ---

app.post('/api/mascotas/:id/controles', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { fecha, motivo, peso, temperatura, fc, fr, hallazgos, diagnostico, tratamiento, recomendaciones, proximoControl, responsable, responsableId, status, fechaAsistencia } = req.body;
    
    if (!motivo || !responsable) {
        return res.status(400).json({ error: 'El motivo y el responsable son obligatorios.' });
    }
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        await db.query('BEGIN');
        
        const queryText = `
            INSERT INTO controles (mascota_id, fecha, motivo, peso, temperatura, fc, fr, hallazgos, diagnostico, tratamiento, recomendaciones, proximo_control, responsable, responsable_id, status, fecha_asistencia)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;
        const values = [
            id,
            fecha || new Date().toISOString().split('T')[0],
            motivo.trim(),
            peso !== undefined && peso !== '' ? parseFloat(peso) : null,
            temperatura !== undefined && temperatura !== '' ? parseFloat(temperatura) : null,
            fc !== undefined && fc !== '' ? parseInt(fc) : null,
            fr !== undefined && fr !== '' ? parseInt(fr) : null,
            hallazgos || '',
            diagnostico || '',
            tratamiento || '',
            recomendaciones || '',
            proximoControl || null,
            responsable.trim(),
            responsableId || null,
            status || 'pendiente',
            fechaAsistencia || null
        ];
        
        await db.query(queryText, values);
        
        // Actualizar peso de la mascota si tiene peso en el control
        if (peso !== undefined && peso !== '') {
            await db.query('UPDATE mascotas SET peso = $1 WHERE id = $2', [parseFloat(peso), id]);
        }
        
        await db.query('COMMIT');
        res.status(201).json({ mensaje: 'Control clínico registrado correctamente.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error al registrar el control.' });
    }
});

app.put('/api/mascotas/:id/controles/:controlId', authMiddleware, async (req, res) => {
    const { id, controlId } = req.params;
    const { fecha, motivo, peso, temperatura, fc, fr, hallazgos, diagnostico, tratamiento, recomendaciones, proximoControl, responsable, responsableId, status, fechaAsistencia } = req.body;
    
    if (!motivo || !responsable) {
        return res.status(400).json({ error: 'El motivo y el responsable son obligatorios.' });
    }

    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        await db.query('BEGIN');
        
        const queryText = `
            UPDATE controles
            SET fecha = $1, motivo = $2, peso = $3, temperatura = $4, fc = $5, fr = $6, hallazgos = $7, diagnostico = $8, tratamiento = $9, recomendaciones = $10, proximo_control = $11, responsable = $12, responsable_id = $13, status = $14, fecha_asistencia = $15
            WHERE id = $16 AND mascota_id = $17
        `;
        const values = [
            fecha || new Date().toISOString().split('T')[0],
            motivo.trim(),
            peso !== undefined && peso !== '' ? parseFloat(peso) : null,
            temperatura !== undefined && temperatura !== '' ? parseFloat(temperatura) : null,
            fc !== undefined && fc !== '' ? parseInt(fc) : null,
            fr !== undefined && fr !== '' ? parseInt(fr) : null,
            hallazgos,
            diagnostico,
            tratamiento,
            recomendaciones,
            proximoControl || null,
            responsable.trim(),
            responsableId || null,
            status || 'pendiente',
            fechaAsistencia || null,
            controlId,
            id
        ];
        const result = await db.query(queryText, values);
        
        if (result.rowCount === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Control no encontrado.' });
        }
        
        // Recalcular el peso general con el más reciente
        if (peso !== undefined && peso !== '') {
            const weightQuery = `
                SELECT peso FROM controles 
                WHERE mascota_id = $1 AND peso IS NOT NULL 
                ORDER BY fecha DESC, id DESC 
                LIMIT 1
            `;
            const weightRes = await db.query(weightQuery, [id]);
            if (weightRes.rows.length > 0) {
                await db.query('UPDATE mascotas SET peso = $1 WHERE id = $2', [weightRes.rows[0].peso, id]);
            }
        }
        
        await db.query('COMMIT');
        res.json({ mensaje: 'Control clínico actualizado correctamente.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar control.' });
    }
});

app.patch('/api/mascotas/:id/controles/:controlId/status', authMiddleware, async (req, res) => {
    const { id, controlId } = req.params;
    const { status, fechaAsistencia } = req.body;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada.' });
        }
        
        const queryText = `
            UPDATE controles
            SET status = $1, fecha_asistencia = $2
            WHERE id = $3 AND mascota_id = $4
        `;
        const result = await db.query(queryText, [status, fechaAsistencia || null, controlId, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Control no encontrado.' });
        }
        
        res.json({ mensaje: 'Estado de control actualizado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar estado.' });
    }
});

app.delete('/api/mascotas/:id/controles/:controlId', authMiddleware, async (req, res) => {
    const { id, controlId } = req.params;
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada o sin permisos.' });
        }
        
        const result = await db.query('DELETE FROM controles WHERE id = $1 AND mascota_id = $2', [controlId, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Control no encontrado.' });
        }
        
        // Recalcular el peso general con el más reciente
        const weightQuery = `
            SELECT peso FROM controles 
            WHERE mascota_id = $1 AND peso IS NOT NULL 
            ORDER BY fecha DESC, id DESC 
            LIMIT 1
        `;
        const weightRes = await db.query(weightQuery, [id]);
        if (weightRes.rows.length > 0) {
            await db.query('UPDATE mascotas SET peso = $1 WHERE id = $2', [weightRes.rows[0].peso, id]);
        } else {
            await db.query('UPDATE mascotas SET peso = NULL WHERE id = $1', [id]);
        }
        
        res.json({ mensaje: 'Control clínico eliminado correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar control.' });
    }
});

// --- TRANSFERENCIA AVANZADA DE PACIENTES ENTRE CLINICAS ---

function mapearClinicaPublica(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        propietario: row.propietario || '',
        iniciales: row.iniciales || '',
        telefono: row.telefono || '',
        email: row.email || '',
        direccion: row.direccion || '',
        ciudad: row.ciudad || row.direccion || '',
        logo: row.logo_base64 || row.logo || '',
        fechaRegistro: row.fecha_registro
    };
}

function mapearPermisosTransferencia(permisos = {}) {
    const full = !!permisos.includeFullHistory;
    return {
        includePetData: permisos.includePetData !== false,
        includeTutorData: permisos.includeTutorData !== false,
        includeVaccines: full || !!permisos.includeVaccines,
        includeInternalDeworming: full || !!permisos.includeInternalDeworming,
        includeExternalDeworming: full || !!permisos.includeExternalDeworming,
        includePreventiveHistory: full || !!permisos.includePreventiveHistory,
        includeNextAppointments: full || !!permisos.includeNextAppointments,
        includeObservations: full || !!permisos.includeObservations,
        includePhotos: full || !!permisos.includePhotos,
        includeFullHistory: full
    };
}

function fechaISO(valor) {
    if (!valor) return null;
    return valor instanceof Date ? valor.toISOString() : valor;
}

async function registrarAuditoria(queryable, { transferId = null, associationId = null, action, actorClinicId, details = {} }) {
    await queryable.query(
        `INSERT INTO transfer_audit_logs (transfer_request_id, association_id, action, actor_user_id, actor_clinic_id, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [transferId, associationId, action, actorClinicId, actorClinicId, JSON.stringify(details)]
    );
}

async function crearNotificacion(queryable, { veterinariaId, type, title, message, transferId = null, associationId = null }) {
    await queryable.query(
        `INSERT INTO internal_notifications (veterinaria_id, type, title, message, related_transfer_id, related_association_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [veterinariaId, type, title, message || '', transferId, associationId]
    );
}

async function obtenerAsociacionAceptada(queryable, clinicaA, clinicaB) {
    const result = await queryable.query(
        `SELECT *
         FROM clinic_associations
         WHERE status = 'accepted'
           AND (
             (requester_clinic_id = $1 AND receiver_clinic_id = $2)
             OR (requester_clinic_id = $2 AND receiver_clinic_id = $1)
           )
         LIMIT 1`,
        [clinicaA, clinicaB]
    );
    return result.rows[0] || null;
}

async function cargarTransferenciaCompleta(queryable, transferId, clinicaId) {
    const transferenciaRes = await queryable.query(
        `SELECT ptr.*,
                ov.nombre AS origin_name, ov.propietario AS origin_owner, ov.iniciales AS origin_initials, ov.telefono AS origin_phone, ov.email AS origin_email, ov.direccion AS origin_city, ov.logo_base64 AS origin_logo,
                dv.nombre AS destination_name, dv.propietario AS destination_owner, dv.iniciales AS destination_initials, dv.telefono AS destination_phone, dv.email AS destination_email, dv.direccion AS destination_city, dv.logo_base64 AS destination_logo,
                rv.nombre AS requester_name, rv.propietario AS requester_owner, rv.iniciales AS requester_initials, rv.telefono AS requester_phone, rv.email AS requester_email, rv.direccion AS requester_city, rv.logo_base64 AS requester_logo,
                cv.nombre AS receiver_name, cv.propietario AS receiver_owner, cv.iniciales AS receiver_initials, cv.telefono AS receiver_phone, cv.email AS receiver_email, cv.direccion AS receiver_city, cv.logo_base64 AS receiver_logo
         FROM patient_transfer_requests ptr
         LEFT JOIN veterinarias ov ON ov.id = ptr.origin_clinic_id
         LEFT JOIN veterinarias dv ON dv.id = ptr.destination_clinic_id
         LEFT JOIN veterinarias rv ON rv.id = ptr.requester_clinic_id
         LEFT JOIN veterinarias cv ON cv.id = ptr.receiver_clinic_id
         WHERE ptr.id = $1
           AND $2 IN (ptr.origin_clinic_id, ptr.destination_clinic_id, ptr.requester_clinic_id, ptr.receiver_clinic_id)`,
        [transferId, clinicaId]
    );
    if (transferenciaRes.rows.length === 0) return null;

    const row = transferenciaRes.rows[0];
    const itemsRes = await queryable.query(
        `SELECT * FROM patient_transfer_items WHERE transfer_request_id = $1 ORDER BY created_at ASC`,
        [transferId]
    );
    const permisosRes = await queryable.query(
        `SELECT * FROM patient_transfer_permissions WHERE transfer_request_id = $1`,
        [transferId]
    );
    const searchRes = await queryable.query(
        `SELECT * FROM patient_request_search_data WHERE transfer_request_id = $1 LIMIT 1`,
        [transferId]
    );

    return {
        id: row.id,
        requestType: row.request_type,
        transferType: row.transfer_type,
        status: row.status,
        reason: row.reason || '',
        rejectionReason: row.rejection_reason || '',
        requestedAt: fechaISO(row.requested_at),
        respondedAt: fechaISO(row.responded_at),
        completedAt: fechaISO(row.completed_at),
        originClinicId: row.origin_clinic_id,
        destinationClinicId: row.destination_clinic_id,
        requesterClinicId: row.requester_clinic_id,
        receiverClinicId: row.receiver_clinic_id,
        originClinic: mapearClinicaPublica({ id: row.origin_clinic_id, nombre: row.origin_name, propietario: row.origin_owner, iniciales: row.origin_initials, telefono: row.origin_phone, email: row.origin_email, direccion: row.origin_city, logo_base64: row.origin_logo }),
        destinationClinic: mapearClinicaPublica({ id: row.destination_clinic_id, nombre: row.destination_name, propietario: row.destination_owner, iniciales: row.destination_initials, telefono: row.destination_phone, email: row.destination_email, direccion: row.destination_city, logo_base64: row.destination_logo }),
        requesterClinic: mapearClinicaPublica({ id: row.requester_clinic_id, nombre: row.requester_name, propietario: row.requester_owner, iniciales: row.requester_initials, telefono: row.requester_phone, email: row.requester_email, direccion: row.requester_city, logo_base64: row.requester_logo }),
        receiverClinic: mapearClinicaPublica({ id: row.receiver_clinic_id, nombre: row.receiver_name, propietario: row.receiver_owner, iniciales: row.receiver_initials, telefono: row.receiver_phone, email: row.receiver_email, direccion: row.receiver_city, logo_base64: row.receiver_logo }),
        items: itemsRes.rows.map(item => ({
            id: item.id,
            sourcePatientId: item.source_patient_id,
            copiedPatientId: item.copied_patient_id,
            patientName: item.patient_name_snapshot || '',
            patientCode: item.patient_code_snapshot || '',
            tutorName: item.tutor_name_snapshot || '',
            species: item.species_snapshot || '',
            status: item.status || 'pending'
        })),
        permissions: permisosRes.rows[0] ? {
            includePetData: permisosRes.rows[0].include_pet_data,
            includeTutorData: permisosRes.rows[0].include_tutor_data,
            includeVaccines: permisosRes.rows[0].include_vaccines,
            includeInternalDeworming: permisosRes.rows[0].include_internal_deworming,
            includeExternalDeworming: permisosRes.rows[0].include_external_deworming,
            includePreventiveHistory: permisosRes.rows[0].include_preventive_history,
            includeNextAppointments: permisosRes.rows[0].include_next_appointments,
            includeObservations: permisosRes.rows[0].include_observations,
            includePhotos: permisosRes.rows[0].include_photos,
            includeFullHistory: permisosRes.rows[0].include_full_history
        } : mapearPermisosTransferencia({}),
        searchData: searchRes.rows[0] ? {
            patientName: searchRes.rows[0].patient_name || '',
            patientCode: searchRes.rows[0].patient_code || '',
            tutorName: searchRes.rows[0].tutor_name || '',
            tutorPhone: searchRes.rows[0].tutor_phone || '',
            tutorEmail: searchRes.rows[0].tutor_email || '',
            species: searchRes.rows[0].species || '',
            breed: searchRes.rows[0].breed || '',
            notes: searchRes.rows[0].notes || ''
        } : null
    };
}

async function copiarPacienteAutorizado(client, sourcePatientId, destinationClinicId, transferId, permissions) {
    const existente = await client.query(
        `SELECT id FROM mascotas WHERE transfer_request_id = $1 AND source_mascota_id = $2 AND veterinaria_id = $3 LIMIT 1`,
        [transferId, sourcePatientId, destinationClinicId]
    );
    if (existente.rows.length > 0) return existente.rows[0].id;

    const mascotaRes = await client.query('SELECT * FROM mascotas WHERE id = $1', [sourcePatientId]);
    if (mascotaRes.rows.length === 0) {
        throw new Error('Paciente origen no encontrado.');
    }
    const origen = mascotaRes.rows[0];
    const destinoRes = await client.query('SELECT id, iniciales FROM veterinarias WHERE id = $1', [destinationClinicId]);
    if (destinoRes.rows.length === 0) {
        throw new Error('Clinica destino no encontrada.');
    }

    const destino = destinoRes.rows[0];
    const codigoGenerado = await generarCodigoPacienteParaClinica(client, destino, origen.especie);
    const includeTutor = permissions.includeTutorData || permissions.includeFullHistory;
    const includeObs = permissions.includeObservations || permissions.includeFullHistory;
    const includePhotos = permissions.includePhotos || permissions.includeFullHistory;

    const insertRes = await client.query(
        `INSERT INTO mascotas (
            codigo, veterinaria_iniciales, veterinaria_id, nombre, especie, raza, sexo,
            fecha_nacimiento, color, peso, foto_base64, tutor_nombre, tutor_telefono,
            tutor_email, tutor_direccion, observaciones, source_veterinaria_id, source_mascota_id,
            source_patient_code, received_by_transfer, transfer_request_id, transfer_status,
            code_species, code_date, code_counter
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, TRUE, $20, 'received', $21, $22, $23)
         RETURNING id`,
        [
            codigoGenerado.codigo,
            destino.iniciales,
            destinationClinicId,
            origen.nombre,
            origen.especie,
            origen.raza || '',
            origen.sexo,
            origen.fecha_nacimiento,
            origen.color || '',
            origen.peso,
            includePhotos ? (origen.foto_base64 || '') : '',
            includeTutor ? origen.tutor_nombre : 'Dato reservado',
            includeTutor ? (origen.tutor_telefono || '') : '',
            includeTutor ? (origen.tutor_email || '') : '',
            includeTutor ? (origen.tutor_direccion || '') : '',
            includeObs ? (origen.observaciones || '') : '',
            origen.veterinaria_id,
            origen.id,
            origen.codigo,
            transferId,
            codigoGenerado.codeSpecies,
            codigoGenerado.codeDate,
            codigoGenerado.codeCounter
        ]
    );

    const nuevoId = insertRes.rows[0].id;
    if (permissions.includeVaccines || permissions.includeFullHistory) {
        await client.query(
            `INSERT INTO vacunas (mascota_id, nombre, enfermedades, laboratorio, fecha_aplicacion, proxima_dosis, lote, responsable, responsable_id, observaciones, status, fecha_asistencia)
             SELECT $1, nombre, enfermedades, laboratorio, fecha_aplicacion, proxima_dosis, lote, responsable, NULL, observaciones, status, fecha_asistencia
             FROM vacunas WHERE mascota_id = $2`,
            [nuevoId, sourcePatientId]
        );
    }
    if (permissions.includeInternalDeworming || permissions.includeFullHistory) {
        await client.query(
            `INSERT INTO desparasitaciones (mascota_id, tipo, producto, tipo_producto, rango_peso, parasitos_cubre, fecha_aplicacion, proxima_aplicacion, dosis, via, responsable, responsable_id, observaciones, status, fecha_asistencia)
             SELECT $1, tipo, producto, tipo_producto, rango_peso, parasitos_cubre, fecha_aplicacion, proxima_aplicacion, dosis, via, responsable, NULL, observaciones, status, fecha_asistencia
             FROM desparasitaciones WHERE mascota_id = $2 AND COALESCE(tipo, 'interna') = 'interna'`,
            [nuevoId, sourcePatientId]
        );
    }
    if (permissions.includeExternalDeworming || permissions.includeFullHistory) {
        await client.query(
            `INSERT INTO desparasitaciones (mascota_id, tipo, producto, tipo_producto, rango_peso, parasitos_cubre, fecha_aplicacion, proxima_aplicacion, dosis, via, responsable, responsable_id, observaciones, status, fecha_asistencia)
             SELECT $1, tipo, producto, tipo_producto, rango_peso, parasitos_cubre, fecha_aplicacion, proxima_aplicacion, dosis, via, responsable, NULL, observaciones, status, fecha_asistencia
             FROM desparasitaciones WHERE mascota_id = $2 AND COALESCE(tipo, 'interna') <> 'interna'`,
            [nuevoId, sourcePatientId]
        );
    }
    if (permissions.includePreventiveHistory || permissions.includeFullHistory) {
        await client.query(
            `INSERT INTO controles (mascota_id, fecha, motivo, peso, temperatura, fc, fr, hallazgos, diagnostico, tratamiento, recomendaciones, proximo_control, responsable, responsable_id, status, fecha_asistencia)
             SELECT $1, fecha, motivo, peso, temperatura, fc, fr, hallazgos, diagnostico, tratamiento, recomendaciones, proximo_control, responsable, NULL, status, fecha_asistencia
             FROM controles WHERE mascota_id = $2`,
            [nuevoId, sourcePatientId]
        );
    }

    await client.query(
        `UPDATE patient_transfer_items
         SET copied_patient_id = $1, status = 'completed', updated_at = CURRENT_TIMESTAMP
         WHERE transfer_request_id = $2 AND source_patient_id = $3`,
        [nuevoId, transferId, sourcePatientId]
    );
    await registrarAuditoria(client, {
        transferId,
        action: 'patient_copied',
        actorClinicId: destinationClinicId,
        details: {
            sourcePatientId,
            copiedPatientId: nuevoId,
            patientCode: codigoGenerado.codigo,
            sourcePatientCode: origen.codigo
        }
    });
    await registrarAuditoria(client, {
        transferId,
        action: 'patient_code_generated',
        actorClinicId: destinationClinicId,
        details: {
            patientId: nuevoId,
            patientCode: codigoGenerado.codigo,
            codeSpecies: codigoGenerado.codeSpecies,
            codeDate: codigoGenerado.codeDate,
            codeCounter: codigoGenerado.codeCounter,
            sourcePatientCode: origen.codigo
        }
    });
    return nuevoId;
}

app.get('/api/transferencias/dashboard', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    try {
        const pending = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM (
                SELECT id FROM patient_transfer_requests WHERE status = 'pending' AND $1 IN (destination_clinic_id, receiver_clinic_id)
                UNION ALL
                SELECT id FROM clinic_associations WHERE status = 'pending' AND receiver_clinic_id = $1
             ) p`,
            [clinicId]
        );
        const enviados = await db.query(`SELECT COUNT(*)::int AS total FROM patient_transfer_requests WHERE request_type = 'send_patient' AND origin_clinic_id = $1`, [clinicId]);
        const recibidos = await db.query(`SELECT COUNT(*)::int AS total FROM patient_transfer_requests WHERE request_type = 'send_patient' AND destination_clinic_id = $1 AND status IN ('accepted', 'completed')`, [clinicId]);
        const solicitudes = await db.query(`SELECT COUNT(*)::int AS total FROM patient_transfer_requests WHERE request_type = 'request_patient' AND $1 IN (requester_clinic_id, receiver_clinic_id)`, [clinicId]);
        const asociadas = await db.query(`SELECT COUNT(*)::int AS total FROM clinic_associations WHERE status = 'accepted' AND $1 IN (requester_clinic_id, receiver_clinic_id)`, [clinicId]);
        res.json({
            solicitudesPendientes: pending.rows[0].total,
            pacientesEnviados: enviados.rows[0].total,
            pacientesRecibidos: recibidos.rows[0].total,
            solicitudesPacientes: solicitudes.rows[0].total,
            clinicasAsociadas: asociadas.rows[0].total
        });
    } catch (err) {
        console.error('Error dashboard transferencias:', err);
        res.status(500).json({ error: 'Error al obtener resumen de transferencias.' });
    }
});

app.get('/api/transferencias/clinicas', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const q = textoLimpio(req.query.q).toLowerCase();
    try {
        const params = [clinicId];
        let filtro = '';
        if (q) {
            params.push(`%${q}%`);
            filtro = `AND (
                LOWER(v.nombre) LIKE $2 OR LOWER(v.iniciales) LIKE $2 OR LOWER(COALESCE(v.email, '')) LIKE $2
                OR LOWER(COALESCE(v.telefono, '')) LIKE $2 OR LOWER(COALESCE(v.propietario, '')) LIKE $2
                OR LOWER(COALESCE(v.direccion, '')) LIKE $2
            )`;
        }
        const result = await db.query(
            `SELECT v.id, v.nombre, v.propietario, v.iniciales, v.telefono, v.email, v.direccion, v.logo_base64,
                    ca.id AS association_id, ca.status AS association_status,
                    ca.requester_clinic_id, ca.receiver_clinic_id
             FROM veterinarias v
             LEFT JOIN clinic_associations ca
               ON (
                    (ca.requester_clinic_id = $1 AND ca.receiver_clinic_id = v.id)
                    OR (ca.receiver_clinic_id = $1 AND ca.requester_clinic_id = v.id)
                  )
              AND ca.status <> 'cancelled'
             WHERE v.id <> $1 ${filtro}
             ORDER BY v.nombre ASC
             LIMIT 50`,
            params
        );
        res.json(result.rows.map(row => ({
            ...mapearClinicaPublica(row),
            associationId: row.association_id || null,
            relationshipStatus: row.association_status || 'none',
            isRequester: row.requester_clinic_id === clinicId,
            isReceiver: row.receiver_clinic_id === clinicId
        })));
    } catch (err) {
        console.error('Error buscando clinicas:', err);
        res.status(500).json({ error: 'Error al buscar clinicas registradas.' });
    }
});

app.get('/api/transferencias/asociaciones', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const status = textoLimpio(req.query.status);
    try {
        const params = [clinicId];
        let filtro = '';
        if (status) {
            params.push(status);
            filtro = 'AND ca.status = $2';
        }
        const result = await db.query(
            `SELECT ca.*, v.id AS other_id, v.nombre, v.propietario, v.iniciales, v.telefono, v.email, v.direccion, v.logo_base64
             FROM clinic_associations ca
             JOIN veterinarias v ON v.id = CASE WHEN ca.requester_clinic_id = $1 THEN ca.receiver_clinic_id ELSE ca.requester_clinic_id END
             WHERE $1 IN (ca.requester_clinic_id, ca.receiver_clinic_id) ${filtro}
             ORDER BY ca.updated_at DESC, ca.requested_at DESC`,
            params
        );
        res.json(result.rows.map(row => ({
            id: row.id,
            status: row.status,
            message: row.message || '',
            requestedAt: fechaISO(row.requested_at),
            respondedAt: fechaISO(row.responded_at),
            isRequester: row.requester_clinic_id === clinicId,
            isReceiver: row.receiver_clinic_id === clinicId,
            clinic: mapearClinicaPublica({
                id: row.other_id,
                nombre: row.nombre,
                propietario: row.propietario,
                iniciales: row.iniciales,
                telefono: row.telefono,
                email: row.email,
                direccion: row.direccion,
                logo_base64: row.logo_base64
            })
        })));
    } catch (err) {
        console.error('Error listando asociaciones:', err);
        res.status(500).json({ error: 'Error al cargar clinicas asociadas.' });
    }
});

app.post('/api/transferencias/asociaciones', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const receiverClinicId = req.body.receiverClinicId;
    const message = textoLimpio(req.body.message);
    if (!receiverClinicId) return res.status(400).json({ error: 'Selecciona una clinica destino.' });
    if (receiverClinicId === clinicId) return res.status(400).json({ error: 'No puedes asociar tu propia clinica.' });

    try {
        const existing = await db.query(
            `SELECT * FROM clinic_associations
             WHERE (
                (requester_clinic_id = $1 AND receiver_clinic_id = $2)
                OR (requester_clinic_id = $2 AND receiver_clinic_id = $1)
             )
             AND status IN ('pending', 'accepted', 'blocked')
             LIMIT 1`,
            [clinicId, receiverClinicId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Ya existe una asociacion activa o pendiente con esa clinica.' });
        }
        const result = await db.query(
            `INSERT INTO clinic_associations (requester_clinic_id, receiver_clinic_id, status, message, requested_by)
             VALUES ($1, $2, 'pending', $3, $1)
             RETURNING *`,
            [clinicId, receiverClinicId, message]
        );
        await registrarAuditoria(db, { associationId: result.rows[0].id, action: 'association_requested', actorClinicId: clinicId, details: { receiverClinicId } });
        await crearNotificacion(db, { veterinariaId: receiverClinicId, type: 'association_requested', title: 'Solicitud de asociacion recibida', message: `${req.veterinaria.nombre} quiere asociarse contigo.`, associationId: result.rows[0].id });
        res.status(201).json({ mensaje: 'Solicitud de asociacion enviada.', association: result.rows[0] });
    } catch (err) {
        console.error('Error creando asociacion:', err);
        res.status(500).json({ error: 'Error al enviar solicitud de asociacion.' });
    }
});

app.patch('/api/transferencias/asociaciones/:id', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const { action } = req.body;
    const nextStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : action === 'cancel' ? 'cancelled' : action === 'remove' ? 'inactive' : '';
    if (!nextStatus) return res.status(400).json({ error: 'Accion de asociacion invalida.' });

    try {
        const assocRes = await db.query('SELECT * FROM clinic_associations WHERE id = $1 AND $2 IN (requester_clinic_id, receiver_clinic_id)', [req.params.id, clinicId]);
        if (assocRes.rows.length === 0) return res.status(404).json({ error: 'Asociacion no encontrada.' });
        const assoc = assocRes.rows[0];
        if ((action === 'accept' || action === 'reject') && assoc.receiver_clinic_id !== clinicId) {
            return res.status(403).json({ error: 'Solo la clinica receptora puede responder esta solicitud.' });
        }
        const result = await db.query(
            `UPDATE clinic_associations
             SET status = $1, responded_by = $2, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [nextStatus, clinicId, req.params.id]
        );
        const auditAction = nextStatus === 'accepted' ? 'association_accepted' : nextStatus === 'rejected' ? 'association_rejected' : 'association_cancelled';
        await registrarAuditoria(db, { associationId: req.params.id, action: auditAction, actorClinicId: clinicId, details: { status: nextStatus } });
        const notifyClinic = assoc.requester_clinic_id === clinicId ? assoc.receiver_clinic_id : assoc.requester_clinic_id;
        await crearNotificacion(db, { veterinariaId: notifyClinic, type: auditAction, title: `Asociacion ${nextStatus}`, message: `La asociacion cambio a estado ${nextStatus}.`, associationId: req.params.id });
        res.json({ mensaje: 'Asociacion actualizada.', association: result.rows[0] });
    } catch (err) {
        console.error('Error actualizando asociacion:', err);
        res.status(500).json({ error: 'Error al responder la asociacion.' });
    }
});

app.get('/api/transferencias/buzon', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    try {
        const transferRes = await db.query(
            `SELECT ptr.id, ptr.request_type, ptr.transfer_type, ptr.status, ptr.reason, ptr.requested_at, ptr.responded_at,
                    ptr.origin_clinic_id, ptr.destination_clinic_id, ptr.requester_clinic_id, ptr.receiver_clinic_id,
                    COALESCE(ov.nombre, rv.nombre) AS origin_name,
                    COALESCE(dv.nombre, cv.nombre) AS destination_name,
                    COUNT(pti.id)::int AS patient_count,
                    STRING_AGG(COALESCE(pti.patient_name_snapshot, ''), ', ' ORDER BY pti.created_at) AS patient_names,
                    MAX(prsd.patient_name) AS search_patient_name,
                    MAX(prsd.tutor_name) AS search_tutor_name
             FROM patient_transfer_requests ptr
             LEFT JOIN veterinarias ov ON ov.id = ptr.origin_clinic_id
             LEFT JOIN veterinarias dv ON dv.id = ptr.destination_clinic_id
             LEFT JOIN veterinarias rv ON rv.id = ptr.requester_clinic_id
             LEFT JOIN veterinarias cv ON cv.id = ptr.receiver_clinic_id
             LEFT JOIN patient_transfer_items pti ON pti.transfer_request_id = ptr.id
             LEFT JOIN patient_request_search_data prsd ON prsd.transfer_request_id = ptr.id
             WHERE $1 IN (ptr.origin_clinic_id, ptr.destination_clinic_id, ptr.requester_clinic_id, ptr.receiver_clinic_id)
             GROUP BY ptr.id, ov.nombre, dv.nombre, rv.nombre, cv.nombre
             ORDER BY ptr.requested_at DESC`,
            [clinicId]
        );
        const assocRes = await db.query(
            `SELECT ca.id, ca.status, ca.requested_at, ca.responded_at, ca.requester_clinic_id, ca.receiver_clinic_id,
                    rq.nombre AS requester_name, rc.nombre AS receiver_name, ca.message
             FROM clinic_associations ca
             JOIN veterinarias rq ON rq.id = ca.requester_clinic_id
             JOIN veterinarias rc ON rc.id = ca.receiver_clinic_id
             WHERE $1 IN (ca.requester_clinic_id, ca.receiver_clinic_id)
             ORDER BY ca.updated_at DESC`,
            [clinicId]
        );

        const transfers = transferRes.rows.map(row => ({
            id: row.id,
            category: 'transfer',
            requestType: row.request_type,
            transferType: row.transfer_type,
            status: row.status,
            direction: clinicId === row.destination_clinic_id || clinicId === row.receiver_clinic_id ? 'received' : 'sent',
            originName: row.origin_name || '',
            destinationName: row.destination_name || '',
            requestedAt: fechaISO(row.requested_at),
            respondedAt: fechaISO(row.responded_at),
            patientCount: row.patient_count || 0,
            patientNames: row.patient_names || '',
            searchPatientName: row.search_patient_name || '',
            searchTutorName: row.search_tutor_name || '',
            reason: row.reason || ''
        }));
        const associations = assocRes.rows.map(row => ({
            id: row.id,
            category: 'association',
            requestType: 'association',
            status: row.status,
            direction: clinicId === row.receiver_clinic_id ? 'received' : 'sent',
            originName: row.requester_name,
            destinationName: row.receiver_name,
            requestedAt: fechaISO(row.requested_at),
            respondedAt: fechaISO(row.responded_at),
            patientCount: 0,
            patientNames: '',
            reason: row.message || ''
        }));
        res.json([...transfers, ...associations].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)));
    } catch (err) {
        console.error('Error buzon transferencias:', err);
        res.status(500).json({ error: 'Error al cargar el buzon de transferencias.' });
    }
});

app.post('/api/transferencias/enviar', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const patientIds = Array.isArray(req.body.patientIds) ? [...new Set(req.body.patientIds.filter(Boolean))] : [];
    const destinationClinicId = req.body.destinationClinicId;
    const transferType = req.body.transferType || 'reference';
    const reason = textoLimpio(req.body.reason);
    const permissions = mapearPermisosTransferencia(req.body.permissions || {});
    if (patientIds.length === 0) return res.status(400).json({ error: 'Selecciona al menos un paciente.' });
    if (!destinationClinicId) return res.status(400).json({ error: 'Selecciona una clinica destino.' });
    if (!['reference', 'definitive'].includes(transferType)) return res.status(400).json({ error: 'Tipo de transferencia invalido.' });

    try {
        const assoc = await obtenerAsociacionAceptada(db, clinicId, destinationClinicId);
        if (!assoc) return res.status(403).json({ error: 'Solo puedes enviar pacientes a clinicas asociadas activas.' });
        const pacientesRes = await db.query(
            `SELECT id, nombre, codigo, tutor_nombre, especie FROM mascotas WHERE veterinaria_id = $1 AND id = ANY($2)`,
            [clinicId, patientIds]
        );
        if (pacientesRes.rows.length !== patientIds.length) return res.status(403).json({ error: 'Uno o mas pacientes no pertenecen a tu clinica.' });

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const transferRes = await client.query(
                `INSERT INTO patient_transfer_requests (request_type, transfer_type, origin_clinic_id, destination_clinic_id, requester_clinic_id, receiver_clinic_id, status, reason, requested_by)
                 VALUES ('send_patient', $1, $2, $3, $2, $3, 'pending', $4, $2)
                 RETURNING id`,
                [transferType, clinicId, destinationClinicId, reason]
            );
            const transferId = transferRes.rows[0].id;
            await client.query(
                `INSERT INTO patient_transfer_permissions (
                    transfer_request_id, include_pet_data, include_tutor_data, include_vaccines,
                    include_internal_deworming, include_external_deworming, include_preventive_history,
                    include_next_appointments, include_observations, include_photos, include_full_history
                 )
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [transferId, permissions.includePetData, permissions.includeTutorData, permissions.includeVaccines, permissions.includeInternalDeworming, permissions.includeExternalDeworming, permissions.includePreventiveHistory, permissions.includeNextAppointments, permissions.includeObservations, permissions.includePhotos, permissions.includeFullHistory]
            );
            for (const paciente of pacientesRes.rows) {
                await client.query(
                    `INSERT INTO patient_transfer_items (transfer_request_id, source_patient_id, patient_name_snapshot, patient_code_snapshot, tutor_name_snapshot, species_snapshot)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [transferId, paciente.id, paciente.nombre, paciente.codigo, paciente.tutor_nombre, paciente.especie]
                );
            }
            await registrarAuditoria(client, { transferId, action: 'patient_transfer_sent', actorClinicId: clinicId, details: { patientIds, destinationClinicId } });
            await crearNotificacion(client, { veterinariaId: destinationClinicId, type: 'patient_transfer_sent', title: 'Transferencia de pacientes recibida', message: `${req.veterinaria.nombre} envio ${patientIds.length} paciente(s).`, transferId });
            await client.query('COMMIT');
            res.status(201).json({ mensaje: 'Solicitud de transferencia enviada.', transferId });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error enviando transferencia:', err);
        res.status(500).json({ error: 'Error al enviar solicitud de transferencia.' });
    }
});

app.post('/api/transferencias/solicitar-paciente', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const receiverClinicId = req.body.receiverClinicId;
    const transferType = req.body.transferType || 'continuity';
    const searchData = req.body.searchData || {};
    const reason = textoLimpio(req.body.reason || searchData.reason);
    const hasMinimumData = !!(
        textoLimpio(searchData.patientCode) ||
        (textoLimpio(searchData.patientName) && textoLimpio(searchData.tutorName)) ||
        (textoLimpio(searchData.patientName) && textoLimpio(searchData.tutorPhone)) ||
        textoLimpio(searchData.tutorPhone)
    );
    if (!receiverClinicId) return res.status(400).json({ error: 'Selecciona una clinica asociada.' });
    if (!hasMinimumData) return res.status(400).json({ error: 'Ingresa codigo, telefono o nombre del paciente con tutor.' });

    try {
        const assoc = await obtenerAsociacionAceptada(db, clinicId, receiverClinicId);
        if (!assoc) return res.status(403).json({ error: 'Solo puedes solicitar pacientes a clinicas asociadas activas.' });
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const transferRes = await client.query(
                `INSERT INTO patient_transfer_requests (request_type, transfer_type, requester_clinic_id, receiver_clinic_id, origin_clinic_id, destination_clinic_id, status, reason, requested_by)
                 VALUES ('request_patient', $1, $2, $3, $3, $2, 'pending', $4, $2)
                 RETURNING id`,
                [transferType, clinicId, receiverClinicId, reason]
            );
            const transferId = transferRes.rows[0].id;
            await client.query(
                `INSERT INTO patient_request_search_data (transfer_request_id, patient_name, patient_code, tutor_name, tutor_phone, tutor_email, species, breed, notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [transferId, textoLimpio(searchData.patientName), textoLimpio(searchData.patientCode), textoLimpio(searchData.tutorName), textoLimpio(searchData.tutorPhone), textoLimpio(searchData.tutorEmail), textoLimpio(searchData.species), textoLimpio(searchData.breed), textoLimpio(searchData.notes)]
            );
            await registrarAuditoria(client, { transferId, action: 'patient_requested', actorClinicId: clinicId, details: { receiverClinicId } });
            await crearNotificacion(client, { veterinariaId: receiverClinicId, type: 'patient_requested', title: 'Solicitud de paciente recibida', message: `${req.veterinaria.nombre} solicita que revises un paciente.`, transferId });
            await client.query('COMMIT');
            res.status(201).json({ mensaje: 'Solicitud de paciente enviada.', transferId });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error solicitando paciente:', err);
        res.status(500).json({ error: 'Error al solicitar paciente.' });
    }
});

app.get('/api/transferencias/:id([0-9a-fA-F-]{36})', authMiddleware, async (req, res) => {
    try {
        const detalle = await cargarTransferenciaCompleta(db, req.params.id, req.veterinaria.id);
        if (!detalle) return res.status(404).json({ error: 'Solicitud no encontrada.' });
        res.json(detalle);
    } catch (err) {
        console.error('Error detalle transferencia:', err);
        res.status(500).json({ error: 'Error al cargar detalle de transferencia.' });
    }
});

app.get('/api/transferencias/:id([0-9a-fA-F-]{36})/coincidencias', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    try {
        const detail = await cargarTransferenciaCompleta(db, req.params.id, clinicId);
        if (!detail || detail.requestType !== 'request_patient' || detail.receiverClinicId !== clinicId) {
            return res.status(403).json({ error: 'No puedes buscar coincidencias para esta solicitud.' });
        }
        const s = detail.searchData || {};
        const result = await db.query(
            `SELECT * FROM mascotas WHERE veterinaria_id = $1 ORDER BY fecha_registro DESC LIMIT 200`,
            [clinicId]
        );
        const norm = valor => normalizarNombreRaza(valor || '');
        const matches = result.rows.map(row => {
            let score = 0;
            if (s.patientCode && norm(row.codigo) === norm(s.patientCode)) score += 60;
            if (s.patientName && norm(row.nombre).includes(norm(s.patientName))) score += 20;
            if (s.tutorName && norm(row.tutor_nombre).includes(norm(s.tutorName))) score += 15;
            if (s.tutorPhone && norm(row.tutor_telefono).includes(norm(s.tutorPhone))) score += 25;
            if (s.tutorEmail && normalizarEmail(row.tutor_email).includes(normalizarEmail(s.tutorEmail))) score += 25;
            if (s.species && norm(row.especie) === norm(s.species)) score += 8;
            if (s.breed && norm(row.raza).includes(norm(s.breed))) score += 7;
            const level = score >= 50 ? 'alta' : score >= 25 ? 'media' : 'baja';
            return {
                id: row.id,
                nombre: row.nombre,
                codigo: row.codigo,
                especie: row.especie,
                raza: row.raza || '',
                sexo: row.sexo,
                tutor: { nombre: row.tutor_nombre, telefono: row.tutor_telefono || '', email: row.tutor_email || '' },
                score,
                level
            };
        }).filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);
        res.json(matches);
    } catch (err) {
        console.error('Error buscando coincidencias:', err);
        res.status(500).json({ error: 'Error al buscar coincidencias de paciente.' });
    }
});

app.post('/api/transferencias/:id([0-9a-fA-F-]{36})/aceptar', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const selectedPatientId = req.body.selectedPatientId;
    const permissions = mapearPermisosTransferencia(req.body.permissions || {});
    const transferTypeOverride = req.body.transferType;
    try {
        const detalle = await cargarTransferenciaCompleta(db, req.params.id, clinicId);
        if (!detalle || detalle.status !== 'pending') return res.status(404).json({ error: 'Solicitud pendiente no encontrada.' });
        if (detalle.requestType === 'send_patient' && detalle.destinationClinicId !== clinicId) {
            return res.status(403).json({ error: 'Solo la clinica destino puede aceptar esta transferencia.' });
        }
        if (detalle.requestType === 'request_patient' && detalle.receiverClinicId !== clinicId) {
            return res.status(403).json({ error: 'Solo la clinica receptora puede aprobar esta solicitud.' });
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            let patientIds = detalle.items.map(item => item.sourcePatientId).filter(Boolean);
            let destinationClinicId = detalle.destinationClinicId;
            let notifyClinicId = detalle.originClinicId;
            let finalTransferType = transferTypeOverride || detalle.transferType;
            let finalPermissions = detalle.permissions || permissions;

            if (detalle.requestType === 'request_patient') {
                if (!selectedPatientId) throw new Error('Selecciona el paciente correcto antes de aprobar.');
                const owned = await client.query('SELECT id, nombre, codigo, tutor_nombre, especie FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [selectedPatientId, clinicId]);
                if (owned.rows.length === 0) throw new Error('El paciente seleccionado no pertenece a tu clinica.');
                const itemRes = await client.query(
                    `INSERT INTO patient_transfer_items (transfer_request_id, source_patient_id, patient_name_snapshot, patient_code_snapshot, tutor_name_snapshot, species_snapshot)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                    [detalle.id, owned.rows[0].id, owned.rows[0].nombre, owned.rows[0].codigo, owned.rows[0].tutor_nombre, owned.rows[0].especie]
                );
                await client.query(
                    `INSERT INTO patient_transfer_permissions (
                        transfer_request_id, include_pet_data, include_tutor_data, include_vaccines,
                        include_internal_deworming, include_external_deworming, include_preventive_history,
                        include_next_appointments, include_observations, include_photos, include_full_history
                     )
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                     ON CONFLICT (transfer_request_id) DO UPDATE SET
                        include_pet_data = EXCLUDED.include_pet_data,
                        include_tutor_data = EXCLUDED.include_tutor_data,
                        include_vaccines = EXCLUDED.include_vaccines,
                        include_internal_deworming = EXCLUDED.include_internal_deworming,
                        include_external_deworming = EXCLUDED.include_external_deworming,
                        include_preventive_history = EXCLUDED.include_preventive_history,
                        include_next_appointments = EXCLUDED.include_next_appointments,
                        include_observations = EXCLUDED.include_observations,
                        include_photos = EXCLUDED.include_photos,
                        include_full_history = EXCLUDED.include_full_history,
                        updated_at = CURRENT_TIMESTAMP`,
                    [detalle.id, permissions.includePetData, permissions.includeTutorData, permissions.includeVaccines, permissions.includeInternalDeworming, permissions.includeExternalDeworming, permissions.includePreventiveHistory, permissions.includeNextAppointments, permissions.includeObservations, permissions.includePhotos, permissions.includeFullHistory]
                );
                patientIds = [selectedPatientId];
                destinationClinicId = detalle.requesterClinicId;
                notifyClinicId = detalle.requesterClinicId;
                finalPermissions = permissions;
                await client.query('UPDATE patient_transfer_items SET status = $1 WHERE id = $2', ['pending', itemRes.rows[0].id]);
            }

            for (const patientId of patientIds) {
                await copiarPacienteAutorizado(client, patientId, destinationClinicId, detalle.id, finalPermissions);
            }
            if (finalTransferType === 'definitive') {
                await client.query(
                    `UPDATE mascotas SET transfer_status = 'transferred_out' WHERE id = ANY($1) AND veterinaria_id = $2`,
                    [patientIds, detalle.originClinicId || clinicId]
                );
            }
            await client.query(
                `UPDATE patient_transfer_requests
                 SET status = 'accepted', transfer_type = COALESCE($1, transfer_type), responded_by = $2, responded_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [finalTransferType, clinicId, detalle.id]
            );
            await registrarAuditoria(client, { transferId: detalle.id, action: detalle.requestType === 'send_patient' ? 'patient_transfer_accepted' : 'patient_request_accepted', actorClinicId: clinicId, details: { patientIds, destinationClinicId } });
            await crearNotificacion(client, { veterinariaId: notifyClinicId, type: 'patient_transfer_accepted', title: 'Solicitud aceptada', message: 'La solicitud fue aceptada y el paciente fue copiado segun permisos.', transferId: detalle.id });
            await client.query('COMMIT');
            res.json({ mensaje: 'Solicitud aceptada. Paciente copiado segun permisos.' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error aceptando transferencia:', err);
        res.status(500).json({ error: err.message || 'Error al aceptar transferencia.' });
    }
});

app.post('/api/transferencias/:id([0-9a-fA-F-]{36})/rechazar', authMiddleware, async (req, res) => {
    const clinicId = req.veterinaria.id;
    const rejectionReason = textoLimpio(req.body.rejectionReason);
    try {
        const detalle = await cargarTransferenciaCompleta(db, req.params.id, clinicId);
        if (!detalle || detalle.status !== 'pending') return res.status(404).json({ error: 'Solicitud pendiente no encontrada.' });
        if (detalle.requestType === 'send_patient' && detalle.destinationClinicId !== clinicId) {
            return res.status(403).json({ error: 'Solo la clinica destino puede rechazar esta transferencia.' });
        }
        if (detalle.requestType === 'request_patient' && detalle.receiverClinicId !== clinicId) {
            return res.status(403).json({ error: 'Solo la clinica receptora puede rechazar esta solicitud.' });
        }
        await db.query(
            `UPDATE patient_transfer_requests
             SET status = 'rejected', rejection_reason = $1, responded_by = $2, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [rejectionReason, clinicId, detalle.id]
        );
        const notifyClinicId = detalle.requestType === 'send_patient' ? detalle.originClinicId : detalle.requesterClinicId;
        await registrarAuditoria(db, { transferId: detalle.id, action: detalle.requestType === 'send_patient' ? 'patient_transfer_rejected' : 'patient_request_rejected', actorClinicId: clinicId, details: { rejectionReason } });
        await crearNotificacion(db, { veterinariaId: notifyClinicId, type: 'patient_transfer_rejected', title: 'Solicitud rechazada', message: rejectionReason || 'La solicitud fue rechazada.', transferId: detalle.id });
        res.json({ mensaje: 'Solicitud rechazada.' });
    } catch (err) {
        console.error('Error rechazando transferencia:', err);
        res.status(500).json({ error: 'Error al rechazar solicitud.' });
    }
});


// --- TRANSFERENCIA DE PACIENTES ---

/**
 * Iniciar transferencia
 */
app.post('/api/transferencias/iniciar', authMiddleware, async (req, res) => {
    return res.status(410).json({ error: 'La transferencia por codigo fue reemplazada por el modulo Transferencia.' });
    const { mascotaId } = req.body;
    if (!mascotaId) return res.status(400).json({ error: 'ID de mascota es requerido.' });
    
    try {
        const mCheck = await db.query('SELECT id FROM mascotas WHERE id = $1 AND veterinaria_id = $2', [mascotaId, req.veterinaria.id]);
        if (mCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada en tus registros.' });
        }
        
        // Generar código único aleatorio: TX-XXXXXX (6 caracteres hex)
        const randomCode = 'TX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 24); // Expira en 24 horas
        
        // Cambiar transferencias pendientes previas de este paciente a "expiradas"
        await db.query("UPDATE transferencias SET estado = 'expirada' WHERE mascota_id = $1 AND estado = 'pendiente'", [mascotaId]);
        
        const insertQuery = `
            INSERT INTO transferencias (mascota_id, veterinaria_origen_id, codigo_transferencia, estado, fecha_expiracion)
            VALUES ($1, $2, $3, 'pendiente', $4)
            RETURNING codigo_transferencia
        `;
        const result = await db.query(insertQuery, [mascotaId, req.veterinaria.id, randomCode, expiration]);
        
        res.status(201).json({ codigo: result.rows[0].codigo_transferencia, expiracion: expiration });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al iniciar la transferencia.' });
    }
});

/**
 * Completar transferencia
 */
app.post('/api/transferencias/completar', authMiddleware, async (req, res) => {
    return res.status(410).json({ error: 'La recepcion por codigo fue reemplazada por el Buzon de Transferencia.' });
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'El código de transferencia es requerido.' });
    
    const codigoClean = codigo.trim().toUpperCase();
    
    try {
        await db.query('BEGIN');
        
        const queryText = `
            SELECT * FROM transferencias 
            WHERE codigo_transferencia = $1 
              AND estado = 'pendiente' 
              AND fecha_expiracion > NOW()
        `;
        const result = await db.query(queryText, [codigoClean]);
        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'El código ingresado es inválido, ya fue usado o ha expirado.' });
        }
        
        const tx = result.rows[0];
        
        if (tx.veterinaria_origen_id === req.veterinaria.id) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Este paciente ya pertenece a tu veterinaria.' });
        }
        
        // 1. Cambiar la propiedad de la mascota a la nueva clínica
        const updateMascotaQuery = `
            UPDATE mascotas
            SET veterinaria_id = $1, veterinaria_iniciales = $2
            WHERE id = $3
        `;
        await db.query(updateMascotaQuery, [req.veterinaria.id, req.veterinaria.iniciales, tx.mascota_id]);
        
        // 2. Marcar transferencia como completada
        const updateTxQuery = `
            UPDATE transferencias
            SET estado = 'completada', veterinaria_destino_id = $1
            WHERE id = $2
        `;
        await db.query(updateTxQuery, [req.veterinaria.id, tx.id]);
        
        await db.query('COMMIT');
        res.json({ mensaje: 'Paciente transferido con éxito. Ya puedes ver su cartilla en tu panel.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error al completar la transferencia.' });
    }
});


// --- RUTA PÚBLICA (LECTURA SEGURA PARA CÓDIGO QR / DUEÑOS DE MASCOTAS) ---

/**
 * Obtiene los datos clínicos públicos y de libre acceso para los tutores
 */
app.get('/api/public/mascotas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const mResult = await db.query(`
            SELECT m.*, v.nombre AS veterinaria_nombre, v.telefono AS veterinaria_telefono, v.direccion AS veterinaria_direccion, v.logo_base64 AS veterinaria_logo
            FROM mascotas m
            JOIN veterinarias v ON m.veterinaria_id = v.id
            WHERE m.id = $1
        `, [id]);
        
        if (mResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cartilla digital no encontrada.' });
        }
        
        const row = mResult.rows[0];
        
        // Obtener vacunas
        const vacRes = await db.query('SELECT * FROM vacunas WHERE mascota_id = $1 ORDER BY fecha_aplicacion DESC', [id]);
        const vacunas = vacRes.rows.map(v => ({
            id: v.id,
            nombre: v.nombre,
            enfermedades: v.enfermedades || '',
            laboratorio: v.laboratorio || '',
            fechaAplicacion: v.fecha_aplicacion.toISOString().split('T')[0],
            proximaDosis: v.proxima_dosis ? v.proxima_dosis.toISOString().split('T')[0] : '',
            lote: v.lote || '',
            responsable: v.responsable,
            observaciones: v.observaciones || '',
            status: v.status || 'pendiente',
            fechaAsistencia: v.fecha_asistencia ? v.fecha_asistencia.toISOString().split('T')[0] : null
        }));
        
        // Obtener desparasitaciones
        const desRes = await db.query('SELECT * FROM desparasitaciones WHERE mascota_id = $1 ORDER BY fecha_aplicacion DESC', [id]);
        const desparasitaciones = desRes.rows.map(d => ({
            id: d.id,
            tipo: d.tipo,
            producto: d.producto,
            tipoProducto: d.tipo_producto || 'tableta',
            rangoPeso: d.rango_peso || '',
            parasitosCubre: d.parasitos_cubre || '',
            fechaAplicacion: d.fecha_aplicacion.toISOString().split('T')[0],
            proximaAplicacion: d.proxima_aplicacion ? d.proxima_aplicacion.toISOString().split('T')[0] : '',
            dosis: d.dosis || '',
            via: d.via || 'Oral',
            responsable: d.responsable,
            observaciones: d.observaciones || '',
            status: d.status || 'pendiente',
            fechaAsistencia: d.fecha_asistencia ? d.fecha_asistencia.toISOString().split('T')[0] : null
        }));
        
        // Obtener controles
        const ctrlRes = await db.query('SELECT * FROM controles WHERE mascota_id = $1 ORDER BY fecha DESC', [id]);
        const controles = ctrlRes.rows.map(c => ({
            id: c.id,
            fecha: c.fecha.toISOString().split('T')[0],
            motivo: c.motivo,
            peso: c.peso || '',
            temperatura: c.temperatura || '',
            fc: c.fc || '',
            fr: c.fr || '',
            hallazgos: c.hallazgos || '',
            diagnostico: c.diagnostico || '',
            tratamiento: c.tratamiento || '',
            recomendaciones: c.recomendaciones || '',
            proximoControl: c.proximo_control ? c.proximo_control.toISOString().split('T')[0] : '',
            responsable: c.responsable || '',
            status: c.status || 'pendiente',
            fechaAsistencia: c.fecha_asistencia ? c.fecha_asistencia.toISOString().split('T')[0] : null
        }));
        
        res.json({
            id: row.id,
            codigo: row.codigo,
            fechaRegistro: row.fecha_registro.toISOString().split('T')[0],
            veterinariaIniciales: row.veterinaria_iniciales,
            nombre: row.nombre,
            especie: row.especie,
            raza: row.raza || '',
            sexo: row.sexo,
            fechaNacimiento: row.fecha_nacimiento.toISOString().split('T')[0],
            color: row.color || '',
            peso: row.peso || '',
            foto: row.foto_base64 || '',
            tutor: {
                nombre: row.tutor_nombre,
                email: row.tutor_email || '',
                telefono: '', // OCULTO POR PRIVACIDAD Y SEGURIDAD EN VISTA PÚBLICA
                direccion: '' // OCULTO POR PRIVACIDAD Y SEGURIDAD EN VISTA PÚBLICA
            },
            observaciones: row.observaciones || '',
            vacunas,
            desparasitaciones,
            controles,
            veterinaria: {
                nombre: row.veterinaria_nombre,
                telefono: row.veterinaria_telefono || '',
                direccion: row.veterinaria_direccion || '',
                logo: row.veterinaria_logo || ''
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener la cartilla pública.' });
    }
});


// --- RUTAS DE EQUIPO VETERINARIO ---

/**
 * Obtener todo el equipo de la clínica (incluyendo inactivos para historial)
 */
app.get('/api/equipo', authMiddleware, async (req, res) => {
    try {
        const queryText = `
            SELECT * FROM equipo_veterinario 
            WHERE veterinaria_id = $1 
            ORDER BY es_principal DESC, nombre ASC
        `;
        const result = await db.query(queryText, [req.veterinaria.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener equipo:', err);
        res.status(500).json({ error: 'Error al obtener el equipo veterinario.' });
    }
});

/**
 * Agregar un nuevo integrante
 */
app.post('/api/equipo', authMiddleware, async (req, res) => {
    const { nombre, cargo, estado } = req.body;
    if (!nombre || !cargo) {
        return res.status(400).json({ error: 'Nombre y cargo son requeridos.' });
    }
    
    try {
        const queryText = `
            INSERT INTO equipo_veterinario (veterinaria_id, nombre, cargo, estado)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const result = await db.query(queryText, [req.veterinaria.id, nombre.trim(), cargo.trim(), estado || 'activo']);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al agregar integrante:', err);
        res.status(500).json({ error: 'Error al agregar integrante al equipo.' });
    }
});

/**
 * Actualizar integrante
 */
app.put('/api/equipo/:id', authMiddleware, async (req, res) => {
    const { nombre, cargo, estado } = req.body;
    const { id } = req.params;
    
    if (!nombre || !cargo) {
        return res.status(400).json({ error: 'Nombre y cargo son requeridos.' });
    }
    
    try {
        const queryText = `
            UPDATE equipo_veterinario 
            SET nombre = $1, cargo = $2, estado = $3
            WHERE id = $4 AND veterinaria_id = $5
            RETURNING *
        `;
        const result = await db.query(queryText, [nombre.trim(), cargo.trim(), estado, id, req.veterinaria.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Integrante no encontrado o no tienes permiso.' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar integrante:', err);
        res.status(500).json({ error: 'Error al actualizar integrante.' });
    }
});

/**
 * Eliminar / Desactivar integrante
 */
app.delete('/api/equipo/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    try {
        // Verificar si es principal
        const checkQuery = await db.query('SELECT es_principal FROM equipo_veterinario WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
        if (checkQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Integrante no encontrado.' });
        }
        if (checkQuery.rows[0].es_principal) {
            return res.status(400).json({ error: 'No se puede eliminar al médico principal.' });
        }
        
        // Primero, revisar si tiene registros médicos vinculados para decidir si hacer soft delete
        const vacunasCount = await db.query('SELECT id FROM vacunas WHERE responsable_id = $1 LIMIT 1', [id]);
        const despCount = await db.query('SELECT id FROM desparasitaciones WHERE responsable_id = $1 LIMIT 1', [id]);
        const controlesCount = await db.query('SELECT id FROM controles WHERE responsable_id = $1 LIMIT 1', [id]);
        
        if (vacunasCount.rows.length > 0 || despCount.rows.length > 0 || controlesCount.rows.length > 0) {
            // Tiene registros, hacer soft delete (marcar inactivo)
            await db.query('UPDATE equipo_veterinario SET estado = $1 WHERE id = $2 AND veterinaria_id = $3', ['inactivo', id, req.veterinaria.id]);
            return res.json({ mensaje: 'El integrante tiene registros médicos. Se ha marcado como INACTIVO en lugar de eliminarse por completo para preservar el historial.', softDelete: true });
        } else {
            // No tiene registros, borrar físico
            await db.query('DELETE FROM equipo_veterinario WHERE id = $1 AND veterinaria_id = $2', [id, req.veterinaria.id]);
            return res.json({ mensaje: 'Integrante eliminado correctamente.', softDelete: false });
        }
    } catch (err) {
        console.error('Error al eliminar integrante:', err);
        res.status(500).json({ error: 'Error al eliminar integrante.' });
    }
});

// --- SUBIDA DE IMÁGENES A SUPABASE STORAGE ---

/**
 * Helper: sube una imagen Base64 a Supabase Storage y devuelve la URL pública.
 * Si Supabase no está configurado, devuelve el Base64 original.
 */
async function subirImagenAStorage(base64String, carpeta = 'general') {
    // Si no es Base64 o Supabase no está configurado, devolver como está
    if (!base64String || !base64String.startsWith('data:image/') || !supabase) {
        return base64String;
    }
    
    try {
        // Extraer el tipo MIME y los datos
        const matches = base64String.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches) return base64String;
        
        const mimeType = matches[1];
        const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
        const buffer = Buffer.from(matches[2], 'base64');
        
        // Generar nombre único
        const fileName = `${carpeta}/${crypto.randomUUID()}.${extension}`;
        
        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from('imagenes')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });
        
        if (error) {
            console.error('Error al subir imagen a Supabase Storage:', error.message);
            return base64String; // Fallback: devolver Base64
        }
        
        // Obtener URL pública
        const { data: publicUrlData } = supabase.storage
            .from('imagenes')
            .getPublicUrl(fileName);
        
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error('Error procesando imagen para Storage:', err.message);
        return base64String; // Fallback: devolver Base64
    }
}

function textoLimpio(valor, fallback = '') {
    if (valor === null || valor === undefined) return fallback;
    return String(valor).trim();
}

function payloadBancoInterno(body) {
    return {
        nombre: textoLimpio(body.nombre),
        principioActivo: textoLimpio(body.principioActivo || body.principio_activo),
        especie: textoLimpio(body.especie, 'Ambos') || 'Ambos',
        tipo: textoLimpio(body.presentacion || body.tipo),
        rangoPeso: textoLimpio(body.rangoPeso || body.rango_peso),
        parasitos: textoLimpio(body.parasitosCubre || body.parasitos),
        dosis: textoLimpio(body.dosisRecomendada || body.dosis),
        via: textoLimpio(body.viaAdministracion || body.via),
        frecuencia: textoLimpio(body.frecuenciaRecomendada || body.frecuencia),
        laboratorio: textoLimpio(body.laboratorio),
        lote: textoLimpio(body.lote),
        observaciones: textoLimpio(body.observaciones)
    };
}

function payloadBancoExterno(body) {
    return {
        nombre: textoLimpio(body.nombre),
        principioActivo: textoLimpio(body.principioActivo || body.principio_activo),
        especie: textoLimpio(body.especie, 'Ambos') || 'Ambos',
        tipo: textoLimpio(body.tipo),
        rangoPeso: textoLimpio(body.rangoPeso || body.rango_peso),
        duracion: textoLimpio(body.duracionProteccion || body.duracion),
        parasitos: textoLimpio(body.parasitosCubre || body.parasitos),
        dosis: textoLimpio(body.dosis),
        via: textoLimpio(body.via),
        frecuencia: textoLimpio(body.frecuenciaRecomendada || body.frecuencia),
        laboratorio: textoLimpio(body.laboratorio),
        lote: textoLimpio(body.lote),
        observaciones: textoLimpio(body.observaciones),
        advertencias: textoLimpio(body.advertencias)
    };
}
// ==========================================
// BANCOS CLÍNICOS
// ==========================================

// Vacunas
app.get('/api/banco/vacunas', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM banco_vacunas WHERE veterinaria_id = $1 ORDER BY nombre ASC', [req.veterinaria.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener banco de vacunas.' });
    }
});

app.post('/api/banco/vacunas', authMiddleware, async (req, res) => {
    const { nombre, tipo, especie, enfermedades, laboratorio, lote, frecuencia, observaciones } = req.body;
    try {
        if (!textoLimpio(nombre)) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await db.query(
            `INSERT INTO banco_vacunas (veterinaria_id, nombre, tipo, especie, enfermedades, laboratorio, lote, frecuencia, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [req.veterinaria.id, textoLimpio(nombre), textoLimpio(tipo), especie || 'Ambos', enfermedades, laboratorio, lote, frecuencia, observaciones]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al agregar vacuna al banco.' });
    }
});

app.put('/api/banco/vacunas/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, especie, enfermedades, laboratorio, lote, frecuencia, observaciones } = req.body;
    try {
        if (!textoLimpio(nombre)) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await db.query(
            `UPDATE banco_vacunas 
             SET nombre = $1, tipo = $2, especie = $3, enfermedades = $4, laboratorio = $5, lote = $6, frecuencia = $7, observaciones = $8
             WHERE id = $9 AND veterinaria_id = $10 RETURNING *`,
            [textoLimpio(nombre), textoLimpio(tipo), especie || 'Ambos', enfermedades, laboratorio, lote, frecuencia, observaciones, id, req.veterinaria.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar vacuna del banco.' });
    }
});

app.delete('/api/banco/vacunas/:id', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM banco_vacunas WHERE id = $1 AND veterinaria_id = $2', [req.params.id, req.veterinaria.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Item no encontrado' });
        res.json({ mensaje: 'Item eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar vacuna del banco.' });
    }
});

// Internos
app.get('/api/banco/internos', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM banco_internos WHERE veterinaria_id = $1 ORDER BY nombre ASC', [req.veterinaria.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener banco de desparasitantes internos.' });
    }
});

app.post('/api/banco/internos', authMiddleware, async (req, res) => {
    const datos = payloadBancoInterno(req.body);
    try {
        if (!datos.nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await db.query(
            `INSERT INTO banco_internos (veterinaria_id, nombre, principio_activo, especie, tipo, rango_peso, parasitos, dosis, via, frecuencia, laboratorio, lote, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [req.veterinaria.id, datos.nombre, datos.principioActivo, datos.especie, datos.tipo, datos.rangoPeso, datos.parasitos, datos.dosis, datos.via, datos.frecuencia, datos.laboratorio, datos.lote, datos.observaciones]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al agregar interno al banco.' });
    }
});

app.put('/api/banco/internos/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const datos = payloadBancoInterno(req.body);
    try {
        if (!datos.nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await db.query(
            `UPDATE banco_internos 
             SET nombre = $1, principio_activo = $2, especie = $3, tipo = $4, rango_peso = $5, parasitos = $6, dosis = $7, via = $8, frecuencia = $9, laboratorio = $10, lote = $11, observaciones = $12
             WHERE id = $13 AND veterinaria_id = $14 RETURNING *`,
            [datos.nombre, datos.principioActivo, datos.especie, datos.tipo, datos.rangoPeso, datos.parasitos, datos.dosis, datos.via, datos.frecuencia, datos.laboratorio, datos.lote, datos.observaciones, id, req.veterinaria.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar interno del banco.' });
    }
});

app.delete('/api/banco/internos/:id', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM banco_internos WHERE id = $1 AND veterinaria_id = $2', [req.params.id, req.veterinaria.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Item no encontrado' });
        res.json({ mensaje: 'Item eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar interno del banco.' });
    }
});

// Externos
app.get('/api/banco/externos', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM banco_externos WHERE veterinaria_id = $1 ORDER BY nombre ASC', [req.veterinaria.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener banco de desparasitantes externos.' });
    }
});

app.post('/api/banco/externos', authMiddleware, async (req, res) => {
    const datos = payloadBancoExterno(req.body);
    try {
        if (!datos.nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await db.query(
            `INSERT INTO banco_externos (veterinaria_id, nombre, principio_activo, especie, tipo, rango_peso, duracion, parasitos, dosis, via, frecuencia, laboratorio, lote, observaciones, advertencias)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [req.veterinaria.id, datos.nombre, datos.principioActivo, datos.especie, datos.tipo, datos.rangoPeso, datos.duracion, datos.parasitos, datos.dosis, datos.via, datos.frecuencia, datos.laboratorio, datos.lote, datos.observaciones, datos.advertencias]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al agregar externo al banco.' });
    }
});

app.put('/api/banco/externos/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const datos = payloadBancoExterno(req.body);
    try {
        if (!datos.nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await db.query(
            `UPDATE banco_externos 
             SET nombre = $1, principio_activo = $2, especie = $3, tipo = $4, rango_peso = $5, duracion = $6, parasitos = $7, dosis = $8, via = $9, frecuencia = $10, laboratorio = $11, lote = $12, observaciones = $13, advertencias = $14
             WHERE id = $15 AND veterinaria_id = $16 RETURNING *`,
            [datos.nombre, datos.principioActivo, datos.especie, datos.tipo, datos.rangoPeso, datos.duracion, datos.parasitos, datos.dosis, datos.via, datos.frecuencia, datos.laboratorio, datos.lote, datos.observaciones, datos.advertencias, id, req.veterinaria.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar externo del banco.' });
    }
});

app.delete('/api/banco/externos/:id', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM banco_externos WHERE id = $1 AND veterinaria_id = $2', [req.params.id, req.veterinaria.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Item no encontrado' });
        res.json({ mensaje: 'Item eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar externo del banco.' });
    }
});


/**
 * Endpoint para subir una imagen desde el frontend
 */
app.post('/api/upload-image', authMiddleware, async (req, res) => {
    const { imagen, carpeta } = req.body;
    
    if (!imagen) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    }
    
    try {
        const url = await subirImagenAStorage(imagen, carpeta || 'general');
        res.json({ url });
    } catch (err) {
        console.error('Error al subir imagen:', err);
        res.status(500).json({ error: 'Error al procesar la imagen.' });
    }
});

// --- INICIALIZACIÓN DEL SERVIDOR ---

const serverInstance = app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en puerto ${PORT}`);
});

serverInstance.on('error', (err) => {
    console.error('Error al iniciar el servidor backend:', err.message);
});

setInterval(() => {}, 60 * 60 * 1000);

