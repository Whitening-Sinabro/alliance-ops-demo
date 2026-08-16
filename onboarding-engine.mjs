const STATUSES = new Set(["new", "review", "invited", "joined", "waitlist", "declined"]);

export function normalizeApplications(applications) {
  if (!Array.isArray(applications)) throw new TypeError("applications must be an array");
  const ids = new Set();
  return applications.map((application, index) => {
    const id = String(application.id ?? "").trim();
    const name = String(application.name ?? "").trim();
    const status = application.status ?? "new";
    if (!id || !name) throw new TypeError(`application ${index + 1} requires id and name`);
    if (ids.has(id)) throw new TypeError(`duplicate application id: ${id}`);
    if (!STATUSES.has(status)) throw new TypeError(`invalid status for ${id}`);
    ids.add(id);
    return { id, name, group: String(application.group ?? "").trim(), timezone: String(application.timezone ?? "").trim(), status };
  });
}

export function onboardingSummary(applications) {
  const normalized = normalizeApplications(applications);
  const counts = Object.fromEntries([...STATUSES].map((status) => [status, 0]));
  normalized.forEach((application) => { counts[application.status] += 1; });
  return { counts, total: normalized.length, actionable: counts.new + counts.review + counts.invited };
}

export function formatOnboardingDigest({ communityName, applications }) {
  const name = String(communityName ?? "").trim();
  if (!name) throw new TypeError("communityName is required");
  const normalized = normalizeApplications(applications);
  const sections = ["new", "review", "invited", "joined", "waitlist"].map((status) => {
    const matches = normalized.filter((application) => application.status === status);
    return `**${status.toUpperCase()} (${matches.length})**\n${matches.length ? matches.map((application) => `- ${application.name}${application.group ? ` · ${application.group}` : ""}${application.timezone ? ` · ${application.timezone}` : ""}`).join("\n") : "- None"}`;
  });
  return [`📥 **${name} onboarding desk**`, "", ...sections, "", "Review before sending any invitation. No automatic DMs are sent."].join("\n");
}
