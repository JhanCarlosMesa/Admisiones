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
    keys.ts                    Claves de localStorage/sessionStorage
    store.ts                   Helpers genéricos de lectura/escritura
    seed.ts                    Datos de prueba (programas, pensum, cuentas demo)
  utils/
    crypto.ts                  Hash de contraseñas (SHA-256 + sal) y tokens
    validators.ts              Reglas de validación de formularios
    dom.ts                     Shell de la app, navegación, mensajes de formulario
  services/
    auth.service.ts            Registro, login, sesión, recuperación de contraseña
    admissions.service.ts      Solicitudes de admisión y su ciclo de vida
    catalog.service.ts         Programas, materias, periodos y ofertas
    enrollment.service.ts      Reglas de matrícula (créditos, horarios, cupos,
                               prerrequisitos) y lista de espera
    grades.service.ts          Calificaciones, promedio ponderado y avance al grado
    assignments.service.ts     Tareas con porcentaje de peso y notas por estudiante
    waitlist.service.ts        Lista de espera por oferta y posición del estudiante
    notifications.service.ts   Bandeja de notificaciones del ciclo de vida
    prerequisites.service.ts   Homologaciones de materias cursadas en otras instituciones
    credentials.service.ts     Credenciales verificables: folio, código y hash
    anchoring.service.ts       Anclaje de credenciales (transporte local o gateway)
    payloads.service.ts        Payloads de las credenciales, desde las funciones reales
    audit.service.ts           Bitácora de acciones de anclaje
  views/                       Una función de render por pantalla
    grading.view.ts            Staff: tareas y notas de una materia
    student-grades.view.ts     Estudiante: sus tareas, su nota y su desglose
    credentials.view.ts        Estudiante: sus credenciales y sus códigos
    issuance.view.ts           Staff: emisión y trazabilidad de credenciales
    verify.view.ts             Verificación pública, sin sesión
  router.ts                    Enrutamiento por hash con protección por rol
  main.ts                      Punto de entrada
  style.css                    Sistema visual (tipografía, color, componentes, animaciones)

gateway/                       Servicio institucional de firma y anclaje
                                (Node nativo, sin dependencias)

verify-nivel1.mjs              Comprobación headless de las reglas de negocio
                                (notas, tareas, prerrequisitos, lista de espera)
verify-anchors.mjs             Comprobación headless de las credenciales
verify-render.mjs              Comprobación headless del render de las vistas
```

## Novedades de esta versión

### Identidad visual renovada
- Rediseño completo del sistema visual: paleta institucional azul marino + dorado,
  tipografía serif (Fraunces) para títulos y sans-serif (Inter) para el resto,
  tarjetas con jerarquía real, sombras suaves y una sola animación de entrada por
  vista (además de transiciones de estado en botones, tarjetas y acordeones).
- Botones, formularios, tablas, insignias de estado y la portada pública fueron
  rediseñados para transmitir la seriedad de un sistema universitario real.
- Diseño responsivo y accesible: foco visible por teclado, contraste cuidado y
  soporte para `prefers-reduced-motion`.

### Elegir programa desde el registro, viendo el pensum
- El formulario de registro (`#register`) ahora incluye, como primer paso, una
  cuadrícula con todos los programas disponibles. Cada tarjeta permite **ver el
  pensum completo por semestre** (materias y créditos) antes de decidir, y
  seleccionar el programa al que se desea aspirar.
- Al crear la cuenta, el programa elegido se guarda temporalmente
  (`sessionStorage`) y se **prellena automáticamente** en el formulario de
  solicitud de admisión (`#enrollment`) la primera vez que el nuevo aspirante
  inicia sesión, sin impedir que lo cambie si lo desea.

### Pensum ampliado
- Se amplió el número de materias por programa (entre ~23 y ~31 materias según la
  carrera, distribuidas por semestre con sus créditos), tanto en la vista pública
  de programas como en el nuevo selector de registro.

### Cuentas y seguridad
- Registro de aspirantes con contraseña **hasheada** (SHA-256 + sal aleatoria por
  cuenta), ya no se guarda en texto plano.
- Inicio de sesión con expiración de sesión (8 horas).
- **Recuperación de contraseña real**: genera un token de un solo uso, válido por
  30 minutos, guardado aparte de las cuentas. Como el proyecto no tiene backend de
  correo, la pantalla de recuperación simula el envío mostrando en pantalla el
  enlace que normalmente llegaría al correo del usuario.

### Proceso de admisión
- Formulario de solicitud de inscripción con validación completa.
- Estados reales de trámite: `Radicada → En revisión → Admitido / Rechazado`.
- Vista de seguimiento para que el aspirante consulte el estado de su solicitud.
- **Panel de staff** (`#admin`, rol `Staff`) para marcar solicitudes en revisión y
  decidir si se admite o se rechaza. Al admitir a alguien, su cuenta se **promueve
  automáticamente** de `Aspirante` a `Estudiante`.

### Calificaciones y avance al grado
- Escala de notas **0.0 a 5.0**, con **aprobación desde 3.0**.
- El **Staff registra las notas** desde la vista de tareas y calificaciones
  (`#grading`): elige la materia, ve el roster y califica.
- Al registrar la nota el estudiante recibe una **notificación** y su promedio y
  su avance al grado se actualizan al instante.
- **Promedio ponderado por créditos**: una materia de 4 créditos pesa el doble que
  una de 2.
- **Panel de avance** en `#history`: porcentaje de créditos del pensum aprobados,
  créditos pendientes, promedio, materias obligatorias que faltan y las que se
  reprobaron (que deben repetirse).
- Los **requisitos de graduación** de `#gestion` muestran el avance real del
  estudiante, no solo la lista genérica de requisitos.

### Tareas con porcentaje y nota final ponderada
Cada materia tiene sus propias evaluaciones, y cada evaluación tiene un
**porcentaje de peso** sobre la nota final.

- El Staff crea tareas (título, descripción, fecha de entrega y %) desde
  `#grading`. El peso total de la materia se muestra en vivo y avisa si pasa de
  100% o si queda incompleto.
- La hoja de calificación es una **tabla con una columna por tarea** y una fila
  por estudiante: se escribe la nota (0–5) de cada tarea y el sistema recalcula
  la nota final del estudiante al instante.
- La **nota final es el promedio ponderado** de las tareas: si "Parcial 1" pesa
  30% y vale 4.0, aporta 1.2 a la nota final.
- La nota final **solo se oficializa cuando todas las tareas tienen nota**;
  mientras tanto se muestra como *provisional*. El Staff puede corregirla a mano
  en cualquier momento.
- **Alta y baja de estudiantes**: el Staff inscribe o retira alumnos del curso.
  La baja libera el cupo (y activa la lista de espera) y el alumno **pierde la
  materia**; si la nota es menor a 3.0, la **materia queda reprobada**, no suma
  créditos, bloquea los prerrequisitos que dependan de ella y debe repetirse.
- El estudiante ve todo esto en `#grades`: sus tareas con su porcentaje, su nota,
  cuánto aporta cada una a la final, y el resultado (aprobada/reprobada).

### Cohorte de prueba
El sistema se siembra con **100 estudiantes (10 por cada uno de los 10
programas)**, cada uno con semestre actual, historial aprobado en periodos
anteriores y tareas calificadas en el periodo vigente. Es una cohorte real:
hay alumnos con promedio alto, con materias reprobadas y con tareas pendientes,
y las métricas de Indicadores de gestión se calculan sobre ella.

### Prerrequisitos de matrícula
- Cada materia del pensum declara a qué materias antecede (por ejemplo
  `ISI-401 Ingeniería de Software` exige `ISI-301` y `ISI-304`).
- La matrícula se **bloquea** si falta aprobar un prerrequisito, y el mensaje
  indica exactamente cuáles faltan.
- Una **homologación externa aprobada** también cumple el prerrequisito: si te
  homologaron una materia de otra universidad, esa materia deja de bloquearte.
- No se puede volver a cursar una materia que ya aprobaste (sí puedes repetir una
  que reprobaste).

### Lista de espera
- Cuando una materia no tiene cupos, puedes **entrar a la lista de espera** en
  lugar de quedarte con un error seco.
- Ves tu **posición** en la fila, y la materia con su docente y horario.
- Si alguien libera el cupo (cancela la materia), el sistema **te asigna la
  materia automáticamente** y te llega la notificación.

### Notificaciones del ciclo de vida
Las notificaciones ya no son solo informativas: se generan en cada evento real.

| Evento | Quién recibe el aviso |
|--------|----------------------|
| R-radicar una solicitud | Staff |
| Marcar en revisión | Aspirante |
| Admitir o rechazar | Aspirante (y sube a Estudiante si es admitido) |
| Registrar una calificación | Estudiante |
| Aprobar/rechazar cambio de carrera | Estudiante |
| Declarar o resolver una homologación | Estudiante |
| Entrar a lista de espera | Estudiante |
| Liberarse un cupo | Estudiante |

Todas se ven en la **bandeja de notificaciones** (`#notifications`) y las más
recientes aparecen en el inicio. Se pueden marcar como leídas.

### Matrícula de materias (una vez el aspirante es admitido)
- Catálogo de materias del programa del estudiante, con créditos, horario, docente
  y cupos disponibles por materia.
- Matricular una materia valida en tiempo real:
  - Límite de créditos por periodo (18 créditos).
  - Choques de horario con materias ya matriculadas.
  - Cupos disponibles.
  - No duplicar la misma materia.
  - Prerrequisitos aprobados.
  - No repetir una materia ya aprobada.
- Vista de "mi matrícula actual" con opción de cancelar una materia.
- **Historial académico** con las materias cursadas por periodo, sus notas, el
  promedio de cada periodo y el avance al grado.

### Credenciales verificables (blockchain)
El portal emite documentos que cualquier persona puede comprobar, sin cuenta
y sin llamar a la universidad: **actas de grado, certificados de notas y
constancias de matrícula**.

- **El hash es real.** `utils/crypto.ts` calcula el SHA-256 del documento con
  serialización canónica (las claves se ordenan, para que el mismo documento
  produzca siempre el mismo hash). La cadena de interés es la de la
  institución, no una cadena pública.
- **Solo va el hash a la cadena.** El contenido real del documento (nombres,
  notas) se queda fuera; a la cadena solo llegan el hash, el folio, el código
  de verificación, el sello de tiempo y la firma institucional. Es lo que
  permite cumplir la Ley 1581 sin excepciones.
- **El Staff emite** desde `#issuance`: elige estudiante y tipo de documento,
  y el sistema arma el payload con las funciones reales del portal
  (`graduationProgress`, `listGradedCourses`, `getActiveEnrollments`).
- **El estudiante** ve sus credenciales en `#credentials`, con folio, código,
  QR y el enlace público de verificación.
- **La verificación pública** (`#verify?code=XXXX`) no requiere sesión.
- **La alteración se detecta**: si alguien cambia una nota de un periodo ya
  emitido, el hash deja de coincidir y la verificación responde `ALTERADO`,
  conservando el anclaje original como evidencia.
- **La revocación no borra**: escribe un anclaje nuevo que apunta al anterior,
  de modo que queda constancia de que hubo una revocación.
- **Bitácora de auditoría** de cada emisión: quién pidió, quién firmó, qué
  se ancló y por qué falló, si falló.

#### El gateway institucional
`gateway/` es el servicio que **custodia la llave de firma** y ancla en la red
— el navegador no puede hacerlo, porque si la llave viajara al cliente
cualquiera que abriera las herramientas de desarrollo podría firmar un
diploma. Está escrito solo con módulos nativos de Node, sin dependencias.

```bash
cd gateway
cp .env.example .env
npm run keys     # genera el par de llaves (la privada no se sube al repo)
npm run dev      # http://localhost:3080
```

El portal elige el transporte con una línea en
`src/services/anchoring.service.ts`:

```ts
const USE_GATEWAY = false;   // false = cadena local (Fase 0) · true = gateway
```

Con `false` el anclaje se registra en `localStorage` (Fase 0: el hashing y la
verificación son reales, solo el transporte se simula). Con `true` el portal
delega la firma en el gateway, que es quien tiene la llave real.

> ⚠️ `STAFF_TOKEN` es un **compromiso de proyecto de clase**: viaja en el
> bundle del navegador. En producción debe sustituirse por OAuth 2.0 con PKCE.

### Roles del sistema
| Rol         | Puede hacer |
|-------------|-------------|
| Aspirante   | Registrarse eligiendo programa, radicar su solicitud de admisión, ver su estado |
| Estudiante  | Matricular/cancelar materias, entrar a lista de espera, ver historial, notas y avance |
| Staff       | Revisar y decidir solicitudes, cambios de carrera, homologaciones y registrar calificaciones |

## Cuentas de prueba (creadas automáticamente la primera vez que se abre la app)

| Rol        | Correo                          | Contraseña      |
|------------|----------------------------------|-----------------|
| Aspirante  | jhanc.mesae@unac.edu.co          | Prueba12345     |
| Estudiante | valentina.rojas@unac.edu.co      | Estudiante123   |
| Estudiante | mateo.salazar@unac.edu.co        | Estudiante123   |
| Staff      | admisiones@unac.edu.co           | Admisiones2026  |

Todos los estudiantes de la cohorte (100 en total) usan la contraseña
`Estudiante123`. Sus correos siguen el patrón
`nombre.apellido.<programa>@unac.edu.co` (por ejemplo
`sofia.cardona.psi@unac.edu.co`).

La cuenta *Estudiante* (Valentina) es la de demo: tiene una admisión aprobada en
Ingeniería de Sistemas, **dos semestres de historial con notas** (6 aprobadas y 1
reprobada), y tareas con nota en el periodo vigente — para que puedas ver de
inmediato el promedio, el avance al grado, el desglose de notas y el bloqueo por
prerrequisitos. La segunda cuenta *Estudiante* (Mateo) ocupa el único cupo de
`ISI-303`: úsalo para probar la lista de espera (entra en espera, y si Mateo
cancela la materia, a Valentina se le asigna automáticamente).

## Cómo correr el proyecto

```bash
npm install
npm run dev       # servidor de desarrollo
npm run build     # build de producción (valida tipos con tsc y compila con Vite)
npm run preview   # sirve el build de producción localmente
```

Para comprobar las reglas de negocio sin abrir el navegador:

```bash
# Reglas de negocio: notas, tareas, prerrequisitos, lista de espera
npx esbuild verify-nivel1.mjs --bundle --platform=node --format=esm --outfile=verify-tmp.mjs
node verify-tmp.mjs

# Credenciales verificables: hashing, emisión, alteración y revocación
npx esbuild verify-anchors.mjs --bundle --platform=node --format=esm --outfile=verify-anchors-tmp.mjs
node verify-anchors-tmp.mjs

# Render de todas las vistas
npx esbuild verify-render.mjs --bundle --platform=node --format=esm --outfile=verify-render-tmp.mjs
node verify-render-tmp.mjs

# Gateway institucional de punta a punta (levanta el servicio y lo prueba)
node verify-gateway.mjs
```

> Nota: si ya habías corrido una versión anterior de este proyecto en el mismo
> navegador, borra los datos del sitio (o usa una ventana de incógnito) para que
> se vuelva a sembrar el catálogo ampliado de programas y materias. La versión de
> esquema de los datos sembrados es `6`; al cambiarla se re-siembran los datos
> generados (programas, materias, ofertas, periodos, matrículas y notificaciones)
> pero se conservan las cuentas y solicitudes creadas por el usuario.

## Limitaciones a tener en cuenta (por ser un proyecto sin backend)

- Todos los datos viven en el navegador (`localStorage`). Borrar datos del sitio
  reinicia todo el sistema (se vuelve a sembrar en la próxima carga).
- No hay envío real de correos: la recuperación de contraseña se simula mostrando
  el enlace en pantalla.
- No hay carga de documentos ni pasarela de pagos de matrícula; son los siguientes
  candidatos naturales si se quiere seguir profesionalizando el sistema.
- Las calificaciones las registra el rol `Staff` desde el panel: no hay un rol
  `Docente` separado, porque el modelo de roles sigue siendo de tres.

## Posibles siguientes pasos

- Conectar un backend real (autenticación, base de datos) reemplazando las
  funciones de `src/services/*` y `src/data/*`, sin tocar las vistas.
- Envío de correos reales para recuperación de contraseña y notificaciones de
  admisión.
- Carga de documentos de soporte en la solicitud de admisión.
- Módulo de pagos/liquidación de matrícula.
- Un rol `Docente` que registre las notas de sus propias materias, en lugar de que
  lo haga `Staff`.
