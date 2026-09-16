import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { requestPasswordRecovery } from "../services/auth.service";

export function renderRecoveryView(): void {
  renderShell(
    `<section class="auth-layout"><section class="auth-card"><div class="intro"><span class="eyebrow">Recupera tu acceso</span><h1>Restablece tu contraseña</h1><p>Ingresa el correo asociado a tu cuenta y te enviaremos instrucciones.</p></div><form id="recovery-form" novalidate><label>Correo electrónico<input name="email" type="email" required><small class="field-error"></small></label><div id="form-message" class="form-message"></div><button class="primary-button" type="submit">Enviar instrucciones &rarr;</button><p class="switch-copy"><a href="#login">Volver al inicio de sesión</a></p></form><div id="recovery-result"></div></section><aside class="side-panel"><h2>Recupera el control</h2><p>Te ayudaremos a volver a tu proceso de admisión o matrícula de forma segura.</p><p class="side-note">El enlace de recuperación es válido por 30 minutos y solo puede usarse una vez.</p></aside></section>`,
    "Recuperar contraseña",
  );

  document.querySelector<HTMLFormElement>("#recovery-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const emailField = form.elements.namedItem("email") as HTMLInputElement;
    const email = emailField.value.trim().toLowerCase();

    if (!email || !emailField.validity.valid) {
      setFieldError(emailField, "Ingresa un correo válido.");
      setFormMessage("Revisa los campos marcados para continuar.", "error");
      return;
    }

    const result = requestPasswordRecovery(email);
    if (!result.ok) {
      setFormMessage(result.message, "error");
      return;
    }

    setFormMessage("Hemos generado tus instrucciones de recuperación.", "success");
    const resultBox = document.querySelector<HTMLElement>("#recovery-result")!;
    const resetLink = `${location.origin}${location.pathname}#reset?token=${result.token}`;
    resultBox.innerHTML = `<div class="recovery-notice"><p><strong>Simulación de correo:</strong> como este proyecto no tiene un servidor de correo real, aquí está el enlace que normalmente llegaría a tu bandeja de entrada.</p><a class="primary-button" href="#reset?token=${result.token}">Abrir enlace de recuperación &rarr;</a><small class="recovery-link">${resetLink}</small></div>`;
  });
}
