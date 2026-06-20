# Importacion Excel/CSV

## Objetivo

La carga masiva permite crear pacientes desde un archivo CSV con vista previa, validacion y confirmacion manual antes de guardar en la base de datos.

Esta primera version soporta **CSV**. Para usar Excel, exporta la hoja como `.csv` antes de cargarla.

## Flujo de uso

1. Entrar a **Registro de mascota > Importar pacientes**.
2. Descargar la plantilla CSV oficial.
3. Completar la plantilla con datos ficticios o datos de la clinica.
4. Seleccionar el archivo CSV.
5. Presionar **Validar archivo**.
6. Revisar filas validas, advertencias y errores.
7. Presionar **Confirmar importacion**.
8. Revisar el resumen final y verificar los pacientes en **Pacientes**.

Nada se guarda antes de la confirmacion.

## Campos requeridos

| Campo | Descripcion |
| --- | --- |
| `tutor_nombre` | Nombre del tutor o responsable. |
| `mascota_nombre` | Nombre de la mascota/paciente. |
| `especie` | `C`, `F`, `Canino` o `Felino`. |
| `fecha_nacimiento` | Requerida por el esquema actual de base de datos. |

## Campos opcionales de tutor

| Campo | Descripcion |
| --- | --- |
| `tutor_telefono` | Telefono de contacto. |
| `tutor_email` | Correo del tutor. Se valida formato si viene informado. |
| `tutor_direccion` | Direccion del tutor. |

## Campos opcionales de mascota

| Campo | Descripcion |
| --- | --- |
| `raza` | Texto libre. |
| `sexo` | `M`, `H`, `Macho` o `Hembra`. |
| `color` | Color o pelaje. |
| `peso` | Numero positivo en kilogramos. |
| `esterilizado` | `S`, `N`, `Si`, `No`, `Si` o `No`. En esta version se conserva en observaciones. |
| `observaciones` | Notas generales del paciente. |

## Registros preventivos opcionales

### Vacuna

| Campo | Descripcion |
| --- | --- |
| `vacuna_codigo` | Codigo o referencia de banco, si existe. |
| `vacuna_nombre` | Nombre de la vacuna. |
| `vacuna_fecha` | Fecha de aplicacion. |
| `vacuna_proxima_fecha` | Proxima dosis. |
| `vacuna_lote` | Lote. |
| `vacuna_responsable` | Responsable clinico. |
| `vacuna_observaciones` | Observaciones. |

Si se incluye una vacuna, debe existir `vacuna_nombre` o `vacuna_codigo`, y `vacuna_fecha`.

### Desparasitante interno

| Campo | Descripcion |
| --- | --- |
| `desparasitante_interno_codigo` | Codigo o referencia. |
| `desparasitante_interno_nombre` | Producto. |
| `desparasitante_interno_fecha` | Fecha de aplicacion. |
| `desparasitante_interno_proxima_fecha` | Proxima aplicacion. |
| `desparasitante_interno_lote` | Lote. |
| `desparasitante_interno_responsable` | Responsable clinico. |
| `desparasitante_interno_observaciones` | Observaciones. |

### Desparasitante externo

| Campo | Descripcion |
| --- | --- |
| `desparasitante_externo_codigo` | Codigo o referencia. |
| `desparasitante_externo_nombre` | Producto. |
| `desparasitante_externo_fecha` | Fecha de aplicacion. |
| `desparasitante_externo_proxima_fecha` | Proxima aplicacion. |
| `desparasitante_externo_lote` | Lote. |
| `desparasitante_externo_responsable` | Responsable clinico. |
| `desparasitante_externo_observaciones` | Observaciones. |

### Control preventivo

| Campo | Descripcion |
| --- | --- |
| `control_preventivo_nombre` | Motivo o procedimiento. |
| `control_preventivo_fecha` | Fecha del control. |
| `control_preventivo_proxima_fecha` | Proximo control. |
| `control_preventivo_responsable` | Responsable clinico. |
| `control_preventivo_observaciones` | Recomendaciones u observaciones. |

## Formato de fechas

Formatos aceptados:

- `dd/mm/aaaa`, por ejemplo `20/06/2026`.
- `yyyy-mm-dd`, por ejemplo `2026-06-20`.

Las fechas imposibles se rechazan.

## Codigos permitidos

| Campo | Codigos |
| --- | --- |
| `especie` | `C`, `F`, `Canino`, `Felino`. |
| `sexo` | `M`, `H`, `Macho`, `Hembra`. |
| `esterilizado` | `S`, `N`, `Si`, `No`, `Si`, `No`. |

## Seguridad multiclinca

El archivo no puede definir `veterinaria_id`. El backend usa siempre la clinica autenticada por JWT para crear pacientes y registros preventivos.

## Errores comunes

- CSV sin encabezados oficiales.
- Fechas en formato no soportado.
- `tutor_email` con formato invalido.
- Filas sin tutor o sin mascota.
- Especie diferente de Canino/Felino.
- Registros preventivos sin fecha.
- Posibles duplicados por tutor + mascota + especie.

## Pendientes

- Soporte nativo `.xlsx`.
- Mapeo avanzado contra codigos reales del banco clinico.
- Importacion de varias vacunas o varios controles por paciente en una misma fila.
- Historial de lotes de importacion.
