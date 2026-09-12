# FieldOps Operations Dashboard

This React + TypeScript dashboard uses Firebase administrator authentication, then calls the REST API at `https://api.fracplotter.com/v1`. It intentionally does not read Firestore directly.

Copy `.env.example` to `.env.local` and set `VITE_FIELDOPS_API_BASE_URL` to point a preview build at a non-production API URL.

```sh
npm install
npm run dev
```

Build static production assets with `npm run build`; Firebase Hosting deploys the generated `dist/` directory.
