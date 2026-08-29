# FieldOps

## Firebase deployment

The Firebase project is `fieldops-260e1`, with Firestore in `us-west3`.

The shared Site Code is never stored in the browser or Firestore in plain text. The
`joinSite` function validates a HMAC hash using the `SITE_CODE_PEPPER` secret and
returns a short-lived field-user session scoped to one site. Deploy with:

```sh
firebase login --reauth
cd functions && npm install && cd ..
firebase functions:secrets:set SITE_CODE_PEPPER
firebase deploy --only functions,firestore:rules
```

To create a site, run `node scripts/hash-site-code.mjs`, then create a
`sites/anthem` document in Firestore with `name`, `active: true`, and the
resulting `accessCodeHash`. Do not enter a raw Site Code in Firestore.

FieldOps is a worksite operations app. This first build includes Chemicals (Frac/Pump Down views, ISO and Poly 330 containers, strap updates, and local strap history) and Requisitions (supply ordering forms with line items and local submission history).

## Run locally

Open `index.html` in a browser, or use a static-file server from this directory:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Current data behavior

Until Firebase is connected, the app stores demo data and changes in this browser's local storage. Use any Site Code in the entry screen.

## Firebase connection plan

1. Copy `firebase-config.example.js` to `firebase-config.js` and add the existing Firebase Web app configuration.
2. Add a server-side Site Code validation endpoint that exchanges a valid code for a Firebase custom token containing a `siteId` claim.
3. Store Firestore data below `sites/{siteId}` and enforce the `siteId` claim in Firestore Security Rules.
4. Replace the local-storage adapter in `app.js` with Firestore reads/writes and enable offline persistence.

Never place Site Code hashes, Firebase service-account JSON, or admin credentials in browser code.
