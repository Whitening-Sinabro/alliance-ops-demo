export const RESPONSE_PREFIX = "AO1";

function requireToken(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

export function createResponseSlip({ game, round, memberId, available }) {
  const cleanGame = requireToken(game, "game");
  const cleanMemberId = requireToken(memberId, "memberId");
  if (!Number.isInteger(round) || round < 1) {
    throw new TypeError("round must be a positive integer");
  }
  if (typeof available !== "boolean") {
    throw new TypeError("available must be boolean");
  }
  return [
    RESPONSE_PREFIX,
    encodeURIComponent(cleanGame),
    round,
    encodeURIComponent(cleanMemberId),
    available ? "in" : "out",
  ].join("|");
}

function decodeToken(value, field, lineNumber) {
  try {
    return requireToken(decodeURIComponent(value), `line ${lineNumber} ${field}`);
  } catch (error) {
    if (error instanceof URIError) throw new TypeError(`line ${lineNumber} has invalid encoding`);
    throw error;
  }
}

export function parseResponseSlips(text, { game, round, memberIds }) {
  const expectedGame = requireToken(game, "game");
  if (!Number.isInteger(round) || round < 1) {
    throw new TypeError("round must be a positive integer");
  }
  const allowedIds = new Set(memberIds);
  const lines = String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw new TypeError("Paste at least one response slip");

  const seen = new Set();
  return lines.map((line, index) => {
    const lineNumber = index + 1;
    const parts = line.split("|");
    if (parts.length !== 5 || parts[0] !== RESPONSE_PREFIX) {
      throw new TypeError(`line ${lineNumber} is not an ${RESPONSE_PREFIX} response slip`);
    }
    const responseGame = decodeToken(parts[1], "game", lineNumber);
    const responseRound = Number(parts[2]);
    const memberId = decodeToken(parts[3], "member ID", lineNumber);
    if (responseGame !== expectedGame) {
      throw new TypeError(`line ${lineNumber} belongs to ${responseGame}, not ${expectedGame}`);
    }
    if (!Number.isInteger(responseRound) || responseRound !== round) {
      throw new TypeError(`line ${lineNumber} belongs to round ${parts[2]}, not round ${round}`);
    }
    if (!allowedIds.has(memberId)) {
      throw new TypeError(`line ${lineNumber} has unknown member ID ${memberId}`);
    }
    if (seen.has(memberId)) {
      throw new TypeError(`line ${lineNumber} duplicates member ID ${memberId}`);
    }
    if (parts[4] !== "in" && parts[4] !== "out") {
      throw new TypeError(`line ${lineNumber} availability must be in or out`);
    }
    seen.add(memberId);
    return { memberId, available: parts[4] === "in" };
  });
}

export function applyResponseSlips({ availabilityIds, respondedIds, responses }) {
  const available = new Set(availabilityIds);
  const responded = new Set(respondedIds);
  for (const response of responses) {
    if (response.available) available.add(response.memberId);
    else available.delete(response.memberId);
    responded.add(response.memberId);
  }
  return { availabilityIds: [...available], respondedIds: [...responded] };
}
