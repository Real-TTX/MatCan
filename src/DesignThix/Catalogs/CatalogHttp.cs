using System.Net;
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

/// <summary>What a successful request brought.</summary>
public sealed record CatalogHttpResult(int Status, string ContentType, byte[] Bytes);

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
            };
        _client = new HttpClient(handler, disposeHandler: true) { Timeout = Timeout.InfiniteTimeSpan };
    }

    public void Dispose() => _client.Dispose();

    /// <summary>
    /// Asks for <paramref name="url"/>. <paramref name="allowedHosts"/> are the hosts this catalogue may reach; a redirect to another host is refused (the key is only sent to the host it was meant for),
    /// plain http is only allowed with <paramref name="allowHttp"/> (an address the operator set by hand). Throws <see cref="CatalogException"/>.
    /// </summary>
    public async Task<CatalogHttpResult> GetAsync(Uri url, IReadOnlyCollection<string> allowedHosts, bool allowHttp, string provider, IReadOnlyDictionary<string, string>? headers, TimeSpan timeout, long maxBytes, CancellationToken ct)
    {
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limit.CancelAfter(timeout);
        var current = url;
        for (var hop = 0; ; hop++)
        {
            Check(current, allowedHosts, allowHttp, provider);
            using var request = new HttpRequestMessage(HttpMethod.Get, current);
            request.Headers.UserAgent.ParseAdd(AiProfileLogic.UserAgent);
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
                    if (response.Headers.Location is not { } location || hop >= MaxRedirects)
                    {
                        throw new CatalogException($"{provider} leitet die Anfrage zu oft oder ohne Ziel weiter.", CatalogFailure.Refused);
                    }

                    current = location.IsAbsoluteUri ? location : new Uri(current, location);
                    continue;
                }

                if (status == 429)
                {
                    var wait = response.Headers.RetryAfter?.Delta is { } delta ? (int)Math.Min(3600, delta.TotalSeconds) : 60;
                    throw new CatalogException($"{provider} hat für diese Zeit genug Anfragen bekommen. Versuch es in ein paar Minuten wieder.", CatalogFailure.Limit, wait);
                }

                if (status is 401 or 403)
                {
                    throw new CatalogException($"{provider} nimmt den Schlüssel nicht an. Bitte frag eine Administratorin oder einen Administrator.", CatalogFailure.Key);
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

                return new CatalogHttpResult(status, response.Content.Headers.ContentType?.MediaType ?? "", bytes);
            }
        }
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
