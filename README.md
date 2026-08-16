# Alliance Ops — evaluation demo

A browser-only, synthetic prototype for Last War `Desert Storm` and Rise of
Kingdoms `Ark of Osiris` roster operations.

It demonstrates:

- 50-member availability collection through round-scoped response slips;
- officer review and manual overrides;
- configurable required-role counts;
- fair rotation, substitutes and waitlists;
- attendance/no-show history across rounds;
- CSV import/export and browser-local persistence.

Open the GitHub Pages link in the repository description. Choose **Restore
sample** to begin. No login, Discord installation, game account, token, API,
scraping or external request is used. All state stays in the current browser's
`localStorage` and can be removed with **Clear local data**.

## Evaluation limits

- All included members are synthetic.
- `AO1` response slips demonstrate collection and review but do not authenticate
  member identity.
- Rise of Kingdoms uses 30 starters; its displayed 10-substitute count remains
  explicitly labeled as an estimate pending current in-game confirmation.
- This is a fan-made operations prototype and is not affiliated with or endorsed
  by either game's publisher.
- It is being shared for blunt R4/R5 workflow feedback, not as a finished or paid
  service.

## Source and privacy

The demo is dependency-free static HTML/CSS/JavaScript. It makes no network
request after the page assets load. Browser storage can be inspected in
`state.mjs`; roster and response logic are in `engine.mjs` and `intake.mjs`.
