using System.Security.Claims;
using System.Text.Encodings.Web;
using FirebaseAdmin.Auth;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace FieldOps.Api.Auth;

public static class FirebaseAuthenticationDefaults
{
    public const string Scheme = "Firebase";
}

public sealed class FirebaseAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    FirestoreDb database)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authorization = Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        try
        {
            var token = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(authorization[7..].Trim());
            var admin = await database.Collection("admins").Document(token.Uid).GetSnapshotAsync();
            if (!admin.Exists || !admin.TryGetValue("active", out bool active) || !active)
                return AuthenticateResult.Fail("An active FieldOps administrator account is required.");

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, token.Uid),
                new(ClaimTypes.Role, "admin"),
            };
            if (token.Claims.TryGetValue("email", out var email) && email is string address)
                claims.Add(new Claim(ClaimTypes.Email, address));

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
        }
        catch (FirebaseAuthException exception)
        {
            Logger.LogInformation(exception, "Rejected invalid Firebase token.");
            return AuthenticateResult.Fail("The Firebase ID token is invalid or expired.");
        }
    }
}
