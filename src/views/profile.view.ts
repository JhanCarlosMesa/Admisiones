import type { Account } from "../types";
import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { getAccounts, updateAccount } from "../services/auth.service";

export function renderProfileView(account: Account): void {
  renderShell(
    `<section class="profile-card"><div class="profile-header"><div><span class="eyebrow">Cuenta</span><h1>Mi perfil</h1><p>Actualiza tus datos de contacto.</p></div><span class="role-badge">${account.role}</span></div><form id="profile-form" class="profile-form"><div class="profile-edit-grid"><label>Nombre<input name="firstName" value="${account.firstName}" required><small class="field-error"></small></label><label>Apellidos<input name="lastName" value="${account.lastName}" required><small class="field-error"></small></label><label>Teléfono<input name="phone" value="${account.phone}" required><small class="field-error"></small></label><div class="profile-field locked"><span>Correo electrónico</span><strong>${account.email}</strong><small>Dato no modificable</small></div><div class="profile-field locked"><span>Documento</span><strong>${account.documentType} ${account.documentNumber}</strong><small>Dato no modificable</small></div></div><div id="form-message" class="form-message"></div><div class="profile-footer"><p>Tu información personal solo está disponible para tu cuenta.</p><a class="secondary-button" href="#home">Cancelar</a><button class="primary-button profile-save" type="submit">Guardar cambios</button></div></form></section>`,
    "Mi perfil",
    account,
  );

  document.querySelector<HTMLFormElement>("#profile-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const names = ["firstName", "lastName", "phone"];
    let valid = true;
    names.forEach((name) => {
      const field = form.elements.namedItem(name) as HTMLInputElement;
      const text = field.value.trim() ? "" : "Este campo es obligatorio.";
      setFieldError(field, text);
      valid = valid && !text;
    });
    if (!valid) {
      setFormMessage("Revisa los campos marcados para continuar.", "error");
      return;
    }
    const data = new FormData(form);
    const updated = updateAccount(account.id, {
      firstName: String(data.get("firstName")).trim(),
      lastName: String(data.get("lastName")).trim(),
      phone: String(data.get("phone")).trim(),
    });
    const refreshed = updated ?? getAccounts().find((item) => item.id === account.id);
    if (refreshed) renderProfileView(refreshed);
    setFormMessage("Tus datos se actualizaron correctamente.", "success");
  });
}
