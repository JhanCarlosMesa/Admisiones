import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { registerApplicant } from "../services/auth.service";
import { isValidPassword } from "../utils/validators";
import { renderLoginView } from "./login.view";

function field(label: string, name: string, type: string): string {
  return `<label>${label}<input name="${name}" type="${type}" required><small class="field-error"></small></label>`;
}
function selectField(label: string, name: string, options: string[]): string {
  return `<label>${label}<select name="${name}" required><option value="">Selecciona una opción</option>${options
    .map((option) => `<option>${option}</option>`)
    .join("")}</select><small class="field-error"></small></label>`;
}

export function renderRegisterView(): void {
  renderShell(
    `<div class="content-grid"><section class="form-column"><div class="intro"><span class="eyebrow">Paso 1 de 3</span><h1>Crea tu cuenta de aspirante</h1><p>Registra tus datos para iniciar tu proceso de inscripción a la UNAC.</p></div><form id="registration-form" novalidate><div class="section-heading"><span>01</span><div><h2>Datos personales</h2><p>Cuéntanos cómo podemos identificarte.</p></div></div><div class="form-grid">${field("Nombre", "firstName", "text")}${field("Apellidos", "lastName", "text")}${selectField("Tipo de documento", "documentType", ["CC", "TI", "CE", "PAS"])}${field("Número de documento", "documentNumber", "text")}${field("Correo electrónico", "email", "email")}${field("Teléfono", "phone", "tel")}</div><div class="section-heading credentials-heading"><span>02</span><div><h2>Crea tu contraseña</h2><p>Usarás estos datos para ingresar al portal.</p></div></div><div class="form-grid">${field("Contraseña", "password", "password")}${field("Confirmar contraseña", "confirmPassword", "password")}</div><div class="password-hint">i &nbsp;Al menos 8 caracteres, una mayúscula, una minúscula y un número.</div><div id="form-message" class="form-message"></div><div class="form-footer"><p>Al continuar aceptas el tratamiento de tus datos personales.</p><button type="submit">Crear cuenta &rarr;</button></div></form></section><aside class="side-panel"><div class="aside-illustration"><span class="sun"></span><span class="illustration-person">&#9786;</span><span class="illustration-card"></span></div><h2>Tu proceso comienza aquí</h2><p>Completa tu registro y podrás continuar con tu solicitud de admisión.</p><div class="progress-list"><div class="progress-item active"><span>1</span><div><strong>Crear cuenta</strong><small>Datos del aspirante</small></div></div><div class="progress-item"><span>2</span><div><strong>Solicitud de admisión</strong><small>Elige tu programa</small></div></div><div class="progress-item"><span>3</span><div><strong>Matrícula</strong><small>Una vez seas admitido</small></div></div></div></aside></div>`,
    "Crear cuenta",
  );

  document.querySelector<HTMLFormElement>("#registration-form")!.addEventListener("submit", async (event) => {
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
      const item = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
      const text = item.value.trim() ? "" : "Este campo es obligatorio.";
      setFieldError(item, text);
      valid = valid && !text;
    });

    const emailField = form.elements.namedItem("email") as HTMLInputElement;
    if (emailField.value && !emailField.validity.valid) {
      setFieldError(emailField, "Ingresa un correo válido.");
      valid = false;
    }

    const password = String(data.get("password"));
    const confirm = String(data.get("confirmPassword"));
    if (!isValidPassword(password)) {
      setFieldError(
        form.elements.namedItem("password") as HTMLInputElement,
        "La contraseña no cumple los requisitos.",
      );
      valid = false;
    }
    if (password !== confirm) {
      setFieldError(
        form.elements.namedItem("confirmPassword") as HTMLInputElement,
        "Las contraseñas no coinciden.",
      );
      valid = false;
    }
    if (!valid) {
      setFormMessage("Revisa los campos marcados para continuar.", "error");
      return;
    }

    const result = await registerApplicant({
      firstName: String(data.get("firstName")),
      lastName: String(data.get("lastName")),
      documentType: String(data.get("documentType")),
      documentNumber: String(data.get("documentNumber")),
      email: String(data.get("email")),
      phone: String(data.get("phone")),
      password,
    });

    if (!result.ok) {
      setFormMessage(result.message, "error");
      return;
    }
    location.hash = "login";
    renderLoginView("Registro exitoso. Ahora puedes iniciar sesión.");
  });
}
