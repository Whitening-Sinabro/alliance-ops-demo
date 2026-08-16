export function normalizeActivityRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  const ids = new Set();
  return rows.map((row, index) => {
    const id = String(row.id ?? "").trim();
    const name = String(row.name ?? "").trim();
    if (!id || !name) throw new TypeError(`row ${index + 1} requires id and name`);
    if (ids.has(id)) throw new TypeError(`duplicate member id: ${id}`);
    ids.add(id);
    const expected = Number(row.expected);
    const completed = Number(row.completed);
    const missed = Number(row.missed ?? 0);
    if (![expected, completed, missed].every(Number.isInteger) || expected < 0 || completed < 0 || missed < 0 || completed > expected) throw new TypeError(`invalid activity counts for ${id}`);
    const rate = expected ? completed / expected : 0;
    const status = rate >= 0.8 && missed === 0 ? "good" : rate >= 0.5 ? "review" : "inactive";
    return { id, name, expected, completed, missed, rate, status };
  });
}

export function buildActivityAudit(rows) {
  const members = normalizeActivityRows(rows).sort((a, b) => a.rate - b.rate || b.missed - a.missed || a.name.localeCompare(b.name));
  const counts = { good: 0, review: 0, inactive: 0 };
  members.forEach((member) => { counts[member.status] += 1; });
  return { members, counts, averageRate: members.length ? members.reduce((total, member) => total + member.rate, 0) / members.length : 0 };
}

export function formatAuditReport({ game, period, audit }) {
  if (!String(game ?? "").trim() || !String(period ?? "").trim()) throw new TypeError("game and period are required");
  const lines = audit.members.map((member) => `- ${member.name}: ${member.completed}/${member.expected} (${Math.round(member.rate * 100)}%) · missed ${member.missed} · ${member.status}`);
  return [`📊 **${game} participation audit · ${period}**`, `Average completion: ${Math.round(audit.averageRate * 100)}%`, `Good ${audit.counts.good} · Review ${audit.counts.review} · Inactive ${audit.counts.inactive}`, "", ...lines, "", "Officer review required before any promotion, demotion or removal decision."].join("\n");
}
