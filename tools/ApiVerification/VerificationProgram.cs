using System.Diagnostics;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using QMAH.Infrastructure.Security;

namespace QMAH.Verification;

internal static class VerificationProgram
{
    public static async Task Main(string[] args)
    {
        await using var api = new IsolatedApi();
        using var client = api.OpenClient();
        if (args.Contains("--load"))
        {
            var outputIndex = Array.IndexOf(args, "--output");
            var output = outputIndex >= 0 ? args[outputIndex + 1] : "api-load-results.json";
            var metrics = await MeasureAsync(api, client);
            await File.WriteAllTextAsync(output, JsonSerializer.Serialize(metrics, new JsonSerializerOptions { WriteIndented = true }));
            Console.WriteLine(JsonSerializer.Serialize(metrics));
            return;
        }
        await SecurityChecksAsync(api, client);
        await AdmissionChecksAsync();
        Console.WriteLine("API pipeline security checks passed (isolated SQLite, real loopback HTTP).");
    }

    private static async Task<object> MeasureAsync(IsolatedApi api, HttpClient client)
    {
        const int durationSeconds = 5, concurrency = 16;
        // Exclude host/JIT startup from the measured scenario.
        for (var i = 0; i < 10; i++)
        {
            using var warm = await client.GetAsync("/api/v1/metadata");
            warm.EnsureSuccessStatusCode();
        }
        api.Queries.Reset();
        var samples = new ConcurrentBag<double>();
        var failures = 0;
        var timer = Stopwatch.StartNew();
        await Task.WhenAll(Enumerable.Range(0, concurrency).Select(async _ =>
        {
            while (timer.Elapsed < TimeSpan.FromSeconds(durationSeconds))
            {
                var requestTimer = Stopwatch.StartNew();
                using var response = await client.GetAsync("/api/v1/metadata");
                if (response.StatusCode != HttpStatusCode.OK) Interlocked.Increment(ref failures);
                await response.Content.LoadIntoBufferAsync();
                samples.Add(requestTimer.Elapsed.TotalMilliseconds);
            }
        }));
        timer.Stop();
        var latency = samples.ToArray();
        Array.Sort(latency);
        var requests = latency.Length;
        if (failures != 0) throw new InvalidOperationException($"Load scenario returned {failures} non-200 responses.");
        return new
        {
            scenario = "public-metadata-warm", transport = "Kestrel loopback TCP", database = "temporary SQLite, synthetic rows",
            requests, concurrency, durationSeconds, failures, queries = api.Queries.Count,
            elapsedMs = Math.Round(timer.Elapsed.TotalMilliseconds, 2),
            requestsPerSecond = Math.Round(requests / timer.Elapsed.TotalSeconds, 2),
            p50Ms = Math.Round(latency[(int)(requests * .50) - 1], 2),
            p95Ms = Math.Round(latency[(int)(requests * .95) - 1], 2),
            p99Ms = Math.Round(latency[(int)(requests * .99) - 1], 2)
        };
    }

    private static async Task SecurityChecksAsync(IsolatedApi api, HttpClient client)
    {
        await Task.WhenAll(Enumerable.Range(0, 32).Select(async _ =>
        {
            using var response = await client.GetAsync("/api/v1/metadata");
            response.EnsureSuccessStatusCode();
        }));
        Check(api.Queries.Count == 2, "a cold request burst shares one category and one era query");
        using (var metadata = await client.GetAsync("/api/v1/metadata"))
        {
            Check(metadata.StatusCode == HttpStatusCode.OK, "guest can read public metadata");
            var body = await metadata.Content.ReadFromJsonAsync<JsonElement>();
            Check(body.GetProperty("categories").GetArrayLength() == 2, "public API returns synthetic data from the isolated database");
            Check(metadata.Headers.GetValues("X-Content-Type-Options").Single() == "nosniff", "security headers are enabled");
            Check(metadata.Headers.GetValues("Set-Cookie").Any(c => c.Contains(".QMAH.Api.Antiforgery=") && c.Contains("httponly", StringComparison.OrdinalIgnoreCase)), "internal antiforgery cookie is HttpOnly");
        }
        using (var me = await client.GetAsync("/api/v1/me"))
            Check(me.StatusCode == HttpStatusCode.Unauthorized && me.Headers.Location is null, "private API returns 401 instead of a login redirect");
        using (var forged = new HttpRequestMessage(HttpMethod.Get, "/api/v1/me"))
        {
            forged.Headers.Add("Cookie", QmahSharedAuthentication.CookieName + "=forged");
            using var response = await client.SendAsync(forged);
            Check(response.StatusCode == HttpStatusCode.Unauthorized, "forged authentication cookie is rejected");
        }
        foreach (var origin in new[] { "http://localhost:4200", "https://attacker.example.invalid" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/metadata");
            request.Headers.Add("Origin", origin);
            using var response = await client.SendAsync(request);
            var allowed = response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) && values.Single() == origin;
            Check(allowed == (origin == "http://localhost:4200"), "CORS only authorizes the configured frontend origin");
        }
        var cookie = CookieFor(api, api.Members[0].Id);
        using (var admin = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/dashboard"))
        {
            admin.Headers.Add("Cookie", cookie);
            using var response = await client.SendAsync(admin);
            Check(response.StatusCode == HttpStatusCode.Forbidden, "ordinary member cannot access administrator data");
        }
        using (var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/account/logout"))
        {
            logout.Headers.Add("Cookie", cookie);
            using var response = await client.SendAsync(logout);
            Check(response.StatusCode == HttpStatusCode.BadRequest, "authenticated writes without antiforgery token are blocked");
        }
        using (var tokenRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/metadata"))
        {
            tokenRequest.Headers.Add("Cookie", cookie);
            using var tokenResponse = await client.SendAsync(tokenRequest);
            tokenResponse.EnsureSuccessStatusCode();
            var cookies = tokenResponse.Headers.GetValues("Set-Cookie").Select(value => value.Split(';')[0]).ToArray();
            var internalCookie = cookies.Single(value => value.StartsWith(".QMAH.Api.Antiforgery="));
            var token = cookies.Single(value => value.StartsWith("XSRF-TOKEN-API="))["XSRF-TOKEN-API=".Length..];
            using var validLogout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/account/logout");
            validLogout.Headers.Add("Cookie", cookie + "; " + internalCookie);
            validLogout.Headers.Add("X-XSRF-TOKEN", Uri.UnescapeDataString(token));
            using var response = await client.SendAsync(validLogout);
            Check(response.StatusCode == HttpStatusCode.NoContent, "a valid antiforgery token permits the safe logout operation");
        }
        // Deliberately omit CSRF: every admitted request must stop before the
        // controller writes anything, while still exercising the real limiter.
        for (var i = 0; i < 11; i++)
        {
            using var post = new HttpRequestMessage(HttpMethod.Post, "/api/v1/social/posts");
            post.Headers.Add("Cookie", cookie);
            post.Headers.Add("Origin", "http://localhost:4200");
            post.Content = JsonContent.Create(new { title = "not submitted", content = "synthetic" });
            using var response = await client.SendAsync(post);
            var expected = i < 10 ? HttpStatusCode.BadRequest : HttpStatusCode.TooManyRequests;
            if (response.StatusCode != expected) throw new InvalidOperationException($"Write {i + 1}: expected {expected}, got {response.StatusCode}");
            if (i == 10)
            {
                Check(response.Headers.Contains("Access-Control-Allow-Origin"), "rate-limit responses remain visible to the allowed browser origin");
                Check(response.Headers.RetryAfter is not null, "rate-limit response tells the client when it can retry");
            }
        }
        Console.WriteLine("PASS social quota rejects the 11th write before controller execution");
        using (var otherUser = new HttpRequestMessage(HttpMethod.Post, "/api/v1/social/posts"))
        {
            otherUser.Headers.Add("Cookie", CookieFor(api, api.Members[1].Id));
            otherUser.Content = JsonContent.Create(new { title = "not submitted", content = "synthetic" });
            using var response = await client.SendAsync(otherUser);
            Check(response.StatusCode == HttpStatusCode.BadRequest, "different signed-in users behind the same IP have separate write quotas");
        }
    }

    internal static string CookieFor(IsolatedApi api, Guid userId)
    {
        var options = api.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(IdentityConstants.ApplicationScheme);
        var user = api.Members.Single(member => member.Id == userId);
        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("AspNet.Identity.SecurityStamp", user.SecurityStamp!)
        ], IdentityConstants.ApplicationScheme));
        var properties = new AuthenticationProperties { IssuedUtc = DateTimeOffset.UtcNow, ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(10) };
        var ticket = new AuthenticationTicket(principal, properties, IdentityConstants.ApplicationScheme);
        return QmahSharedAuthentication.CookieName + "=" + options.TicketDataFormat.Protect(ticket);
    }

    private static async Task AdmissionChecksAsync()
    {
        await using var api = new IsolatedApi(withAdmission: true);
        using var client = api.OpenClient();
        using var anonymous = api.OpenClient();
        using (var warm = await anonymous.GetAsync("/api/v1/metadata")) warm.EnsureSuccessStatusCode();
        api.Queries.Reset();
        client.DefaultRequestHeaders.Add("Cookie", CookieFor(api, api.Members[0].Id));
        api.Queries.HoldReads = true;
        var admitted = Enumerable.Range(0, 2).Select(_ => client.GetAsync("/api/v1/admin/dashboard")).ToArray();
        try
        {
            await api.Queries.TwoReadsStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
            using (var publicRead = await anonymous.GetAsync("/api/v1/metadata"))
                Check(publicRead.StatusCode == HttpStatusCode.OK, "an overloaded account area does not block warm public catalog data");
            using var rejected = await client.GetAsync("/api/v1/me");
            Check(rejected.StatusCode == HttpStatusCode.TooManyRequests && api.Queries.Count == 2,
                "overload is rejected before another authentication database read");
            Check(rejected.Headers.RetryAfter is not null, "overload response provides backoff guidance");
        }
        finally { api.Queries.ReleaseReads.TrySetResult(); }
        foreach (var task in admitted)
        {
            using var response = await task;
            Check(response.StatusCode == HttpStatusCode.Forbidden, "admitted requests still pass through normal role authorization");
        }
        using var recovered = await client.GetAsync("/api/v1/metadata");
        Check(recovered.StatusCode == HttpStatusCode.OK, "service accepts requests again when capacity is released");
    }

    internal static void Check(bool success, string behavior)
    {
        if (!success) throw new InvalidOperationException(behavior);
        Console.WriteLine("PASS " + behavior);
    }
}
