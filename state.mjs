import { GAME_TEMPLATES } from "./engine.mjs";
import { defaultEventSettings, defaultRolePolicies, validateEventSettings, validateRolePolicies } from "./policy.mjs";

export const STORAGE_KEY = "alliance-ops-demo-state-v1";
export const STATE_SCHEMA = 1;
export const EMPTY_ROUND = 1;

function validateMemberIds(value, field, memberIds, fallback) {
  const ids = value === undefined ? fallback : value;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new TypeError(`state.${field} must be an array of non-empty strings`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new TypeError(`state.${field} must contain unique IDs`);
  }
  const unknown = ids.find((id) => !memberIds.has(id));
  if (unknown) throw new TypeError(`state.${field} contains unknown member ID ${unknown}`);
  return [...ids];
}

function assertNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer`);
  }
}

function validateMember(member, index) {
  const prefix = `members[${index}]`;
  if (!member || typeof member !== "object") {
    throw new TypeError(`${prefix} must be an object`);
  }
  if (typeof member.id !== "string" || !member.id.trim()) {
    throw new TypeError(`${prefix}.id must be a non-empty string`);
  }
  if (typeof member.name !== "string" || !member.name.trim()) {
    throw new TypeError(`${prefix}.name must be a non-empty string`);
  }
  if (!Number.isFinite(member.power) || member.power < 0) {
    throw new TypeError(`${prefix}.power must be a non-negative number`);
  }
  if (!Array.isArray(member.roles) || member.roles.some((role) => typeof role !== "string")) {
    throw new TypeError(`${prefix}.roles must be an array of strings`);
  }
  assertNonNegativeInteger(member.selectionCount, `${prefix}.selectionCount`);
  assertNonNegativeInteger(member.noShowCount, `${prefix}.noShowCount`);
  if (member.lastSelectedRound !== null) {
    assertNonNegativeInteger(member.lastSelectedRound, `${prefix}.lastSelectedRound`);
  }
}

export function validateState(value) {
  if (!value || typeof value !== "object" || value.schema !== STATE_SCHEMA) {
    throw new TypeError(`state.schema must equal ${STATE_SCHEMA}`);
  }
  if (!Number.isInteger(value.round) || value.round < 1) {
    throw new TypeError("state.round must be a positive integer");
  }
  if (!Array.isArray(value.members)) {
    throw new TypeError("state.members must be an array");
  }
  value.members.forEach(validateMember);
  const ids = value.members.map((member) => member.id.trim());
  if (new Set(ids).size !== ids.length) {
    throw new TypeError("state member IDs must be unique");
  }
  const memberIds = new Set(ids);
  const availabilityIds = validateMemberIds(value.availabilityIds, "availabilityIds", memberIds, ids);
  const respondedIds = validateMemberIds(value.respondedIds, "respondedIds", memberIds, []);
  const eventSettings = validateEventSettings(value.eventSettings, GAME_TEMPLATES);
  const rolePolicies = validateRolePolicies(value.rolePolicies, GAME_TEMPLATES, eventSettings);
  return structuredClone({
    schema: STATE_SCHEMA,
    round: value.round,
    members: value.members,
    availabilityIds,
    respondedIds,
    rolePolicies,
    eventSettings,
  });
}

export function loadState(storage) {
  const empty = () => ({
    members: [],
    round: EMPTY_ROUND,
    availabilityIds: [],
    respondedIds: [],
    rolePolicies: defaultRolePolicies(GAME_TEMPLATES),
    eventSettings: defaultEventSettings(GAME_TEMPLATES),
  });
  if (!storage) return { status: "unavailable", ...empty() };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { status: "empty", ...empty() };
    const state = validateState(JSON.parse(raw));
    return {
      status: "restored",
      members: state.members,
      round: state.round,
      availabilityIds: state.availabilityIds,
      respondedIds: state.respondedIds,
      rolePolicies: state.rolePolicies,
      eventSettings: state.eventSettings,
    };
  } catch (error) {
    return { status: "invalid", ...empty(), error: error.message };
  }
}

export function saveState(storage, { members, round, availabilityIds, respondedIds, rolePolicies, eventSettings }) {
  if (!storage) return { ok: false, error: "Browser storage is unavailable." };
  try {
    const state = validateState({ schema: STATE_SCHEMA, members, round, availabilityIds, respondedIds, rolePolicies, eventSettings });
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function clearState(storage) {
  if (!storage) return { ok: false, error: "Browser storage is unavailable." };
  try {
    storage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
