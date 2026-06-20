# Migraciones y esquema de base de datos

Este proyecto usa PostgreSQL en Supabase. La base ya crecio por fases y hoy hay SQL repartido entre varios archivos; este documento fija la estrategia actual sin borrar historial.

## Fuente de verdad actual

Para una base nueva, usar primero:

```text
server/schema.sql
```

Es el archivo mas completo: incluye clinicas, pacientes, razas por clinica, equipo veterinario, historial preventivo, transferencias, soporte, actividad, pagos manuales, alertas y bancos clinicos.

## Migraciones parciales o historicas

```text
server/db.js
```

Contiene una migracion automatica defensiva al iniciar el backend. Su objetivo es mantener columnas/tablas recientes en entornos existentes. No debe considerarse el unico origen del esquema.

```text
server/migrate.js
```

Script historico/parcial. Cubre propietario, equipo veterinario y responsables en historial clinico, pero no incluye todo el esquema actual.

```text
supabase/admin_center_schema.sql
supabase/phase2_control_avanzado.sql
```

SQL de fases especificas para Admin Center, soporte avanzado, pagos manuales y alertas. Son utiles como referencia incremental, pero su contenido ya esta incorporado en `server/schema.sql` y en parte en `server/db.js`.

## Recomendacion operativa actual

1. Para una base limpia, ejecutar `server/schema.sql` desde el editor SQL de Supabase.
2. Configurar `server/.env` con las variables `DB_*`.
3. Iniciar el backend y revisar `/api/health`.
4. Usar `server/migrate.js` solo si se trabaja con una base antigua y se entiende que es parcial.

## Pendiente para la siguiente fase

- Convertir los cambios a migraciones versionadas numeradas.
- Separar `schema inicial` de `migraciones incrementales`.
- Evitar duplicacion entre `server/schema.sql`, `server/db.js` y `supabase/*.sql`.
- Definir si la migracion automatica de `server/db.js` se mantiene, se limita a checks seguros o se reemplaza por un runner formal.
- Documentar procedimiento de backup antes de migraciones productivas.
