# Cartilla Digital

**Cartilla Digital** es una aplicación web para clínicas veterinarias que permite registrar pacientes, administrar su historial preventivo y compartir una cartilla pública verificable para tutores mediante enlace o código QR.

El sistema está construido con **HTML, CSS y JavaScript vanilla** en el frontend, un backend **Node.js/Express**, autenticación con **JWT**, base de datos **PostgreSQL alojada en Supabase** y soporte opcional para **Supabase Storage** y **Resend**.

> Revisión técnica del ZIP: 2026-06-19.  
> Estado general: **funcional avanzado en desarrollo**, con módulos activos para clínica, pacientes, cartilla, banco clínico, equipo veterinario, soporte, transferencias y Centro de Control administrativo.

---

## Objetivo principal

Digitalizar la cartilla veterinaria preventiva para que una clínica pueda:

- Registrar mascotas y datos del tutor.
- Administrar vacunas, desparasitaciones internas, controles antiparasitarios externos y controles preventivos.
- Mantener un historial preventivo ordenado por paciente.
- Compartir una cartilla pública mediante URL o código QR.
- Imprimir la cartilla o guardarla como PDF desde el navegador.
- Gestionar banco clínico, equipo veterinario, configuración de clínica, soporte interno y transferencias entre clínicas.
- Permitir supervisión global desde un **Centro de Control** para usuarios con rol `super_admin`.

---

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript ES6 sin framework |
| UI | CSS propio en `css/styles.css` y `css/admin.css` |
| Backend | Node.js, Express, CORS |
| Base de datos | PostgreSQL en Supabase |
| Conexión DB | `pg` con pool de conexiones |
| Autenticación | JWT con `jsonwebtoken` |
| Seguridad de contraseña | `bcryptjs` |
| Storage de imágenes | Supabase Storage con fallback a Base64 |
| Email | Resend para recuperación de contraseña, condicionado a configuración |
| QR | `qrcodejs` desde CDN con fallback por canvas |
| Validación local | `node --check` + scripts en `scratch/` |

---

## Estructura del proyecto

```text
.
├── admin.html                  # Centro de Control / Panel Super Admin
├── index.html                  # Aplicación principal de clínicas
├── static-server.js            # Servidor estático local + proxy /api
├── iniciar_servidor.bat        # Arranque local en Windows
├── package.json                # Scripts del proyecto raíz
├── package-lock.json
├── README.md
├── assets/
│   └── logo-placeholder.png
├── css/
│   ├── styles.css              # UI principal, responsive, cartilla e impresión
│   └── admin.css               # UI del Centro de Control
├── js/
│   ├── api.js                  # Cliente HTTP centralizado
│   ├── app.js                  # Inicialización, auth, eventos y rutas internas
│   ├── ui.js                   # Render de vistas, cartilla, QR, dashboard y modales
│   ├── storage.js              # Adaptador de persistencia y fallback local
│   ├── codigo.js               # Generación de códigos de pacientes
│   ├── razas.js                # Razas base y personalizadas por clínica
│   ├── fotos.js                # Compresión, carga y captura de imágenes
│   ├── mascotas.js             # Alta/edición de pacientes
│   ├── vacunas.js              # Vacunas
│   ├── desparasitaciones.js    # Desparasitaciones internas y externas
│   ├── controles.js            # Controles preventivos
│   ├── banco.js                # Banco clínico
│   ├── equipo.js               # Equipo veterinario
│   ├── transferencias.js       # Asociaciones y transferencias entre clínicas
│   ├── support.js              # Soporte, comentarios y tickets
│   ├── admin-service.js        # Cliente API del Centro de Control
│   └── admin.js                # UI del Centro de Control
├── server/
│   ├── index.js                # API Express principal
│   ├── adminRoutes.js          # Rutas protegidas del Centro de Control
│   ├── authMiddleware.js       # Validación JWT
│   ├── db.js                   # Pool PostgreSQL + migración automática parcial
│   ├── supabaseClient.js       # Cliente Supabase Storage
│   ├── migrate.js              # Migración histórica/parcial
│   ├── schema.sql              # Esquema SQL completo de referencia
│   ├── .env.template           # Plantilla actual; requiere actualización
│   └── test-*.js               # Scripts de diagnóstico
├── supabase/
│   ├── admin_center_schema.sql
│   └── phase2_control_avanzado.sql
└── scratch/
    ├── check_html.js
    ├── test_storage.js
    └── test_flow.js
```

---

## Módulos actuales del sistema

| Módulo | Estado | Descripción |
| --- | --- | --- |
| Autenticación de clínicas | Activo | Registro, login, JWT, sesión local y protección de rutas privadas. |
| Recuperación de contraseña | Activo condicionado | Endpoints y UI existen. El envío real depende de `RESEND_API_KEY`. |
| Inicio / Dashboard | Activo | Conteos de pacientes, caninos, felinos, vacunas, desparasitaciones, alertas clínicas y próximos eventos. |
| Pacientes | Activo | Listado, búsqueda por código/mascota/tutor/raza, acceso a cartilla y acciones clínicas. |
| Registro de mascota | Activo | Formulario con datos de mascota, tutor, especie, raza, sexo, fecha, color, peso, foto y observaciones. |
| Razas inteligentes | Activo | Razas base por especie, búsqueda, escritura manual y razas personalizadas por clínica. Incluye `Canino`, `Felino`, `Mestizo` y `Caramelo`. |
| Fotos y cámara | Activo | Carga desde galería, captura por cámara WebRTC cuando el dispositivo lo permite, compresión y eliminación de foto. |
| Cartilla del paciente | Activo | Vista clínica con datos de mascota, tutor, historial preventivo, QR, enlace público, WhatsApp e impresión. |
| Vista pública del tutor | Activo | Se carga con `?id=<mascotaId>` usando `/api/public/mascotas/:id`; no requiere autenticación. |
| Impresión / PDF | Activo | Usa `window.print()` y CSS de impresión. El PDF se genera desde “Guardar como PDF” del navegador. |
| Vacunas | Activo | Crear, editar, eliminar y actualizar estado de vacuna. Incluye lote, laboratorio, próxima dosis y responsable. |
| Desparasitaciones internas | Activo | Crear, editar, eliminar y actualizar estado. Incluye producto, dosis, vía, próxima aplicación y responsable. |
| Controles antiparasitarios externos | Activo | Se registran dentro de desparasitaciones con tipo externo y campos preventivos específicos. |
| Controles preventivos | Activo | Registro de fecha, motivo, peso, temperatura, FC, FR, hallazgos, diagnóstico, tratamiento, recomendaciones y próximo control. |
| Estados de eventos preventivos | Activo | Estados `asistio`, `no_asistio` y `reagendado` para vacunas, desparasitaciones y controles. |
| Banco de vacunas | Activo | CRUD completo, autocompletado y catálogo inicial orientado a Ecuador. |
| Banco de antiparasitarios internos | Activo | CRUD completo con principio activo, especie, presentación, dosis, vía, frecuencia, lote y observaciones. |
| Banco de antiparasitarios externos | Activo | CRUD completo con producto, principio activo, especie, tipo, rango de peso, duración, frecuencia y advertencias. |
| Medicamentos preventivos | Preparado | Existe vista visual en banco, pero no se identificó CRUD funcional conectado a base de datos. |
| Códigos rápidos | Parcial/preparado | Vista con códigos de referencia para Excel/carga futura. No hay importación funcional completa. |
| Configuración de veterinaria | Activo parcial | Guarda datos principales: nombre, propietario, iniciales, teléfono, correo, dirección y logo. |
| Plantillas, preferencias, roles y seguridad | Preparado | Paneles visibles en configuración, pero varias opciones no están conectadas a persistencia completa. |
| Equipo veterinario | Activo | CRUD de responsables con cargo, estado y uso como firmantes en procedimientos. |
| Transferencia de pacientes | Activo avanzado | Asociaciones entre clínicas, buzón, envío/solicitud, permisos, coincidencias, aceptación/rechazo y auditoría. |
| Soporte / Comentarios | Activo | La clínica crea tickets, agrega mensajes y revisa estados. El admin gestiona desde Centro de Control. |
| Centro de Control / Admin | Activo parcial avanzado | Panel protegido por rol `super_admin` con dashboard, clínicas, pacientes globales, tutores, planes, pagos, métricas, tickets, actividad y alertas. |
| Pagos manuales | Activo parcial | Registro y seguimiento administrativo de pagos; no hay pasarela de cobro automática integrada. |
| Planes y pruebas gratis | Activo administrativo parcial | Existen campos y vistas admin para plan, vencimiento, trial y estado de cuenta; falta flujo comercial completo al registrarse. |
| Métricas de uso | Activo parcial | Endpoint y vista admin con actividad, uso por clínica y datos agregados. |
| StoreClinic / Tienda veterinaria | No implementado | No se encontró código relacionado con tienda, proveedores, catálogo comercial o inventario. |
| Cartilla tradicional tipo tríptico | No implementado | No se encontró modo tríptico horizontal A4 ni selector de formato profesional/tradicional. |
| Importación Excel masiva | Preparado/no implementado | Hay vista “Plantilla Excel pendiente” y referencias a `.xlsx/.csv`, pero no se encontró importador funcional. |
| Recordatorios automáticos al tutor | Preparado/no implementado | Hay plantillas visuales y categoría de soporte “recordatorios”; no se encontró job, cron ni envío automático de recordatorios preventivos. |

---

## Funcionalidades implementadas

### Clínicas y autenticación

- Registro de clínicas veterinarias.
- Inicio de sesión con email y contraseña.
- Contraseñas hasheadas con `bcryptjs`.
- JWT para proteger rutas privadas.
- Rol `clinic_owner` para clínicas normales.
- Rol `super_admin` para Centro de Control.
- Recuperación de contraseña con token y expiración.
- Envío de correo de recuperación mediante Resend si está configurado.

### Pacientes

- Registro, edición, consulta y eliminación de mascotas.
- Datos de mascota:
  - Nombre.
  - Especie.
  - Raza.
  - Sexo.
  - Fecha de nacimiento.
  - Color/pelaje.
  - Peso.
  - Foto.
  - Observaciones.
- Datos del tutor:
  - Nombre.
  - Teléfono.
  - Email.
  - Dirección.
- Código único de cartilla con formato:

```text
CD-[INICIALES]-[ESPECIE]-[AAMMDD]-[CONTADOR]
```

### Razas

- Catálogo base de razas para `Canino` y `Felino`.
- Incluye `Mestizo` para ambas especies.
- Incluye `Caramelo` para caninos.
- Permite escribir una raza nueva y guardarla por clínica.
- Normaliza especies antiguas como `Perro/Gato` o códigos `P/G` hacia el flujo actual.

### Historial preventivo

- Vacunas.
- Desparasitaciones internas.
- Controles antiparasitarios externos.
- Controles preventivos.
- Responsable veterinario asociado desde equipo.
- Fechas de aplicación y próximas fechas.
- Lote, laboratorio, dosis, vía, observaciones y datos clínicos según módulo.
- Estados de asistencia:
  - `asistio`
  - `no_asistio`
  - `reagendado`

### Cartilla clínica y pública

- Vista interna para la clínica.
- Vista pública para tutor por URL.
- Código QR.
- Compartir por WhatsApp.
- Impresión.
- Guardado como PDF desde navegador.
- Ocultamiento de elementos administrativos en modo público.
- Placeholder visual con emoji si no existe foto de mascota.

### Banco clínico

- Banco privado por clínica.
- Vacunas.
- Antiparasitarios internos.
- Antiparasitarios externos.
- Catálogo inicial orientado a Ecuador.
- Autocompletado en formularios de historial preventivo.

### Equipo veterinario

- Crear, editar y eliminar responsables.
- Cargo/estado del responsable.
- Responsable principal sincronizado con propietario de la clínica.
- Uso de responsables en vacunas, desparasitaciones y controles.

### Transferencias entre clínicas

- Búsqueda de clínicas.
- Solicitudes de asociación.
- Aceptación/rechazo de asociaciones.
- Buzón de transferencias.
- Envío de pacientes.
- Solicitud de paciente.
- Permisos por tipo de información:
  - Datos de mascota.
  - Datos del tutor.
  - Vacunas.
  - Desparasitaciones internas.
  - Desparasitaciones externas.
  - Historial preventivo.
  - Próximas atenciones.
  - Observaciones.
  - Fotos.
  - Historial completo.
- Auditoría de acciones.
- Notificaciones internas.

### Soporte y tickets

- Crear tickets desde la app clínica.
- Tipos de solicitud:
  - Problema técnico.
  - Error del sistema.
  - Sugerencia.
  - Solicitud de mejora.
  - Duda.
  - Pago/plan.
  - Impresión/PDF.
  - QR/cartilla pública.
  - Recordatorios.
  - Otro.
- Prioridades:
  - Baja.
  - Media.
  - Alta.
  - Urgente.
- Estados:
  - Enviado.
  - Recibido.
  - Revisado.
  - En proceso.
  - En desarrollo.
  - Solucionado.
  - Rechazado.
  - Cerrado.
- Conversación por mensajes entre clínica y administración.

### Centro de Control / Super Admin

El Centro de Control se carga desde `admin.html` y consume rutas `/api/admin/*`.

Incluye vistas para:

- Dashboard global.
- Clínicas registradas.
- Pacientes globales.
- Tutores.
- Planes.
- Pagos.
- Métricas de uso.
- Pruebas gratis.
- Comentarios/reportes.
- Soporte técnico.
- Actividad del sistema.
- Alertas.
- Configuración global.
- Usuarios internos.
- Seguridad.

Las vistas de **configuración global**, **usuarios internos** y **seguridad** están preparadas visualmente para fase posterior.

---

## API principal

### Rutas públicas

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Verificar estado del backend |
| POST | `/api/auth/register` | Registrar clínica |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/forgot-password` | Solicitar recuperación |
| POST | `/api/auth/reset-password` | Restablecer contraseña |
| GET | `/api/public/mascotas/:id` | Cartilla pública del tutor |

### Rutas privadas de clínica

| Módulo | Rutas principales |
| --- | --- |
| Veterinaria | `GET/PUT /api/veterinaria` |
| Razas | `GET/POST /api/razas` |
| Mascotas | `GET/POST /api/mascotas`, `GET/PUT/DELETE /api/mascotas/:id` |
| Vacunas | `POST/PUT/PATCH/DELETE /api/mascotas/:id/vacunas` |
| Desparasitaciones | `POST/PUT/PATCH/DELETE /api/mascotas/:id/desparasitaciones` |
| Controles | `POST/PUT/PATCH/DELETE /api/mascotas/:id/controles` |
| Equipo | `GET/POST/PUT/DELETE /api/equipo` |
| Banco vacunas | `GET/POST/PUT/DELETE /api/banco/vacunas` |
| Banco internos | `GET/POST/PUT/DELETE /api/banco/internos` |
| Banco externos | `GET/POST/PUT/DELETE /api/banco/externos` |
| Transferencias | `/api/transferencias/*` |
| Soporte | `/api/support/tickets` |
| Imágenes | `POST /api/upload-image` |

### Rutas de Centro de Control

Las rutas admin se montan bajo:

```text
/api/admin
```

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/admin/me` | Validar usuario super admin |
| GET | `/api/admin/summary` | Resumen global |
| GET | `/api/admin/clinics` | Clínicas |
| PATCH | `/api/admin/clinics/:id` | Editar estado/plan/notas de clínica |
| GET | `/api/admin/patients` | Pacientes globales |
| GET | `/api/admin/tutors` | Tutores |
| GET | `/api/admin/plans` | Planes y vencimientos |
| GET | `/api/admin/feedback` | Comentarios/reportes |
| PATCH | `/api/admin/feedback/:id` | Actualizar feedback |
| GET | `/api/admin/tickets` | Tickets |
| PATCH | `/api/admin/tickets/:id` | Actualizar ticket |
| GET | `/api/admin/payments` | Pagos |
| POST | `/api/admin/payments` | Registrar pago manual |
| PATCH | `/api/admin/payments/:id` | Actualizar pago |
| GET | `/api/admin/usage-metrics` | Métricas |
| GET | `/api/admin/support-users` | Usuarios/soporte |
| GET | `/api/admin/activity` | Actividad |
| GET | `/api/admin/alerts` | Alertas |

---

## Base de datos

El proyecto usa PostgreSQL en Supabase mediante `pg`.

### Tablas principales

| Tabla | Uso |
| --- | --- |
| `veterinarias` | Cuentas de clínicas, perfil, propietario, rol, plan, trial y estado de cuenta. |
| `mascotas` | Pacientes, datos de tutor, foto, observaciones y relación con clínica. |
| `razas_clinica` | Razas personalizadas por clínica y especie. |
| `equipo_veterinario` | Responsables/firmantes de cada clínica. |
| `vacunas` | Historial de vacunas. |
| `desparasitaciones` | Historial de desparasitación interna y control externo. |
| `controles` | Controles preventivos. |
| `banco_vacunas` | Banco privado de vacunas. |
| `banco_internos` | Banco privado de antiparasitarios internos. |
| `banco_externos` | Banco privado de antiparasitarios externos. |
| `password_resets` | Tokens de recuperación. |
| `transferencias` | Transferencia simple por código temporal. |
| `clinic_associations` | Asociaciones entre clínicas. |
| `patient_transfer_requests` | Solicitudes/envíos avanzados de pacientes. |
| `patient_transfer_items` | Pacientes incluidos en transferencias. |
| `patient_request_search_data` | Datos para búsqueda de pacientes solicitados. |
| `patient_transfer_permissions` | Permisos de información compartida. |
| `transfer_audit_logs` | Auditoría de transferencias. |
| `internal_notifications` | Notificaciones internas. |
| `admin_feedback` | Comentarios/reportes administrativos. |
| `activity_logs` | Actividad del sistema. |
| `support_tickets` | Tickets de soporte. |
| `support_ticket_messages` | Mensajes de tickets. |
| `support_ticket_status_history` | Historial de estados de tickets. |
| `payments` | Pagos manuales o preparados para integración futura. |
| `admin_alerts` | Alertas del Centro de Control. |
| `support_internal_notes` | Notas internas de soporte. |

---

## Variables de entorno

> No subir archivos `.env` al repositorio ni compartirlos en ZIP.  
> El código actual de `server/db.js` usa variables separadas `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` y `DB_SSL`. La plantilla `server/.env.template` debe actualizarse porque todavía menciona `DATABASE_URL`.

Crear un archivo:

```text
server/.env
```

con una estructura similar a:

```env
PORT=3000

DB_USER=usuario_postgres
DB_PASSWORD=contrasena_postgres
DB_HOST=host_postgres_supabase
DB_PORT=5432
DB_NAME=postgres
DB_SSL=require

JWT_SECRET=frase_larga_y_segura

FRONTEND_URL=http://localhost:5500
RESEND_API_KEY=PENDIENTE_CONFIGURAR

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_publica
```

Variables opcionales del servidor estático:

```env
FRONTEND_PORT=5500
CARTILLA_SKIP_BACKEND_AUTOSTART=1
```

---

## Instalación local

### Requisitos

- Node.js.
- npm.
- Proyecto de Supabase con PostgreSQL.
- Credenciales PostgreSQL.
- Opcional: bucket de Supabase Storage.
- Opcional: API key de Resend.

### Instalación

Desde la raíz:

```bash
npm install
```

Luego, instalar dependencias del backend:

```bash
cd server
npm install
```

Crear `server/.env` con las variables reales.

Volver a la raíz e iniciar:

```bash
npm start
```

La app se sirve en:

```text
http://localhost:5500
```

El backend local usa:

```text
http://localhost:3000
```

Health checks:

```text
http://localhost:3000/api/health
http://localhost:5500/api/health
```

---

## Scripts disponibles

Desde la raíz:

```bash
npm start
npm run dev
npm run frontend
npm run backend
npm run check
```

Desde `server/`:

```bash
npm start
npm run dev
```

En Windows:

```text
iniciar_servidor.bat
```

### Nota sobre `npm run check`

El script raíz ejecuta validaciones con `jsdom`. Si aparece un error como:

```text
Cannot find module 'jsdom'
```

ejecutar primero:

```bash
npm install
```

en la raíz del proyecto.

---

## Flujo general de uso

1. La clínica se registra con datos básicos.
2. El backend crea la cuenta, guarda la contraseña hasheada y sincroniza al propietario como responsable principal.
3. La clínica inicia sesión y recibe token JWT.
4. Desde Inicio revisa conteos, alertas y próximos eventos.
5. Registra pacientes con datos de mascota, tutor, raza y foto.
6. Abre la cartilla para registrar vacunas, desparasitaciones y controles.
7. Usa el banco clínico para autocompletar productos.
8. Comparte la cartilla por enlace, QR o WhatsApp.
9. Imprime o guarda como PDF desde el navegador.
10. Usa Transferencias para asociarse con otras clínicas y compartir expedientes autorizados.
11. Usa Soporte/Comentarios para enviar problemas o solicitudes al administrador.
12. Un usuario `super_admin` entra a `admin.html` o `/admin` para gestionar el ecosistema.

---

## Estado real por prioridad

### Ya integrado

- Auth de clínicas.
- Dashboard clínico.
- Registro/listado/edición/eliminación de pacientes.
- Razas base y personalizadas.
- Canino/Felino.
- Foto desde galería/cámara y botón para eliminar foto.
- Cartilla clínica.
- Cartilla pública.
- QR.
- Impresión/PDF por navegador.
- Vacunas.
- Desparasitaciones internas.
- Controles externos.
- Controles preventivos.
- Estados de asistencia y reagendamiento.
- Banco clínico de vacunas, internos y externos.
- Equipo veterinario.
- Configuración básica de veterinaria.
- Transferencias entre clínicas.
- Tickets y soporte interno.
- Centro de Control parcial avanzado.
- Pagos manuales desde admin.
- Métricas y actividad administrativa parcial.

### Preparado o parcial

- Importación Excel/csv.
- Códigos rápidos como sistema formal de importación.
- Medicamentos preventivos.
- Plantillas de recordatorios.
- Preferencias avanzadas.
- Roles internos de clínica.
- Configuración global admin.
- Usuarios internos admin.
- Seguridad admin.
- Flujo comercial de planes al registrarse.
- Pruebas gratis desde onboarding.
- Pasarela real de pagos.
- Recordatorios automáticos al tutor.

### No implementado en el código revisado

- StoreClinic / tienda veterinaria.
- Inventario comercial.
- Proveedores.
- Pedidos/compras.
- Cartilla tradicional tipo tríptico.
- Selector entre cartilla profesional y cartilla tradicional.
- Job automático de email para próximas vacunas/desparasitaciones/controles.
- WhatsApp API oficial.
- Importador real `.xlsx`.
- Exportador Excel completo.
- Multiusuario interno de clínica con permisos reales separados.

---

## Pendientes técnicos importantes

1. **Eliminar `server/.env` del ZIP y del repositorio** si llegó a guardarse por error.
2. **No compartir `server/.env`** con claves reales.
3. **No subir `node_modules/`**.
4. Actualizar `server/.env.template` para que use las variables reales esperadas por `server/db.js`.
5. Consolidar migraciones:
   - `server/schema.sql`
   - `server/db.js`
   - `server/migrate.js`
   - SQL de `supabase/`
6. Revisar scripts `server/test-*` para evitar credenciales o pruebas antiguas.
7. Definir una sola estrategia de despliegue:
   - Frontend.
   - Backend.
   - CORS.
   - `FRONTEND_URL`.
   - URL pública del API.
8. Validar reglas de seguridad si se usa Supabase Storage en producción.
9. Crear backups y política de retención de datos.
10. Agregar pruebas funcionales reales para:
    - Registro/login.
    - Pacientes.
    - Código único.
    - Cartilla pública.
    - Transferencias.
    - Tickets.
    - Admin Center.

---

## Roadmap recomendado

### Fase 1 — Estabilización técnica

- Corregir `.env.template`.
- Crear `.env.example` limpio.
- Consolidar migraciones.
- Limpiar scripts de diagnóstico.
- Verificar `npm run check`.
- Revisar despliegue frontend/backend.

### Fase 2 — Responsive y experiencia móvil

- Revisar sidebar móvil.
- Ajustar hamburguesa.
- Mejorar tamaños de texto.
- Evitar deformaciones en tarjetas/tablas.
- Mantener nombre de página centrado en la vista principal.
- Validar en celular, tablet, laptop y monitor grande.

### Fase 3 — Cartilla profesional

- Refinar diseño de cartilla.
- Mejorar impresión.
- Aumentar QR en impresión.
- Mantener vista tutor limpia.
- Separar botones administrativos del modo público.

### Fase 4 — Importación Excel

- Crear plantilla `.xlsx`.
- Crear catálogo de códigos descargable.
- Validar datos antes de importar.
- Vista previa de importación.
- Reporte de errores.
- Exportación de pacientes.

### Fase 5 — Recordatorios

- Crear tabla de recordatorios.
- Crear jobs programados.
- Enviar correos por Resend/Brevo/SendGrid.
- Historial de envíos.
- Plantillas editables por clínica.
- Activación/desactivación por clínica.

### Fase 6 — Planes, pagos y trial

- Pantalla de selección de plan al registrarse.
- Planes Free, Básico, Pro y Plus.
- Prueba gratis.
- Límites por plan.
- Bloqueo o advertencia por plan vencido.
- Integración futura con pasarela.

### Fase 7 — Centro de Control completo

- Configuración global.
- Usuarios internos.
- Seguridad.
- Gestión avanzada de clínicas.
- Panel de alertas automático.
- Filtros avanzados.
- Exportaciones administrativas.

### Fase 8 — Cartilla tradicional tríptico

- Formato A4 horizontal.
- Tres columnas.
- Solo datos existentes.
- Firma/sello/QR.
- Selector de tipo de impresión:
  - Profesional detallada.
  - Tradicional tríptico.

### Fase 9 — StoreClinic

- Proveedores.
- Catálogo comercial.
- Productos.
- Compras.
- Comisiones.
- Suscripciones para proveedores.
- Integración futura con inventario.

---

## Buenas prácticas de seguridad

- Nunca subir `.env`.
- Nunca subir claves de Supabase, DB, JWT o Resend.
- No usar datos reales de pacientes en pruebas compartidas.
- Usar contraseñas fuertes para `JWT_SECRET`.
- Mantener backend como capa de seguridad principal.
- Validar siempre `veterinaria_id` en rutas privadas.
- Evitar exponer datos sensibles en la cartilla pública.
- Revisar CORS antes de producción.
- Usar HTTPS en producción.

---

## Resumen para revisión con ChatGPT

Cartilla Digital es una aplicación veterinaria web avanzada con frontend vanilla, backend Express, PostgreSQL/Supabase, JWT, banco clínico, cartilla pública con QR, módulos preventivos, equipo veterinario, transferencias entre clínicas, soporte/tickets y Centro de Control para `super_admin`.

El sistema ya tiene varias funciones que antes estaban planteadas como futuras: soporte interno, estados de tickets, pagos manuales, métricas, actividad, alertas, transferencias y control admin parcial. Las áreas que siguen pendientes son principalmente importación Excel real, recordatorios automáticos, pasarela de pagos, onboarding con planes, cartilla tríptico, roles internos reales, seguridad admin completa y StoreClinic.

El siguiente paso recomendado es estabilizar variables de entorno/migraciones, corregir responsive, terminar Centro de Control y luego avanzar hacia planes, pagos, recordatorios e importación Excel.
