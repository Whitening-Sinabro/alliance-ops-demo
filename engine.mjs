export const GAME_TEMPLATES = Object.freeze({
  last_war: Object.freeze({
    label: "Last War",
    eventName: "Desert Storm",
    capacity: 20,
    substituteCount: 10,
    scaleStatus: "verified",
    scaleNote: "Verified event cap: 20 starters + 10 substitutes.",
    roles: Object.freeze([
      Object.freeze({ key: "rally_lead", label: "Rally lead", count: 1 }),
      Object.freeze({ key: "defense", label: "Defense", count: 2 }),
    ]),
  }),
  rise_of_kingdoms: Object.freeze({
    label: "Rise of Kingdoms",
    eventName: "Ark of Osiris",
    capacity: 30,
    substituteCount: 10,
    scaleStatus: "estimate",
    scaleNote: "30 starters confirmed by a current update summary; 10 substitutes is an estimate pending an in-game rules check.",
    roles: Object.freeze([
      Object.freeze({ key: "rally_lead", label: "Rally lead", count: 1 }),
      Object.freeze({ key: "garrison", label: "Garrison", count: 1 }),
      Object.freeze({ key: "field", label: "Open field", count: 2 }),
    ]),
  }),
});

function assertNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer`);
  }
}

function normalizeMember(member) {
  if (!member || typeof member.id !== "string" || !member.id.trim()) {
    throw new TypeError("member.id must be a non-empty string");
  }
  if (typeof member.name !== "string" || !member.name.trim()) {
    throw new TypeError("member.name must be a non-empty string");
  }

  const selectionCount = member.selectionCount ?? 0;
  const noShowCount = member.noShowCount ?? 0;
  assertNonNegativeInteger(selectionCount, "member.selectionCount");
  assertNonNegativeInteger(noShowCount, "member.noShowCount");

  return {
    ...member,
    id: member.id.trim(),
    name: member.name.trim(),
    power: Number.isFinite(member.power) ? member.power : 0,
    selectionCount,
    noShowCount,
    lastSelectedRound: Number.isInteger(member.lastSelectedRound)
      ? member.lastSelectedRound
      : null,
    roles: Array.isArray(member.roles) ? [...new Set(member.roles)] : [],
  };
}

function fairnessCompare(a, b) {
  return (
    a.selectionCount - b.selectionCount ||
    a.noShowCount - b.noShowCount ||
    (a.lastSelectedRound ?? -1) - (b.lastSelectedRound ?? -1) ||
    b.power - a.power ||
    a.name.localeCompare(b.name)
  );
}

function takeFirstMatching(pool, selectedIds, predicate) {
  return pool.find((member) => !selectedIds.has(member.id) && predicate(member));
}

export function buildRoster({
  members,
  availableIds,
  capacity,
  substituteCount = 0,
  requiredRoles = [],
}) {
  assertNonNegativeInteger(capacity, "capacity");
  assertNonNegativeInteger(substituteCount, "substituteCount");

  const normalized = members.map(normalizeMember);
  const uniqueIds = new Set(normalized.map((member) => member.id));
  if (uniqueIds.size !== normalized.length) {
    throw new TypeError("member IDs must be unique");
  }

  const available = new Set(availableIds);
  const pool = normalized.filter((member) => available.has(member.id)).sort(fairnessCompare);
  const selectedIds = new Set();
  const main = [];
  const unfilledRoles = [];

  for (const role of requiredRoles) {
    assertNonNegativeInteger(role.count, `required role ${role.key}.count`);
    let filled = 0;
    while (filled < role.count && main.length < capacity) {
      const candidate = takeFirstMatching(
        pool,
        selectedIds,
        (member) => member.roles.includes(role.key),
      );
      if (!candidate) break;
      main.push({ ...candidate, assignedRole: role.key, selectionReason: "required_role" });
      selectedIds.add(candidate.id);
      filled += 1;
    }
    if (filled < role.count) {
      unfilledRoles.push({ key: role.key, missing: role.count - filled });
    }
  }

  for (const candidate of pool) {
    if (main.length >= capacity) break;
    if (selectedIds.has(candidate.id)) continue;
    main.push({ ...candidate, assignedRole: null, selectionReason: "fair_rotation" });
    selectedIds.add(candidate.id);
  }

  const substitutes = pool
    .filter((member) => !selectedIds.has(member.id))
    .slice(0, substituteCount)
    .map((member) => ({ ...member, assignedRole: null, selectionReason: "substitute" }));

  return {
    main,
    substitutes,
    unfilledRoles,
    waitlistCount: Math.max(0, pool.length - main.length - substitutes.length),
  };
}

export function applyAttendance({ members, mainRoster, attendedIds, round }) {
  assertNonNegativeInteger(round, "round");
  const selected = new Set(mainRoster.map((member) => member.id));
  const attended = new Set(attendedIds);

  return members.map(normalizeMember).map((member) => {
    if (!selected.has(member.id)) return member;
    return {
      ...member,
      selectionCount: member.selectionCount + 1,
      noShowCount: member.noShowCount + (attended.has(member.id) ? 0 : 1),
      lastSelectedRound: round,
    };
  });
}

export function explainPriority(member) {
  const normalized = normalizeMember(member);
  if (normalized.selectionCount === 0) return "Not selected before";
  if (normalized.noShowCount > 0) return `${normalized.noShowCount} recorded no-show(s)`;
  return `${normalized.selectionCount} prior selection(s)`;
}

export function formatRosterAnnouncement({ template, roster, round, roleLabels = {} }) {
  assertNonNegativeInteger(round, "round");
  if (!template || typeof template.eventName !== "string") {
    throw new TypeError("template.eventName is required");
  }

  const renderMember = (member, index) => {
    const role = member.assignedRole
      ? roleLabels[member.assignedRole] ?? member.assignedRole
      : "Flexible";
    return `${index + 1}. ${member.name} — ${role}`;
  };
  const main = roster.main.length
    ? roster.main.map(renderMember).join("\n")
    : "No selected members";
  const substitutes = roster.substitutes.length
    ? roster.substitutes.map(renderMember).join("\n")
    : "None";
  const gaps = roster.unfilledRoles.length
    ? `\n⚠ Missing roles: ${roster.unfilledRoles.map((role) => `${roleLabels[role.key] ?? role.key} ×${role.missing}`).join(", ")}`
    : "";

  return [
    `📋 ${template.eventName} · Round ${round}`,
    "",
    "Main roster",
    main,
    "",
    "Substitutes",
    substitutes,
    gaps,
    "",
    "Please notify an officer early if your availability changes.",
  ].join("\n").trim();
}
