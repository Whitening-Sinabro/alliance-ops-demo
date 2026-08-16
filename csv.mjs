const HEADER = [
  "id",
  "name",
  "power",
  "roles",
  "selection_count",
  "no_show_count",
  "last_selected_round",
];

function parseCsvRow(line) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new TypeError("CSV contains an unclosed quote");
  cells.push(cell.trim());
  return cells;
}

function integerOrDefault(value, fallback, field, rowNumber) {
  if (value === "" || value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TypeError(`row ${rowNumber}: ${field} must be a non-negative integer`);
  }
  return parsed;
}

export function parseRosterCsv(text) {
  if (typeof text !== "string") throw new TypeError("CSV input must be text");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new TypeError("CSV must include a header and at least one member");

  const header = parseCsvRow(lines[0]).map((value) => value.toLowerCase());
  for (const required of ["id", "name"]) {
    if (!header.includes(required)) throw new TypeError(`CSV header is missing ${required}`);
  }

  const seen = new Set();
  return lines.slice(1).map((line, offset) => {
    const rowNumber = offset + 2;
    const cells = parseCsvRow(line);
    const value = (field) => cells[header.indexOf(field)] ?? "";
    const id = value("id").trim();
    const name = value("name").trim();
    if (!id || !name) throw new TypeError(`row ${rowNumber}: id and name are required`);
    if (seen.has(id)) throw new TypeError(`row ${rowNumber}: duplicate id ${id}`);
    seen.add(id);

    const power = value("power") === "" ? 0 : Number(value("power"));
    if (!Number.isFinite(power) || power < 0) {
      throw new TypeError(`row ${rowNumber}: power must be a non-negative number`);
    }

    return {
      id,
      name,
      power,
      roles: value("roles").split("|").map((role) => role.trim()).filter(Boolean),
      selectionCount: integerOrDefault(value("selection_count"), 0, "selection_count", rowNumber),
      noShowCount: integerOrDefault(value("no_show_count"), 0, "no_show_count", rowNumber),
      lastSelectedRound: value("last_selected_round") === ""
        ? null
        : integerOrDefault(value("last_selected_round"), null, "last_selected_round", rowNumber),
    };
  });
}

function quoteCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeRosterCsv(members) {
  const rows = members.map((member) => [
    member.id,
    member.name,
    member.power ?? 0,
    Array.isArray(member.roles) ? member.roles.join("|") : "",
    member.selectionCount ?? 0,
    member.noShowCount ?? 0,
    member.lastSelectedRound ?? "",
  ]);
  return [HEADER, ...rows].map((row) => row.map(quoteCsv).join(",")).join("\n");
}

export const ROSTER_CSV_HEADER = HEADER.join(",");
