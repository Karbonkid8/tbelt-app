namespace FieldOps.Api.Models;

public sealed record SiteDto(string Id, string Name);
public sealed record WellDto(string Id, string Name, string Color, int PlannedStages);
public sealed record ReadingDto(double PressurePsi, double? TemperatureF, string RecordedAtIso, string? By);
public sealed record TrailerDto(string Id, int Position, string TrailerNumber, bool Active, ReadingDto? LatestReading);
public sealed record ContainerDto(string Id, string Name, string Type, string Area, string Chemical, double? Strap, string? UpdatedAtIso);
public sealed record CngStageDto(string Id, string WellId, string WellName, int StageNumber, double Mscf, string? Note, string? EndedAtIso, string? By);
public sealed record CngStageTotalsDto(double TotalMscf, int CompletedStageCount, IReadOnlyList<CngStageDto> Stages, string GeneratedAtIso);
public sealed record CngTrailerTrendDto(string TrailerId, string TrailerNumber, IReadOnlyList<ReadingDto> Readings);
public sealed record CngDispatchDto(string Id, string SourceTrailerId, string SourceTrailerNumber, string? ReplacementTrailerNumber, string Status, double TravelTimeHours, double TargetArrivalPsi, string DispatchedAtIso, string ProjectedArrivalIso, string DispatchedBy, string? ResolvedAtIso, string? ResolvedBy);
public sealed record CreateCngDispatchRequest(string SourceTrailerId, string? ReplacementTrailerNumber, double TravelTimeHours, double TargetArrivalPsi);
public sealed record ResolveCngDispatchRequest(string Status);
public sealed record AlertDto(string Type, string Severity, string ResourceId, string ResourceName, string Message, string? RecordedAtIso);
public sealed record InventoryDto(IReadOnlyList<ContainerDto> Containers, double LowIsoThresholdInches, IReadOnlyList<AlertDto> Alerts);
public sealed record DashboardDto(SiteDto Site, IReadOnlyList<WellDto> ActiveWells, IReadOnlyList<TrailerDto> Trailers, InventoryDto Inventory, IReadOnlyList<AlertDto> Alerts, string GeneratedAtIso);
