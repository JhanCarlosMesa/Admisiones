import "./style.css";

type Applicant = {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  password: string;
  role: "Aspirante";
};
type Admission = {
  id: string;
  applicantEmail: string;
  program: string;
  level: string;
  city: string;
  modality: string;
  motivation: string;
  status: string;
  createdAt: string;
};
const app = document.querySelector<HTMLDivElement>("#app")!;
const accountsKey = "unac-applicants";
const sessionKey = "unac-session";
const admissionsKey = "unac-admissions";

function accounts(): Applicant[] {
  try {
    return JSON.parse(localStorage.getItem(accountsKey) ?? "[]") as Applicant[];
  } catch {
    return [];
  }
}
function currentApplicant(): Applicant | undefined {
  const raw =
    sessionStorage.getItem(sessionKey) ?? localStorage.getItem(sessionKey);
  if (!raw) return undefined;
  try {
    return accounts().find(
      (item) => item.email === (JSON.parse(raw) as { email: string }).email,
    );
  } catch {
    return undefined;
  }
}
function shell(content: string, title: string): void {
  app.innerHTML = `<header class="topbar"><a class="brand" href="#public" aria-label="UNAC, inicio"><span class="brand-mark" aria-hidden="true">A</span><span>UNAC</span></a><div class="topbar-context"><span class="secure-dot"></span>Portal seguro de admisiones</div></header><main class="page-shell"><nav class="breadcrumbs"><a href="#public">Inicio</a><span>/</span><strong>${title}</strong></nav>${content}</main><footer><span>&copy; 2026 UNAC</span><span>Admisiones <b>&bull;</b> Privacidad</span></footer>`;
}
function error(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  text: string,
): void {
  field.classList.toggle("invalid", Boolean(text));
  const target =
    field.parentElement?.querySelector<HTMLElement>(".field-error");
  if (target) target.textContent = text;
}
function feedback(text: string, type: "error" | "success"): void {
  const target = document.querySelector<HTMLElement>("#form-message");
  if (target) {
    target.className = `form-message ${type}`;
    target.textContent = text;
  }
}

function renderPublic(): void {
  const applicant = currentApplicant();
  const action = applicant
    ? '<button class="enroll-button" type="button">Inscribirme &rarr;</button>'
    : '<span class="program-note">Inicia sesi&oacute;n para inscribirte</span>';
  shell(
    `<section class="public-hero"><div><span class="eyebrow">Universidad Adventista de Colombia</span><h1>Tu pr&oacute;ximo paso empieza aqu&iacute;</h1><p>Encuentra el programa que transformar&aacute; tu vocaci&oacute;n en una carrera con prop&oacute;sito.</p><div class="hero-actions">${applicant ? '<a class="primary-button hero-button" href="#home">Ir a mi portal &rarr;</a>' : '<a class="primary-button hero-button" href="#login">Iniciar sesi&oacute;n &rarr;</a><a class="outline-button" href="#register">Crear cuenta</a>'}</div></div><div class="hero-art"><span class="art-sun"></span><span class="art-building"></span><span class="art-window window-one"></span><span class="art-window window-two"></span></div></section><section class="programs-section"><div class="section-intro"><div><span class="eyebrow">Oferta acad&eacute;mica</span><h2>Programas para construir tu futuro</h2></div><span class="program-count">4 programas disponibles</span></div><div class="study-tools"><label class="study-search"><span>&#128269;</span><input id="program-search" type="search" placeholder="Escribe el nombre de la carrera que te interesa..." aria-label="Buscar programas"></label><div class="study-filters"><button class="filter-active" data-filter="all">Todos</button><button data-filter="Pregrado">Pregrado</button><button data-filter="Posgrado">Posgrado</button><button data-filter="Virtual">Virtual</button></div></div><div class="program-grid">${programCard("program-coral", "Administraci&oacute;n de Empresas", "Desarrolla tu visi&oacute;n para liderar organizaciones con &eacute;tica e innovaci&oacute;n.", "8 semestres", action)}${programCard("program-teal", "Ingenier&iacute;a de Sistemas", "Convierte ideas en soluciones tecnol&oacute;gicas que impactan el mundo.", "10 semestres", action)}${programCard("program-gold", "Contadur&iacute;a P&uacute;blica", "Domina la informaci&oacute;n financiera para tomar decisiones responsables.", "9 semestres", action)}${programCard("program-blue", "Licenciatura en Educaci&oacute;n", "Forma experiencias de aprendizaje que dejan huella.", "8 semestres", action)}</div></section><section class="value-strip"><div><strong>Formaci&oacute;n integral</strong><span>Aprende con prop&oacute;sito y valores.</span></div><div><strong>Comunidad UNAC</strong><span>Crece junto a una comunidad que te acompa&ntilde;a.</span></div><div><strong>Acompa&ntilde;amiento</strong><span>Estamos contigo en cada etapa.</span></div></section>`,
    "Inicio",
  );
  const search = document.querySelector<HTMLInputElement>("#program-search");
  const cards = [...document.querySelectorAll<HTMLElement>(".program-card")];
  const filters = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-filter]"),
  ];
  const apply = (filter: string, query: string) =>
    cards.forEach((card) => {
      card.hidden =
        !(filter === "all" || card.dataset.level === filter) ||
        !card.textContent?.toLowerCase().includes(query.toLowerCase());
    });
  search?.addEventListener("input", () =>
    apply(
      document.querySelector<HTMLButtonElement>(".filter-active")?.dataset
        .filter ?? "all",
      search.value,
    ),
  );
  filters.forEach((button) =>
    button.addEventListener("click", () => {
      filters.forEach((item) => item.classList.remove("filter-active"));
      button.classList.add("filter-active");
      apply(button.dataset.filter ?? "all", search?.value ?? "");
    }),
  );
  document
    .querySelectorAll<HTMLButtonElement>(".enroll-button")
    .forEach((button) =>
      button.addEventListener("click", () => {
        location.hash = "enrollment";
      }),
    );
}
function programCard(
  style: string,
  name: string,
  description: string,
  duration: string,
  action: string,
): string {
  return `<article class="program-card ${style}" data-level="Pregrado"><span class="program-tag">Pregrado</span><h3>${name}</h3><p>${description}</p><div class="program-meta"><span>${duration}</span><span>Presencial</span></div>${action}</article>`;
}

function renderLogin(message = ""): void {
  shell(
    `<div class="auth-layout"><section class="auth-card"><div class="intro"><span class="eyebrow">Portal de admisiones</span><h1>Bienvenido de nuevo</h1><p>Ingresa para continuar con tu proceso de admisi&oacute;n.</p></div><form id="login-form" novalidate><label>Correo electr&oacute;nico<input name="email" type="email" autocomplete="email" required><small class="field-error"></small></label><label>Contrase&ntilde;a<input name="password" type="password" autocomplete="current-password" required><small class="field-error"></small></label><div class="login-options"><label class="check-label"><input name="remember" type="checkbox"> Mantener mi sesi&oacute;n</label><a href="#recovery">&iquest;Olvidaste tu contrase&ntilde;a?</a></div><div id="form-message" class="form-message ${message ? "success" : ""}">${message}</div><button class="primary-button" type="submit">Iniciar sesi&oacute;n &rarr;</button><p class="switch-copy">&iquest;A&uacute;n no tienes una cuenta? <a href="#register">Crear cuenta</a></p></form></section><aside class="side-panel"><div class="aside-illustration"><span class="sun"></span><span class="illustration-person">&#9786;</span><span class="illustration-card"></span></div><h2>Tu futuro empieza aqu&iacute;</h2><p>Accede a tu portal para gestionar tu inscripci&oacute;n.</p><div class="login-perks">&#10003; Consulta el estado de tu solicitud<br>&#10003; Contin&uacute;a tu proceso cuando quieras</div></aside></div>`,
    "Inicio de sesi&oacute;n",
  );
  document
    .querySelector<HTMLFormElement>("#login-form")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const email = (form.elements.namedItem("email") as HTMLInputElement).value
        .trim()
        .toLowerCase();
      const password = (form.elements.namedItem("password") as HTMLInputElement)
        .value;
      const emailField = form.elements.namedItem("email") as HTMLInputElement;
      const passwordField = form.elements.namedItem(
        "password",
      ) as HTMLInputElement;
      let valid = true;
      [emailField, passwordField].forEach((field) => {
        const text = field.value ? "" : "Este campo es obligatorio.";
        error(field, text);
        valid = valid && !text;
      });
      if (!valid) {
        feedback("Revisa los campos marcados para continuar.", "error");
        return;
      }
      const applicant = accounts().find(
        (item) => item.email === email && item.password === password,
      );
      if (!applicant) {
        feedback("El correo o la contrase&ntilde;a no son correctos.", "error");
        return;
      }
      const session = JSON.stringify({
        email: applicant.email,
        role: applicant.role,
      });
      if ((form.elements.namedItem("remember") as HTMLInputElement).checked)
        localStorage.setItem(sessionKey, session);
      else sessionStorage.setItem(sessionKey, session);
      location.hash = "home";
    });
}

function renderHome(applicant: Applicant): void {
  shell(
    `<section class="welcome-card"><span class="eyebrow">Portal de aspirante</span><h1>Hola, ${applicant.firstName} &#128075;</h1><p>Bienvenido a tu portal de admisiones UNAC.</p><div class="home-actions"><article><span class="action-icon">01</span><div><h2>Iniciar inscripci&oacute;n</h2><p>Comienza tu proceso para ingresar a la universidad.</p><button class="primary-button" id="start-enrollment">Continuar &rarr;</button></div></article><article><span class="action-icon">02</span><div><h2>Mis tr&aacute;mites</h2><p>Consulta el estado de tus solicitudes y documentos.</p><button class="secondary-button" type="button">Ver tr&aacute;mites</button></div></article></div><div class="portal-actions"><a class="profile-link" href="#profile"><span class="profile-icon">&#128100;</span><span><strong>Mi perfil</strong><small>Consulta tus datos personales</small></span><span>&rarr;</span></a><button id="logout" class="logout-button" type="button">Cerrar sesi&oacute;n</button></div></section>`,
    "Inicio",
  );
  document
    .querySelector<HTMLButtonElement>("#start-enrollment")!
    .addEventListener("click", () => {
      location.hash = "enrollment";
    });
  document
    .querySelector<HTMLButtonElement>("#logout")!
    .addEventListener("click", () => {
      sessionStorage.removeItem(sessionKey);
      localStorage.removeItem(sessionKey);
      location.hash = "login";
    });
}

function renderRegistration(): void {
  shell(
    `<div class="content-grid"><section class="form-column"><div class="intro"><span class="eyebrow">Paso 1 de 3</span><h1>Crea tu cuenta de aspirante</h1><p>Registra tus datos para iniciar tu proceso de inscripci&oacute;n a la UNAC.</p></div><form id="registration-form" novalidate><div class="section-heading"><span>01</span><div><h2>Datos personales</h2><p>Cu&eacute;ntanos c&oacute;mo podemos identificarte.</p></div></div><div class="form-grid">${field("Nombre", "firstName", "text")}${field("Apellidos", "lastName", "text")}${selectField("Tipo de documento", "documentType", ["CC", "TI", "CE", "PAS"])}${field("N&uacute;mero de documento", "documentNumber", "text")}${field("Correo electr&oacute;nico", "email", "email")}${field("Tel&eacute;fono", "phone", "tel")}</div><div class="section-heading credentials-heading"><span>02</span><div><h2>Crea tu contrase&ntilde;a</h2><p>Usar&aacute;s estos datos para ingresar al portal.</p></div></div><div class="form-grid">${field("Contrase&ntilde;a", "password", "password")}${field("Confirmar contrase&ntilde;a", "confirmPassword", "password")}</div><div class="password-hint">i &nbsp;Al menos 8 caracteres, una may&uacute;scula, una min&uacute;scula y un n&uacute;mero.</div><div id="form-message" class="form-message"></div><div class="form-footer"><p>Al continuar aceptas el tratamiento de tus datos personales.</p><button type="submit">Crear cuenta &rarr;</button></div></form></section><aside class="side-panel"><div class="aside-illustration"><span class="sun"></span><span class="illustration-person">&#9786;</span><span class="illustration-card"></span></div><h2>Tu proceso comienza aqu&iacute;</h2><p>Completa tu registro y podr&aacute;s continuar con tu solicitud.</p><div class="progress-list"><div class="progress-item active"><span>1</span><div><strong>Crear cuenta</strong><small>Datos del aspirante</small></div></div><div class="progress-item"><span>2</span><div><strong>Inscripci&oacute;n</strong><small>Elige tu programa</small></div></div><div class="progress-item"><span>3</span><div><strong>Seguimiento</strong><small>Consulta el estado</small></div></div></div></aside></div>`,
    "Crear cuenta",
  );
  document
    .querySelector<HTMLFormElement>("#registration-form")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const names = [
        "firstName",
        "lastName",
        "documentType",
        "documentNumber",
        "email",
        "phone",
        "password",
        "confirmPassword",
      ];
      let valid = true;
      names.forEach((name) => {
        const item = form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLSelectElement;
        const text = item.value.trim() ? "" : "Este campo es obligatorio.";
        error(item, text);
        valid = valid && !text;
      });
      const email = String(data.get("email")).trim().toLowerCase();
      const documentNumber = String(data.get("documentNumber")).trim();
      const password = String(data.get("password"));
      const confirm = String(data.get("confirmPassword"));
      const emailField = form.elements.namedItem("email") as HTMLInputElement;
      if (emailField.value && !emailField.validity.valid) {
        error(emailField, "Ingresa un correo v&aacute;lido.");
        valid = false;
      }
      if (
        accounts().some(
          (item) =>
            item.email === email || item.documentNumber === documentNumber,
        )
      ) {
        feedback("El correo o documento ya est&aacute; registrado.", "error");
        valid = false;
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        error(
          form.elements.namedItem("password") as HTMLInputElement,
          "La contrase&ntilde;a no cumple los requisitos.",
        );
        valid = false;
      }
      if (password !== confirm) {
        error(
          form.elements.namedItem("confirmPassword") as HTMLInputElement,
          "Las contrase&ntilde;as no coinciden.",
        );
        valid = false;
      }
      if (!valid) {
        feedback("Revisa los campos marcados para continuar.", "error");
        return;
      }
      const applicant: Applicant = {
        firstName: String(data.get("firstName")),
        lastName: String(data.get("lastName")),
        documentType: String(data.get("documentType")),
        documentNumber,
        email,
        phone: String(data.get("phone")),
        password,
        role: "Aspirante",
      };
      localStorage.setItem(
        accountsKey,
        JSON.stringify([...accounts(), applicant]),
      );
      location.hash = "login";
      renderLogin("Registro exitoso. Ahora puedes iniciar sesi&oacute;n.");
    });
}
function field(label: string, name: string, type: string): string {
  return `<label>${label}<input name="${name}" type="${type}" required><small class="field-error"></small></label>`;
}
function selectField(label: string, name: string, options: string[]): string {
  return `<label>${label}<select name="${name}" required><option value="">Selecciona una opci&oacute;n</option>${options.map((option) => `<option>${option}</option>`).join("")}</select><small class="field-error"></small></label>`;
}

function renderRecovery(): void {
  shell(
    `<section class="auth-layout"><section class="auth-card"><div class="intro"><span class="eyebrow">Recupera tu acceso</span><h1>Restablece tu contrase&ntilde;a</h1><p>Ingresa el correo asociado a tu cuenta.</p></div><form id="recovery-form"><label>Correo electr&oacute;nico<input name="email" type="email" required><small class="field-error"></small></label><div id="form-message" class="form-message"></div><button class="primary-button" type="submit">Enviar instrucciones &rarr;</button><p class="switch-copy"><a href="#login">Volver al inicio de sesi&oacute;n</a></p></form></section><aside class="side-panel"><h2>Recupera el control</h2><p>Te ayudaremos a volver a tu proceso de admisi&oacute;n.</p></aside></section>`,
    "Recuperar contrase&ntilde;a",
  );
  document
    .querySelector<HTMLFormElement>("#recovery-form")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const emailField = form.elements.namedItem("email") as HTMLInputElement;
      const email = emailField.value.trim().toLowerCase();
      if (!email || !emailField.validity.valid) {
        error(emailField, "Ingresa un correo v&aacute;lido.");
        feedback("Revisa los campos marcados para continuar.", "error");
        return;
      }
      if (!accounts().some((item) => item.email === email)) {
        feedback("No encontramos una cuenta asociada a este correo.", "error");
        return;
      }
      renderReset(email);
    });
}
function renderReset(email: string): void {
  shell(
    `<section class="auth-layout"><section class="auth-card"><div class="intro"><span class="eyebrow">Correo verificado</span><h1>Crea una nueva contrase&ntilde;a</h1><p>Define una contrase&ntilde;a nueva para volver a ingresar.</p></div><div class="recovery-notice">&#10003; Instrucciones enviadas a <strong>${email}</strong></div><form id="reset-form"><label>Nueva contrase&ntilde;a<input name="password" type="password" required><small class="field-error"></small></label><label>Confirmar contrase&ntilde;a<input name="confirmPassword" type="password" required><small class="field-error"></small></label><div class="password-hint">i &nbsp;Al menos 8 caracteres, una may&uacute;scula, una min&uacute;scula y un n&uacute;mero.</div><div id="form-message" class="form-message"></div><button class="primary-button" type="submit">Guardar nueva contrase&ntilde;a &rarr;</button></form></section></section>`,
    "Nueva contrase&ntilde;a",
  );
  document
    .querySelector<HTMLFormElement>("#reset-form")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const password = (form.elements.namedItem("password") as HTMLInputElement)
        .value;
      const confirm = (
        form.elements.namedItem("confirmPassword") as HTMLInputElement
      ).value;
      let valid = true;
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        error(
          form.elements.namedItem("password") as HTMLInputElement,
          "La contrase&ntilde;a no cumple los requisitos.",
        );
        valid = false;
      }
      if (password !== confirm) {
        error(
          form.elements.namedItem("confirmPassword") as HTMLInputElement,
          "Las contrase&ntilde;as no coinciden.",
        );
        valid = false;
      }
      if (!valid) {
        feedback("Revisa los campos marcados para continuar.", "error");
        return;
      }
      localStorage.setItem(
        accountsKey,
        JSON.stringify(
          accounts().map((item) =>
            item.email === email ? { ...item, password } : item,
          ),
        ),
      );
      renderLogin(
        "Contrase&ntilde;a actualizada. Ya puedes iniciar sesi&oacute;n.",
      );
    });
}
function renderProfile(applicant: Applicant): void {
  shell(
    `<section class="profile-card"><div class="profile-header"><div><span class="eyebrow">Cuenta de aspirante</span><h1>Mi perfil</h1><p>Actualiza tus datos de contacto.</p></div><span class="role-badge">${applicant.role}</span></div><form id="profile-form" class="profile-form"><div class="profile-edit-grid"><label>Nombre<input name="firstName" value="${applicant.firstName}" required><small class="field-error"></small></label><label>Apellidos<input name="lastName" value="${applicant.lastName}" required><small class="field-error"></small></label><label>Tel&eacute;fono<input name="phone" value="${applicant.phone}" required><small class="field-error"></small></label><div class="profile-field locked"><span>Correo electr&oacute;nico</span><strong>${applicant.email}</strong><small>Dato no modificable</small></div><div class="profile-field locked"><span>Documento</span><strong>${applicant.documentType} ${applicant.documentNumber}</strong><small>Dato no modificable</small></div></div><div id="form-message" class="form-message"></div><div class="profile-footer"><p>Tu informaci&oacute;n personal solo est&aacute; disponible para tu cuenta.</p><a class="secondary-button" href="#home">Cancelar</a><button class="primary-button profile-save" type="submit">Guardar cambios</button></div></form></section>`,
    "Mi perfil",
  );
  document
    .querySelector<HTMLFormElement>("#profile-form")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const names = ["firstName", "lastName", "phone"];
      let valid = true;
      names.forEach((name) => {
        const field = form.elements.namedItem(name) as HTMLInputElement;
        const text = field.value.trim() ? "" : "Este campo es obligatorio.";
        error(field, text);
        valid = valid && !text;
      });
      if (!valid) {
        feedback("Revisa los campos marcados para continuar.", "error");
        return;
      }
      const data = new FormData(form);
      const updated = accounts().map((item) =>
        item.email === applicant.email
          ? {
              ...item,
              firstName: String(data.get("firstName")).trim(),
              lastName: String(data.get("lastName")).trim(),
              phone: String(data.get("phone")).trim(),
            }
          : item,
      );
      localStorage.setItem(accountsKey, JSON.stringify(updated));
      renderProfile(updated.find((item) => item.email === applicant.email)!);
      feedback("Tus datos se actualizaron correctamente.", "success");
    });
}
function renderEnrollment(applicant: Applicant): void {
  shell(
    `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Nueva solicitud</span><h1>Inicia tu inscripci&oacute;n</h1><p>Completa la informaci&oacute;n para comenzar.</p></div><span class="step-badge">Paso 1 de 3</span></div><form id="enrollment-form" class="enrollment-form"><div class="section-heading"><span>01</span><div><h2>Elige tu programa</h2><p>Selecciona la opci&oacute;n acad&eacute;mica.</p></div></div><div class="form-grid"><label>Programa acad&eacute;mico${selectField("", "program", ["Administraci&oacute;n de Empresas", "Ingenier&iacute;a de Sistemas", "Contadur&iacute;a P&uacute;blica", "Licenciatura en Educaci&oacute;n"]).replace("<label>", "<select-label>").replace("</label>", "</select-label>")}</label><label>Nivel acad&eacute;mico<select name="level" required><option value="">Selecciona un nivel</option><option>Pregrado</option><option>Posgrado</option></select><small class="field-error"></small></label><label>Ciudad de residencia<input name="city" required><small class="field-error"></small></label><label>Modalidad<select name="modality" required><option value="">Selecciona una modalidad</option><option>Presencial</option><option>Virtual</option></select><small class="field-error"></small></label></div><div class="section-heading credentials-heading"><span>02</span><div><h2>Cu&eacute;ntanos sobre ti</h2><p>Esta informaci&oacute;n nos ayuda a conocerte.</p></div></div><label class="wide-label">Motivaci&oacute;n<textarea name="motivation" rows="4" required></textarea><small class="field-error"></small></label><div id="form-message" class="form-message"></div><div class="enrollment-footer"><a class="secondary-button" href="#home">Cancelar</a><button class="primary-button" type="submit">Crear solicitud &rarr;</button></div></form></section>`,
    "Iniciar inscripci&oacute;n",
  );
  const form = document.querySelector<HTMLFormElement>("#enrollment-form")!;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const names = ["program", "level", "city", "modality", "motivation"];
    let valid = true;
    names.forEach((name) => {
      const field = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      const text = field.value.trim() ? "" : "Este campo es obligatorio.";
      error(field, text);
      valid = valid && !text;
    });
    if (!valid) {
      feedback("Revisa los campos marcados para continuar.", "error");
      return;
    }
    const request: Admission = {
      id: `ADM-${Date.now().toString().slice(-6)}`,
      applicantEmail: applicant.email,
      program: String(data.get("program")),
      level: String(data.get("level")),
      city: String(data.get("city")),
      modality: String(data.get("modality")),
      motivation: String(data.get("motivation")),
      status: "Radicada",
      createdAt: new Date().toISOString(),
    };
    const list = JSON.parse(
      localStorage.getItem(admissionsKey) ?? "[]",
    ) as Admission[];
    localStorage.setItem(admissionsKey, JSON.stringify([...list, request]));
    feedback(`Solicitud ${request.id} creada correctamente.`, "success");
    form.reset();
  });
}

function seedTestApplicant(): void {
  const email = "jhanc.mesae@unac.edu.co";
  if (accounts().some((item) => item.email === email)) return;
  localStorage.setItem(
    accountsKey,
    JSON.stringify([
      ...accounts(),
      {
        firstName: "Jhanc",
        lastName: "Mesa",
        documentType: "CC",
        documentNumber: "TEST-JHANC-001",
        email,
        phone: "3000000000",
        password: "Prueba12345",
        role: "Aspirante",
      },
    ]),
  );
}
function route(): void {
  const applicant = currentApplicant();
  if (location.hash === "#register") renderRegistration();
  else if (location.hash === "#login") renderLogin();
  else if (location.hash === "#recovery") renderRecovery();
  else if (location.hash === "#home" && applicant) renderHome(applicant);
  else if (location.hash === "#profile" && applicant) renderProfile(applicant);
  else if (location.hash === "#enrollment" && applicant)
    renderEnrollment(applicant);
  else renderPublic();
}
window.addEventListener("hashchange", route);
seedTestApplicant();
route();
