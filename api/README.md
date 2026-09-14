# FieldOps Integration API

The FieldOps Integration API is an ASP.NET Core Minimal API that provides a secured REST interface over FieldOps location data. It is read-focused, with controlled CNG replacement-dispatch actions for approved administrators.

## Endpoints

All protected `/v1` operational endpoints require a Firebase ID token from an active FieldOps administrator in the `Authorization: Bearer <token>` header. `/v1/healthz` is public for service-health checks.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Unauthenticated liveness check. |
| `GET` | `/v1/sites` | Active locations. |
| `GET` | `/v1/sites/{siteId}/dashboard` | One-call dashboard summary: active wells, trailers, inventory, and alerts. |
| `GET` | `/v1/sites/{siteId}/inventory` | All containers plus low, stale, and missing-strap alerts. |
| `GET` | `/v1/sites/{siteId}/wells` | Active wells with their planned-stage counts and display colors. |
| `GET` | `/v1/sites/{siteId}/cng/stages` | Posted CNG stage records with a location-wide MSCF total. |
| `GET` | `/v1/sites/{siteId}/cng/pressure-trends` | Recorded CNG pressures for each active trailer. |
| `GET` | `/v1/sites/{siteId}/trailers?active=true` | Trailers with their latest pressure and temperature readings. |
| `GET` | `/v1/sites/{siteId}/cng/dispatches` | Replacement CNG trailers currently in transit. |
| `GET` | `/v1/sites/{siteId}/cng/dispatches/history` | Completed and cancelled CNG replacement dispatches. |
| `POST` | `/v1/sites/{siteId}/cng/dispatches` | Record a replacement CNG trailer as dispatched. |
| `PATCH` | `/v1/sites/{siteId}/cng/dispatches/{dispatchId}` | Mark an in-transit replacement as arrived or cancelled. |

Swagger documentation is available at `/swagger` once the service is running. Select **Authorize**, paste the Firebase ID token for an active FieldOps administrator (without `Bearer `), then execute protected `/v1` requests. The Swagger page adds the authorization header automatically. `/v1/healthz` remains available without a token.

## Local development

Install the .NET 8 SDK, then authenticate with Google application-default credentials. Never commit a service-account key.

```sh
gcloud auth application-default login
dotnet restore FieldOps.Api/FieldOps.Api.csproj
dotnet run --project FieldOps.Api/FieldOps.Api.csproj
```

The API runs with `fieldops-260e1` as its configured Google Cloud project. Override settings with environment variables such as `GoogleCloud__ProjectId` and `Dashboard__Origins__0`. The production configuration permits both the final dashboard domain and Firebase's temporary dashboard URL.

## Deployment

Deploy the `FieldOps.Api` directory as a Cloud Run service in `us-west3`, using a dedicated service account with Firestore read access. The Cloud Run service must accept public HTTP requests because the API itself verifies the Firebase bearer token; do not rely on Cloud Run IAM as the end-user authorization layer.

```sh
gcloud run deploy fieldops-api \
  --source api/FieldOps.Api \
  --region us-west3 \
  --project fieldops-260e1 \
  --service-account fieldops-api@fieldops-260e1.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars Dashboard__Origin=https://dashboard.fracplotter.com
```

The `fieldops-api` service account needs the read-only Firestore/Datastore Viewer role in `fieldops-260e1`. Firebase Hosting owns `api.fracplotter.com` and rewrites its requests to this service; this avoids Cloud Run's preview-only direct domain mapping in `us-west3`.

The dashboard-facing API is read-focused. Its only write operations manage the CNG replacement-dispatch lifecycle; all other endpoints return operational data.
