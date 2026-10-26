using System.Net;
using System.Net.Sockets;
using DesignThix.Logic;

namespace DesignThix.Catalogs;

/// <summary>Why a request to a provider (or to a thing a catalogue reads) failed: the person is told in German, a test checks the kind.</summary>
public enum CatalogFailure
{
    /// <summary>Not reachable, an error of the provider, a timeout: "Nicht erreichbar".</summary>
    Unavailable,

    /// <summary>A limit is used up (ours or the provider's 429).</summary>
    Limit,

    /// <summary>The key is missing or refused.</summary>
    Key,

    NotFound,

    TooLarge,

    /// <summary>The request or an answer broke a rule (another host, a redirect elsewhere, an answer that is no JSON, a licence that is not allowed).</summary>
    Refused,
}

/// <summary>A failure of a catalogue with a message for the person (German). The endpoints turn it into 429 (limit), 404, or 503 with <c>{ error }</c>.</summary>
public sealed class CatalogException(string message, CatalogFailure failure, int retryAfterSeconds = 0) : Exception(message)
{
    public CatalogFailure Failure { get; } = failure;

    public int RetryAfterSeconds { get; } = retryAfterSeconds;
}

/// <summary>What the provider said about its limits in the headers of an answer (<c>X-RateLimit-*</c>): how many, how many are left, in how many seconds the window ends.</summary>
public sealed record CatalogRate(int? Limit, int? Remaining, int? ResetSeconds, DateTime Seen);

/// <summary>What a successful request brought.</summary>
public sealed record CatalogHttpResult(int Status, string ContentType, byte[] Bytes, CatalogRate? Rate = null);

/// <summary>
/// The only way the server talks to a provider (docs/PLAN-CATALOGS.md section 4): GET only, to hosts the catalogue names (the request and every redirect), no cookies, a time limit, a size
/// limit while reading, a User-Agent that names the app. An address never comes from the browser: the browser sends item ids, the catalogue builds the address itself (SSRF).
/// <see cref="CatalogTestSeam"/> replaces the network in the tests.
/// </summary>
public sealed class CatalogHttp : IDisposable
{
    public static readonly TimeSpan SearchTimeout = TimeSpan.FromSeconds(10);

    public static readonly TimeSpan DownloadTimeout = TimeSpan.FromSeconds(60);

    /// <summary>The largest picture the import takes from a provider.</summary>
    public const long MaxDownloadBytes = 25L * 1024 * 1024;

    /// <summary>The largest answer of a search.</summary>
    public const long MaxJsonBytes = 4L * 1024 * 1024;

    /// <summary>The largest thumbnail the proxy takes.</summary>
    public const long MaxThumbBytes = 5L * 1024 * 1024;

    public const int MaxRedirects = 3;

    private readonly HttpClient _client;

    public CatalogHttp(CatalogTestSeam? seam = null)
    {
        HttpMessageHandler handler = seam is not null
            ? new SeamHandler(seam)
            : new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                UseProxy = true,
                AutomaticDecompression = DecompressionMethods.All,
                ConnectTimeout = TimeSpan.FromSeconds(10),
                PooledConnectionLifetime = TimeSpan.FromMinutes(5),
                ConnectCallback = ConnectAsync,
            };
        _client = new HttpClient(handler, disposeHandler: true) { Timeout = Timeout.InfiniteTimeSpan };
    }

    public void Dispose() => _client.Dispose();

    private static readonly HttpRequestOptionsKey<bool> GuardPrivate = new("dt-guard-private");

    /// <summary>
    /// Whether an address is one of this machine or of a private network: loopback, link-local (the metadata service of a cloud lives at 169.254.169.254), private ranges, shared address space
    /// (100.64.0.0/10), unspecified, multicast and the same behind an IPv4-mapped IPv6 address. A catalogue that is built in (Pexels, Iconify ...) is a service on the internet: its name must not lead there.
    /// </summary>
    public static bool IsPrivateAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (IPAddress.IsLoopback(address) || address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any) || address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6Multicast)
        {
            return true;
        }

        var b = address.GetAddressBytes();
        if (b.Length == 16)
        {
            // unique local fc00::/7
            return (b[0] & 0xFE) == 0xFC;
        }

        return b[0] switch
        {
            0 or 10 or 127 => true,
            100 => b[1] is >= 64 and <= 127,
            169 => b[1] == 254,
            172 => b[1] is >= 16 and <= 31,
            192 => (b[1] == 168) || (b[1] == 0 && b[2] == 0),
            198 => b[1] is 18 or 19,
            >= 224 => true,
            _ => false,
        };
    }

    /// <summary>
    /// The connection of the real client: the name is resolved HERE and a host that is guarded (a built-in catalogue's own host) is only connected to when none of its addresses is private, so a
    /// name that has been turned to point inside the network (DNS rebinding, a poisoned record) reaches nothing. Through a proxy the proxy resolves the name and cannot be checked.
    /// </summary>
    private static async ValueTask<Stream> ConnectAsync(SocketsHttpConnectionContext context, CancellationToken ct)
    {
        var guard = context.InitialRequestMessage.Options.TryGetValue(GuardPrivate, out var g) && g
            && string.Equals(context.InitialRequestMessage.RequestUri?.Host, context.DnsEndPoint.Host, StringComparison.OrdinalIgnoreCase);
        var addresses = IPAddress.TryParse(context.DnsEndPoint.Host, out var literal) ? [literal] : await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, ct);
        if (guard)
        {
            addresses = [.. addresses.Where(a => !IsPrivateAddress(a))];
            if (addresses.Length == 0)
            {
                throw new HttpRequestException("The host resolves to a private address.");
            }
        }

        Exception? last = null;
        foreach (var address in addresses)
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(new IPEndPoint(address, context.DnsEndPoint.Port), ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch (Exception ex) when (ex is SocketException or OperationCanceledException)
            {
                socket.Dispose();
                last = ex;
                if (ex is OperationCanceledException)
                {
                    throw;
                }
            }
        }

        throw new HttpRequestException("No address could be reached.", last);
    }

    /// <summary>
    /// Asks for <paramref name="url"/>. <paramref name="allowedHosts"/> are the hosts this catalogue may reach; a redirect to another host is refused (the key is only sent to the host it was meant for),
    /// plain http is only allowed with <paramref name="allowHttp"/> (an address the operator set by hand). Throws <see cref="CatalogException"/>.
    /// </summary>
    public Task<CatalogHttpResult> GetAsync(Uri url, IReadOnlyCollection<string> allowedHosts, bool allowHttp, string provider, IReadOnlyDictionary<string, string>? headers, TimeSpan timeout, long maxBytes, CancellationToken ct, IReadOnlyCollection<string>? publicHosts = null)
        => SendAsync(HttpMethod.Get, null, url, allowedHosts, allowHttp, provider, headers, timeout, maxBytes, ct, publicHosts);

    /// <summary>
    /// A POST of a small form (the token request of a provider): the same rules as <see cref="GetAsync"/>, but it is never redirected (a form with a secret goes to the address the catalogue built and nowhere else).
    /// </summary>
    public Task<CatalogHttpResult> PostFormAsync(Uri url, IReadOnlyCollection<string> allowedHosts, bool allowHttp, string provider, IReadOnlyDictionary<string, string> form, TimeSpan timeout, long maxBytes, CancellationToken ct, IReadOnlyCollection<string>? publicHosts = null)
        => SendAsync(HttpMethod.Post, form, url, allowedHosts, allowHttp, provider, null, timeout, maxBytes, ct, publicHosts);

    private async Task<CatalogHttpResult> SendAsync(HttpMethod method, IReadOnlyDictionary<string, string>? form, Uri url, IReadOnlyCollection<string> allowedHosts, bool allowHttp, string provider, IReadOnlyDictionary<string, string>? headers, TimeSpan timeout, long maxBytes, CancellationToken ct, IReadOnlyCollection<string>? publicHosts)
    {
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limit.CancelAfter(timeout);
        var current = url;
        for (var hop = 0; ; hop++)
        {
            Check(current, allowedHosts, allowHttp, provider);
            using var request = new HttpRequestMessage(method, current);
            if (form is not null)
            {
                request.Content = new FormUrlEncodedContent(form);
            }

            request.Headers.UserAgent.ParseAdd(AiProfileLogic.UserAgent);
            // the hosts the catalogue brings itself (not the one the operator typed) are public services: a connection to one of them never goes to a private address.
            // Without a list every host is guarded unless the operator allowed plain http (a fake provider on this machine).
            request.Options.Set(GuardPrivate, publicHosts is null ? !allowHttp : publicHosts.Contains(current.Host, StringComparer.OrdinalIgnoreCase));
            if (headers is not null && string.Equals(current.Host, url.Host, StringComparison.OrdinalIgnoreCase))
            {
                foreach (var (name, value) in headers)
                {
                    request.Headers.TryAddWithoutValidation(name, value);
                }
            }

            HttpResponseMessage response;
            try
            {
                response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, limit.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                throw new CatalogException($"{provider} antwortet nicht rechtzeitig. Versuch es später noch einmal.", CatalogFailure.Unavailable);
            }
            catch (HttpRequestException)
            {
                throw new CatalogException($"{provider} ist gerade nicht erreichbar.", CatalogFailure.Unavailable);
            }

            using (response)
            {
                var status = (int)response.StatusCode;
                if (status is 301 or 302 or 303 or 307 or 308)
                {
                    if (form is not null || response.Headers.Location is not { } location || hop >= MaxRedirects)
                    {
                        throw new CatalogException($"{provider} leitet die Anfrage zu oft oder ohne Ziel weiter.", CatalogFailure.Refused);
                    }

                    current = location.IsAbsoluteUri ? location : new Uri(current, location);
                    continue;
                }

                if (status == 429)
                {
                    // Retry-After (seconds or a date), else the end of the window the rate headers name, else a minute; never more than an hour, never less than a second
                    var rate = ReadRate(response);
                    var after = response.Headers.RetryAfter;
                    // (a "Retry-After: 0" says nothing: Pixabay sends it with its 429 and names the end of the window in X-RateLimit-Reset)
                    var seconds = after?.Delta is { TotalSeconds: > 0 } delta ? delta.TotalSeconds
                        : after?.Date is { } date && date > DateTimeOffset.UtcNow ? (date - DateTimeOffset.UtcNow).TotalSeconds
                        : rate?.ResetSeconds is > 0 ? rate.ResetSeconds.Value
                        : 60;
                    var wait = (int)Math.Clamp(Math.Ceiling(seconds), 1, 3600);
                    throw new CatalogException($"{provider} bremst gerade: Der Anbieter lässt im Moment keine weiteren Anfragen zu. Versuch es in {WaitText(wait)} wieder.", CatalogFailure.Limit, wait);
                }

                if (status is 401 or 403)
                {
                    throw new CatalogException($"{provider} nimmt den Schlüssel nicht an. Bitte frag eine Administratorin oder einen Administrator.", CatalogFailure.Key);
                }

                if (status is 400 or 422)
                {
                    // a provider that refuses the request itself (Pixabay answers 400 for a key it does not know)
                    throw new CatalogException($"{provider} hat die Anfrage nicht angenommen. Wenn ein Schlüssel eingetragen ist, prüfe ihn.", CatalogFailure.Refused);
                }

                if (status == 404 || status == 410)
                {
                    throw new CatalogException("Das gibt es bei " + provider + " nicht (mehr).", CatalogFailure.NotFound);
                }

                if (status is < 200 or >= 300)
                {
                    throw new CatalogException($"{provider} ist gerade nicht erreichbar.", CatalogFailure.Unavailable);
                }

                if (response.Content.Headers.ContentLength is { } declared && declared > maxBytes)
                {
                    throw new CatalogException($"Die Datei von {provider} ist zu groß (höchstens {Services.Fmt.FileSize(maxBytes)}).", CatalogFailure.TooLarge);
                }

                byte[] bytes;
                try
                {
                    bytes = await ReadAsync(response.Content, maxBytes, provider, limit.Token);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    throw new CatalogException($"{provider} antwortet nicht rechtzeitig. Versuch es später noch einmal.", CatalogFailure.Unavailable);
                }
                catch (HttpRequestException)
                {
                    throw new CatalogException($"{provider} ist gerade nicht erreichbar.", CatalogFailure.Unavailable);
                }

                return new CatalogHttpResult(status, response.Content.Headers.ContentType?.MediaType ?? "", bytes, ReadRate(response));
            }
        }
    }

    /// <summary>"in einer Minute", "in 5 Minuten", "in 2 Stunden": how long to wait, for a message (the verb of the sentence is "versuch es in ... wieder").</summary>
    public static string WaitText(int seconds)
        => seconds <= 90 ? "einer Minute" : seconds < 5400 ? $"{(int)Math.Ceiling(seconds / 60.0)} Minuten" : $"{(int)Math.Ceiling(seconds / 3600.0)} Stunden";

    /// <summary>
    /// What the provider says about its limits: <c>X-RateLimit-Limit</c> (also with a scope after the name, "20/min" counts as 20), <c>X-RateLimit-Remaining</c> or Openverse's <c>X-RateLimit-Available-*</c> (the smallest wins) and
    /// <c>X-RateLimit-Reset</c> (seconds, or a Unix time as Pexels sends it). Null when the answer names none of them.
    /// </summary>
    internal static CatalogRate? ReadRate(HttpResponseMessage response)
    {
        int? limit = null;
        int? remaining = null;
        int? reset = null;
        foreach (var header in response.Headers)
        {
            var name = header.Key.ToLowerInvariant();
            if (!name.StartsWith("x-ratelimit-", StringComparison.Ordinal))
            {
                continue;
            }

            var raw = header.Value.FirstOrDefault() ?? "";
            var digits = new string(raw.TakeWhile(char.IsAsciiDigit).ToArray());
            if (digits.Length == 0 || !long.TryParse(digits, out var number))
            {
                continue;
            }

            if (name == "x-ratelimit-limit" || name.StartsWith("x-ratelimit-limit-", StringComparison.Ordinal))
            {
                limit = (int)Math.Min(int.MaxValue, number);
            }
            else if (name == "x-ratelimit-remaining" || name.StartsWith("x-ratelimit-available", StringComparison.Ordinal))
            {
                remaining = (int)Math.Min(remaining ?? int.MaxValue, Math.Min(int.MaxValue, number));
            }
            else if (name == "x-ratelimit-reset")
            {
                var seconds = number > 1_000_000_000 ? number - DateTimeOffset.UtcNow.ToUnixTimeSeconds() : number;
                reset = (int)Math.Clamp(seconds, 0, 86400 * 40);
            }
        }

        return limit is null && remaining is null && reset is null ? null : new CatalogRate(limit, remaining, reset, DateTime.UtcNow);
    }

    /// <summary>The rules for every address a request goes to: absolute, https (http only when allowed), no credentials in it, and a host of the list.</summary>
    public static void Check(Uri url, IReadOnlyCollection<string> allowedHosts, bool allowHttp, string provider)
    {
        var schemeOk = url.Scheme == Uri.UriSchemeHttps || (allowHttp && url.Scheme == Uri.UriSchemeHttp);
        if (!url.IsAbsoluteUri || !schemeOk || !string.IsNullOrEmpty(url.UserInfo) || !allowedHosts.Contains(url.Host, StringComparer.OrdinalIgnoreCase))
        {
            throw new CatalogException($"Die Anfrage an „{url.Host}“ ist für {provider} nicht erlaubt.", CatalogFailure.Refused);
        }
    }

    private static async Task<byte[]> ReadAsync(HttpContent content, long maxBytes, string provider, CancellationToken ct)
    {
        await using var stream = await content.ReadAsStreamAsync(ct);
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > maxBytes)
            {
                throw new CatalogException($"Die Datei von {provider} ist zu groß (höchstens {Services.Fmt.FileSize(maxBytes)}).", CatalogFailure.TooLarge);
            }

            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    private sealed class SeamHandler(CatalogTestSeam seam) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            seam.Record(request);
            if (seam.Handler is null)
            {
                return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
            }

            return await seam.Handler(request, cancellationToken);
        }
    }
}
