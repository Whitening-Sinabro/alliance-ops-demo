import { buildAssignments, formatCheckInReminder, formatRoundAnnouncement } from "./tournament-engine.mjs";

const SAMPLE = [
  ["p1", "Aster", "Seoul Cards", "checked_in"], ["p2", "Bamboo", "Night Lobby", "checked_in"],
  ["p3", "Comet", "Seoul Cards", "checked_in"], ["p4", "Dune", "Solo", "pending"],
  ["p5", "Echo", "Night Lobby", "checked_in"], ["p6", "Flint", "Solo", "no_show"],
  ["p7", "Gale", "Busan League", "checked_in"], ["p8", "Halo", "Busan League", "waitlist"],
].map(([id, name, community, status], index) => ({ id, name, community, status, seed: index + 1 }));

const rows = document.querySelector("#entrant-rows");
const eventName = document.querySelector("#tournament-name");
const roundName = document.querySelector("#round-name");
const roomSize = document.querySelector("#room-size");
const output = document.querySelector("#tournament-output");
const summary = document.querySelector("#tournament-summary");
let entrants = structuredClone(SAMPLE);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderEntrants() {
  rows.innerHTML = entrants.map((entrant) => `<tr><td>${entrant.seed}</td><td><strong>${escapeHtml(entrant.name)}</strong><small>${escapeHtml(entrant.community || "Independent")}</small></td><td><select data-status="${entrant.id}" aria-label="${escapeHtml(entrant.name)} status">${[["checked_in", "Checked in"], ["pending", "Pending"], ["waitlist", "Waitlist"], ["no_show", "No-show"]].map(([value, label]) => `<option value="${value}" ${entrant.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></td></tr>`).join("");
}

function assignments() { return buildAssignments({ entrants, playersPerRoom: Number(roomSize.value), roomPrefix: "Room" }); }

function generate() {
  const result = assignments();
  output.value = formatRoundAnnouncement({ eventName: eventName.value, roundName: roundName.value, assignments: result });
  summary.textContent = `${result.confirmedCount} checked in · ${result.pending.length} pending · ${result.waitlist.length} waitlist · ${result.noShows.length} no-show`;
}

async function copyOutput() {
  if (!output.value) generate();
  try { await navigator.clipboard.writeText(output.value); summary.textContent = "Announcement copied."; }
  catch { output.focus(); output.select(); summary.textContent = "Select-all ready. Copy the announcement manually."; }
}

rows.addEventListener("change", (event) => { const select = event.target.closest("[data-status]"); if (!select) return; entrants = entrants.map((entrant) => entrant.id === select.dataset.status ? { ...entrant, status: select.value } : entrant); generate(); });
document.querySelector("#generate-rooms").addEventListener("click", generate);
document.querySelector("#copy-tournament-output").addEventListener("click", copyOutput);
document.querySelector("#checkin-reminder").addEventListener("click", () => { output.value = formatCheckInReminder({ eventName: eventName.value, entrants }); summary.textContent = "Pending check-in reminder prepared."; });
document.querySelector("#reset-tournament").addEventListener("click", () => { entrants = structuredClone(SAMPLE); renderEntrants(); generate(); });
for (const control of [roomSize, eventName, roundName]) control.addEventListener(control === roomSize ? "change" : "input", generate);

renderEntrants();
generate();
