export function defaultRolePolicies(templates) {
  return Object.fromEntries(Object.entries(templates).map(([game, template]) => [
    game,
    Object.fromEntries(template.roles.map((role) => [role.key, role.count])),
  ]));
}

export function defaultEventSettings(templates) {
  return Object.fromEntries(Object.entries(templates).map(([game, template]) => [
    game,
    {
      eventName: template.eventName,
      capacity: template.capacity,
      substituteCount: template.substituteCount,
    },
  ]));
}

export function validateEventSettings(value, templates) {
  const defaults = defaultEventSettings(templates);
  if (value === undefined) return defaults;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("state.eventSettings must be an object");
  }
  for (const [game, settings] of Object.entries(value)) {
    if (!(game in templates)) throw new TypeError(`state.eventSettings has unknown game ${game}`);
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      throw new TypeError(`state.eventSettings.${game} must be an object`);
    }
    const eventName = settings.eventName ?? defaults[game].eventName;
    if (typeof eventName !== "string" || !eventName.trim() || eventName.trim().length > 80) {
      throw new TypeError(`state.eventSettings.${game}.eventName must be 1-80 characters`);
    }
    const capacity = settings.capacity ?? defaults[game].capacity;
    const substituteCount = settings.substituteCount ?? defaults[game].substituteCount;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
      throw new TypeError(`state.eventSettings.${game}.capacity must be an integer from 1 to 200`);
    }
    if (!Number.isInteger(substituteCount) || substituteCount < 0 || substituteCount > 200) {
      throw new TypeError(`state.eventSettings.${game}.substituteCount must be an integer from 0 to 200`);
    }
    defaults[game] = { eventName: eventName.trim(), capacity, substituteCount };
  }
  return structuredClone(defaults);
}

export function configuredTemplate(template, settings) {
  return { ...template, ...settings };
}

export function validateRolePolicies(value, templates, eventSettings = defaultEventSettings(templates)) {
  const validatedEventSettings = validateEventSettings(eventSettings, templates);
  const defaults = defaultRolePolicies(templates);
  if (value === undefined) return defaults;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("state.rolePolicies must be an object");
  }
  for (const game of Object.keys(value)) {
    if (!(game in templates)) throw new TypeError(`state.rolePolicies has unknown game ${game}`);
    const counts = value[game];
    if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
      throw new TypeError(`state.rolePolicies.${game} must be an object`);
    }
    const allowedRoles = new Set(templates[game].roles.map((role) => role.key));
    for (const [role, count] of Object.entries(counts)) {
      if (!allowedRoles.has(role)) {
        throw new TypeError(`state.rolePolicies.${game} has unknown role ${role}`);
      }
      if (!Number.isInteger(count) || count < 0) {
        throw new TypeError(`state.rolePolicies.${game}.${role} must be a non-negative integer`);
      }
      defaults[game][role] = count;
    }
  }
  for (const [game, counts] of Object.entries(defaults)) {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total > validatedEventSettings[game].capacity) {
      throw new TypeError(`state.rolePolicies.${game} total ${total} exceeds capacity ${validatedEventSettings[game].capacity}`);
    }
  }
  return structuredClone(defaults);
}

export function requiredRolesFor(template, policy) {
  return template.roles.map((role) => ({ ...role, count: policy[role.key] }));
}
