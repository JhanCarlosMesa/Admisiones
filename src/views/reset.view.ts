import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { resetPasswordWithToken, validateRecoveryToken } from "../services/auth.service";
import { isValidPassword } from "../utils/validators";
import { renderLoginView } from "./login.view";

export function renderResetView(token: string): void {
  const entry = validateRecoveryToken(token);

  if (!entry) {
    renderShell(
      `<section class="auth-layout"><section class="auth-card"><div class="intro"><span class="eyebrow">Enlace inválido</span><h1>Este enlace ya no es válido</h1><p>El enlace de recuperación expiró, ya fue usado, o no existe.</p></div><p class="switch-copy"><a href="#recovery">Solicitar un nuevo enlace</a></p></section></section>`,
      "Enlace inválido",
    );
    return;
  }

  renderShell(
    `<section class="auth-layout"><section class="auth-card"><div class="intro"><span class="eyebrow">Correo verificado</span><h1>Crea una nueva contraseña</h1><p>Define una contraseña nueva para volver a ingresar.</p></div><div class="recovery-notice">&#10003; Enlace válido para <strong>${entry.email}</strong></div><form id="reset-form" novalidate><label>Nueva contraseña<input name="password" type="password" required><small class="field-error"></small></label><label>Confirmar contraseña<input name="confirmPassword" type="password" required><small class="field-error"></small></label><div class="password-hint">i &nbsp;Al menos 8 caracteres, una mayúscula, una minúscula y un número.</div><div id="form-message" class="form-message"></div><button class="primary-button" type="submit">Guardar nueva contraseña &rarr;</button></form></section></section>`,
    "Nueva contraseña",
  );

  document.querySelector<HTMLFormElement>("#reset-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const passwordField = form.elements.namedItem("password") as HTMLInputElement;
    const confirmField = form.elements.namedItem("confirmPassword") as HTMLInputElement;

    let valid = true;
    if (!isValidPassword(passwordField.value)) {
      setFieldError(passwordField, "La contraseña no cumple los requisitos.");
      valid = false;
    }
    if (passwordField.value !== confirmField.value) {
      setFieldError(confirmField, "Las contraseñas no coinciden.");
      valid = false;
    }
    if (!valid) {
      setFormMessage("Revisa los campos marcados para continuar.", "error");
      return;
    }

    const result = await resetPasswordWithToken(token, passwordField.value);
    if (!result.ok) {
      setFormMessage(result.message, "error");
      return;
    }
    location.hash = "login";
    renderLoginView("Contraseña actualizada. Ya puedes iniciar sesión.");
  });
}
