# FieldOps

FieldOps is a web-based worksite operations app for chemical container tracking, T-Belt RunDown reporting, requisitions, and location administration.

**Current production release:** `v0.1.1`

**Production URL:** <https://ops.fracplotter.com>

**Firebase project:** `fieldops-260e1` (Firestore region: `us-west3`)

## What is included

- Site Code entry scoped to one work location
- Administrator sign-in and location management
- Frac and Pump Down chemical inventories
- ISO and Poly 330 container tracking
- Strap readings, optional field notes, history, and trend plots
- Toggleable Chemical Usage Calculator with shared BBL volume and per-container GPT targets
- T-Belt RunDown with SMS report handoff
- Requisition form foundation
- Installable PWA behavior

## Local development

Use a static-file server from the repository root:

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173>. The local app uses the committed public Firebase web configuration when available.

## Firebase deployment

Deploy the web app:

```sh
firebase deploy --only hosting --project fieldops-260e1
```

Deploy Functions and Firestore rules when either changes:

```sh
firebase deploy --only functions,firestore:rules --project fieldops-260e1
```

The `SITE_CODE_PEPPER` secret must remain configured in Firebase. Never commit raw Site Codes, service-account keys, or administrator credentials.

## Preview before production

Use a Firebase Hosting preview channel for feature review:

```sh
firebase hosting:channel:deploy feature-name --expires 7d --project fieldops-260e1
```

Preview channels use the real project backend, so do not enter production test data unless it is acceptable for the live project.

## Git and release workflow

`main` is the production branch. Create new work on a short-lived branch such as `feature/chemical-undo` or `fix/mobile-layout`.

1. Build and test locally.
2. Deploy a preview channel for review.
3. Merge the verified work into `main`.
4. Update the version and `CHANGELOG.md`.
5. Create a Git tag such as `v0.2.0`.
6. Deploy the tagged release to Hosting.

Use semantic versions:

- `v0.MINOR.PATCH` while FieldOps is in beta
- Increase `MINOR` for a new operator-facing feature
- Increase `PATCH` for a correction or small polish change
- `v1.0.0` marks the first stable field-ready release

See [CHANGELOG.md](CHANGELOG.md) for release notes and [docs/DATA_MODEL.md](docs/DATA_MODEL.md) for the Firestore structure.

## Security boundaries

- Raw Site Codes are validated only by the `joinSite` Cloud Function and are never stored in Firestore or browser code.
- Field users receive a custom Firebase token scoped to exactly one site.
- Admin controls call privileged Cloud Functions and require an active admin document.
- Location removal is permanent and recursively deletes its subcollections after typed-ID confirmation.
