# Game Ops Desk local prototype

A dependency-free game-specific hub. KingShot is a simple redemption-code desk with no roster or redemption automation. Last War `Desert Storm` and Rise of Kingdoms `Ark of Osiris` use separate public URLs backed by one shared browser-local roster engine.

## Public routes

- `/` — game/product chooser.
- `/kingshot.html` — codes and official redemption instructions only.
- `/tournament.html` — cross-game community tournament check-in and room-assignment demo.
- `/onboarding.html` — cross-game clan/community application and invitation pipeline.
- `/audit.html` — officer-reviewed clan participation audit demo.
- `/integration-repair.html` — fixed-scope Sheet/API workflow repair service page.
- `/game.html?game=last_war` — Last War event-roster demo.
- `/game.html?game=rise_of_kingdoms` — Rise of Kingdoms event-roster demo.

## Demonstrated flow

1. Create a round- and game-scoped one-line availability response for a roster member.
2. Paste multiple member responses into the officer view and apply them atomically.
3. Review or override availability with the roster checkboxes.
4. Fill required roles from the fairest eligible candidates.
5. Configure the event name, main seats and substitutes, then adjust required-role seat counts per game and validate them against that event capacity.
6. Fill remaining seats by fewest prior selections, fewer no-shows, oldest previous selection and then power.
7. Produce substitutes and a waitlist count.
8. Record attendance; selected no-shows are penalized in the next round.
9. Restore members, round, availability, response count, role policy and attendance history after refresh.
10. Clear availability for a new collection or clear all local data.
11. Import/export a roster CSV without a database.
12. Generate a Discord-ready announcement without connecting a bot.
13. Open a prefilled public setup-request issue without posting player IDs or personal data.

## Run

```powershell
cd 03-mvp/alliance_ops_demo
python serve.py
```

Open `http://127.0.0.1:8765`. Choose a game from the hub or open one of the routes above.

Use `serve.py`, not `python -m http.server`. The stdlib server resolves extensions
through the platform mimetypes registry, which on Windows maps `.mjs` to
`text/plain`; a browser then refuses to execute the ES modules and the page
renders as an empty shell. `serve.py` pins the JavaScript MIME type and disables
caching, and adds no dependency.

Tests:

```powershell
node --test tests/*.test.mjs
```

For a consented operator walkthrough, use [operator-trial.md](operator-trial.md). Ready-to-import synthetic rosters are in `fixtures/`; the same 50-member sample can demonstrate every game template without claiming native game integration.

## Boundaries

- Synthetic data only.
- No Discord token, game API, network client, credentials, scraping or CAPTCHA handling.
- No billing, publisher claim or production storage.
- Local persistence is limited to this browser's `localStorage`; clearing site data or using
  the in-app reset removes it. There is no backend sync or account.
- `AO1` response slips are transportable text, not authenticated identities. The officer must
  review them. A production member link would need an approved deployment and identity/signing design.
- The algorithm is a demonstrable policy, not an assertion that every alliance prefers this rotation rule.
- Event name, main seats, substitutes and role counts are browser-local and officer-configurable. The UI rejects empty/oversized names, negative or fractional counts, unknown games/roles, and role totals above the configured capacity.
- KingShot is not part of the roster engine. The code page does not collect player IDs, automate redemption, or claim unverified codes are active.

## Local response slips

The member panel creates one line such as `AO1|last_war|6|m1|in`. An officer can paste
one slip per line and apply the batch. The whole batch is rejected if any line has the
wrong game or round, an unknown/duplicate member, or an invalid availability value.
Applying a batch and manual checkbox overrides are stored only in this browser.

## Required-role policy

Each game keeps its own browser-local event settings and role counts. Saving event settings changes
the event name, main capacity and substitute count for the next roster. Saving a role policy changes
the required-role phase. `Restore sample defaults` resets the active game's event and roles; restoring
the full synthetic sample or clearing local data resets every game.

## CSV fields

`id,name,power,roles,selection_count,no_show_count,last_selected_round`

Only `id` and `name` are required. Separate multiple roles with `|`. Imported and updated
member history is saved only in the current browser; the prototype has no server-side storage.
