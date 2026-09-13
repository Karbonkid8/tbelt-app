using System.Globalization;
using FieldOps.Api.Models;
using Google.Cloud.Firestore;

namespace FieldOps.Api.Services;

public sealed class FieldOpsRepository(FirestoreDb database, IConfiguration configuration)
{
    private readonly double _lowIsoThreshold = configuration.GetValue("Alerts:LowIsoThresholdInches", 18d);
    private readonly TimeSpan _staleTrailerReading = TimeSpan.FromHours(configuration.GetValue("Alerts:StaleTrailerReadingHours", 2));
    private readonly TimeSpan _staleStrap = TimeSpan.FromHours(configuration.GetValue("Alerts:StaleStrapHours", 24));

    public async Task<IReadOnlyList<SiteDto>> GetActiveSitesAsync(CancellationToken cancellationToken) =>
        (await database.Collection("sites").WhereEqualTo("active", true).GetSnapshotAsync(cancellationToken))
            .Documents.Select(site => new SiteDto(site.Id, StringValue(site, "name") ?? site.Id))
            .OrderBy(site => site.Name)
            .ToList();

    public async Task<DashboardDto?> GetDashboardAsync(string siteId, CancellationToken cancellationToken)
    {
        var site = await GetSiteAsync(siteId, cancellationToken);
        if (site is null) return null;

        var trailersTask = GetTrailersAsync(siteId, true, cancellationToken);
        var inventoryTask = GetInventoryAsync(siteId, cancellationToken);
        var wellsTask = GetActiveWellsAsync(siteId, cancellationToken);
        await Task.WhenAll(trailersTask, inventoryTask, wellsTask);

        var trailers = trailersTask.Result!;
        var inventory = inventoryTask.Result!;
        var trailerAlerts = BuildTrailerAlerts(trailers);
        var alerts = inventory.Alerts.Concat(trailerAlerts).ToList();
        return new DashboardDto(site, wellsTask.Result!, trailers, inventory, alerts, DateTimeOffset.UtcNow.ToString("O"));
    }

    public async Task<InventoryDto?> GetInventoryAsync(string siteId, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return null;
        var snapshot = await database.Collection("sites").Document(siteId).Collection("containers").GetSnapshotAsync(cancellationToken);
        var containers = snapshot.Documents.Select(ContainerFrom).OrderBy(container => container.Area).ThenBy(container => container.Name).ToList();
        return new InventoryDto(containers, _lowIsoThreshold, BuildInventoryAlerts(containers));
    }

    public async Task<IReadOnlyList<TrailerDto>?> GetTrailersAsync(string siteId, bool activeOnly, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return null;
        var trailersTask = database.Collection("sites").Document(siteId).Collection("cngTrailers").GetSnapshotAsync(cancellationToken);
        var readingsTask = database.Collection("sites").Document(siteId).Collection("cngReadings").GetSnapshotAsync(cancellationToken);
        await Task.WhenAll(trailersTask, readingsTask);

        var latestByTrailer = readingsTask.Result.Documents
            .Select(ReadingFrom)
            .GroupBy(reading => reading.TrailerId)
            .ToDictionary(group => group.Key, group => group.MaxBy(reading => ParseTimestamp(reading.RecordedAtIso))!);

        return trailersTask.Result.Documents
            .Select(document => TrailerFrom(document, latestByTrailer))
            .Where(trailer => !activeOnly || trailer.Active)
            .OrderBy(trailer => trailer.Position)
            .ToList();
    }

    private async Task<SiteDto?> GetSiteAsync(string siteId, CancellationToken cancellationToken)
    {
        var site = await database.Collection("sites").Document(siteId).GetSnapshotAsync(cancellationToken);
        return !site.Exists || !BoolValue(site, "active") ? null : new SiteDto(site.Id, StringValue(site, "name") ?? site.Id);
    }

    public async Task<IReadOnlyList<WellDto>?> GetActiveWellsAsync(string siteId, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return null;

        return (await database.Collection("sites").Document(siteId).Collection("wells").WhereEqualTo("active", true).GetSnapshotAsync(cancellationToken))
            .Documents.Select(well => new WellDto(well.Id, StringValue(well, "name") ?? well.Id, StringValue(well, "color") ?? "#7c7b7a", IntValue(well, "plannedStages")))
            .OrderBy(well => well.Name)
            .ToList();
    }

    public async Task<CngStageTotalsDto?> GetCngStageTotalsAsync(string siteId, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return null;

        var stagesTask = database.Collection("sites").Document(siteId).Collection("cngStages").GetSnapshotAsync(cancellationToken);
        var wellsTask = database.Collection("sites").Document(siteId).Collection("wells").GetSnapshotAsync(cancellationToken);
        await Task.WhenAll(stagesTask, wellsTask);

        var wellNames = wellsTask.Result.Documents.ToDictionary(
            well => well.Id,
            well => StringValue(well, "name") ?? well.Id);
        var stages = stagesTask.Result.Documents
            .Select(stage => CngStageFrom(stage, wellNames))
            .OrderByDescending(stage => ParseTimestamp(stage.EndedAtIso ?? string.Empty))
            .ThenBy(stage => stage.WellName)
            .ThenBy(stage => stage.StageNumber)
            .ToList();

        return new CngStageTotalsDto(
            stages.Sum(stage => stage.Mscf),
            stages.Count,
            stages,
            DateTimeOffset.UtcNow.ToString("O"));
    }

    public async Task<IReadOnlyList<CngTrailerTrendDto>?> GetCngPressureTrendsAsync(string siteId, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return null;

        var trailersTask = database.Collection("sites").Document(siteId).Collection("cngTrailers").GetSnapshotAsync(cancellationToken);
        var readingsTask = database.Collection("sites").Document(siteId).Collection("cngReadings").GetSnapshotAsync(cancellationToken);
        await Task.WhenAll(trailersTask, readingsTask);

        var readingsByTrailer = readingsTask.Result.Documents
            .Select(ReadingFrom)
            .GroupBy(reading => reading.TrailerId)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<ReadingDto>)group
                .OrderBy(reading => ParseTimestamp(reading.RecordedAtIso))
                .Select(reading => new ReadingDto(reading.PressurePsi, reading.TemperatureF, reading.RecordedAtIso, reading.By))
                .ToList());

        return trailersTask.Result.Documents
            .Where(document => BoolValue(document, "active"))
            .Select(document => new CngTrailerTrendDto(
                document.Id,
                StringValue(document, "trailerNumber") ?? document.Id,
                readingsByTrailer.GetValueOrDefault(document.Id, Array.Empty<ReadingDto>())))
            .OrderBy(trailer => trailer.TrailerNumber)
            .ToList();
    }

    public async Task<IReadOnlyList<CngDispatchDto>?> GetActiveCngDispatchesAsync(string siteId, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return null;

        return (await database.Collection("sites").Document(siteId).Collection("cngActiveDispatches").GetSnapshotAsync(cancellationToken))
            .Documents.Select(CngDispatchFrom)
            .OrderByDescending(dispatch => ParseTimestamp(dispatch.DispatchedAtIso))
            .ToList();
    }

    public async Task<CngDispatchCreateResult> CreateCngDispatchAsync(string siteId, CreateCngDispatchRequest request, string actor, CancellationToken cancellationToken)
    {
        var site = await GetSiteAsync(siteId, cancellationToken);
        if (site is null) return new CngDispatchCreateResult(CngDispatchCreateStatus.SiteNotFound, null);

        var siteReference = database.Collection("sites").Document(siteId);
        var trailer = await siteReference.Collection("cngTrailers").Document(request.SourceTrailerId).GetSnapshotAsync(cancellationToken);
        if (!trailer.Exists || !BoolValue(trailer, "active")) return new CngDispatchCreateResult(CngDispatchCreateStatus.TrailerNotAvailable, null);

        var dispatchReference = siteReference.Collection("cngDispatches").Document();
        var activeReference = siteReference.Collection("cngActiveDispatches").Document(request.SourceTrailerId);
        var dispatchedAt = DateTimeOffset.UtcNow;
        var dispatch = new CngDispatchDto(
            dispatchReference.Id,
            request.SourceTrailerId,
            StringValue(trailer, "trailerNumber") ?? trailer.Id,
            string.IsNullOrWhiteSpace(request.ReplacementTrailerNumber) ? null : request.ReplacementTrailerNumber.Trim(),
            "dispatched",
            request.TravelTimeHours,
            request.TargetArrivalPsi,
            dispatchedAt.ToString("O"),
            dispatchedAt.AddHours(request.TravelTimeHours).ToString("O"),
            actor,
            null,
            null);

        try
        {
            await database.RunTransactionAsync(async transaction =>
            {
                var active = await transaction.GetSnapshotAsync(activeReference);
                if (active.Exists) throw new ActiveCngDispatchExistsException();

                var fields = CngDispatchFields(dispatch);
                transaction.Set(dispatchReference, fields);
                transaction.Set(activeReference, fields);
                return 0;
            });
        }
        catch (ActiveCngDispatchExistsException)
        {
            return new CngDispatchCreateResult(CngDispatchCreateStatus.ActiveDispatchExists, null);
        }

        return new CngDispatchCreateResult(CngDispatchCreateStatus.Created, dispatch);
    }

    public async Task<IReadOnlyList<CngDispatchDto>?> GetCngDispatchHistoryAsync(string siteId, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return null;
        return (await database.Collection("sites").Document(siteId).Collection("cngDispatches").GetSnapshotAsync(cancellationToken))
            .Documents.Select(CngDispatchFrom)
            .OrderByDescending(dispatch => ParseTimestamp(dispatch.DispatchedAtIso))
            .ToList();
    }

    public async Task<CngDispatchResolveResult> ResolveCngDispatchAsync(string siteId, string dispatchId, string status, string actor, CancellationToken cancellationToken)
    {
        if (await GetSiteAsync(siteId, cancellationToken) is null) return new(CngDispatchResolveStatus.SiteNotFound, null);
        var siteReference = database.Collection("sites").Document(siteId);
        var dispatchReference = siteReference.Collection("cngDispatches").Document(dispatchId);
        try
        {
            var resolved = await database.RunTransactionAsync(async transaction =>
            {
                var document = await transaction.GetSnapshotAsync(dispatchReference);
                if (!document.Exists) throw new CngDispatchNotFoundException();
                var dispatch = CngDispatchFrom(document);
                if (dispatch.Status != "dispatched") throw new CngDispatchNotInTransitException();

                var next = dispatch with { Status = status, ResolvedAtIso = DateTimeOffset.UtcNow.ToString("O"), ResolvedBy = actor };
                transaction.Set(dispatchReference, CngDispatchFields(next));
                transaction.Delete(siteReference.Collection("cngActiveDispatches").Document(dispatch.SourceTrailerId));
                return next;
            });
            return new(CngDispatchResolveStatus.Resolved, resolved);
        }
        catch (CngDispatchNotFoundException) { return new(CngDispatchResolveStatus.DispatchNotFound, null); }
        catch (CngDispatchNotInTransitException) { return new(CngDispatchResolveStatus.NotInTransit, null); }
    }

    private TrailerDto TrailerFrom(DocumentSnapshot document, IReadOnlyDictionary<string, StoredReading> latestByTrailer)
    {
        latestByTrailer.TryGetValue(document.Id, out var reading);
        return new TrailerDto(document.Id, IntValue(document, "position"), StringValue(document, "trailerNumber") ?? document.Id, BoolValue(document, "active"), reading is null ? null : new ReadingDto(reading.PressurePsi, reading.TemperatureF, reading.RecordedAtIso, reading.By));
    }

    private static ContainerDto ContainerFrom(DocumentSnapshot document) => new(document.Id, StringValue(document, "name") ?? document.Id, StringValue(document, "type") ?? "", StringValue(document, "area") ?? "", StringValue(document, "chemical") ?? "", NumberValue(document, "strap"), StringValue(document, "updatedAtIso"));
    private static StoredReading ReadingFrom(DocumentSnapshot document) => new(StringValue(document, "trailerId") ?? "", NumberValue(document, "pressurePsi") ?? 0, NumberValue(document, "temperatureF"), StringValue(document, "recordedAtIso") ?? "", StringValue(document, "by"));
    private static CngStageDto CngStageFrom(DocumentSnapshot document, IReadOnlyDictionary<string, string> wellNames)
    {
        var wellId = StringValue(document, "wellId") ?? "";
        return new CngStageDto(
            document.Id,
            wellId,
            wellNames.GetValueOrDefault(wellId, wellId),
            IntValue(document, "stageNumber"),
            NumberValue(document, "mscf") ?? 0,
            StringValue(document, "note"),
            StringValue(document, "endedAtIso"),
            StringValue(document, "by"));
    }
    private static CngDispatchDto CngDispatchFrom(DocumentSnapshot document) => new(
        StringValue(document, "id") ?? document.Id,
        StringValue(document, "sourceTrailerId") ?? document.Id,
        StringValue(document, "sourceTrailerNumber") ?? document.Id,
        EmptyToNull(StringValue(document, "replacementTrailerNumber")),
        StringValue(document, "status") ?? "dispatched",
        NumberValue(document, "travelTimeHours") ?? 0,
        NumberValue(document, "targetArrivalPsi") ?? 0,
        StringValue(document, "dispatchedAtIso") ?? "",
        StringValue(document, "projectedArrivalIso") ?? "",
        StringValue(document, "dispatchedBy") ?? "",
        EmptyToNull(StringValue(document, "resolvedAtIso")),
        EmptyToNull(StringValue(document, "resolvedBy")));
    private static Dictionary<string, object> CngDispatchFields(CngDispatchDto dispatch) => new()
    {
        ["id"] = dispatch.Id,
        ["sourceTrailerId"] = dispatch.SourceTrailerId,
        ["sourceTrailerNumber"] = dispatch.SourceTrailerNumber,
        ["replacementTrailerNumber"] = dispatch.ReplacementTrailerNumber ?? "",
        ["status"] = dispatch.Status,
        ["travelTimeHours"] = dispatch.TravelTimeHours,
        ["targetArrivalPsi"] = dispatch.TargetArrivalPsi,
        ["dispatchedAtIso"] = dispatch.DispatchedAtIso,
        ["projectedArrivalIso"] = dispatch.ProjectedArrivalIso,
        ["dispatchedBy"] = dispatch.DispatchedBy,
        ["resolvedAtIso"] = dispatch.ResolvedAtIso ?? "",
        ["resolvedBy"] = dispatch.ResolvedBy ?? "",
    };

    private IReadOnlyList<AlertDto> BuildInventoryAlerts(IEnumerable<ContainerDto> containers)
    {
        var now = DateTimeOffset.UtcNow;
        return containers.SelectMany(container =>
        {
            if (container.Strap is null) return [new AlertDto("missing-strap", "critical", container.Id, container.Name, "No strap reading has been recorded.", container.UpdatedAtIso)];
            if (container.Type == "ISO tank" && container.Strap <= _lowIsoThreshold) return [new AlertDto("low-iso", "warning", container.Id, container.Name, $"Strap is {container.Strap:0.#} in; threshold is {_lowIsoThreshold:0.#} in.", container.UpdatedAtIso)];
            if (IsStale(container.UpdatedAtIso, now, _staleStrap)) return [new AlertDto("stale-strap", "warning", container.Id, container.Name, "Strap reading is older than the configured interval.", container.UpdatedAtIso)];
            return Array.Empty<AlertDto>();
        }).ToList();
    }

    private IReadOnlyList<AlertDto> BuildTrailerAlerts(IEnumerable<TrailerDto> trailers)
    {
        var now = DateTimeOffset.UtcNow;
        return trailers.SelectMany(trailer =>
        {
            if (trailer.LatestReading is null) return [new AlertDto("missing-trailer-reading", "critical", trailer.Id, $"Trailer {trailer.TrailerNumber}", "No pressure reading has been recorded.", null)];
            if (IsStale(trailer.LatestReading.RecordedAtIso, now, _staleTrailerReading)) return [new AlertDto("stale-trailer-reading", "warning", trailer.Id, $"Trailer {trailer.TrailerNumber}", "Trailer reading is older than the configured interval.", trailer.LatestReading.RecordedAtIso)];
            return Array.Empty<AlertDto>();
        }).ToList();
    }

    private static bool IsStale(string? timestamp, DateTimeOffset now, TimeSpan threshold) => timestamp is null || now - ParseTimestamp(timestamp) > threshold;
    private static DateTimeOffset ParseTimestamp(string timestamp) => DateTimeOffset.TryParse(timestamp, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var value) ? value : DateTimeOffset.MinValue;
    private static string? EmptyToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
    private static string? StringValue(DocumentSnapshot document, string field) => document.TryGetValue(field, out string? value) ? value : null;
    private static bool BoolValue(DocumentSnapshot document, string field) => document.TryGetValue(field, out bool value) && value;
    private static int IntValue(DocumentSnapshot document, string field) => document.TryGetValue(field, out long value) ? checked((int)value) : 0;
    private static double? NumberValue(DocumentSnapshot document, string field)
    {
        if (!document.ToDictionary().TryGetValue(field, out var rawValue)) return null;

        return rawValue switch
        {
            double value => value,
            long integer => integer,
            int integer => integer,
            _ => null,
        };
    }

    private sealed record StoredReading(string TrailerId, double PressurePsi, double? TemperatureF, string RecordedAtIso, string? By);
}

public enum CngDispatchCreateStatus { Created, SiteNotFound, TrailerNotAvailable, ActiveDispatchExists }
public sealed record CngDispatchCreateResult(CngDispatchCreateStatus Status, CngDispatchDto? Dispatch);
public sealed class ActiveCngDispatchExistsException : Exception { }
public enum CngDispatchResolveStatus { Resolved, SiteNotFound, DispatchNotFound, NotInTransit }
public sealed record CngDispatchResolveResult(CngDispatchResolveStatus Status, CngDispatchDto? Dispatch);
public sealed class CngDispatchNotFoundException : Exception { }
public sealed class CngDispatchNotInTransitException : Exception { }
