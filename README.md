# 🐾 Cartilla Digital Veterinaria

**Cartilla Digital** es una plataforma profesional y moderna diseñada para que las clínicas veterinarias gestionen el historial médico preventivo de las mascotas (vacunas, desparasitaciones y controles clínicos) y permitan a los tutores acceder a la información de sus mascotas en tiempo real mediante un código QR o enlace público verificado.

La aplicación cuenta con una interfaz web responsiva de alta gama (estilo minimalista clínico) y un servidor backend conectado a una base de datos relacional.

---

## 🚀 Características Principales

1. **Gestión de Pacientes**: Registro detallado de mascotas, incluyendo foto de perfil, datos de raza, edad y datos de contacto del tutor.
2. **Historial Médico Preventivo**:
   * **Vacunas**: Control de dosis, marca, lote y veterinario responsable.
   * **Desparasitaciones Internas y Externas**: Control de principios activos y periodicidad.
   * **Controles Clínicos**: Anotación de observaciones generales de salud.
3. **Módulo de Equipo Veterinario**: Registro y administración de médicos veterinarios y asistentes de la clínica. Permite vincularlos como responsables firmantes en cada procedimiento médico.
4. **Cámara WebRTC Integrada**: Captura fotos de las mascotas directamente desde la webcam en ordenadores o utilizando la cámara nativa en dispositivos móviles.
5. **Formato de Impresión A4 Minimalista**: Diseño optimizado para impresión física o guardado en PDF con formato de hoja A4. Oculta de forma automática botones, formularios y secciones que no hayan sido completadas.
6. **Cartilla Pública por Código QR**: Generación dinámica de códigos QR y enlaces web públicos para que los tutores tengan la cartilla a la mano en todo momento sin necesidad de iniciar sesión.

---

## 🛠️ Stack Tecnológico

* **Frontend**: HTML5 (Semántico), Vanilla CSS3 (Custom Variables, diseño responsivo, temas Claro/Oscuro) y Javascript (ES6).
* **Backend**: Node.js con Express.js.
* **Base de Datos**: PostgreSQL (hospedado en Supabase).
* **Autenticación**: JSON Web Tokens (JWT) para proteger las rutas privadas del personal veterinario.

---

## 📂 Estructura del Proyecto

```text
├── css/
│   └── styles.css          # Diseño global, componentes y media queries de impresión
├── js/
│   ├── api.js              # Cliente de API para comunicación con el servidor
│   ├── storage.js          # Persistencia y manejo del estado local
│   ├── equipo.js           # Lógica del módulo de equipo veterinario (CRUD)
│   ├── ui.js               # Control de vistas, renderizado de tablas y modales
│   └── app.js              # Inicialización, enrutamiento y listeners de formularios
├── server/
│   ├── index.js            # Servidor Express, APIs públicas/privadas y lógica de negocio
│   ├── db.js               # Pool de conexiones a PostgreSQL (Supabase)
│   ├── authMiddleware.js   # Middleware de validación JWT
│   ├── migrate.js          # Script de migraciones de la base de datos
│   ├── schema.sql          # Estructura DDL de tablas y relaciones de la base de datos
│   └── .env.template       # Plantilla de variables de entorno para el servidor
├── index.html              # Estructura base de la aplicación web
└── iniciar_servidor.bat    # Script automatizado para arrancar el backend en Windows
```

---

## 🔧 Configuración e Instalación

### 1. Base de Datos (PostgreSQL / Supabase)
Crea una base de datos en Supabase y ejecuta las consultas del archivo `server/schema.sql` en el editor SQL para crear la estructura de las tablas correspondientes (`veterinarias`, `equipo_veterinario`, `mascotas`, `vacunas`, `desparasitaciones`, `controles`).

### 2. Configurar el Backend
1. Entra a la carpeta `server/`.
2. Crea un archivo `.env` basado en `.env.template`.
3. Completa los datos de conexión a tu base de datos y define tu clave JWT secreta:
   ```env
   DB_USER=tu_usuario_supabase
   DB_PASSWORD=tu_contraseña_supabase
   DB_HOST=tu_host_supabase
   DB_PORT=5432
   DB_NAME=postgres
   JWT_SECRET=tu_firma_jwt_personalizada
   PORT=3000
   ```
4. Ejecuta `npm install` en la carpeta `server/` para instalar las dependencias (`pg`, `express`, `jsonwebtoken`, `dotenv`, etc.).

### 3. Iniciar el Servidor
En Windows, puedes hacer doble clic en el archivo `iniciar_servidor.bat` en la raíz del proyecto para encender automáticamente el backend. De forma alternativa, ejecuta:
```bash
cd server
npm start
```

### 4. Lanzar la Aplicación
Dado que el frontend es Vanilla HTML/JS, puedes abrir directamente el archivo `index.html` en tu navegador favorito (o utilizar una extensión de servidor local como *Live Server* en VS Code).

---

## 🛡️ Seguridad y Buenas Prácticas
* **Variables de entorno ignoradas**: Los archivos `.env` están agregados al archivo `.gitignore` para evitar subir contraseñas o tokens sensibles a GitHub.
* **Consistencia del historial**: Al eliminar un integrante del equipo veterinario que tiene registros médicos asociados, el sistema realiza un *Soft Delete* (marcado como inactivo) para preservar la firma en el historial impreso de las vacunas pasadas.
