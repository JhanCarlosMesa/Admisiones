# Admisiones UNAC

Portal de admisiones y matrícula de la Universidad Adventista de Colombia (UNAC).
Aplicación 100% front-end (Vite + TypeScript), sin backend: los datos se guardan en
`localStorage`/`sessionStorage` del navegador, pero está organizada con una
arquitectura real de capas (tipos, datos, servicios, vistas, enrutador) para que sea
fácil conectar un backend real más adelante.

## Estructura del proyecto

```
src/
  types.ts                     Modelos de datos (Account, AdmissionApplication, Course, ...)
  data/
    keys.ts                    Claves de localStorage
    store.ts                   Helpers genéricos de lectura/escritura
    seed.ts                    Datos de prueba (programas, materias, cuentas demo)
  utils/
    crypto.ts                  Hash de contraseñas (SHA-256 + sal) y tokens
    validators.ts              Reglas de validación de formularios
    dom.ts                     Shell de la app, navegación, mensajes de formulario
  services/
    auth.service.ts            Registro, login, sesión, recuperación de contraseña
    admissions.service.ts      Solicitudes de admisión y su ciclo de vida
    catalog.service.ts         Programas, materias, periodos y ofertas
    enrollment.service.ts      Reglas de matrícula (créditos, horarios, cupos)
  views/                       Una función de render por pantalla
  router.ts                    Enrutamiento por hash con protección por rol
  main.ts                      Punto de entrada
```

## Funciones implementadas

### Cuentas y seguridad
- Registro de aspirantes con contraseña **hasheada** (SHA-256 + sal aleatoria por
  cuenta), ya no se guarda en texto plano.
- Inicio de sesión con expiración de sesión (8 horas).
- **Recuperación de contraseña real**: genera un token de un solo uso, válido por
  30 minutos, guardado aparte de las cuentas. Como el proyecto no tiene backend de
  correo, la pantalla de recuperación simula el envío mostrando en pantalla el
  enlace que normalmente llegaría al correo del usuario. Para conectar un envío de
  correo real, solo hay que reemplazar esa simulación en
  `src/views/recovery.view.ts` por una llamada a tu servicio de correo, usando el
  mismo token generado por `requestPasswordRecovery`.

### Proceso de admisión
- Formulario de solicitud de inscripción con validación completa.
- Estados reales de trámite: `Radicada → En revisión → Admitido / Rechazado`.
- Vista de seguimiento para que el aspirante consulte el estado de su solicitud.
- **Panel de staff** (`#admin`, rol `Staff`) para marcar solicitudes en revisión y
  decidir si se admite o se rechaza. Al admitir a alguien, su cuenta se **promueve
  automáticamente** de `Aspirante` a `Estudiante`.

### Matrícula de materias (una vez el aspirante es admitido)
- Catálogo de materias del programa del estudiante, con créditos, horario, docente
  y cupos disponibles por materia.
- Matricular una materia valida en tiempo real:
  - Límite de créditos por periodo (18 créditos).
  - Choques de horario con materias ya matriculadas.
  - Cupos disponibles.
  - No duplicar la misma materia.
- Vista de "mi matrícula actual" con opción de cancelar una materia.
- **Historial académico** con las materias cursadas por periodo.

### Roles del sistema
| Rol         | Puede hacer |
|-------------|-------------|
| Aspirante   | Registrarse, radicar su solicitud de admisión, ver su estado |
| Estudiante  | Matricular/cancelar materias, ver su historial académico |
| Staff       | Revisar y decidir solicitudes de admisión |

## Cuentas de prueba (creadas automáticamente la primera vez que se abre la app)

| Rol        | Correo                          | Contraseña      |
|------------|----------------------------------|-----------------|
| Aspirante  | jhanc.mesae@unac.edu.co          | Prueba12345     |
| Estudiante | valentina.rojas@unac.edu.co      | Estudiante123   |
| Staff      | admisiones@unac.edu.co           | Admisiones2026  |

La cuenta *Estudiante* ya tiene una admisión aprobada en Ingeniería de Sistemas y
una materia cursada en un periodo anterior, para que puedas probar matrícula e
historial de inmediato.

## Cómo correr el proyecto

```bash
npm install
npm run dev       # servidor de desarrollo
npm run build     # build de producción (valida tipos con tsc y compila con Vite)
npm run preview   # sirve el build de producción localmente
```

## Limitaciones a tener en cuenta (por ser un proyecto sin backend)

- Todos los datos viven en el navegador (`localStorage`). Borrar datos del sitio
  reinicia todo el sistema (se vuelve a sembrar en la próxima carga).
- No hay envío real de correos: la recuperación de contraseña se simula mostrando
  el enlace en pantalla.
- No hay carga de documentos ni pasarela de pagos de matrícula; son los siguientes
  candidatos naturales si se quiere seguir profesionalizando el sistema.

## Posibles siguientes pasos

- Conectar un backend real (autenticación, base de datos) reemplazando las
  funciones de `src/services/*` y `src/data/*`, sin tocar las vistas.
- Envío de correos reales para recuperación de contraseña y notificaciones de
  admisión.
- Carga de documentos de soporte en la solicitud de admisión.
- Módulo de pagos/liquidación de matrícula.
- Calificaciones y promedio académico en el historial.
