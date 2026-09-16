import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { login } from "../services/auth.service";

export function renderLoginView(message = ""): void {
  renderShell(
    `<div class="auth-layout"><section class="auth-card"><div class="intro"><span class="eyebrow">Portal de admisiones</span><h1>Bienvenido de nuevo</h1><p>Ingresa para continuar con tu proceso de admisión o matrícula.</p></div><form id="login-form" novalidate><label>Correo electrónico<input name="email" type="email" autocomplete="email" required><small class="field-error"></small></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required><small class="field-error"></small></label><div class="login-options"><label class="check-label"><input name="remember" type="checkbox"> Mantener mi sesión</label><a href="#recovery">¿Olvidaste tu contraseña?</a></div><div id="form-message" class="form-message ${message ? "success" : ""}">${message}</div><button class="primary-button" type="submit">Iniciar sesión &rarr;</button><p class="switch-copy">¿Aún no tienes una cuenta? <a href="#register">Crear cuenta</a></p></form><div class="demo-hint"><strong>Cuentas de prueba:</strong><br>Aspirante: jhanc.mesae@unac.edu.co / Prueba12345<br>Estudiante: valentina.rojas@unac.edu.co / Estudiante123<br>Staff: admisiones@unac.edu.co / Admisiones2026</div></section><aside class="side-panel"><div class="aside-illustration"><span class="sun"></span><span class="illustration-person">&#9786;</span><span class="illustration-card"></span></div><h2>Tu futuro empieza aquí</h2><p>Accede a tu portal para gestionar tu inscripción o tu matrícula.</p></aside></div>`,
    "Inicio de sesión",
  );

  document.querySelector<HTMLFormElement>("#login-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const emailField = form.elements.namedItem("email") as HTMLInputElement;
    const passwordField = form.elements.namedItem("password") as HTMLInputElement;
    const rememberField = form.elements.namedItem("remember") as HTMLInputElement;

    let valid = true;
    [emailField, passwordField].forEach((field) => {
      const text = field.value.trim() ? "" : "Este campo es obligatorio.";
      setFieldError(field, text);
      valid = valid && !text;
    });
    if (!valid) {
      setFormMessage("Revisa los campos marcados para continuar.", "error");
      return;
    }

    const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
    submitButton.disabled = true;
    const result = await login(emailField.value, passwordField.value, rememberField.checked);
    submitButton.disabled = false;

    if (!result.ok) {
      setFormMessage(result.message, "error");
      return;
    }
    location.hash = "home";
  });
}
