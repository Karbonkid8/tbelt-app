using FirebaseAdmin;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Authentication;
using FieldOps.Api.Auth;
using FieldOps.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var projectId = builder.Configuration["GoogleCloud:ProjectId"]
    ?? throw new InvalidOperationException("GoogleCloud:ProjectId must be configured.");

FirebaseApp.Create();

builder.Services.AddSingleton(new FirestoreDbBuilder { ProjectId = projectId }.Build());
builder.Services.AddSingleton<FieldOpsRepository>();
builder.Services.AddAuthentication(FirebaseAuthenticationDefaults.Scheme)
    .AddScheme<AuthenticationSchemeOptions, FirebaseAuthenticationHandler>(
        FirebaseAuthenticationDefaults.Scheme, _ => { });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("dashboard", policy =>
    policy.WithOrigins(builder.Configuration["Dashboard:Origin"] ?? "https://dashboard.fracplotter.com")
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

v1.MapGet("/sites/{siteId}/trailers", async (string siteId, bool? active, FieldOpsRepository repository, CancellationToken cancellationToken) =>
{
    var trailers = await repository.GetTrailersAsync(siteId, active ?? true, cancellationToken);
    return trailers is null ? Results.NotFound() : Results.Ok(trailers);
})
    .WithName("GetSiteTrailers")
    .WithSummary("Returns trailers and their latest pressure and temperature readings.");

app.Run();

public partial class Program;
