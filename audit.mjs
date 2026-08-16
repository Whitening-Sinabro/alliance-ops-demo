import { buildActivityAudit, formatAuditReport } from "./audit-engine.mjs";

const SAMPLE = [
  ["m1", "Aster", 12, 12, 0], ["m2", "Bamboo", 12, 10, 0], ["m3", "Comet", 12, 8, 1],
  ["m4", "Dune", 12, 6, 2], ["m5", "Echo", 12, 4, 3], ["m6", "Flint", 12, 11, 1],
  ["m7", "Gale", 12, 7, 0], ["m8", "Halo", 12, 2, 4],
];
let members = SAMPLE.map(([id, name, expected, completed, missed]) => ({ id, name, expected, completed, missed }));
const rows = document.querySelector("#audit-rows");
const game = document.querySelector("#audit-game");
const period = document.querySelector("#audit-period");
const output = document.querySelector("#audit-output");
const summary = document.querySelector("#audit-summary");

function render() {
  const audit = buildActivityAudit(members);
  rows.innerHTML = audit.members.map((member) => `<tr><td><strong>${member.name}</strong><small>${member.status}</small></td><td><input data-field="completed" data-member="${member.id}" type="number" min="0" max="${member.expected}" value="${member.completed}"></td><td><input data-field="missed" data-member="${member.id}" type="number" min="0" value="${member.missed}"></td><td><span class="pill">${Math.round(member.rate * 100)}%</span></td></tr>`).join("");
  summary.textContent = `${audit.counts.good} good · ${audit.counts.review} review · ${audit.counts.inactive} inactive · average ${Math.round(audit.averageRate * 100)}%`;
  output.value = formatAuditReport({ game: game.value, period: period.value, audit });
}

rows.addEventListener("change", (event) => { const input = event.target.closest("[data-member]"); if (!input) return; members = members.map((member) => member.id === input.dataset.member ? { ...member, [input.dataset.field]: Number(input.value) } : member); render(); });
for (const control of [game, period]) control.addEventListener("input", render);
document.querySelector("#reset-audit").addEventListener("click", () => { members = SAMPLE.map(([id, name, expected, completed, missed]) => ({ id, name, expected, completed, missed })); render(); });
document.querySelector("#copy-audit").addEventListener("click", async () => { try { await navigator.clipboard.writeText(output.value); summary.textContent = "Audit report copied."; } catch { output.focus(); output.select(); summary.textContent = "Select-all ready. Copy manually."; } });
render();
