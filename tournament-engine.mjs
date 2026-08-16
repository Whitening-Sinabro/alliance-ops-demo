function cleanText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

export function normalizeEntrants(entrants) {
  if (!Array.isArray(entrants)) throw new TypeError("entrants must be an array");
  const ids = new Set();
  return entrants.map((entrant, index) => {
    const id = cleanText(entrant.id, `entrant ${index + 1} id`);
    if (ids.has(id)) throw new TypeError(`duplicate entrant id: ${id}`);
    ids.add(id);
    const status = entrant.status ?? "pending";
    if (!["checked_in", "pending", "waitlist", "no_show"].includes(status)) throw new TypeError(`invalid status for ${id}`);
    return { id, name: cleanText(entrant.name, `entrant ${index + 1} name`), community: String(entrant.community ?? "").trim(), seed: Number.isInteger(entrant.seed) && entrant.seed > 0 ? entrant.seed : index + 1, status };
  });
}

export function buildAssignments({ entrants, playersPerRoom = 2, roomPrefix = "Table" }) {
  if (!Number.isInteger(playersPerRoom) || playersPerRoom < 2 || playersPerRoom > 8) throw new TypeError("playersPerRoom must be an integer from 2 to 8");
  const normalized = normalizeEntrants(entrants);
  const bySeed = (a, b) => a.seed - b.seed || a.name.localeCompare(b.name);
  const confirmed = normalized.filter((entrant) => entrant.status === "checked_in").sort(bySeed);
  const waitlist = normalized.filter((entrant) => entrant.status === "waitlist").sort(bySeed);
  const pending = normalized.filter((entrant) => entrant.status === "pending");
  const noShows = normalized.filter((entrant) => entrant.status === "no_show");
  const rooms = [];
  for (let offset = 0; offset < confirmed.length; offset += playersPerRoom) rooms.push({ name: `${roomPrefix} ${rooms.length + 1}`, entrants: confirmed.slice(offset, offset + playersPerRoom) });
  return { rooms, waitlist, pending, noShows, confirmedCount: confirmed.length };
}

export function formatRoundAnnouncement({ eventName, roundName, assignments }) {
  const event = cleanText(eventName, "eventName");
  const round = cleanText(roundName, "roundName");
  const roomLines = assignments.rooms.length ? assignments.rooms.map((room) => `**${room.name}** — ${room.entrants.map((entrant) => entrant.name).join(" / ")}`).join("\n") : "No checked-in entrants yet.";
  const waitlist = assignments.waitlist.length ? assignments.waitlist.map((entrant) => entrant.name).join(", ") : "None";
  return [`🏆 **${event} · ${round}**`, "", roomLines, "", `Waitlist: ${waitlist}`, "", "Report a no-show to the organizer before the round starts."].join("\n");
}

export function formatCheckInReminder({ eventName, entrants }) {
  const event = cleanText(eventName, "eventName");
  const pending = normalizeEntrants(entrants).filter((entrant) => entrant.status === "pending");
  if (!pending.length) return `✅ ${event}: everyone has a recorded status.`;
  return `⏰ ${event} check-in pending: ${pending.map((entrant) => entrant.name).join(", ")}\nPlease check in or withdraw before the deadline.`;
}
