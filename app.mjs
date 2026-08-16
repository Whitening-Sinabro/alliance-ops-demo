import { GAME_TEMPLATES, applyAttendance, buildRoster, explainPriority, formatRosterAnnouncement } from "./engine.mjs";
import { parseRosterCsv, serializeRosterCsv } from "./csv.mjs";
import { applyResponseSlips, createResponseSlip, parseResponseSlips } from "./intake.mjs";
import { defaultRolePolicies, requiredRolesFor, validateRolePolicies } from "./policy.mjs";
import { EMPTY_ROUND, clearState, loadState, saveState } from "./state.mjs";

const SAMPLE_ROUND = 6;

const sampleNames = [
  "Aurora", "Bamboo", "Comet", "Dune", "Echo", "Flint", "Gale", "Halo", "Ion", "Jade",
  "Kestrel", "Lotus", "Mica", "Nova", "Onyx", "Pine", "Quartz", "Rune", "Sol", "Tundra",
  "Umber", "Vale", "Willow", "Xenon", "Yarrow", "Zephyr", "Aster", "Birch", "Cobalt", "Delta",
  "Elm", "Fjord", "Glint", "Haven", "Indigo", "Juniper", "Kite", "Lumen", "Moss", "Nimbus",
  "Opal", "Prairie", "Quill", "Reef", "Sable", "Thorn", "Unity", "Vega", "Wren", "Yonder",
];

const sampleMembers = sampleNames.map((name, index) => {
  const roles = [];
  if (index % 13 === 0) roles.push("rally_lead");
  if (index % 3 === 0) roles.push("defense");
  if (index % 7 === 1) roles.push("garrison");
  if (index % 2 === 0) roles.push("field");
  const selectionCount = index % 4;
  return {
    id: `m${index + 1}`,
    name,
    power: Number((150 - index * 1.7).toFixed(1)),
    roles,
    selectionCount,
    noShowCount: index > 0 && index % 11 === 0 ? 1 : 0,
    lastSelectedRound: selectionCount ? 1 + (index % 5) : null,
  };
});

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = browserStorage();
const restoredState = loadState(storage);
let members = restoredState.members;
let availabilityIds = new Set(restoredState.availabilityIds);
let respondedIds = new Set(restoredState.respondedIds);
let rolePolicies = restoredState.rolePolicies;

let currentRoster = null;
let round = restoredState.round;

const gameSelect = document.querySelector("#game");
const eventTitle = document.querySelector("#event-title");
const signupBody = document.querySelector("#signup-body");
const rosterPanel = document.querySelector("#roster-panel");
const generateButton = document.querySelector("#generate");
const attendanceButton = document.querySelector("#attendance");
const csvInput = document.querySelector("#csv-input");
const csvStatus = document.querySelector("#csv-status");
const importButton = document.querySelector("#import-csv");
const exportButton = document.querySelector("#export-csv");
const sampleButton = document.querySelector("#load-sample");
const resetButton = document.querySelector("#reset-state");
const storageStatus = document.querySelector("#storage-status");
const responseMember = document.querySelector("#response-member");
const responseAvailability = document.querySelector("#response-availability");
const createResponseButton = document.querySelector("#create-response");
const responseOutput = document.querySelector("#response-output");
const responseBatch = document.querySelector("#response-batch");
const applyResponsesButton = document.querySelector("#apply-responses");
const clearAvailabilityButton = document.querySelector("#clear-availability");
const intakeStatus = document.querySelector("#intake-status");
const rolePolicyFields = document.querySelector("#role-policy-fields");
const applyRolePolicyButton = document.querySelector("#apply-role-policy");
const resetRolePolicyButton = document.querySelector("#reset-role-policy");
const rolePolicyStatus = document.querySelector("#role-policy-status");

function showStorageStatus(message, kind = "muted") {
  storageStatus.textContent = message;
  storageStatus.className = `${kind} inline-status`;
}

function persistState(message) {
  const result = saveState(storage, {
    members,
    round,
    availabilityIds: [...availabilityIds],
    respondedIds: [...respondedIds],
    rolePolicies,
  });
  if (result.ok) {
    showStorageStatus(message ?? `Saved round ${round} · ${members.length} members.`, "success");
  } else {
    showStorageStatus(`Not saved: ${result.error}`, "warning");
  }
  return result.ok;
}

function currentTemplate() {
  return GAME_TEMPLATES[gameSelect.value];
}

function roleLabels() {
  const labels = new Map();
  for (const template of Object.values(GAME_TEMPLATES)) {
    for (const role of template.roles) labels.set(role.key, role.label);
  }
  return labels;
}

const allRoleLabels = roleLabels();

function renderSignups() {
  if (members.length === 0) {
    signupBody.innerHTML = `<tr><td colspan="6" class="empty-row"><strong>No saved roster</strong><small>Import a CSV or restore the synthetic sample.</small></td></tr>`;
    generateButton.disabled = true;
    renderIntake();
    return;
  }
  generateButton.disabled = false;
  signupBody.innerHTML = members
    .map(
      (member) => `
        <tr>
          <td><input type="checkbox" data-available="${member.id}" ${availabilityIds.has(member.id) ? "checked" : ""} aria-label="${member.name} available"></td>
          <td><strong>${member.name}</strong><small>${explainPriority(member)}</small></td>
          <td>${member.power}M</td>
          <td>${member.roles.map((role) => allRoleLabels.get(role) ?? role).join(", ") || "Flexible"}</td>
          <td>${member.selectionCount}</td>
          <td>${member.noShowCount}</td>
        </tr>`,
    )
    .join("");
  renderIntake();
}

function renderIntake(message, kind = "muted") {
  const previousMember = responseMember.value;
  responseMember.innerHTML = members.map((member) => `<option value="${member.id}">${member.name}</option>`).join("");
  if (members.some((member) => member.id === previousMember)) responseMember.value = previousMember;
  const empty = members.length === 0;
  for (const control of [responseMember, responseAvailability, createResponseButton, responseBatch, applyResponsesButton, clearAvailabilityButton]) {
    control.disabled = empty;
  }
  const summary = empty
    ? "Import a roster or restore the sample before collecting responses."
    : `Collected responses: ${respondedIds.size}/${members.length} · Available: ${availabilityIds.size}/${members.length} · Round ${round}`;
  intakeStatus.textContent = message ? `${message} ${summary}` : summary;
  intakeStatus.className = `${kind} inline-status`;
}

function renderRolePolicy(message, kind = "muted") {
  const template = currentTemplate();
  const policy = rolePolicies[gameSelect.value];
  rolePolicyFields.innerHTML = template.roles.map((role) => `
    <label>${role.label}
      <input type="number" min="0" max="${template.capacity}" step="1" value="${policy[role.key]}" data-role-count="${role.key}">
    </label>`).join("");
  const total = Object.values(policy).reduce((sum, count) => sum + count, 0);
  rolePolicyStatus.textContent = message ?? `Required seats: ${total}/${template.capacity}. Remaining seats use fair rotation.`;
  rolePolicyStatus.className = `${kind} inline-status`;
}

function applyRolePolicy() {
  const game = gameSelect.value;
  const next = structuredClone(rolePolicies);
  next[game] = Object.fromEntries([...rolePolicyFields.querySelectorAll("[data-role-count]")].map((input) => [
    input.dataset.roleCount,
    Number(input.value),
  ]));
  try {
    rolePolicies = validateRolePolicies(next, GAME_TEMPLATES);
    currentRoster = null;
    attendanceButton.disabled = true;
    updateTemplate();
    persistState(`Role policy saved locally for ${currentTemplate().eventName}.`);
    renderRolePolicy("Role policy saved. Generate again to apply it.", "success");
  } catch (error) {
    renderRolePolicy(`${error.message}. Policy was not changed.`, "warning");
  }
}

function resetRolePolicy() {
  rolePolicies[gameSelect.value] = defaultRolePolicies(GAME_TEMPLATES)[gameSelect.value];
  currentRoster = null;
  attendanceButton.disabled = true;
  updateTemplate();
  persistState(`Template role defaults restored for ${currentTemplate().eventName}.`);
  renderRolePolicy("Template role defaults restored.", "success");
}

function createMemberResponse() {
  try {
    responseOutput.value = createResponseSlip({
      game: gameSelect.value,
      round,
      memberId: responseMember.value,
      available: responseAvailability.value === "in",
    });
    renderIntake("Response slip created for review.", "success");
  } catch (error) {
    renderIntake(error.message, "warning");
  }
}

function applyMemberResponses() {
  try {
    const responses = parseResponseSlips(responseBatch.value, {
      game: gameSelect.value,
      round,
      memberIds: members.map((member) => member.id),
    });
    const next = applyResponseSlips({
      availabilityIds: [...availabilityIds],
      respondedIds: [...respondedIds],
      responses,
    });
    availabilityIds = new Set(next.availabilityIds);
    respondedIds = new Set(next.respondedIds);
    currentRoster = null;
    attendanceButton.disabled = true;
    renderSignups();
    updateTemplate();
    persistState(`Applied ${responses.length} member response(s) locally.`);
    renderIntake(`Applied ${responses.length} response(s).`, "success");
  } catch (error) {
    renderIntake(`${error.message}. No responses were applied.`, "warning");
  }
}

function clearAvailability() {
  availabilityIds = new Set();
  respondedIds = new Set();
  currentRoster = null;
  attendanceButton.disabled = true;
  renderSignups();
  updateTemplate();
  persistState(`Availability cleared locally for round ${round}.`);
  renderIntake("Ready to collect a new response batch.", "success");
}

function memberCard(member, type) {
  const role = member.assignedRole ? allRoleLabels.get(member.assignedRole) : "Flexible";
  const attendance = type === "main"
    ? `<label class="attend"><input type="checkbox" data-attended="${member.id}" checked> attended</label>`
    : "";
  return `<li><span><strong>${member.name}</strong><small>${role} · ${member.selectionReason.replace("_", " ")}</small></span>${attendance}</li>`;
}

function renderRoster() {
  const template = currentTemplate();
  const issues = [];
  if (currentRoster.main.length < template.capacity) {
    issues.push(`${template.capacity - currentRoster.main.length} unfilled main seat(s)`);
  }
  if (currentRoster.unfilledRoles.length) {
    issues.push(`missing roles: ${currentRoster.unfilledRoles.map((role) => `${allRoleLabels.get(role.key)} ×${role.missing}`).join(", ")}`);
  }
  const warnings = issues.length
    ? `<div class="warning">${issues.join(" · ")}</div>`
    : `<div class="success">Capacity and required roles are covered.</div>`;

  const announcement = formatRosterAnnouncement({
    template,
    roster: currentRoster,
    round,
    roleLabels: Object.fromEntries(allRoleLabels),
  });
  rosterPanel.innerHTML = `
    <div class="roster-head"><div><span class="eyebrow">Round ${round}</span><h2>${template.eventName} roster</h2></div><span class="pill">${currentRoster.main.length}/${template.capacity}</span></div>
    <p class="scale-note ${template.scaleStatus === "estimate" ? "estimate" : ""}">${template.scaleNote}</p>
    ${warnings}
    <div class="roster-grid">
      <section><h3>Main roster</h3><ol>${currentRoster.main.map((member) => memberCard(member, "main")).join("")}</ol></section>
      <section><h3>Substitutes</h3><ol>${currentRoster.substitutes.map((member) => memberCard(member, "substitute")).join("") || "<li>No substitutes</li>"}</ol></section>
    </div>
    <div class="announcement"><label for="announcement-text">Discord announcement preview</label><textarea id="announcement-text" readonly>${announcement}</textarea><button id="copy-announcement" class="secondary">Copy announcement</button></div>
    <p class="muted">Waitlist: ${currentRoster.waitlistCount}. Attendance updates only the selected main roster.</p>`;
  attendanceButton.disabled = currentRoster.main.length === 0;
  document.querySelector("#copy-announcement").addEventListener("click", async (event) => {
    const textarea = document.querySelector("#announcement-text");
    const text = textarea.value;
    if (!document.hasFocus() || !navigator.clipboard?.writeText) {
      textarea.select();
      event.currentTarget.textContent = "Select text and copy";
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      event.currentTarget.textContent = "Copied";
    } catch {
      textarea.select();
      event.currentTarget.textContent = "Select text and copy";
    }
  });
}

function generateRoster() {
  const template = currentTemplate();
  currentRoster = buildRoster({
    members,
    availableIds: [...availabilityIds],
    capacity: template.capacity,
    substituteCount: template.substituteCount,
    requiredRoles: requiredRolesFor(template, rolePolicies[gameSelect.value]),
  });
  renderRoster();
}

function recordAttendance() {
  if (!currentRoster) return;
  const attendedIds = [...document.querySelectorAll("[data-attended]:checked")].map((input) => input.dataset.attended);
  members = applyAttendance({ members, mainRoster: currentRoster.main, attendedIds, round });
  round += 1;
  respondedIds = new Set();
  persistState(`Attendance saved locally. Round ${round} is ready.`);
  currentRoster = null;
  attendanceButton.disabled = true;
  rosterPanel.innerHTML = `<div class="empty"><span>Attendance saved.</span><strong>Generate round ${round} to see the updated rotation.</strong></div>`;
  renderSignups();
}

function updateTemplate() {
  const template = currentTemplate();
  eventTitle.textContent = `${template.label} · ${template.eventName}`;
  currentRoster = null;
  attendanceButton.disabled = true;
  rosterPanel.innerHTML = members.length
    ? `<div class="empty"><span>${template.capacity} main · ${template.substituteCount} substitutes</span><strong>Select availability and generate the roster.</strong></div>`
    : `<div class="empty"><span>Round ${round} · no saved state</span><strong>Import a roster CSV or restore the synthetic sample to begin.</strong><small class="scale-note ${template.scaleStatus === "estimate" ? "estimate" : ""}">${template.scaleNote}</small></div>`;
  responseOutput.value = "";
  renderIntake();
  renderRolePolicy();
}

function importCsv() {
  try {
    members = parseRosterCsv(csvInput.value);
    availabilityIds = new Set(members.map((member) => member.id));
    respondedIds = new Set();
    const latestMemberRound = Math.max(0, ...members.map((member) => member.lastSelectedRound ?? 0));
    round = Math.max(round, latestMemberRound + 1);
    currentRoster = null;
    attendanceButton.disabled = true;
    renderSignups();
    updateTemplate();
    csvStatus.textContent = `Imported ${members.length} members.`;
    csvStatus.className = "success inline-status";
    persistState(`Imported roster saved locally for round ${round}.`);
  } catch (error) {
    csvStatus.textContent = error.message;
    csvStatus.className = "warning inline-status";
  }
}

function exportCsv() {
  const csv = serializeRosterCsv(members);
  csvInput.value = csv;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `alliance-roster-round-${round}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  csvStatus.textContent = "CSV prepared and downloaded.";
  csvStatus.className = "success inline-status";
}

function loadSample() {
  members = structuredClone(sampleMembers);
  availabilityIds = new Set(members.map((member) => member.id));
  respondedIds = new Set();
  rolePolicies = defaultRolePolicies(GAME_TEMPLATES);
  round = SAMPLE_ROUND;
  csvInput.value = serializeRosterCsv(members);
  currentRoster = null;
  attendanceButton.disabled = true;
  renderSignups();
  updateTemplate();
  csvStatus.textContent = "Synthetic sample restored.";
  csvStatus.className = "muted inline-status";
  persistState(`Synthetic sample saved locally at round ${round}.`);
}

function resetState() {
  const result = clearState(storage);
  if (!result.ok) {
    showStorageStatus(`Could not clear local state: ${result.error}`, "warning");
    return;
  }
  members = [];
  availabilityIds = new Set();
  respondedIds = new Set();
  rolePolicies = defaultRolePolicies(GAME_TEMPLATES);
  round = EMPTY_ROUND;
  currentRoster = null;
  csvInput.value = "";
  csvStatus.textContent = "";
  attendanceButton.disabled = true;
  renderSignups();
  updateTemplate();
  showStorageStatus("Local state cleared. No saved roster.", "muted");
}

gameSelect.addEventListener("change", updateTemplate);
generateButton.addEventListener("click", generateRoster);
attendanceButton.addEventListener("click", recordAttendance);
importButton.addEventListener("click", importCsv);
exportButton.addEventListener("click", exportCsv);
sampleButton.addEventListener("click", loadSample);
resetButton.addEventListener("click", resetState);
createResponseButton.addEventListener("click", createMemberResponse);
applyResponsesButton.addEventListener("click", applyMemberResponses);
clearAvailabilityButton.addEventListener("click", clearAvailability);
applyRolePolicyButton.addEventListener("click", applyRolePolicy);
resetRolePolicyButton.addEventListener("click", resetRolePolicy);
signupBody.addEventListener("change", (event) => {
  const input = event.target.closest("[data-available]");
  if (!input) return;
  if (input.checked) availabilityIds.add(input.dataset.available);
  else availabilityIds.delete(input.dataset.available);
  currentRoster = null;
  attendanceButton.disabled = true;
  persistState(`Officer availability override saved for round ${round}.`);
  renderIntake("Officer override saved.", "success");
});

csvInput.value = members.length ? serializeRosterCsv(members) : "";
renderSignups();
updateTemplate();
if (restoredState.status === "restored") {
  showStorageStatus(`Restored round ${round} · ${members.length} members from this browser.`, "success");
} else if (restoredState.status === "invalid") {
  showStorageStatus(`Saved state is invalid: ${restoredState.error}. Clear it or import a roster.`, "warning");
} else if (restoredState.status === "unavailable") {
  showStorageStatus("Browser storage is unavailable; changes will last only until refresh.", "warning");
} else {
  showStorageStatus("No saved state. Import a CSV or restore the synthetic sample.");
}
