# FieldOps Integration API

The FieldOps Integration API is a read-only ASP.NET Core Minimal API that provides a secured REST interface over the existing Firestore location data.

## Endpoints

All `/v1` endpoints require a Firebase ID token from an active FieldOps administrator in the `Authorization: Bearer <token>` header.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Unauthenticated liveness check. |
| `GET` | `/v1/sites` | Active locations. |
| `GET` | `/v1/sites/{siteId}/dashboard` | One-call dashboard summary: active wells, trailers, inventory, and alerts. |
| `GET` | `/v1/sites/{siteId}/inventory` | All containers plus low, stale, and missing-strap alerts. |
| `GET` | `/v1/sites/{siteId}/wells` | Active wells with their planned-stage counts and display colors. |
| `GET` | `/v1/sites/{siteId}/trailers?active=true` | Trailers with their latest pressure and temperature readings. |

Swagger documentation is available at `/swagger` once the service is running.

## Local development

Install the .NET 8 SDK, then authenticate with Google application-default credentials. Never commit a service-account key.

```sh
gcloud auth application-default login
dotnet restore FieldOps.Api/FieldOps.Api.csproj
dotnet run --project FieldOps.Api/FieldOps.Api.csproj
```

The API runs with `fieldops-260e1` as its configured Google Cloud project. Override settings with environment variables such as `GoogleCloud__ProjectId` and `Dashboard__Origin`.

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

The dashboard-facing API is intentionally read-only in its first release.
