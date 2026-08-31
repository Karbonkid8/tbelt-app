# FieldOps data model

All worksite records are stored under a location document in Firestore.

```text
admins/{adminUid}
sites/{siteId}
  containers/{containerId}
  pumpingPrograms/{areaId}
  requisitions/{requisitionId}
  accessLog/{entryId}
```

## `admins/{adminUid}`

| Field | Purpose |
| --- | --- |
| `active` | Grants active administrator access when `true`. |

## `sites/{siteId}`

| Field | Purpose |
| --- | --- |
| `name` | Human-readable worksite name. |
| `active` | Allows or blocks Site Code access. |
| `accessCodeHash` | HMAC hash of the Site Code; raw codes are never stored. |
| `createdAt`, `createdBy` | Creation audit metadata. |
| `updatedAt`, `updatedBy` | Most recent administration change. |

Deleting a site recursively deletes the container, requisition, and access-log subcollections.

## `sites/{siteId}/containers/{containerId}`

| Field | Purpose |
| --- | --- |
| `name` | Container label, such as `ISO #014`. |
| `type` | `ISO tank` or `Poly 330 gal`. |
| `area` | `Frac` or `Pump Down`. |
| `chemical` | Assigned chemical name. |
| `strap` | Most recent strap value in inches, or `null`. |
| `updatedAt`, `updatedAtIso` | Display and sortable latest-reading timestamps. |
| `history` | Newest-first array of strap entries. |

Each `history` entry contains `strap`, `at`, `atIso`, `by`, and optional `note`.

Containers may also include `setPointGpt`, the active chemical dosage in gallons per thousand gallons. A blank value means that container is not included in the Chemical Usage Calculator.

## `sites/{siteId}/pumpingPrograms/{areaId}`

There is one active record for each area: `frac` or `pump-down`.

| Field | Purpose |
| --- | --- |
| `area` | `Frac` or `Pump Down`. |
| `pumpedBbl` | Shared, current total fluid volume pumped in barrels. |
| `updatedAtIso`, `updatedBy` | Latest saved volume audit metadata. |

Target gallons are calculated in the app from `pumpedBbl × 42 ÷ 1,000 × setPointGpt`.

## `sites/{siteId}/requisitions/{requisitionId}`

| Field | Purpose |
| --- | --- |
| `items` | Requested materials, quantities, and details. |
| `notes` | Delivery or job notes. |
| `requestedBy` | Operator who submitted the request. |
| `createdAt` | ISO timestamp. |

## `sites/{siteId}/accessLog/{entryId}`

Site Code entries are written by the secure `joinSite` function. Each entry records `operatorName`, `joinedAt`, and the temporary field-user UID.

## Device-local T-Belt data

T-Belt readings, the selected Start station, the engineer phone number, and display preferences remain in browser local storage on the device. They are intentionally not stored in Firestore in `v0.1.0`.
