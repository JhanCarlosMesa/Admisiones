import type { Account } from "../types";
import { renderShell } from "../utils/dom";
import { currentAccount } from "../services/auth.service";
import { getProgram } from "../services/catalog.service";
import { renderCurriculumContent } from "../utils/curriculum";

export function renderPensumView(programId: string): void {
  const program = getProgram(programId);
  if (!program) {
    location.hash = "public";
    return;
  }

  const account: Account | undefined = currentAccount();
  const cta = account
    ? account.role === "Aspirante"
      ? { href: "#enrollment", label: "Inscribirme a este programa →" }
      : null
    : { href: "#login", label: "Iniciar sesión para inscribirme →" };

  renderShell(
    renderCurriculumContent(program, cta ?? undefined),
    program.name,
    account,
  );

  // Update hash so the URL is shareable without #pensum?id=...
  const cleanHash = `#pensum/${program.id}`;
  if (location.hash !== cleanHash) {
    history.replaceState(null, "", cleanHash);
    document.title = `${program.name} · Pensum académico · UNAC`;
  }
}
