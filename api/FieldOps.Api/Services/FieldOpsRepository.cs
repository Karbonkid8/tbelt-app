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

    private TrailerDto TrailerFrom(DocumentSnapshot document, IReadOnlyDictionary<string, StoredReading> latestByTrailer)
    {
        latestByTrailer.TryGetValue(document.Id, out var reading);
        return new TrailerDto(document.Id, IntValue(document, "position"), StringValue(document, "trailerNumber") ?? document.Id, BoolValue(document, "active"), reading is null ? null : new ReadingDto(reading.PressurePsi, reading.TemperatureF, reading.RecordedAtIso, reading.By));
    }

    private static ContainerDto ContainerFrom(DocumentSnapshot document) => new(document.Id, StringValue(document, "name") ?? document.Id, StringValue(document, "type") ?? "", StringValue(document, "area") ?? "", StringValue(document, "chemical") ?? "", NumberValue(document, "strap"), StringValue(document, "updatedAtIso"));
    private static StoredReading ReadingFrom(DocumentSnapshot document) => new(StringValue(document, "trailerId") ?? "", NumberValue(document, "pressurePsi") ?? 0, NumberValue(document, "temperatureF"), StringValue(document, "recordedAtIso") ?? "", StringValue(document, "by"));

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
    private static string? StringValue(DocumentSnapshot document, string field) => document.TryGetValue(field, out string? value) ? value : null;
    private static bool BoolValue(DocumentSnapshot document, string field) => document.TryGetValue(field, out bool value) && value;
    private static int IntValue(DocumentSnapshot document, string field) => document.TryGetValue(field, out long value) ? checked((int)value) : 0;
    private static double? NumberValue(DocumentSnapshot document, string field) => document.TryGetValue(field, out double value) ? value : document.TryGetValue(field, out long integer) ? integer : null;

    private sealed record StoredReading(string TrailerId, double PressurePsi, double? TemperatureF, string RecordedAtIso, string? By);
}
