import type { Account, AdmissionApplication, Assignment, AssignmentGrade, CampusEvent, Course, CourseOffering, Enrollment, FaqItem, Notification, Period, Program, Testimonial } from "../types";
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
  courses: Array<{
    code: string;
    name: string;
    description: string;
    credits: number;
    hours: number;
    semester: number;
    type: Course["type"];
  }>;
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
      { code: "ADM-101", name: "Fundamentos de Administración", description: "Principios históricos y contemporáneos de la gestión organizacional y las teorías administrativas.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "ADM-102", name: "Contabilidad General", description: "Registro, clasificación y presentación de hechos económicos según marcos normativos vigentes.", credits: 4, hours: 5, semester: 1, type: "Obligatoria" },
      { code: "ADM-103", name: "Matemáticas para los Negocios", description: "Herramientas cuantitativas aplicadas a la toma de decisiones administrativas y financieras.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "ADM-104", name: "Comunicación Empresarial", description: "Técnicas orales y escritas para la comunicación efectiva en entornos corporativos.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "ADM-105", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista en el contexto profesional.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "ADM-201", name: "Microeconomía", description: "Comportamiento de consumidores, productores y mercados en la asignación de recursos.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "ADM-202", name: "Macroeconomía", description: "Variables agregadas: inflación, empleo, crecimiento y política económica.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "ADM-203", name: "Gestión del Talento Humano", description: "Procesos de selección, formación, evaluación y desarrollo de personas en las organizaciones.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "ADM-204", name: "Ética y Responsabilidad Social", description: "Fundamentos éticos para la gestión empresarial y el impacto social organizacional.", credits: 2, hours: 3, semester: 2, type: "Obligatoria" },
      { code: "ADM-301", name: "Estadística Empresarial", description: "Análisis descriptivo e inferencial para la investigación y gestión empresarial.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "ADM-302", name: "Costos y Presupuestos", description: "Sistemas de costeo, planificación financiera y control presupuestario.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "ADM-303", name: "Derecho Empresarial", description: "Marco jurídico colombiano aplicable a la actividad empresarial y los contratos.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "ADM-304", name: "Comportamiento Organizacional", description: "Dinámicas individuales, grupales y estructurales que influyen en las organizaciones.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "ADM-401", name: "Mercadeo Estratégico", description: "Diseño de estrategias de mercado, segmentación, posicionamiento y mezcla de marketing.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ADM-402", name: "Gestión Financiera", description: "Decisiones de inversión, financiamiento y operación bajo criterios de creación de valor.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ADM-403", name: "Investigación de Mercados", description: "Técnicas cualitativas y cuantitativas para obtener y analizar información de mercado.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ADM-404", name: "Sistemas de Información Gerencial", description: "Tecnologías de información como soporte a la estrategia y operación empresarial.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ADM-405", name: "Legislación Laboral", description: "Normatividad colombiana sobre relaciones laborales, seguridad social y prestaciones.", credits: 2, hours: 3, semester: 4, type: "Obligatoria" },
      { code: "ADM-501", name: "Gerencia de Operaciones", description: "Diseño, operación y mejora de procesos productivos y de servicios.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "ADM-502", name: "Comercio Internacional", description: "Marco legal, logístico y estratégico de las operaciones de importación y exportación.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "ADM-503", name: "Formulación de Proyectos", description: "Metodologías para evaluar técnica y financieramente proyectos de inversión.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "ADM-504", name: "Gestión de la Calidad", description: "Sistemas de gestión de calidad, норма ISO 9001 y herramientas de mejora continua.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "ADM-601", name: "Gerencia Estratégica", description: "Formulación, implementación y control de estrategias organizacionales.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "ADM-602", name: "Emprendimiento e Innovación", description: "Diseño y validación de modelos de negocio con mentalidad emprendedora.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "ADM-603", name: "Finanzas Corporativas", description: "Estructura de capital, valoración de empresas y decisiones financieras estratégicas.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "ADM-604", name: "Negociación y Manejo de Conflictos", description: "Estrategias, tácticas y habilidades para negociar acuerdos efectivos.", credits: 2, hours: 3, semester: 6, type: "Obligatoria" },
      { code: "ADM-701", name: "Práctica Empresarial", description: "Experiencia formativa en organizaciones reales supervisada por la universidad.", credits: 4, hours: 12, semester: 7, type: "Práctica" },
      { code: "ADM-702", name: "Seminario de Investigación", description: "Construcción de un proyecto de investigación aplicado al campo administrativo.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "ADM-703", name: "Electiva Profesional I", description: "Profundización electiva en un área afín al perfil del administrador.", credits: 3, hours: 4, semester: 7, type: "Electiva" },
      { code: "ADM-801", name: "Trabajo de Grado", description: "Proyecto integrador que demuestra las competencias adquiridas en el programa.", credits: 6, hours: 16, semester: 8, type: "Trabajo de grado" },
      { code: "ADM-802", name: "Electiva Profesional II", description: "Segunda profundización electiva en el campo administrativo.", credits: 3, hours: 4, semester: 8, type: "Electiva" },
      { code: "ADM-803", name: "Gerencia del Cambio", description: "Liderazgo de procesos de transformación organizacional y gestión del cambio.", credits: 3, hours: 4, semester: 8, type: "Obligatoria" },
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
      { code: "ISI-101", name: "Algoritmos y Programación", description: "Fundamentos de pensamiento algorítmico y resolución de problemas con código.", credits: 4, hours: 6, semester: 1, type: "Obligatoria" },
      { code: "ISI-102", name: "Matemáticas Discretas", description: "Lógica, conjuntos, relaciones, grafos y combinatoria aplicada a la computación.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "ISI-103", name: "Introducción a la Ingeniería", description: "Panorama de la ingeniería, su historia, campos profesionales y rol social.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "ISI-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "ISI-201", name: "Estructuras de Datos", description: "Listas, pilas, colas, árboles, grafos y algoritmos fundamentales sobre ellos.", credits: 4, hours: 6, semester: 2, type: "Obligatoria" },
      { code: "ISI-202", name: "Cálculo Diferencial", description: "Funciones, límites, derivadas y sus aplicaciones en problemas de ingeniería.", credits: 4, hours: 5, semester: 2, type: "Obligatoria" },
      { code: "ISI-203", name: "Lógica Computacional", description: "Lógica proposicional y de predicados para especificación y verificación formal.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "ISI-204", name: "Pensamiento Sistémico", description: "Enfoques para modelar y analizar sistemas complejos desde la ingeniería.", credits: 2, hours: 3, semester: 2, type: "Obligatoria" },
      { code: "ISI-301", name: "Bases de Datos", description: "Diseño, implementación y consulta de bases de datos relacionales y NoSQL.", credits: 3, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "ISI-302", name: "Sistemas Operativos", description: "Procesos, memoria, archivos y concurrencia en sistemas operativos modernos.", credits: 3, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "ISI-303", name: "Cálculo Integral", description: "Integración definida e indefinida, series y aplicaciones a la ingeniería.", credits: 4, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "ISI-304", name: "Programación Orientada a Objetos", description: "Paradigma de objetos: clases, herencia, polimorfismo y patrones de diseño.", credits: 3, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "ISI-401", name: "Ingeniería de Software", description: "Procesos, métodos y herramientas para el desarrollo de software de calidad.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ISI-402", name: "Redes de Computadores", description: "Protocolos, arquitecturas y servicios de red según el modelo TCP/IP.", credits: 3, hours: 5, semester: 4, type: "Obligatoria" },
      { code: "ISI-403", name: "Álgebra Lineal", description: "Vectores, matrices, transformaciones y espacios vectoriales.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ISI-404", name: "Probabilidad y Estadística", description: "Probabilidad, distribuciones, inferencia y análisis de datos.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ISI-501", name: "Arquitectura de Computadores", description: "Organización interna del hardware, ensamblador y rendimiento.", credits: 3, hours: 5, semester: 5, type: "Obligatoria" },
      { code: "ISI-502", name: "Desarrollo Web", description: "Frontend, backend y despliegue de aplicaciones web full stack.", credits: 3, hours: 5, semester: 5, type: "Obligatoria" },
      { code: "ISI-503", name: "Métodos Numéricos", description: "Algoritmos numéricos para resolver problemas matemáticos en ingeniería.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "ISI-601", name: "Seguridad Informática", description: "Criptografía, gestión de riesgos, normas y ethical hacking.", credits: 3, hours: 5, semester: 6, type: "Obligatoria" },
      { code: "ISI-602", name: "Inteligencia Artificial", description: "Fundamentos, algoritmos clásicos y aplicaciones contemporáneas de IA.", credits: 3, hours: 5, semester: 6, type: "Obligatoria" },
      { code: "ISI-603", name: "Ingeniería de Requisitos", description: "Técnicas de elicitación, análisis, especificación y validación de requisitos.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "ISI-701", name: "Gestión de Proyectos TI", description: "Planificación, ejecución y control de proyectos de tecnología con marcos ágiles y predictivos.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "ISI-702", name: "Computación en la Nube", description: "Modelos de servicio, virtualización, contenedores y arquitecturas serverless.", credits: 3, hours: 5, semester: 7, type: "Obligatoria" },
      { code: "ISI-703", name: "Electiva Profesional I", description: "Profundización electiva en un área avanzada de la ingeniería.", credits: 3, hours: 4, semester: 7, type: "Electiva" },
      { code: "ISI-801", name: "Práctica Profesional", description: "Experiencia laboral supervisada en empresas del sector tecnológico.", credits: 4, hours: 12, semester: 8, type: "Práctica" },
      { code: "ISI-802", name: "Calidad de Software", description: "Métricas, pruebas, estándares y mejora continua del software.", credits: 3, hours: 4, semester: 8, type: "Obligatoria" },
      { code: "ISI-803", name: "Electiva Profesional II", description: "Segunda profundización electiva en un área afín.", credits: 3, hours: 4, semester: 8, type: "Electiva" },
      { code: "ISI-901", name: "Proyecto Integrador", description: "Proyecto aplicado de final de carrera integrando todas las competencias.", credits: 5, hours: 14, semester: 9, type: "Trabajo de grado" },
      { code: "ISI-902", name: "Arquitectura de Software", description: "Patrones, estilos y decisiones arquitectónicas para sistemas complejos.", credits: 3, hours: 4, semester: 9, type: "Obligatoria" },
      { code: "ISI-903", name: "Electiva Profesional III", description: "Tercera profundización electiva en un campo de frontera.", credits: 3, hours: 4, semester: 9, type: "Electiva" },
      { code: "ISI-1001", name: "Trabajo de Grado", description: "Investigación aplicada o proyecto de impacto en el área de sistemas.", credits: 6, hours: 16, semester: 10, type: "Trabajo de grado" },
      { code: "ISI-1002", name: "Gestión de la Innovación Tecnológica", description: "Estrategias de innovación, transferencia tecnológica y propiedad intelectual.", credits: 3, hours: 4, semester: 10, type: "Obligatoria" },
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
      { code: "CON-101", name: "Contabilidad Financiera", description: "Registro y presentación de hechos financieros según marcos normativos.", credits: 4, hours: 5, semester: 1, type: "Obligatoria" },
      { code: "CON-102", name: "Fundamentos de Economía", description: "Conceptos micro y macroeconómicos para la gestión contable.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "CON-103", name: "Matemáticas Financieras", description: "Interés, anualidades, amortización y evaluación financiera.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "CON-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "CON-201", name: "Costos I", description: "Sistemas de costeo por órdenes, por procesos y ABC.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "CON-202", name: "Legislación Comercial", description: "Normatividad mercantil colombiana y regímenes societarios.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "CON-203", name: "Estadística Aplicada", description: "Herramientas estadísticas para el análisis de información contable y financiera.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "CON-301", name: "Legislación Tributaria", description: "Marco legal del impuesto sobre la renta, IVA y demás tributos nacionales.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "CON-302", name: "Presupuestos", description: "Elaboración, ejecución y control de presupuestos empresariales.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "CON-303", name: "Contabilidad de Costos II", description: "Costos estándar, análisis de variaciones y costeo basado en actividades.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "CON-401", name: "Auditoría I", description: "Normas de auditoría, planeación, ejecución y dictamen de estados financieros.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "CON-402", name: "Contabilidad de Sociedades", description: "Registro contable de sociedades, fusiones, escisiones y combinaciones de negocio.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "CON-403", name: "Finanzas Corporativas", description: "Decisiones de inversión y financiamiento en el ámbito corporativo.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "CON-501", name: "Impuestos Nacionales", description: "Liquidación y declaración de impuestos en Colombia: renta, IVA, retención en la fuente.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "CON-502", name: "Auditoría II", description: "Auditoría de cuentas específicas, papeles de trabajo e informes de auditoría.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "CON-503", name: "Control Interno", description: "Modelos de control interno: COSO, MECI y gestión de riesgos.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "CON-601", name: "Contabilidad Pública", description: "Régimen contable público colombiano y reportes a la Contaduría General.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "CON-602", name: "Revisoría Fiscal", description: "Funciones, dictámenes y responsabilidades del revisor fiscal en Colombia.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "CON-603", name: "NIIF Avanzadas", description: "Aplicación de Normas Internacionales de Información Financiera en contextos complejos.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "CON-701", name: "Ética Profesional", description: "Principios éticos del contador público y su rol ante la sociedad.", credits: 2, hours: 3, semester: 7, type: "Obligatoria" },
      { code: "CON-702", name: "Práctica Contable", description: "Experiencia formativa en firmas contables o áreas financieras de organizaciones.", credits: 4, hours: 12, semester: 7, type: "Práctica" },
      { code: "CON-703", name: "Auditoría de Sistemas", description: "Auditoría de sistemas de información y entornos tecnológicos.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "CON-801", name: "Trabajo de Grado", description: "Proyecto de investigación aplicada en el campo contable y financiero.", credits: 6, hours: 16, semester: 8, type: "Trabajo de grado" },
      { code: "CON-802", name: "Gerencia Financiera", description: "Planeación financiera estratégica y valoración de empresas.", credits: 3, hours: 4, semester: 8, type: "Obligatoria" },
      { code: "CON-901", name: "Seminario Tributario", description: "Análisis de casos contemporáneos en fiscalidad nacional e internacional.", credits: 3, hours: 4, semester: 9, type: "Obligatoria" },
      { code: "CON-902", name: "Electiva Profesional", description: "Profundización electiva en un área de la contaduría.", credits: 3, hours: 4, semester: 9, type: "Electiva" },
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
      { code: "EDU-101", name: "Pedagogía General", description: "Fundamentos teóricos e históricos de la pedagogía como disciplina y práctica.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "EDU-102", name: "Psicología del Aprendizaje", description: "Teorías cognitivas, conductuales y constructivistas del aprendizaje humano.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "EDU-103", name: "Fundamentos Filosóficos de la Educación", description: "Corrientes filosóficas que sustentan la práctica educativa.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "EDU-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "EDU-201", name: "Currículo y Evaluación", description: "Diseño curricular, modelos pedagógicos y sistemas de evaluación educativa.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "EDU-202", name: "Desarrollo Humano", description: "Etapas del desarrollo infantil, juvenil y adulto y su impacto en el aula.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "EDU-203", name: "Didáctica General", description: "Estrategias, métodos y recursos para la enseñanza efectiva.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "EDU-301", name: "Sociología de la Educación", description: "Relación entre educación, cultura, sociedad y desigualdad.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "EDU-302", name: "Tecnologías Educativas", description: "Integración pedagógica de tecnologías digitales en el aula.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "EDU-303", name: "Educación Inclusiva", description: "Atención a la diversidad y diseño universal para el aprendizaje.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "EDU-401", name: "Investigación Educativa I", description: "Paradigmas y métodos de investigación en el campo educativo.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "EDU-402", name: "Gestión Escolar", description: "Administración, legislación y gobierno escolar.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "EDU-403", name: "Orientación Educativa", description: "Acompañamiento socioafectivo y orientación vocacional del estudiante.", credits: 2, hours: 3, semester: 4, type: "Obligatoria" },
      { code: "EDU-501", name: "Investigación Educativa II", description: "Diseño y ejecución de proyectos de investigación en educación.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "EDU-502", name: "Evaluación del Aprendizaje", description: "Diseño de instrumentos, rúbricas y análisis de resultados académicos.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "EDU-503", name: "Diseño Curricular", description: "Construcción de planes de estudio basados en competencias y estándares.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "EDU-601", name: "Práctica Pedagógica I", description: "Primer acercamiento al aula con acompañamiento institucional.", credits: 4, hours: 12, semester: 6, type: "Práctica" },
      { code: "EDU-602", name: "Neuroeducación", description: "Aportes de las neurociencias al aprendizaje y la enseñanza.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "EDU-603", name: "Educación Emocional", description: "Inteligencia emocional, convivencia y bienestar en la escuela.", credits: 2, hours: 3, semester: 6, type: "Obligatoria" },
      { code: "EDU-701", name: "Práctica Pedagógica II", description: "Práctica profesional intensiva con responsabilidad sobre un grupo.", credits: 5, hours: 16, semester: 7, type: "Práctica" },
      { code: "EDU-702", name: "Seminario de Grado", description: "Acompañamiento al proyecto investigativo de culminación de carrera.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "EDU-703", name: "Liderazgo Educativo", description: "Roles directivos y liderazgo pedagógico en instituciones educativas.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "EDU-801", name: "Trabajo de Grado", description: "Investigación aplicada en educación con resultados publicables.", credits: 6, hours: 16, semester: 8, type: "Trabajo de grado" },
      { code: "EDU-802", name: "Legislación Educativa", description: "Marco normativo colombiano para la educación preescolar, básica y media.", credits: 2, hours: 3, semester: 8, type: "Obligatoria" },
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
      { code: "PSI-101", name: "Introducción a la Psicología", description: "Historia, campos de aplicación y métodos de la psicología contemporánea.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "PSI-102", name: "Bases Biológicas de la Conducta", description: "Anatomía y fisiología del sistema nervioso y su relación con el comportamiento.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "PSI-103", name: "Historia de la Psicología", description: "Evolución de las principales escuelas y corrientes psicológicas.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "PSI-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "PSI-201", name: "Psicología del Desarrollo I", description: "Desarrollo humano desde la gestación hasta la adolescencia.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "PSI-202", name: "Procesos Psicológicos", description: "Percepción, atención, memoria, aprendizaje y pensamiento.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "PSI-203", name: "Estadística Aplicada", description: "Herramientas cuantitativas para la investigación psicológica.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "PSI-301", name: "Psicología del Desarrollo II", description: "Desarrollo adulto y envejecimiento desde una perspectiva integral.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "PSI-302", name: "Psicología Social", description: "Influencia de los otros, los grupos y la cultura en el comportamiento.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "PSI-303", name: "Teorías de la Personalidad", description: "Principales enfoques teóricos de la estructura y dinámica de la personalidad.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "PSI-401", name: "Evaluación Psicológica I", description: "Fundamentos, técnicas y ética de la evaluación psicológica.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "PSI-402", name: "Psicología de la Personalidad", description: "Aplicación clínica de los modelos de la personalidad.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "PSI-403", name: "Psicometría", description: "Construcción, validación y aplicación de pruebas psicológicas.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "PSI-501", name: "Psicopatología", description: "Clasificación, diagnóstico y comprensión de los trastornos mentales.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "PSI-502", name: "Evaluación Psicológica II", description: "Pruebas específicas por área: inteligencia, personalidad, neuropsicología.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "PSI-503", name: "Psicología Cognitiva", description: "Modelos computacionales y experimentales de la cognición humana.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "PSI-601", name: "Psicología Clínica", description: "Modelos de intervención clínica basados en la evidencia.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "PSI-602", name: "Intervención Comunitaria", description: "Estrategias psicosociales para la transformación de comunidades.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "PSI-603", name: "Psicología del Consumidor", description: "Comportamiento del consumidor y técnicas de investigación de mercados.", credits: 2, hours: 3, semester: 6, type: "Obligatoria" },
      { code: "PSI-701", name: "Psicología Organizacional", description: "Gestión del talento humano, clima y cultura organizacional.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "PSI-702", name: "Seminario de Investigación", description: "Diseño de proyectos de investigación en psicología.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "PSI-703", name: "Psicología Forense", description: "Aplicación de la psicología al derecho penal, civil y de familia.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "PSI-801", name: "Práctica Profesional I", description: "Práctica supervisada en contextos aplicados de la psicología.", credits: 5, hours: 16, semester: 8, type: "Práctica" },
      { code: "PSI-802", name: "Neuropsicología", description: "Relación cerebro-conducta y rehabilitación neuropsicológica.", credits: 3, hours: 4, semester: 8, type: "Obligatoria" },
      { code: "PSI-803", name: "Ética Profesional", description: "Código deontológico del psicólogo y dilemas éticos contemporáneos.", credits: 2, hours: 3, semester: 8, type: "Obligatoria" },
      { code: "PSI-901", name: "Práctica Profesional II", description: "Profundización de la práctica profesional con mayor autonomía.", credits: 6, hours: 20, semester: 9, type: "Práctica" },
      { code: "PSI-902", name: "Psicoterapia", description: "Modelos, técnicas y procesos psicoterapéuticos contemporáneos.", credits: 3, hours: 4, semester: 9, type: "Obligatoria" },
      { code: "PSI-1001", name: "Trabajo de Grado", description: "Investigación original en un área de la psicología.", credits: 6, hours: 16, semester: 10, type: "Trabajo de grado" },
      { code: "PSI-1002", name: "Electiva Profesional", description: "Profundización electiva en un campo aplicado de la psicología.", credits: 3, hours: 4, semester: 10, type: "Electiva" },
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
      { code: "ENF-101", name: "Fundamentos de Enfermería", description: "Historia, principios y rol profesional de la enfermería en el cuidado.", credits: 4, hours: 6, semester: 1, type: "Obligatoria" },
      { code: "ENF-102", name: "Anatomía y Fisiología I", description: "Estructura y función de los sistemas del cuerpo humano.", credits: 4, hours: 5, semester: 1, type: "Obligatoria" },
      { code: "ENF-103", name: "Biología Celular", description: "Estructura y función celular como base para la comprensión de la salud.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "ENF-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "ENF-201", name: "Anatomía y Fisiología II", description: "Continuación del estudio de los sistemas corporales.", credits: 4, hours: 5, semester: 2, type: "Obligatoria" },
      { code: "ENF-202", name: "Bioquímica", description: "Reacciones químicas de los sistemas biológicos y su relevancia clínica.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "ENF-203", name: "Microbiología", description: "Microorganismos de interés clínico y mecanismos de infección.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "ENF-301", name: "Enfermería del Adulto I", description: "Cuidado integral al adulto con alteraciones de salud en hospitalización.", credits: 5, hours: 10, semester: 3, type: "Obligatoria" },
      { code: "ENF-302", name: "Farmacología", description: "Principios de farmacocinética, farmacodinamia y grupos farmacológicos.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "ENF-303", name: "Nutrición y Dietética", description: "Principios nutricionales aplicados al cuidado de la salud.", credits: 2, hours: 3, semester: 3, type: "Obligatoria" },
      { code: "ENF-401", name: "Enfermería del Adulto II", description: "Cuidado del adulto con condiciones crónicas y de alta dependencia.", credits: 5, hours: 10, semester: 4, type: "Obligatoria" },
      { code: "ENF-402", name: "Salud Mental", description: "Promoción de la salud mental y cuidado de personas con sufrimiento psíquico.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "ENF-403", name: "Bioética", description: "Dilemas éticos en la práctica clínica y la investigación en salud.", credits: 2, hours: 3, semester: 4, type: "Obligatoria" },
      { code: "ENF-501", name: "Enfermería Materno Infantil", description: "Cuidado de la mujer gestante, parto, puerperio y recién nacido.", credits: 5, hours: 10, semester: 5, type: "Obligatoria" },
      { code: "ENF-502", name: "Salud Pública", description: "Políticas, programas e intervenciones colectivas de salud.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "ENF-503", name: "Educación para la Salud", description: "Metodologías para la promoción de la salud y la prevención de la enfermedad.", credits: 2, hours: 3, semester: 5, type: "Obligatoria" },
      { code: "ENF-601", name: "Enfermería Pediátrica", description: "Cuidado integral del niño y adolescente en contextos clínicos y comunitarios.", credits: 5, hours: 10, semester: 6, type: "Obligatoria" },
      { code: "ENF-602", name: "Epidemiología", description: "Métodos epidemiológicos para el análisis de la situación de salud.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "ENF-603", name: "Gestión del Cuidado", description: "Modelos de gestión para servicios de enfermería seguros y de calidad.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "ENF-701", name: "Cuidado Crítico", description: "Atención de enfermería al paciente adulto en unidades de cuidado intensivo.", credits: 5, hours: 10, semester: 7, type: "Obligatoria" },
      { code: "ENF-702", name: "Gestión de Servicios de Salud", description: "Administración y planeación estratégica en instituciones de salud.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "ENF-703", name: "Investigación en Enfermería", description: "Diseño y desarrollo de investigación aplicada al cuidado enfermero.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "ENF-801", name: "Práctica Clínica Integral", description: "Práctica profesional en escenarios clínicos reales de alta complejidad.", credits: 8, hours: 24, semester: 8, type: "Práctica" },
      { code: "ENF-802", name: "Legislación en Salud", description: "Marco legal colombiano del sistema de salud y la profesión de enfermería.", credits: 2, hours: 3, semester: 8, type: "Obligatoria" },
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
      { code: "COM-101", name: "Teorías de la Comunicación", description: "Modelos clásicos y contemporáneos para comprender los procesos comunicativos.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "COM-102", name: "Escritura y Narrativa", description: "Técnicas de redacción creativa y construcción de relatos para medios.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "COM-103", name: "Historia del Arte y los Medios", description: "Recorrido histórico por las manifestaciones artísticas y los medios de comunicación.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "COM-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "COM-201", name: "Fotografía", description: "Técnica fotográfica, composición y narrativa visual.", credits: 3, hours: 5, semester: 2, type: "Obligatoria" },
      { code: "COM-202", name: "Comunicación y Cultura", description: "Relación entre prácticas culturales, identidades y medios.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "COM-203", name: "Semiótica", description: "Estudio de los signos, códigos y procesos de significación.", credits: 2, hours: 3, semester: 2, type: "Obligatoria" },
      { code: "COM-301", name: "Producción Sonora", description: "Edición, mezcla y producción de contenido sonoro y podcast.", credits: 3, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "COM-302", name: "Periodismo Informativo", description: "Géneros periodísticos, técnicas de reportería y construcción de la noticia.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "COM-303", name: "Guion Audiovisual", description: "Escritura de guiones para cine, televisión y formatos digitales.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "COM-401", name: "Producción Audiovisual", description: "Planeación, rodaje y postproducción de piezas audiovisuales.", credits: 4, hours: 6, semester: 4, type: "Obligatoria" },
      { code: "COM-402", name: "Comunicación Digital", description: "Ecosistemas digitales, redes sociales y estrategias de contenido.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "COM-403", name: "Diseño Gráfico", description: "Principios de diseño visual y herramientas de producción gráfica.", credits: 3, hours: 5, semester: 4, type: "Obligatoria" },
      { code: "COM-501", name: "Periodismo de Investigación", description: "Métodos avanzados de investigación periodística y reportajes en profundidad.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "COM-502", name: "Comunicación Organizacional", description: "Estrategias de comunicación interna, cultura y reputación corporativa.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "COM-503", name: "Marketing Digital", description: "Planificación de medios, métricas y campañas digitales.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "COM-601", name: "Diseño y Marca", description: "Construcción de identidad de marca, branding y diseño estratégico.", credits: 3, hours: 5, semester: 6, type: "Obligatoria" },
      { code: "COM-602", name: "Narrativas Transmedia", description: "Diseño de historias distribuidas en múltiples plataformas y formatos.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "COM-603", name: "Comunicación Política", description: "Opinión pública, campañas políticas y análisis de discurso.", credits: 2, hours: 3, semester: 6, type: "Obligatoria" },
      { code: "COM-701", name: "Práctica Profesional", description: "Experiencia profesional en medios, agencias o departamentos de comunicación.", credits: 5, hours: 16, semester: 7, type: "Práctica" },
      { code: "COM-702", name: "Ética y Legislación de Medios", description: "Marco regulatorio y deontológico del ejercicio periodístico.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "COM-703", name: "Producción de Contenidos Digitales", description: "Creación de contenido profesional para plataformas digitales.", credits: 3, hours: 5, semester: 7, type: "Obligatoria" },
      { code: "COM-801", name: "Proyecto de Comunicación", description: "Proyecto integrador de cierre que demuestra las competencias adquiridas.", credits: 6, hours: 16, semester: 8, type: "Trabajo de grado" },
      { code: "COM-802", name: "Gestión de Medios", description: "Administración y sostenibilidad financiera de empresas de comunicación.", credits: 3, hours: 4, semester: 8, type: "Obligatoria" },
    ],
  },
  {
    id: "prog-industrial",
    name: "Ingeniería Industrial",
    level: "Pregrado",
    duration: "10 semestres",
    modality: "Presencial",
    description: "Optimiza procesos, personas y recursos para generar valor sostenible.",
    colorClass: "program-coral",
    courses: [
      { code: "IIN-101", name: "Introducción a la Ingeniería Industrial", description: "Campo profesional, historia y aplicaciones contemporáneas de la disciplina.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "IIN-102", name: "Cálculo Diferencial", description: "Funciones, límites, derivadas y aplicaciones a problemas de ingeniería.", credits: 4, hours: 5, semester: 1, type: "Obligatoria" },
      { code: "IIN-103", name: "Física Mecánica", description: "Estática, cinemática y dinámica aplicadas a sistemas físicos.", credits: 4, hours: 5, semester: 1, type: "Obligatoria" },
      { code: "IIN-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "IIN-201", name: "Álgebra Lineal", description: "Vectores, matrices, sistemas lineales y sus aplicaciones.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "IIN-202", name: "Cálculo Integral", description: "Técnicas de integración y aplicaciones en ingeniería.", credits: 4, hours: 5, semester: 2, type: "Obligatoria" },
      { code: "IIN-203", name: "Química General", description: "Principios químicos con énfasis en procesos industriales.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "IIN-204", name: "Expresión Gráfica", description: "Interpretación y elaboración de planos técnicos con software CAD.", credits: 2, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "IIN-301", name: "Cálculo Vectorial", description: "Funciones vectoriales, derivadas direccionales e integración múltiple.", credits: 4, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "IIN-302", name: "Probabilidad y Estadística", description: "Probabilidad, inferencia y análisis de datos para la toma de decisiones.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "IIN-303", name: "Electricidad y Electrónica", description: "Principios de circuitos eléctricos y electrónica básica industrial.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "IIN-304", name: "Programación para Ingeniería", description: "Fundamentos de programación aplicados a problemas de ingeniería.", credits: 3, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "IIN-401", name: "Ecuaciones Diferenciales", description: "EDO, sistemas dinámicos y aplicaciones a modelos de ingeniería.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "IIN-402", name: "Termodinámica", description: "Leyes de la termodinámica y ciclos de potencia y refrigeración.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "IIN-403", name: "Gestión de la Producción", description: "Planeación y control de la producción en sistemas manufactureros.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "IIN-501", name: "Investigación de Operaciones I", description: "Programación lineal, método simplex y aplicaciones a la optimización.", credits: 3, hours: 5, semester: 5, type: "Obligatoria" },
      { code: "IIN-502", name: "Procesos de Manufactura", description: "Tecnologías de fabricación y selección de procesos productivos.", credits: 3, hours: 5, semester: 5, type: "Obligatoria" },
      { code: "IIN-503", name: "Gestión de la Calidad", description: "Sistemas de calidad, норма ISO 9001 y herramientas estadísticas.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "IIN-601", name: "Investigación de Operaciones II", description: "Modelos de transporte, redes, colas y simulación.", credits: 3, hours: 5, semester: 6, type: "Obligatoria" },
      { code: "IIN-602", name: "Logística y Cadena de Suministro", description: "Diseño y gestión de cadenas de abastecimiento y distribución.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "IIN-603", name: "Gestión Financiera", description: "Decisiones financieras aplicadas a proyectos de ingeniería.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "IIN-701", name: "Simulación de Procesos", description: "Modelado y simulación de sistemas con software especializado.", credits: 3, hours: 5, semester: 7, type: "Obligatoria" },
      { code: "IIN-702", name: "Seguridad y Salud en el Trabajo", description: "Gestión de riesgos laborales y normatividad colombiana.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "IIN-703", name: "Gestión de Proyectos de Ingeniería", description: "Metodologías PMI, planeación, ejecución y cierre de proyectos.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "IIN-801", name: "Práctica Profesional", description: "Experiencia profesional en empresas del sector industrial.", credits: 4, hours: 12, semester: 8, type: "Práctica" },
      { code: "IIN-802", name: "Ingeniería del Mejoramiento Continuo", description: "Lean manufacturing, six sigma y metodologías de mejora.", credits: 3, hours: 4, semester: 8, type: "Obligatoria" },
      { code: "IIN-901", name: "Formulación y Evaluación de Proyectos", description: "Estudio de mercado, técnico, financiero y ambiental.", credits: 3, hours: 4, semester: 9, type: "Obligatoria" },
      { code: "IIN-902", name: "Electiva Profesional I", description: "Profundización electiva en un área industrial avanzada.", credits: 3, hours: 4, semester: 9, type: "Electiva" },
      { code: "IIN-1001", name: "Proyecto Integrador", description: "Proyecto aplicado que integra todas las competencias del programa.", credits: 5, hours: 14, semester: 10, type: "Trabajo de grado" },
      { code: "IIN-1002", name: "Electiva Profesional II", description: "Segunda profundización electiva en el campo industrial.", credits: 3, hours: 4, semester: 10, type: "Electiva" },
    ],
  },
  {
    id: "prog-derecho",
    name: "Derecho",
    level: "Pregrado",
    duration: "10 semestres",
    modality: "Presencial",
    description: "Forma profesionales del derecho con sentido ético, crítico y social.",
    colorClass: "program-gold",
    courses: [
      { code: "DER-101", name: "Introducción al Derecho", description: "Conceptos fundamentales, fuentes y ramas del ordenamiento jurídico.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "DER-102", name: "Historia del Derecho", description: "Evolución histórica del pensamiento jurídico occidental.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "DER-103", name: "Lógica y Argumentación Jurídica", description: "Razonamiento lógico y técnicas de argumentación para abogados.", credits: 2, hours: 3, semester: 1, type: "Obligatoria" },
      { code: "DER-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "DER-201", name: "Teoría Constitucional", description: "Principios, estructura y dinámica de la constitución colombiana.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "DER-202", name: "Derecho Romano", description: "Instituciones jurídicas romanas y su influencia en el derecho moderno.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "DER-203", name: "Personas y Familia", description: "Régimen jurídico de las personas naturales y la familia en Colombia.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "DER-301", name: "Derecho Civil I - Obligaciones", description: "Teoría general de las obligaciones y su aplicación práctica.", credits: 4, hours: 5, semester: 3, type: "Obligatoria" },
      { code: "DER-302", name: "Derecho Penal General", description: "Principios, teoría del delito y consecuencias jurídicas.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "DER-303", name: "Hermenéutica Jurídica", description: "Métodos de interpretación y aplicación del derecho.", credits: 2, hours: 3, semester: 3, type: "Obligatoria" },
      { code: "DER-401", name: "Derecho Civil II - Contratos", description: "Teoría general de los contratos y principales figuras contractuales.", credits: 4, hours: 5, semester: 4, type: "Obligatoria" },
      { code: "DER-402", name: "Derecho Procesal Civil", description: "Estructura y principios del proceso civil colombiano.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "DER-403", name: "Derecho Constitucional Colombiano", description: "Jurisprudencia y mecanismos de protección constitucional.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "DER-501", name: "Derecho Penal Especial", description: "Estudio de los delitos en particular y su jurisprudencia.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "DER-502", name: "Derecho Comercial", description: "Régimen jurídico de la actividad mercantil y los empresarios.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "DER-503", name: "Derecho Administrativo", description: "Principios y organización del Estado y la función administrativa.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "DER-601", name: "Derecho Laboral", description: "Contrato de trabajo, prestaciones y seguridad social.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "DER-602", name: "Derecho Procesal Penal", description: "Sistema procesal penal acusatorio colombiano.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "DER-603", name: "Bienes y Derechos Reales", description: "Régimen civil de los bienes y los derechos reales.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "DER-701", name: "Derecho de Familia y Sucesiones", description: "Matrimonio, régimen patrimonial y derecho sucesoral.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "DER-702", name: "Derecho Tributario", description: "Sistema tributario colombiano y principios constitucionales.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "DER-703", name: "Consultorio Jurídico I", description: "Atención supervisada de casos reales en el consultorio jurídico.", credits: 4, hours: 12, semester: 7, type: "Práctica" },
      { code: "DER-801", name: "Derecho Internacional Público", description: "Sujetos, fuentes y principios del derecho internacional público.", credits: 3, hours: 4, semester: 8, type: "Obligatoria" },
      { code: "DER-802", name: "Ética y Deontología Jurídica", description: "Responsabilidades éticas del abogado en el ejercicio profesional.", credits: 2, hours: 3, semester: 8, type: "Obligatoria" },
      { code: "DER-803", name: "Consultorio Jurídico II", description: "Continuación de la práctica profesional con mayor autonomía.", credits: 4, hours: 12, semester: 8, type: "Práctica" },
      { code: "DER-901", name: "Propiedad Intelectual", description: "Régimen jurídico del derecho de autor y la propiedad industrial.", credits: 3, hours: 4, semester: 9, type: "Obligatoria" },
      { code: "DER-902", name: "Derecho Procesal Laboral", description: "Procedimiento laboral y mecanismos alternativos de solución.", credits: 3, hours: 4, semester: 9, type: "Obligatoria" },
      { code: "DER-903", name: "Electiva Profesional I", description: "Profundización electiva en un área del derecho.", credits: 3, hours: 4, semester: 9, type: "Electiva" },
      { code: "DER-1001", name: "Trabajo de Grado", description: "Monografía o investigación aplicada en el campo jurídico.", credits: 6, hours: 16, semester: 10, type: "Trabajo de grado" },
      { code: "DER-1002", name: "Derecho Internacional Privado", description: "Normas de conflicto y jurisdicción internacional.", credits: 3, hours: 4, semester: 10, type: "Obligatoria" },
    ],
  },
  {
    id: "prog-teologia",
    name: "Teología",
    level: "Pregrado",
    duration: "8 semestres",
    modality: "Presencial",
    description: "Estudia la fe cristiana con profundidad bíblica, histórica y pastoral.",
    colorClass: "program-blue",
    courses: [
      { code: "TEO-101", name: "Introducción a la Teología", description: "Naturaleza, métodos y fuentes de la reflexión teológica cristiana.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "TEO-102", name: "Estudio del Antiguo Testamento I", description: "Pentateuco y libros históricos: contexto, formación y mensaje.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "TEO-103", name: "Hermenéutica Bíblica", description: "Principios y métodos para la interpretación de las Escrituras.", credits: 3, hours: 4, semester: 1, type: "Obligatoria" },
      { code: "TEO-104", name: "Cátedra Institucional UNAC", description: "Identidad, misión y valores de la Universidad Adventista.", credits: 1, hours: 2, semester: 1, type: "Cátedra" },
      { code: "TEO-201", name: "Estudio del Antiguo Testamento II", description: "Profetas, poesía y literatura sapiencial del Antiguo Testamento.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "TEO-202", name: "Estudio del Nuevo Testamento I", description: "Evangelios sinópticos y Hechos: contexto y teología.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "TEO-203", name: "Historia de la Iglesia I", description: "Desarrollo del cristianismo desde los orígenes hasta la Edad Media.", credits: 3, hours: 4, semester: 2, type: "Obligatoria" },
      { code: "TEO-301", name: "Estudio del Nuevo Testamento II", description: "Epístolas paulinas y literatura apostólica.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "TEO-302", name: "Historia de la Iglesia II", description: "Reforma protestante y cristianismo moderno y contemporáneo.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "TEO-303", name: "Teología Sistemática I", description: "Teología propia: doctrina de Dios, creación y providencia.", credits: 3, hours: 4, semester: 3, type: "Obligatoria" },
      { code: "TEO-401", name: "Teología Sistemática II", description: "Cristología, pneumatología y antropología teológica.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "TEO-402", name: "Teología Pastoral", description: "Ministerio pastoral, cuidado de la comunidad y liderazgo eclesial.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "TEO-403", name: "Griego Bíblico I", description: "Iniciación al griego koiné para el estudio del Nuevo Testamento.", credits: 3, hours: 4, semester: 4, type: "Obligatoria" },
      { code: "TEO-501", name: "Teología Sistemática III", description: "Soteriología, eclesiología y escatología.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "TEO-502", name: "Homilética", description: "Técnicas de preparación y predicación de sermones.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "TEO-503", name: "Griego Bíblico II", description: "Lectura y análisis exegético de textos del Nuevo Testamento.", credits: 3, hours: 4, semester: 5, type: "Obligatoria" },
      { code: "TEO-601", name: "Ética Cristiana", description: "Fundamentos bíblicos y teológicos para la reflexión ética.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "TEO-602", name: "Evangelismo y Misión", description: "Estrategias contemporáneas de evangelización y misión.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "TEO-603", name: "Hebreo Bíblico I", description: "Iniciación al hebreo bíblico para el estudio del Antiguo Testamento.", credits: 3, hours: 4, semester: 6, type: "Obligatoria" },
      { code: "TEO-701", name: "Liderazgo y Administración Eclesial", description: "Gestión del liderazgo en organizaciones religiosas.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "TEO-702", name: "Capellanía y Consejería Pastoral", description: "Cuidado pastoral en contextos clínicos, educativos y comunitarios.", credits: 3, hours: 4, semester: 7, type: "Obligatoria" },
      { code: "TEO-703", name: "Práctica Pastoral", description: "Experiencia ministerial supervisada en congregaciones.", credits: 4, hours: 12, semester: 7, type: "Práctica" },
      { code: "TEO-801", name: "Trabajo de Grado", description: "Investigación teológica original con tutoría docente.", credits: 6, hours: 16, semester: 8, type: "Trabajo de grado" },
      { code: "TEO-802", name: "Religiones y Corrientes Contemporáneas", description: "Panorama de las principales religiones y nuevas espiritualidades.", credits: 2, hours: 3, semester: 8, type: "Obligatoria" },
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

/**
 * Prerrequisitos por código de materia: cada materia que se lista exige haber
 * aprobado las que aparecen en su array antes de poder matricularse.
 */
const PREREQUISITES: Record<string, string[]> = {
  // Ingeniería de Sistemas
  "ISI-201": ["ISI-101"],
  "ISI-301": ["ISI-201"],
  "ISI-302": ["ISI-201"],
  "ISI-401": ["ISI-301", "ISI-304"],
  "ISI-501": ["ISI-401"],
  "ISI-601": ["ISI-501"],
  "ISI-702": ["ISI-502"],
  "ISI-801": ["ISI-701", "ISI-702"],
  "ISI-901": ["ISI-801"],
  "ISI-1001": ["ISI-901"],
  // Administración de Empresas
  "ADM-201": ["ADM-103"],
  "ADM-301": ["ADM-201"],
  "ADM-302": ["ADM-102"],
  "ADM-401": ["ADM-301"],
  "ADM-402": ["ADM-302"],
  "ADM-501": ["ADM-401"],
  "ADM-601": ["ADM-501"],
  "ADM-701": ["ADM-502", "ADM-504"],
  "ADM-801": ["ADM-701"],
  // Contaduría Pública
  "CON-201": ["CON-101"],
  "CON-301": ["CON-201"],
  "CON-401": ["CON-301"],
  "CON-501": ["CON-401"],
  "CON-601": ["CON-501"],
  "CON-702": ["CON-601"],
  "CON-801": ["CON-702"],
  // Educación
  "EDU-201": ["EDU-101"],
  "EDU-301": ["EDU-203"],
  "EDU-401": ["EDU-301"],
  "EDU-501": ["EDU-401"],
  "EDU-601": ["EDU-402"],
  "EDU-701": ["EDU-601", "EDU-702"],
  "EDU-801": ["EDU-701"],
  // Psicología
  "PSI-201": ["PSI-101"],
  "PSI-301": ["PSI-201"],
  "PSI-401": ["PSI-203"],
  "PSI-501": ["PSI-401"],
  "PSI-601": ["PSI-501"],
  "PSI-701": ["PSI-601"],
  "PSI-801": ["PSI-701"],
  "PSI-1001": ["PSI-801"],
  // Enfermería
  "ENF-201": ["ENF-102"],
  "ENF-301": ["ENF-201"],
  "ENF-401": ["ENF-301"],
  "ENF-501": ["ENF-401"],
  "ENF-601": ["ENF-501"],
  "ENF-701": ["ENF-601"],
  "ENF-801": ["ENF-701"],
  // Comunicación
  "COM-201": ["COM-101"],
  "COM-301": ["COM-203"],
  "COM-401": ["COM-301"],
  "COM-501": ["COM-401"],
  "COM-601": ["COM-501"],
  "COM-701": ["COM-601"],
  "COM-801": ["COM-701"],
  // Ingeniería Industrial
  "IIN-201": ["IIN-102"],
  "IIN-301": ["IIN-202"],
  "IIN-401": ["IIN-301"],
  "IIN-501": ["IIN-401"],
  "IIN-601": ["IIN-501"],
  "IIN-701": ["IIN-601"],
  "IIN-801": ["IIN-701"],
  "IIN-1001": ["IIN-801"],
  // Derecho
  "DER-201": ["DER-101"],
  "DER-301": ["DER-203"],
  "DER-401": ["DER-301"],
  "DER-501": ["DER-401"],
  "DER-601": ["DER-501"],
  "DER-701": ["DER-601"],
  "DER-801": ["DER-701"],
  "DER-1001": ["DER-801"],
  // Teología
  "TEO-201": ["TEO-101"],
  "TEO-301": ["TEO-103"],
  "TEO-401": ["TEO-303"],
  "TEO-501": ["TEO-401"],
  "TEO-601": ["TEO-501"],
  "TEO-701": ["TEO-601"],
  "TEO-801": ["TEO-701"],
};

/** Códigos de las materias cuyo cupo se reduce para poder demostrar la lista de espera. */
const LIMITED_CAPACITY: Record<string, number> = {
  "ISI-303": 1,
};

/** Docentes asignados a las ofertas del periodo activo. */
const PROFESSORS = [
  "Dra. Martha Londoño",
  "Dr. Andrés Quintero",
  "Mg. Carolina Restrepo",
  "Dr. Fabián Morales",
  "Lic. Natalia Guzmán",
  "Dr. Hernán Ospina",
];

// ------------------------------------------------------------------
// Datos de la cohorte de prueba
// ------------------------------------------------------------------

/** Estudiantes generados por cada programa. */
const STUDENTS_PER_PROGRAM = 10;

/** Nombres de la cohorte. Los dos primeros son las cuentas destacadas. */
const STUDENT_NAMES: Array<[string, string]> = [
  ["Sofía", "Cardona"],
  ["Andrés", "Quintero"],
  ["Valeria", "Henao"],
  ["Julián", "Álvarez"],
  ["Carolina", "Pineda"],
  ["Sebastián", "Ramírez"],
  ["Isabella", "Vélez"],
  ["Nicolás", "Bedoya"],
  ["Mariana", "Cortés"],
  ["Tomás", "Guerrero"],
];

/** Las dos cuentas destacadas del programa de Ingeniería de Sistemas. */
const FEATURED_NAMES: Array<[string, string]> = [
  ["Valentina", "Rojas"],
  ["Mateo", "Salazar"],
];

const FEATURED_EMAILS = ["valentina.rojas@unac.edu.co", "mateo.salazar@unac.edu.co"];

/** Notas fijas de la cuenta destacada: incluye una reprobada para ver el impacto. */
const FEATURED_GRADES: Record<string, number> = {
  "ISI-101": 4.4,
  "ISI-102": 3.8,
  "ISI-103": 4.1,
  "ISI-104": 4.6,
  "ISI-201": 4.2,
  "ISI-202": 2.8,
  "ISI-203": 3.5,
  "ISI-204": 4.0,
};

/** Materia con un solo cupo, para poder demostrar la lista de espera. */
const LIMITED_CAPACITY_COURSE = "ISI-303";

/** Tareas que se crean en cada materia del periodo activo. */
const TASK_TEMPLATES = [
  { title: "Parcial 1", description: "Primera evaluación del periodo.", weight: 30, dueInDays: 21 },
  { title: "Parcial 2", description: "Segunda evaluación del periodo.", weight: 30, dueInDays: 45 },
  { title: "Trabajo práctico", description: "Aplicación de los contenidos del semestre.", weight: 40, dueInDays: 60 },
];

/** Quita acentos y pasa a minúsculas para construir correos. */
function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Nota determinista a partir de una semilla: el mismo estudiante siempre
 * recebe la misma nota, así el seed es reproducible entre cargas.
 */
function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function seededGrade(seed: string, min = 1.6, max = 5): number {
  const unit = seededUnit(seed);
  // El 15% de los estudiantes reprueba: los valores suben de 3.0.
  const raw = unit < 0.15 ? min + unit * (2.9 - min) : 3.0 + unit * (max - 3.0);
  return Math.round(raw * 10) / 10;
}

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
  });

  // Backfill new fields on legacy courses that match the seed by (programId + name)
  mergedCourses.forEach((course) => {
    if (course.code) return; // already migrated
    const seedMatch = PROGRAM_SEEDS.flatMap((p) =>
      p.courses.filter((c) => p.id === course.programId && c.name === course.name),
    )[0];
    if (seedMatch) {
      course.code = seedMatch.code;
      course.description = seedMatch.description;
      course.hours = seedMatch.hours;
      course.type = seedMatch.type;
      course.credits = seedMatch.credits;
      course.semester = seedMatch.semester;
    }
  });

  // Los prerrequisitos se derivan del código, así que siempre están vigentes.
  mergedCourses.forEach((course) => {
    if (!course.code) return;
    course.prerequisites = PREREQUISITES[course.code] ?? [];
  });

  // Add any new courses from the seed that don't already exist (matched by code)
  PROGRAM_SEEDS.forEach((programSeed) => {
    programSeed.courses.forEach((course, index) => {
      const exists = mergedCourses.some(
        (item) => item.programId === programSeed.id && item.code === course.code,
      );
      if (!exists) {
        mergedCourses.push({
          id: generateId(`crs-${programSeed.id}-${index}-${course.code}`),
          programId: programSeed.id,
          code: course.code,
          name: course.name,
          description: course.description,
          credits: course.credits,
          hours: course.hours,
          semester: course.semester,
          type: course.type,
          prerequisites: PREREQUISITES[course.code] ?? [],
        });
      }
    });
  });

  writeList(STORAGE_KEYS.programs, mergedPrograms);
  writeList(STORAGE_KEYS.courses, mergedCourses);
}

const SCHEMA_VERSION = "8";

export async function seed(): Promise<void> {
  if (localStorage.getItem(STORAGE_KEYS.seeded) === SCHEMA_VERSION) {
    syncCatalog();
    return;
  }

  // Schema is older or missing — wipe seedable collections so they regenerate
  // against the current Course/Program shape. User-created accounts and applications
  // are intentionally preserved.
  localStorage.removeItem(STORAGE_KEYS.courses);
  localStorage.removeItem(STORAGE_KEYS.offerings);
  localStorage.removeItem(STORAGE_KEYS.enrollments);
  localStorage.removeItem(STORAGE_KEYS.periods);
  localStorage.removeItem(STORAGE_KEYS.programChanges);
  localStorage.removeItem(STORAGE_KEYS.prerequisites);
  localStorage.removeItem(STORAGE_KEYS.notifications);
  localStorage.removeItem(STORAGE_KEYS.assignments);
  localStorage.removeItem(STORAGE_KEYS.assignmentGrades);
  localStorage.removeItem(STORAGE_KEYS.waitlist);
  localStorage.removeItem(STORAGE_KEYS.credentials);
  localStorage.removeItem(STORAGE_KEYS.anchorAudit);
  localStorage.removeItem(STORAGE_KEYS.anchors);
  localStorage.removeItem(STORAGE_KEYS.events);
  localStorage.removeItem(STORAGE_KEYS.testimonials);
  localStorage.removeItem(STORAGE_KEYS.faq);

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
        code: course.code,
        name: course.name,
        description: course.description,
        credits: course.credits,
        hours: course.hours,
        semester: course.semester,
        type: course.type,
        prerequisites: PREREQUISITES[course.code] ?? [],
      });
    });
  });
  writeList(STORAGE_KEYS.courses, courses);

  const periods: Period[] = [
    { id: "per-2025-2", name: "2025-2", active: false },
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
      capacity: LIMITED_CAPACITY[course.code] ?? 25,
      professor: PROFESSORS[index % PROFESSORS.length],
    };
  });

  // Ofertas de periodos ya cerrados: semestre 1 en 2025-2 y semestres 2 y 3 en 2026-1.
  // Así cada estudiante tiene un historial real con notas en las que approved.
  const pastOfferings: CourseOffering[] = [];
  courses.forEach((course) => {
    if (course.semester === 1) {
      pastOfferings.push({
        id: generateId(`hist-off-1-${course.id}`),
        courseId: course.id,
        periodId: "per-2025-2",
        day: DAYS[course.semester % DAYS.length],
        startTime: "07:00",
        endTime: "09:00",
        capacity: 25,
        professor: PROFESSORS[course.semester % PROFESSORS.length],
      });
    }
    if (course.semester === 2 || course.semester === 3) {
      pastOfferings.push({
        id: generateId(`hist-off-${course.semester}-${course.id}`),
        courseId: course.id,
        periodId: "per-2026-1",
        day: DAYS[course.semester % DAYS.length],
        startTime: course.semester === 2 ? "09:00" : "11:00",
        endTime: course.semester === 2 ? "11:00" : "13:00",
        capacity: 25,
        professor: PROFESSORS[(course.semester + 1) % PROFESSORS.length],
      });
    }
  });
  writeList(STORAGE_KEYS.offerings, [...offerings, ...pastOfferings]);

const staffSalt = randomSalt();
  const applicantSalt = randomSalt();
  const [staffHash, applicantHash] = await Promise.all([
    hashPassword("Admisiones2026", staffSalt),
    hashPassword("Prueba12345", applicantSalt),
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

  // ------------------------------------------------------------------
  // Estudiantes: 10 por programa, cada uno con su semestre actual,
  // historial aprobado y tareas calificadas en el periodo activo.
  // ------------------------------------------------------------------
  const accounts: Account[] = [staffAccount, applicantAccount];
  const applications: AdmissionApplication[] = [];
  const enrollments: Enrollment[] = [];
  const assignments: Assignment[] = [];
  const assignmentGrades: AssignmentGrade[] = [];

  const offeringByCoursePeriod = new Map<string, CourseOffering>();
  [...offerings, ...pastOfferings].forEach((offering) => {
    offeringByCoursePeriod.set(`${offering.courseId}|${offering.periodId}`, offering);
  });

  // Las tareas se crean una sola vez por materia (no por estudiante):
  // cada oferta del periodo activo tiene su propio conjunto de evaluaciones.
  const assignmentsByOffering = new Map<string, Assignment[]>();
  courses.forEach((course) => {
    if (course.type !== "Obligatoria") return;
    if (course.semester < 1 || course.semester > 4) return;
    if (course.code === LIMITED_CAPACITY_COURSE) return;
    const offering = offeringByCoursePeriod.get(`${course.id}|per-2026-2`);
    if (!offering) return;
    const createdAt = new Date(Date.now() - DAY_MS * 5).toISOString();
    const list = TASK_TEMPLATES.map((template) => {
      const assignment: Assignment = {
        id: generateId("TSK"),
        offeringId: offering.id,
        courseId: course.id,
        periodId: "per-2026-2",
        title: template.title,
        description: template.description,
        weight: template.weight,
        dueDate: new Date(Date.now() + DAY_MS * template.dueInDays).toISOString(),
        createdAt,
      };
      assignments.push(assignment);
      return assignment;
    });
    assignmentsByOffering.set(offering.id, list);
  });

  let phoneCounter = 10;
  for (const program of programs) {
    const programCourses = courses.filter((item) => item.programId === program.id);
    const prefix =
      programCourses[0]?.code.split("-")[0]?.toLowerCase() ?? program.id.replace("prog-", "");

    for (let index = 0; index < STUDENTS_PER_PROGRAM; index += 1) {
      const isFeatured = program.id === "prog-sistemas" && index < 2;
      const namePair = isFeatured ? FEATURED_NAMES[index] : STUDENT_NAMES[index];
      const firstName = namePair[0];
      const lastName = namePair[1];
      const email = isFeatured
        ? FEATURED_EMAILS[index]
        : `${slug(firstName)}.${slug(lastName)}.${prefix}@unac.edu.co`;

      const salt = randomSalt();
      const hash = await hashPassword("Estudiante123", salt);
      const account: Account = {
        id: generateId(`acc-${prefix}-${index}`),
        firstName,
        lastName,
        documentType: "CC",
        documentNumber: `TEST-${prefix.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
        email,
        phone: `3000${String(phoneCounter).padStart(6, "0")}`,
        passwordHash: hash,
        passwordSalt: salt,
        role: "Estudiante",
        createdAt: new Date(Date.now() - DAY_MS * (200 - index * 5)).toISOString(),
      };
      phoneCounter += 1;
      accounts.push(account);

      const semester = isFeatured ? 3 : 1 + (index % 4);
      const admittedDaysAgo = 200 - index * 5;
      applications.push({
        id: generateId("ADM"),
        applicantId: account.id,
        applicantEmail: account.email,
        programId: program.id,
        level: program.level,
        city: "Medellín",
        modality: program.modality,
        motivation: `Quiero formarme como profesional en ${program.name}.`,
        status: "Admitido",
        createdAt: new Date(Date.now() - DAY_MS * (admittedDaysAgo + 10)).toISOString(),
        reviewedAt: new Date(Date.now() - DAY_MS * admittedDaysAgo).toISOString(),
        reviewNote: "Cumple los requisitos de admisión.",
      });

      // Historial: obligatorias de los semestres anteriores, ya calificadas.
      for (let past = 1; past < semester; past += 1) {
        const periodId = past === 1 ? "per-2025-2" : "per-2026-1";
        const pastCourses = programCourses.filter(
          (item) => item.semester === past && item.type === "Obligatoria",
        );
        pastCourses.forEach((course) => {
          const offering = offeringByCoursePeriod.get(`${course.id}|${periodId}`);
          if (!offering) return;
          const grade = isFeatured
            ? FEATURED_GRADES[course.code]
            : seededGrade(`${account.email}|${course.code}`);
          const createdAt = new Date(Date.now() - DAY_MS * (past === 1 ? 240 : 120)).toISOString();
          enrollments.push({
            id: generateId("MAT"),
            studentId: account.id,
            offeringId: offering.id,
            periodId,
            status: "Matriculada",
            createdAt,
            grade,
            gradedAt: new Date(Date.now() - DAY_MS * (past === 1 ? 180 : 60)).toISOString(),
          });
        });
      }

      // Periodo activo: obligatorias del semestre actual, con tareas y notas.
      // La materia de cupo 1 se deja fuera: solo la ocupa el estudiante destacado,
      // así la cuenta de prueba puede entrar a la lista de espera.
      const currentCourses = programCourses.filter(
        (item) => item.semester === semester && item.type === "Obligatoria",
      ).filter((item) => item.code !== LIMITED_CAPACITY_COURSE);
      currentCourses.forEach((course) => {
        const offering = offeringByCoursePeriod.get(`${course.id}|per-2026-2`);
        if (!offering) return;
        const enrollmentId = generateId("MAT");
        const createdAt = new Date(Date.now() - DAY_MS * 5).toISOString();

        const courseAssignments = assignmentsByOffering.get(offering.id) ?? [];

        let weighted = 0;
        let gradedWeight = 0;
        courseAssignments.forEach((assignment, taskIndex) => {
          // Se califican los dos primeros parciales; el trabajo práctico queda
          // pendiente para la mitad de la cohorte, así el Staff tiene trabajo real.
          const fullyGraded = seededUnit(`${account.email}|${course.code}|full`) > 0.5;
          if (taskIndex === 2 && !fullyGraded) return;
          const value = seededGrade(`${account.email}|${course.code}|${assignment.title}`, 1.5, 5);
          assignmentGrades.push({
            id: generateId("NTG"),
            assignmentId: assignment.id,
            studentId: account.id,
            enrollmentId,
            value,
            createdAt,
            updatedAt: createdAt,
          });
          weighted += value * assignment.weight;
          gradedWeight += assignment.weight;
        });
        const totalWeight = courseAssignments.reduce((sum, item) => sum + item.weight, 0);
        // La nota final solo existe cuando todas las tareas tienen nota.
        const finalGrade =
          gradedWeight >= totalWeight ? Math.round((weighted / totalWeight) * 100) / 100 : undefined;

        enrollments.push({
          id: enrollmentId,
          studentId: account.id,
          offeringId: offering.id,
          periodId: "per-2026-2",
          status: "Matriculada",
          createdAt,
          grade: finalGrade,
          gradedAt: finalGrade === undefined ? undefined : new Date().toISOString(),
        });
      });
    }
  }

  // La materia de cupo 1 la ocupa el segundo estudiante destacado, para poder
  // demostrar la lista de espera desde la cuenta de prueba.
  const limitedOffering = offerings.find((item) => {
    const course = courses.find((c) => c.id === item.courseId);
    return course?.code === LIMITED_CAPACITY_COURSE;
  });
  const featured = accounts.find((item) => item.email === FEATURED_EMAILS[1]);
  if (limitedOffering && featured) {
    enrollments.push({
      id: generateId("MAT"),
      studentId: featured.id,
      offeringId: limitedOffering.id,
      periodId: "per-2026-2",
      status: "Matriculada",
      createdAt: new Date(Date.now() - DAY_MS * 3).toISOString(),
    });
  }

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

  writeList(STORAGE_KEYS.accounts, accounts);
  writeList(STORAGE_KEYS.admissions, [...applications, pendingApplication]);
  writeList(STORAGE_KEYS.enrollments, enrollments);
  writeList(STORAGE_KEYS.assignments, assignments);
  writeList(STORAGE_KEYS.assignmentGrades, assignmentGrades);


  const notifications: Notification[] = [
    {
      id: generateId("NOT"),
      audience: "*",
      title: "Admisiones 2026-2 abiertas",
      body: "Las inscripciones para el segundo semestre de 2026 están abiertas hasta el 30 de junio. Inicia tu proceso desde el portal.",
      type: "info",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + DAY_MS * 30).toISOString(),
    },
    {
      id: generateId("NOT"),
      audience: "Estudiante",
      title: "Periodo académico 2026-2 activo",
      body: "Ya puedes matricular tus materias para el segundo semestre. Tienes hasta 18 créditos por periodo.",
      type: "success",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + DAY_MS * 30).toISOString(),
    },
    {
      id: generateId("NOT"),
      audience: "Aspirante",
      title: "Documentos para admisión",
      body: "Recuerda tener a mano tu documento de identidad y resultados de pruebas Saber 11 al momento de radicar tu solicitud.",
      type: "warning",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + DAY_MS * 60).toISOString(),
    },
    {
      id: generateId("NOT"),
      audience: "Staff",
      title: "Nueva solicitud de admisión",
      body: "Jhanc Mesa radicó una solicitud para Administración de Empresas. Ya está disponible en el panel de admisiones.",
      type: "info",
      createdAt: new Date().toISOString(),
    },
  ];
  writeList(STORAGE_KEYS.notifications, notifications);

  const events: CampusEvent[] = [
    {
      id: generateId("EVT"),
      title: "Open Day: conoce Ingeniería de Sistemas",
      description: "Recorrido por laboratorios, charla con estudiantes y profesores, sesión de preguntas.",
      type: "Open Day",
      date: new Date(Date.now() + DAY_MS * 12).toISOString(),
      location: "Campus principal · Medellín",
      speaker: "Decanatura de Ingenierías",
      capacity: 80,
      enrolled: 47,
    },
    {
      id: generateId("EVT"),
      title: "Feria de posgrados y becas",
      description: "Conoce nuestras opciones de especialización y las becas disponibles para el segundo semestre.",
      type: "Feria",
      date: new Date(Date.now() + DAY_MS * 25).toISOString(),
      location: "Auditorio principal",
      speaker: "Oficina de Investigación",
      capacity: 150,
      enrolled: 92,
    },
    {
      id: generateId("EVT"),
      title: "Webinar: cómo financiar tu carrera",
      description: "Sesión informativa sobre becas, créditos y opciones de pago para nuevos estudiantes.",
      type: "Webinar",
      date: new Date(Date.now() + DAY_MS * 5).toISOString(),
      location: "Online (Zoom)",
      speaker: "Departamento Financiero",
      capacity: 300,
      enrolled: 178,
    },
    {
      id: generateId("EVT"),
      title: "Tour por la biblioteca y centros de estudio",
      description: "Recorrido guiado por nuestros espacios académicos y de bienestar.",
      type: "Tour",
      date: new Date(Date.now() + DAY_MS * 18).toISOString(),
      location: "Punto de encuentro: Plaza central",
      capacity: 40,
      enrolled: 23,
    },
  ];
  writeList(STORAGE_KEYS.events, events);

  const testimonials: Testimonial[] = [
    {
      id: "TST-1",
      name: "Carolina Mejía",
      programId: "prog-sistemas",
      graduationYear: 2022,
      currentRole: "Ingeniera de software",
      company: "Globant",
      quote: "La UNAC me dio las bases técnicas y humanas para crecer en una de las empresas tech más grandes de Latinoamérica.",
      initials: "CM",
    },
    {
      id: "TST-2",
      name: "Andrés Saldarriaga",
      programId: "prog-enfermeria",
      graduationYear: 2021,
      currentRole: "Jefe de enfermería",
      company: "Hospital Pablo Tobón Uribe",
      quote: "El enfoque de servicio y la formación práctica de la universidad me prepararon para liderar equipos en cuidados intensivos.",
      initials: "AS",
    },
    {
      id: "TST-3",
      name: "Daniela Restrepo",
      programId: "prog-admin",
      graduationYear: 2023,
      currentRole: "Consultora de estrategia",
      company: "McKinsey & Company",
      quote: "Las competencias de liderazgo y análisis que desarrollé durante la carrera son la base de mi trabajo como consultora.",
      initials: "DR",
    },
    {
      id: "TST-4",
      name: "Juan Pablo Castaño",
      programId: "prog-derecho",
      graduationYear: 2020,
      currentRole: "Abogado litigante",
      company: "Bufete propio",
      quote: "La formación ética y rigurosa de la facultad me permitió abrir mi propio bufete con clientes desde el primer año.",
      initials: "JC",
    },
  ];
  writeList(STORAGE_KEYS.testimonials, testimonials);

  const faq: FaqItem[] = [
    {
      id: "FAQ-1",
      category: "Admisiones",
      question: "¿Cuáles son los requisitos para admisión?",
      answer: "Necesitas ser bachiller, presentar tu documento de identidad, resultados de pruebas Saber 11 y completar el formulario de inscripción. Para algunos programas también se requiere una entrevista personal.",
    },
    {
      id: "FAQ-2",
      category: "Admisiones",
      question: "¿Cuándo son las inscripciones?",
      answer: "Las inscripciones para cada semestre están abiertas durante los meses de mayo y noviembre. Las fechas exactas se publican en la página principal y se anuncian por correo electrónico.",
    },
    {
      id: "FAQ-3",
      category: "Admisiones",
      question: "¿Puedo cambiar de carrera una vez admitido?",
      answer: "Sí. Desde tu perfil puedes solicitar un cambio de carrera. El equipo de admisiones evaluará tu caso y la disponibilidad de cupos en la nueva carrera.",
    },
    {
      id: "FAQ-4",
      category: "Matrícula",
      question: "¿Cuántos créditos puedo matricular por semestre?",
      answer: "El máximo es de 18 créditos por periodo académico. Algunos programas con cohortes especiales pueden tener reglas distintas.",
    },
    {
      id: "FAQ-5",
      category: "Matrícula",
      question: "¿Puedo homologar materias cursadas en otra universidad?",
      answer: "Sí, siempre que la materia sea equivalente en contenido y horas. Debes declararlas desde tu perfil en la sección Prerrequisitos y nuestro equipo académico las evaluará.",
    },
    {
      id: "FAQ-6",
      category: "Pagos",
      question: "¿Cuáles son las formas de pago?",
      answer: "Aceptamos pagos en línea con tarjeta de crédito o débito, transferencia bancaria y financiación directa con la universidad. También tenemos becas y descuentos por rendimiento.",
    },
    {
      id: "FAQ-7",
      category: "Pagos",
      question: "¿Hay becas disponibles?",
      answer: "Sí: becas por rendimiento académico, becas socioeconómicas y descuentos para hermanos y egresados. Consulta con la oficina financiera.",
    },
    {
      id: "FAQ-8",
      category: "Vida universitaria",
      question: "¿La universidad tiene campus?",
      answer: "Sí, contamos con un campus principal en Medellín con bibliotecas, laboratorios, zonas deportivas y residencia universitaria. Además organizamos actividades culturales, deportivas y de servicio comunitario.",
    },
    {
      id: "FAQ-9",
      category: "Académico",
      question: "¿Cuánto dura cada carrera?",
      answer: "La mayoría de nuestros pregrados duran entre 8 y 10 semestres (4 a 5 años). Los detalles específicos están en el pensum de cada programa.",
    },
    {
      id: "FAQ-10",
      category: "Académico",
      question: "¿Puedo estudiar dos carreras a la vez?",
      answer: "Sí, algunos estudiantes optan por doble programa. Consulta con tu decanatura los requisitos y la compatibilidad de horarios.",
    },
  ];
  writeList(STORAGE_KEYS.faq, faq);

  localStorage.setItem(STORAGE_KEYS.seeded, SCHEMA_VERSION);
}
