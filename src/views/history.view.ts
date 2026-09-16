import type { Account } from "../types";
import { badgeClassForStatus, renderShell } from "../utils/dom";
import { getEnrollmentHistory } from "../services/enrollment.service";
import { getCourse, getOffering, getPeriod } from "../services/catalog.service";

export function renderHistoryView(account: Account): void {
  const history = getEnrollmentHistory(account.id);

  const periodIds = [...new Set(history.map((item) => item.periodId))];
  const sections = periodIds
    .map((periodId) => {
      const period = getPeriod(periodId);
      const rows = history
        .filter((item) => item.periodId === periodId)
        .map((item) => {
          const offering = getOffering(item.offeringId);
          const course = offering ? getCourse(offering.courseId) : undefined;
          return `<tr><td>${course?.name ?? "—"}</td><td>${course?.credits ?? "—"}</td><td>${
            offering ? `${offering.day}, ${offering.startTime}–${offering.endTime}` : "—"
          }</td><td><span class="${badgeClassForStatus(item.status)}">${item.status}</span></td></tr>`;
        })
        .join("");
      return `<h2 class="table-title">Periodo ${period?.name ?? periodId}</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Materia</th><th>Créditos</th><th>Horario</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .join("");

  renderShell(
    `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Historial</span><h1>Historial académico</h1><p>Consulta las materias que has cursado en cada periodo.</p></div></div>${
      sections || "<p>Aún no tienes materias matriculadas en periodos anteriores.</p>"
    }</section>`,
    "Historial académico",
    account,
  );
}
