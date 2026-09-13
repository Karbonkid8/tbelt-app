using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using FieldOps.Api.Auth;
using FieldOps.Api.Models;
using FieldOps.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var projectId = builder.Configuration["GoogleCloud:ProjectId"]
    ?? throw new InvalidOperationException("GoogleCloud:ProjectId must be configured.");
var dashboardOrigins = builder.Configuration.GetSection("Dashboard:Origins").Get<string[]>()
    ?? [builder.Configuration["Dashboard:Origin"] ?? "https://dashboard.fracplotter.com"];

FirebaseApp.Create(new AppOptions
{
    ProjectId = projectId,
    Credential = GoogleCredential.GetApplicationDefault(),
});

builder.Services.AddSingleton(new FirestoreDbBuilder { ProjectId = projectId }.Build());
builder.Services.AddSingleton<FieldOpsRepository>();
builder.Services.AddAuthentication(FirebaseAuthenticationDefaults.Scheme)
    .AddScheme<AuthenticationSchemeOptions, FirebaseAuthenticationHandler>(
        FirebaseAuthenticationDefaults.Scheme, _ => { });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("dashboard", policy =>
    policy.WithOrigins(dashboardOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseCors("dashboard");
app.UseAuthentication();
app.UseAuthorization();
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous()
    .WithTags("Health");

var v1 = app.MapGroup("/v1")
    .RequireAuthorization()
    .WithTags("FieldOps");

v1.MapGet("/sites", async (FieldOpsRepository repository, CancellationToken cancellationToken) =>
    Results.Ok(await repository.GetActiveSitesAsync(cancellationToken)))
    .WithName("ListActiveSites")
    .WithSummary("Lists active FieldOps locations.");

v1.MapGet("/sites/{siteId}/dashboard", async (string siteId, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var dashboard = await repository.GetDashboardAsync(siteId, cancellationToken);
    return dashboard is null ? Results.NotFound() : Results.Ok(dashboard);
})
    .WithName("GetSiteDashboard")
    .WithSummary("Returns trailer, inventory, well, and alert data for one location.");

v1.MapGet("/sites/{siteId}/inventory", async (string siteId, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var inventory = await repository.GetInventoryAsync(siteId, cancellationToken);
    return inventory is null ? Results.NotFound() : Results.Ok(inventory);
})
    .WithName("GetSiteInventory")
    .WithSummary("Returns all chemical containers and inventory alerts for one location.");

v1.MapGet("/sites/{siteId}/wells", async (string siteId, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var wells = await repository.GetActiveWellsAsync(siteId, cancellationToken);
    return wells is null ? Results.NotFound() : Results.Ok(wells);
})
    .WithName("GetActiveSiteWells")
    .WithSummary("Returns active wells for one location.");

v1.MapGet("/sites/{siteId}/cng/stages", async (string siteId, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var totals = await repository.GetCngStageTotalsAsync(siteId, cancellationToken);
    return totals is null ? Results.NotFound() : Results.Ok(totals);
})
    .WithName("GetCngStageTotals")
    .WithSummary("Returns all posted CNG stage totals and the location-wide MSCF aggregate.");

v1.MapGet("/sites/{siteId}/cng/pressure-trends", async (string siteId, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var trends = await repository.GetCngPressureTrendsAsync(siteId, cancellationToken);
    return trends is null ? Results.NotFound() : Results.Ok(trends);
})
    .WithName("GetCngPressureTrends")
    .WithSummary("Returns recorded CNG pressures for each active trailer.");

v1.MapGet("/sites/{siteId}/cng/dispatches", async (string siteId, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var dispatches = await repository.GetActiveCngDispatchesAsync(siteId, cancellationToken);
    return dispatches is null ? Results.NotFound() : Results.Ok(dispatches);
})
    .WithName("GetActiveCngDispatches")
    .WithSummary("Returns CNG replacement trailers currently in transit.");

v1.MapGet("/sites/{siteId}/cng/dispatches/history", async (string siteId, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var dispatches = await repository.GetCngDispatchHistoryAsync(siteId, cancellationToken);
    return dispatches is null ? Results.NotFound() : Results.Ok(dispatches);
})
    .WithName("GetCngDispatchHistory")
    .WithSummary("Returns CNG replacement dispatch history.");

v1.MapPost("/sites/{siteId}/cng/dispatches", async (string siteId, CreateCngDispatchRequest request, ClaimsPrincipal user, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.SourceTrailerId))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["sourceTrailerId"] = ["A source trailer is required."] });
    if (request.TravelTimeHours is < 0 or > 48)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["travelTimeHours"] = ["Travel time must be between 0 and 48 hours."] });
    if (request.TargetArrivalPsi is < 100 or > 2500)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetArrivalPsi"] = ["Target arrival pressure must be between 100 and 2,500 PSI."] });

    var actor = user.FindFirst(ClaimTypes.Email)?.Value
        ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "Unknown administrator";
    var result = await repository.CreateCngDispatchAsync(siteId, request, actor, cancellationToken);
    return result.Status switch
    {
        CngDispatchCreateStatus.SiteNotFound => Results.NotFound(),
        CngDispatchCreateStatus.TrailerNotAvailable => Results.ValidationProblem(new Dictionary<string, string[]> { ["sourceTrailerId"] = ["The selected active trailer was not found at this location."] }),
        CngDispatchCreateStatus.ActiveDispatchExists => Results.Conflict(new { message = "A replacement is already in transit for this trailer." }),
        _ => Results.Created($"/v1/sites/{siteId}/cng/dispatches/{result.Dispatch!.Id}", result.Dispatch),
    };
})
    .WithName("CreateCngDispatch")
    .WithSummary("Records a replacement CNG trailer as dispatched.");

v1.MapPatch("/sites/{siteId}/cng/dispatches/{dispatchId}", async (string siteId, string dispatchId, ResolveCngDispatchRequest request, ClaimsPrincipal user, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    if (request.Status is not ("arrived" or "cancelled"))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Status must be arrived or cancelled."] });

    var actor = user.FindFirst(ClaimTypes.Email)?.Value
        ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "Unknown administrator";
    var result = await repository.ResolveCngDispatchAsync(siteId, dispatchId, request.Status, actor, cancellationToken);
    return result.Status switch
    {
        CngDispatchResolveStatus.SiteNotFound or CngDispatchResolveStatus.DispatchNotFound => Results.NotFound(),
        CngDispatchResolveStatus.NotInTransit => Results.Conflict(new { message = "Only an in-transit replacement can be updated." }),
        _ => Results.Ok(result.Dispatch),
    };
})
    .WithName("ResolveCngDispatch")
    .WithSummary("Marks an in-transit CNG replacement as arrived or cancelled.");

v1.MapGet("/sites/{siteId}/trailers", async (string siteId, bool? active, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var trailers = await repository.GetTrailersAsync(siteId, active ?? true, cancellationToken);
    return trailers is null ? Results.NotFound() : Results.Ok(trailers);
})
    .WithName("GetSiteTrailers")
    .WithSummary("Returns trailers and their latest pressure and temperature readings.");

app.Run();

public partial class Program;
