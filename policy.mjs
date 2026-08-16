export function defaultRolePolicies(templates) {
  return Object.fromEntries(Object.entries(templates).map(([game, template]) => [
    game,
    Object.fromEntries(template.roles.map((role) => [role.key, role.count])),
  ]));
}

export function validateRolePolicies(value, templates) {
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
    if (total > templates[game].capacity) {
      throw new TypeError(`state.rolePolicies.${game} total ${total} exceeds capacity ${templates[game].capacity}`);
    }
  }
  return structuredClone(defaults);
}

export function requiredRolesFor(template, policy) {
  return template.roles.map((role) => ({ ...role, count: policy[role.key] }));
}
