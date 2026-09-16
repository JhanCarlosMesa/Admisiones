import type { Account, AdmissionApplication, Course, CourseOffering, Enrollment, Period, Program } from "../types";
import { generateId, readList, writeList } from "./store";
import { STORAGE_KEYS } from "./keys";
import { hashPassword, randomSalt } from "../utils/crypto";

interface ProgramSeed {
  id: string;
  name: string;
  level: string;
  duration: string;
  modality: string;
  description: string;
  colorClass: string;
  courses: Array<{ name: string; credits: number; semester: number }>;
}

const PROGRAM_SEEDS: ProgramSeed[] = [
  {
    id: "prog-admin",
    name: "Administración de Empresas",
    level: "Pregrado",
    duration: "8 semestres",
    modality: "Presencial",
    description: "Desarrolla tu visión para liderar organizaciones con ética e innovación.",
    colorClass: "program-coral",
    courses: [
      { name: "Fundamentos de Administración", credits: 3, semester: 1 },
      { name: "Contabilidad General", credits: 4, semester: 1 },
      { name: "Microeconomía", credits: 3, semester: 2 },
      { name: "Matemáticas para los Negocios", credits: 3, semester: 2 },
      { name: "Gestión del Talento Humano", credits: 3, semester: 3 },
      { name: "Estadística Empresarial", credits: 3, semester: 3 },
      { name: "Mercadeo Estratégico", credits: 3, semester: 4 },
      { name: "Gestión Financiera", credits: 3, semester: 4 },
      { name: "Investigación de Mercados", credits: 3, semester: 5 },
      { name: "Derecho Empresarial", credits: 3, semester: 5 },
      { name: "Gerencia Estratégica", credits: 3, semester: 6 },
      { name: "Emprendimiento e Innovación", credits: 3, semester: 6 },
      { name: "Práctica Empresarial", credits: 4, semester: 7 },
      { name: "Seminario de Investigación", credits: 3, semester: 7 },
      { name: "Trabajo de Grado", credits: 6, semester: 8 },
    ],
  },
  {
    id: "prog-sistemas",
    name: "Ingeniería de Sistemas",
    level: "Pregrado",
    duration: "10 semestres",
    modality: "Presencial",
    description: "Convierte ideas en soluciones tecnológicas que impactan el mundo.",
    colorClass: "program-teal",
    courses: [
      { name: "Algoritmos y Programación", credits: 4, semester: 1 },
      { name: "Matemáticas Discretas", credits: 3, semester: 1 },
      { name: "Estructuras de Datos", credits: 4, semester: 2 },
      { name: "Cálculo Diferencial", credits: 4, semester: 2 },
      { name: "Bases de Datos", credits: 3, semester: 3 },
      { name: "Sistemas Operativos", credits: 3, semester: 3 },
      { name: "Ingeniería de Software", credits: 3, semester: 4 },
      { name: "Redes de Computadores", credits: 3, semester: 4 },
      { name: "Arquitectura de Computadores", credits: 3, semester: 5 },
      { name: "Desarrollo Web", credits: 3, semester: 5 },
      { name: "Seguridad Informática", credits: 3, semester: 6 },
      { name: "Inteligencia Artificial", credits: 3, semester: 6 },
      { name: "Gestión de Proyectos TI", credits: 3, semester: 7 },
      { name: "Electiva Profesional I", credits: 3, semester: 7 },
      { name: "Práctica Profesional", credits: 4, semester: 8 },
      { name: "Electiva Profesional II", credits: 3, semester: 8 },
      { name: "Proyecto Integrador", credits: 5, semester: 9 },
      { name: "Trabajo de Grado", credits: 6, semester: 10 },
    ],
  },
  {
    id: "prog-contaduria",
    name: "Contaduría Pública",
    level: "Pregrado",
    duration: "9 semestres",
    modality: "Presencial",
    description: "Domina la información financiera para tomar decisiones responsables.",
    colorClass: "program-gold",
    courses: [
      { name: "Contabilidad Financiera", credits: 4, semester: 1 },
      { name: "Costos I", credits: 3, semester: 2 },
      { name: "Matemáticas Financieras", credits: 3, semester: 2 },
      { name: "Legislación Tributaria", credits: 3, semester: 3 },
      { name: "Presupuestos", credits: 3, semester: 3 },
      { name: "Auditoría I", credits: 3, semester: 4 },
      { name: "Contabilidad de Sociedades", credits: 3, semester: 4 },
      { name: "Impuestos Nacionales", credits: 3, semester: 5 },
      { name: "Auditoría II", credits: 3, semester: 5 },
      { name: "Contabilidad Pública", credits: 3, semester: 6 },
      { name: "Revisoría Fiscal", credits: 3, semester: 6 },
      { name: "Ética Profesional", credits: 2, semester: 7 },
      { name: "Práctica Contable", credits: 4, semester: 7 },
      { name: "Trabajo de Grado", credits: 6, semester: 8 },
      { name: "Seminario Tributario", credits: 3, semester: 9 },
    ],
  },
  {
    id: "prog-educacion",
    name: "Licenciatura en Educación",
    level: "Pregrado",
    duration: "8 semestres",
    modality: "Presencial",
    description: "Forma experiencias de aprendizaje que dejan huella.",
    colorClass: "program-blue",
    courses: [
      { name: "Pedagogía General", credits: 3, semester: 1 },
      { name: "Psicología del Aprendizaje", credits: 3, semester: 1 },
      { name: "Currículo y Evaluación", credits: 3, semester: 2 },
      { name: "Didáctica General", credits: 3, semester: 3 },
      { name: "Desarrollo Humano", credits: 3, semester: 3 },
      { name: "Tecnologías Educativas", credits: 3, semester: 4 },
      { name: "Educación Inclusiva", credits: 3, semester: 4 },
      { name: "Investigación Educativa", credits: 3, semester: 5 },
      { name: "Evaluación del Aprendizaje", credits: 3, semester: 5 },
      { name: "Práctica Pedagógica I", credits: 4, semester: 6 },
      { name: "Gestión Escolar", credits: 3, semester: 6 },
      { name: "Práctica Pedagógica II", credits: 5, semester: 7 },
      { name: "Seminario de Grado", credits: 3, semester: 7 },
      { name: "Trabajo de Grado", credits: 6, semester: 8 },
    ],
  },
  {
    id: "prog-psicologia",
    name: "Psicología",
    level: "Pregrado",
    duration: "10 semestres",
    modality: "Presencial",
    description: "Comprende el comportamiento humano para acompañar vidas y comunidades.",
    colorClass: "program-coral",
    courses: [
      { name: "Introducción a la Psicología", credits: 3, semester: 1 },
      { name: "Bases Biológicas de la Conducta", credits: 3, semester: 1 },
      { name: "Psicología del Desarrollo I", credits: 3, semester: 2 },
      { name: "Procesos Psicológicos", credits: 3, semester: 2 },
      { name: "Psicología del Desarrollo II", credits: 3, semester: 3 },
      { name: "Psicología Social", credits: 3, semester: 3 },
      { name: "Evaluación Psicológica I", credits: 3, semester: 4 },
      { name: "Psicología de la Personalidad", credits: 3, semester: 4 },
      { name: "Psicopatología", credits: 3, semester: 5 },
      { name: "Evaluación Psicológica II", credits: 3, semester: 5 },
      { name: "Psicología Clínica", credits: 3, semester: 6 },
      { name: "Intervención Comunitaria", credits: 3, semester: 6 },
      { name: "Psicología Organizacional", credits: 3, semester: 7 },
      { name: "Seminario de Investigación", credits: 3, semester: 7 },
      { name: "Práctica Profesional I", credits: 5, semester: 8 },
      { name: "Neuropsicología", credits: 3, semester: 8 },
      { name: "Práctica Profesional II", credits: 6, semester: 9 },
      { name: "Trabajo de Grado", credits: 6, semester: 10 },
    ],
  },
  {
    id: "prog-enfermeria",
    name: "Enfermería",
    level: "Pregrado",
    duration: "8 semestres",
    modality: "Presencial",
    description: "Cuida la vida con ciencia, sensibilidad y compromiso con el servicio.",
    colorClass: "program-teal",
    courses: [
      { name: "Fundamentos de Enfermería", credits: 4, semester: 1 },
      { name: "Anatomía y Fisiología I", credits: 4, semester: 1 },
      { name: "Anatomía y Fisiología II", credits: 4, semester: 2 },
      { name: "Bioquímica", credits: 3, semester: 2 },
      { name: "Enfermería del Adulto I", credits: 5, semester: 3 },
      { name: "Farmacología", credits: 3, semester: 3 },
      { name: "Enfermería del Adulto II", credits: 5, semester: 4 },
      { name: "Salud Mental", credits: 3, semester: 4 },
      { name: "Enfermería Materno Infantil", credits: 5, semester: 5 },
      { name: "Salud Pública", credits: 3, semester: 5 },
      { name: "Enfermería Pediátrica", credits: 5, semester: 6 },
      { name: "Epidemiología", credits: 3, semester: 6 },
      { name: "Cuidado Crítico", credits: 5, semester: 7 },
      { name: "Gestión de Servicios de Salud", credits: 3, semester: 7 },
      { name: "Práctica Clínica Integral", credits: 8, semester: 8 },
    ],
  },
  {
    id: "prog-comunicacion",
    name: "Comunicación Social",
    level: "Pregrado",
    duration: "8 semestres",
    modality: "Presencial",
    description: "Cuenta historias que conectan personas, culturas y realidades.",
    colorClass: "program-blue",
    courses: [
      { name: "Teorías de la Comunicación", credits: 3, semester: 1 },
      { name: "Escritura y Narrativa", credits: 3, semester: 1 },
      { name: "Fotografía", credits: 3, semester: 2 },
      { name: "Comunicación y Cultura", credits: 3, semester: 2 },
      { name: "Producción Sonora", credits: 3, semester: 3 },
      { name: "Periodismo Informativo", credits: 3, semester: 3 },
      { name: "Producción Audiovisual", credits: 4, semester: 4 },
      { name: "Comunicación Digital", credits: 3, semester: 4 },
      { name: "Periodismo de Investigación", credits: 3, semester: 5 },
      { name: "Comunicación Organizacional", credits: 3, semester: 5 },
      { name: "Diseño y Marca", credits: 3, semester: 6 },
      { name: "Narrativas Transmedia", credits: 3, semester: 6 },
      { name: "Práctica Profesional", credits: 5, semester: 7 },
      { name: "Ética y Legislación de Medios", credits: 3, semester: 7 },
      { name: "Proyecto de Comunicación", credits: 6, semester: 8 },
    ],
  },
];

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const SLOTS: Array<{ start: string; end: string }> = [
  { start: "07:00", end: "09:00" },
  { start: "09:00", end: "11:00" },
  { start: "11:00", end: "13:00" },
  { start: "14:00", end: "16:00" },
];

const DAY_MS = 1000 * 60 * 60 * 24;

function syncCatalog(): void {
  const programs = readList<Program>(STORAGE_KEYS.programs);
  const courses = readList<Course>(STORAGE_KEYS.courses);
  const mergedPrograms = [...programs];
  const mergedCourses = [...courses];

  PROGRAM_SEEDS.forEach((programSeed) => {
    if (!mergedPrograms.some((program) => program.id === programSeed.id)) {
      mergedPrograms.push({
        id: programSeed.id,
        name: programSeed.name,
        level: programSeed.level,
        duration: programSeed.duration,
        modality: programSeed.modality,
        description: programSeed.description,
        colorClass: programSeed.colorClass,
      });
    }

    programSeed.courses.forEach((course) => {
      const exists = mergedCourses.some(
        (item) => item.programId === programSeed.id && item.name === course.name,
      );
      if (!exists) {
        mergedCourses.push({
          id: generateId(`crs-${programSeed.id}`),
          programId: programSeed.id,
          name: course.name,
          credits: course.credits,
          semester: course.semester,
        });
      }
    });
  });

  writeList(STORAGE_KEYS.programs, mergedPrograms);
  writeList(STORAGE_KEYS.courses, mergedCourses);
}

export async function seed(): Promise<void> {
  if (localStorage.getItem(STORAGE_KEYS.seeded)) {
    syncCatalog();
    return;
  }

  const programs: Program[] = PROGRAM_SEEDS.map((item) => ({
    id: item.id,
    name: item.name,
    level: item.level,
    duration: item.duration,
    modality: item.modality,
    description: item.description,
    colorClass: item.colorClass,
  }));
  writeList(STORAGE_KEYS.programs, programs);

  const courses: Course[] = [];
  PROGRAM_SEEDS.forEach((program) => {
    program.courses.forEach((course, index) => {
      courses.push({
        id: generateId(`crs-${program.id}-${index}`),
        programId: program.id,
        name: course.name,
        credits: course.credits,
        semester: course.semester,
      });
    });
  });
  writeList(STORAGE_KEYS.courses, courses);

  const periods: Period[] = [
    { id: "per-2026-1", name: "2026-1", active: false },
    { id: "per-2026-2", name: "2026-2", active: true },
  ];
  writeList(STORAGE_KEYS.periods, periods);

  const offerings: CourseOffering[] = courses.map((course, index) => {
    const day = DAYS[index % DAYS.length];
    const slot = SLOTS[index % SLOTS.length];
    return {
      id: generateId(`off-${course.id}`),
      courseId: course.id,
      periodId: "per-2026-2",
      day,
      startTime: slot.start,
      endTime: slot.end,
      capacity: 25,
      professor: "Por asignar",
    };
  });

  const sistemasCourses = courses.filter((item) => item.programId === "prog-sistemas");
  const pastOfferings: CourseOffering[] = sistemasCourses.slice(0, 2).map((course, index) => ({
    id: generateId(`hist-off-${course.id}`),
    courseId: course.id,
    periodId: "per-2026-1",
    day: DAYS[index],
    startTime: "07:00",
    endTime: "09:00",
    capacity: 25,
    professor: "Por asignar",
  }));
  writeList(STORAGE_KEYS.offerings, [...offerings, ...pastOfferings]);

  const staffSalt = randomSalt();
  const applicantSalt = randomSalt();
  const studentSalt = randomSalt();
  const [staffHash, applicantHash, studentHash] = await Promise.all([
    hashPassword("Admisiones2026", staffSalt),
    hashPassword("Prueba12345", applicantSalt),
    hashPassword("Estudiante123", studentSalt),
  ]);

  const staffAccount: Account = {
    id: generateId("acc-staff"),
    firstName: "Equipo",
    lastName: "Admisiones",
    documentType: "CC",
    documentNumber: "STAFF-0001",
    email: "admisiones@unac.edu.co",
    phone: "3000000001",
    passwordHash: staffHash,
    passwordSalt: staffSalt,
    role: "Staff",
    createdAt: new Date().toISOString(),
  };
  const applicantAccount: Account = {
    id: generateId("acc-app"),
    firstName: "Jhanc",
    lastName: "Mesa",
    documentType: "CC",
    documentNumber: "TEST-JHANC-001",
    email: "jhanc.mesae@unac.edu.co",
    phone: "3000000000",
    passwordHash: applicantHash,
    passwordSalt: applicantSalt,
    role: "Aspirante",
    createdAt: new Date().toISOString(),
  };
  const studentAccount: Account = {
    id: generateId("acc-std"),
    firstName: "Valentina",
    lastName: "Rojas",
    documentType: "CC",
    documentNumber: "TEST-VAL-001",
    email: "valentina.rojas@unac.edu.co",
    phone: "3000000002",
    passwordHash: studentHash,
    passwordSalt: studentSalt,
    role: "Estudiante",
    createdAt: new Date().toISOString(),
  };
  writeList(STORAGE_KEYS.accounts, [staffAccount, applicantAccount, studentAccount]);

  const admittedApplication: AdmissionApplication = {
    id: generateId("ADM"),
    applicantId: studentAccount.id,
    applicantEmail: studentAccount.email,
    programId: "prog-sistemas",
    level: "Pregrado",
    city: "Medellín",
    modality: "Presencial",
    motivation: "Quiero formarme como ingeniera de sistemas.",
    status: "Admitido",
    createdAt: new Date(Date.now() - DAY_MS * 10).toISOString(),
    reviewedAt: new Date(Date.now() - DAY_MS * 5).toISOString(),
    reviewNote: "Cumple los requisitos de admisión.",
  };
  const pendingApplication: AdmissionApplication = {
    id: generateId("ADM"),
    applicantId: applicantAccount.id,
    applicantEmail: applicantAccount.email,
    programId: "prog-admin",
    level: "Pregrado",
    city: "Medellín",
    modality: "Presencial",
    motivation: "Quiero liderar organizaciones con propósito.",
    status: "Radicada",
    createdAt: new Date().toISOString(),
  };
  writeList(STORAGE_KEYS.admissions, [admittedApplication, pendingApplication]);

  const historyEnrollments: Enrollment[] = pastOfferings.map((offering) => ({
    id: generateId("MAT"),
    studentId: studentAccount.id,
    offeringId: offering.id,
    periodId: "per-2026-1",
    status: "Matriculada",
    createdAt: new Date(Date.now() - DAY_MS * 90).toISOString(),
  }));
  writeList(STORAGE_KEYS.enrollments, historyEnrollments);

  localStorage.setItem(STORAGE_KEYS.seeded, "1");
}
