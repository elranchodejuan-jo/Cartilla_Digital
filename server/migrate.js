const db = require('./db');

async function migrate() {
    console.log("Iniciando migración de la base de datos...");
    
    try {
        // 1. Tabla equipo_veterinario
        await db.query(`
            CREATE TABLE IF NOT EXISTS equipo_veterinario (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                veterinaria_id UUID NOT NULL REFERENCES veterinarias(id) ON DELETE CASCADE,
                nombre VARCHAR(150) NOT NULL,
                cargo VARCHAR(100) NOT NULL,
                estado VARCHAR(20) DEFAULT 'activo',
                es_principal BOOLEAN DEFAULT false,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla equipo_veterinario creada o ya existía.");

        // 2. Modificar vacunas
        try {
            await db.query(`ALTER TABLE vacunas ADD COLUMN responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL;`);
            console.log("Columna responsable_id agregada a vacunas.");
        } catch(e) {
            console.log("Nota: columna responsable_id ya existe en vacunas o error:", e.message);
        }

        // 3. Modificar desparasitaciones
        try {
            await db.query(`ALTER TABLE desparasitaciones ADD COLUMN responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL;`);
            console.log("Columna responsable_id agregada a desparasitaciones.");
        } catch(e) {
            console.log("Nota: columna responsable_id ya existe en desparasitaciones o error:", e.message);
        }

        // 4. Modificar controles
        try {
            await db.query(`ALTER TABLE controles ADD COLUMN responsable VARCHAR(150);`);
            console.log("Columna responsable agregada a controles.");
        } catch(e) {
            console.log("Nota: columna responsable ya existe en controles o error:", e.message);
        }
        
        try {
            await db.query(`ALTER TABLE controles ADD COLUMN responsable_id UUID REFERENCES equipo_veterinario(id) ON DELETE SET NULL;`);
            console.log("Columna responsable_id agregada a controles.");
        } catch(e) {
            console.log("Nota: columna responsable_id ya existe en controles o error:", e.message);
        }

        console.log("Migración completada exitosamente.");
    } catch (err) {
        console.error("Error crítico durante la migración:", err);
    } finally {
        process.exit();
    }
}

migrate();
