# Informe Fase 0 - Estabilizacion tecnica y seguridad

## Archivos revisados

- `.gitignore`
- `package.json`
- `package-lock.json`
- `server/.env.template`
- `server/.env` (solo existencia local; no se imprimio su contenido)
- `server/db.js`
- `server/schema.sql`
- `server/migrate.js`
- `server/authMiddleware.js`
- `server/adminRoutes.js`
- `server/index.js`
- `server/supabaseClient.js`
- `server/test-*.js`
- `supabase/admin_center_schema.sql`
- `supabase/phase2_control_avanzado.sql`
- `README.md`
- `tests/check_html.js`
- `tests/test_storage.js`
- `tests/test_flow.js`

## Archivos modificados

- `.gitignore`
- `package.json`
- `package-lock.json`
- `server/.env.template`
- `server/.env.example`
- `server/test-db.js`
- `server/test-db-url.js`
- `server/test-db-regions.js`
- `server/test-db-regions-6543.js`
- `server/test-pooler-all.js`
- `docs/MIGRACIONES.md`
- `tests/check_html.js`
- `tests/test_storage.js`
- `tests/test_flow.js`

## Problemas encontrados

- `server/.env` existe en el entorno local. No se borro porque contiene configuracion del usuario.
- `.gitignore` no ignoraba `server/node_modules/`, `.codex-run/`, `*.log` ni variantes `.env.*.local`.
- `server/.env.template` mencionaba `DATABASE_URL`, pero `server/db.js` usa variables separadas `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` y `DB_SSL`.
- `npm run check` dependia de scripts en `scratch/`, carpeta ignorada por Git.
- Algunos scripts `server/test-*` tenian datos concretos de diagnostico embebidos.
- La estrategia de migraciones estaba repartida entre `server/schema.sql`, `server/db.js`, `server/migrate.js` y `supabase/*.sql`.
- `README.md` se veia roto en PowerShell, pero la lectura UTF-8 con Node confirmo que el archivo no contiene mojibake real.
- `.codex-run/*.log` ya aparece trackeado por Git. Se agrego a `.gitignore`, pero para retirarlo del repositorio hace falta un `git rm --cached .codex-run/*.log` en una tarea de limpieza de versionado.

## Problemas corregidos

- Se reforzo `.gitignore` para dependencias, logs, artefactos locales y variantes de `.env`.
- Se creo `server/.env.example` con placeholders seguros.
- Se actualizo `server/.env.template` para alinearlo con `server/db.js`.
- Se movio el check versionable a `tests/`.
- Se actualizo `package.json` para que `npm run check` use `tests/` en vez de `scratch/`.
- `jsdom` quedo como `devDependencies`; `npm install` actualizo `package-lock.json`.
- Se sanearon scripts de diagnostico para no incluir password, project ref ni connection string reales.
- Se creo `docs/MIGRACIONES.md` y se fijo `server/schema.sql` como fuente de verdad actual para bases nuevas.

## Pendientes tecnicos

- Retirar `.codex-run/*.log` del indice Git antes de publicar el repositorio.
- Consolidar migraciones en archivos versionados numerados.
- Decidir si `server/db.js` debe seguir haciendo migracion automatica al inicio o pasar a un runner formal.
- Revisar RLS/politicas de Supabase si en una fase futura se consulta Supabase directo desde frontend.
- Revisar CORS y URL publica del API antes de produccion.
- Mantener `server/.env` solo local y nunca compartirlo en ZIP o GitHub.

## Comandos ejecutados

```bash
git status --short
git ls-files
git ls-files server/.env .env node_modules server/node_modules scratch
npm.cmd install
npm.cmd run check
```

Tambien se intento un smoke de arranque con `npm start` usando un job de PowerShell. El endpoint `http://localhost:5500/api/health` respondio `200` con `database: ok`, pero el comando de job agoto timeout antes de cerrar limpiamente la tarea. No se cerro ningun proceso Node ajeno porque ya existian procesos previos en la maquina y no se pudo leer command line por permisos.

## Resultado de npm run check

`npm.cmd run check` paso correctamente.

Resultados relevantes:

- Sintaxis JS principal: OK.
- Balance basico de HTML: OK.
- Storage smoke: OK.
- UI flow smoke: OK.

## Recomendacion para migraciones

Usar `server/schema.sql` como fuente de verdad para bases nuevas. Mantener `server/db.js`, `server/migrate.js` y `supabase/*.sql` como soporte historico/parcial hasta que se cree un sistema de migraciones versionadas.
