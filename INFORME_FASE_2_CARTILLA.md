# Informe Fase 2 - Cartilla clinica, tutor, QR e impresion/PDF

## Archivos revisados

- `README.md`
- `INFORME_FASE_0_ESTABILIZACION.md`
- `INFORME_FASE_1_RESPONSIVE.md`
- `index.html`
- `js/ui.js`
- `js/app.js`
- `js/storage.js`
- `js/api.js`
- `js/vacunas.js`
- `js/desparasitaciones.js`
- `js/controles.js`
- `css/styles.css`
- `server/index.js`

## Archivos modificados

- `index.html`
- `js/ui.js`
- `css/styles.css`
- `server/index.js`

## Cambios aplicados en cartilla clinica

- Se agrego visualizacion de fecha de nacimiento y esterilizado en la ficha del paciente.
- Se centralizo una capa de render para datos de clinica, mascota y tutor.
- Se mantiene la especie visible como `Canino` o `Felino`.
- Se mejoro la presentacion de datos largos con `overflow-wrap`.
- Se reforzaron cortes de pagina para registros preventivos, tarjetas y timeline.
- Se mantiene el historial preventivo existente:
  - vacunas,
  - desparasitaciones internas,
  - controles antiparasitarios externos,
  - controles preventivos.

## Cambios aplicados en vista publica

- La vista publica conserva acceso sin login mediante `?id=<mascotaId>`.
- Se mantiene ocultamiento de controles internos con `body.public-view .no-public`.
- Los botones de agregar, editar, eliminar y cambiar estado quedan ocultos en vista publica e impresion.
- Se permitieron acciones seguras para tutor:
  - copiar enlace,
  - compartir por WhatsApp,
  - imprimir/guardar PDF desde navegador.
- `compartirWhatsApp()` ya no depende del listado privado cuando la cartilla se abre por QR.
- El endpoint publico entrega datos de contacto de la clinica: telefono, correo, direccion, propietario/responsable y logo.
- No se exponen `veterinaria_id` ni IDs internos de otras clinicas.

## Cambios aplicados al QR

- Se aumento el QR de pantalla y de impresion.
- Se reforzo que el QR sea cuadrado y sin bordes redondeados.
- Se corrigieron estilos finales usando el ID real `#qrcode`.
- Se mantiene generacion por `qrcodejs` CDN.
- Se conserva fallback canvas local visual si falla la libreria externa.
- El QR apunta a la URL publica generada por `construirUrlCartillaPublica(mascota.id)`.

## Cambios aplicados a impresion/PDF

- Se reforzo `@media print` para ocultar:
  - sidebar,
  - header,
  - footer,
  - modales,
  - toasts,
  - filtros,
  - botones,
  - panel de importacion.
- Se mantiene visible la cartilla.
- Se eliminan sombras fuertes en papel.
- Se fuerza fondo blanco y contraste.
- Se mejoran saltos de pagina con `break-inside: avoid`.
- Se mantiene QR con tamano aproximado de 138-150 px.
- El titulo del documento al imprimir queda como:

```text
Cartilla Digital – Paciente – NOMBRE_MASCOTA
```

El PDF sigue dependiendo del dialogo nativo del navegador con `window.print()`.

## Estado de botones

| Boton | Vista clinica | Vista publica | Estado |
| --- | --- | --- | --- |
| Volver a pacientes | Visible | Oculto | Correcto |
| Transferencia | Visible | Oculto | Correcto |
| Copiar enlace | Visible | Visible | Funcional |
| WhatsApp | Visible | Visible | Funcional |
| Imprimir/guardar PDF | Visible | Visible | Funcional por navegador |
| Agregar/editar/eliminar registros | Visible | Oculto | Correcto |

## Estados preventivos

- Se mantiene soporte visual para:
  - Proximo,
  - Vencido,
  - Asistio,
  - No asistio,
  - Reagendado.
- Se corrigio la evaluacion de controles preventivos para que `asistio` tambien pase por la funcion que evita mostrarlos como vencidos.
- Vacunas y desparasitaciones ya usaban esa ruta visual.

## Pendientes detectados

- El fallback canvas del QR es visual, no reemplaza completamente una libreria QR real si la CDN falla.
- No existe campo dedicado `esterilizado` en la base de datos; si llega por importacion, se conserva en observaciones y se muestra desde ahi.
- Ciudad/pais no existen como campos separados; se muestra direccion y datos de contacto disponibles.
- Falta QA visual real en navegador/dispositivo movil.
- No se implemento triptico, por regla de fase.

## Riesgos o recomendaciones

- Antes de produccion conviene servir una copia local de la libreria QR o generar QR en backend para no depender solo del CDN.
- Si `esterilizado` sera un dato clinico formal, conviene agregarlo como columna en una migracion posterior.
- Hacer prueba de impresion en Chrome/Edge con escala 100% y A4.
