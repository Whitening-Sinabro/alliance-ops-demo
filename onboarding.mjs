import { formatOnboardingDigest, onboardingSummary } from "./onboarding-engine.mjs";

const SAMPLE = [
  ["a1", "Solaris", "Ghost Clan", "EU", "new"], ["a2", "Moss", "Solo leader", "NA", "review"],
  ["a3", "Nova", "Moon Dojo", "APAC", "invited"], ["a4", "Rune", "Small clan", "EU", "joined"],
  ["a5", "Vega", "Returning group", "NA", "waitlist"], ["a6", "Willow", "Ghost Clan", "APAC", "new"],
];
let applications = SAMPLE.map(([id, name, group, timezone, status]) => ({ id, name, group, timezone, status }));
const rows = document.querySelector("#application-rows");
const output = document.querySelector("#onboarding-output");
const summary = document.querySelector("#onboarding-summary");
const communityName = document.querySelector("#community-name");

function render() {
  rows.innerHTML = applications.map((item) => `<tr><td><strong>${item.name}</strong><small>${item.group}</small></td><td>${item.timezone}</td><td><select data-application="${item.id}">${["new", "review", "invited", "joined", "waitlist", "declined"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></td></tr>`).join("");
  const state = onboardingSummary(applications);
  summary.textContent = `${state.total} applications · ${state.actionable} require action · ${state.counts.joined} joined`;
  output.value = formatOnboardingDigest({ communityName: communityName.value, applications });
}

rows.addEventListener("change", (event) => { const select = event.target.closest("[data-application]"); if (!select) return; applications = applications.map((item) => item.id === select.dataset.application ? { ...item, status: select.value } : item); render(); });
communityName.addEventListener("input", render);
document.querySelector("#reset-onboarding").addEventListener("click", () => { applications = SAMPLE.map(([id, name, group, timezone, status]) => ({ id, name, group, timezone, status })); render(); });
document.querySelector("#copy-onboarding").addEventListener("click", async () => { try { await navigator.clipboard.writeText(output.value); summary.textContent = "Digest copied."; } catch { output.focus(); output.select(); summary.textContent = "Select-all ready. Copy manually."; } });
render();
