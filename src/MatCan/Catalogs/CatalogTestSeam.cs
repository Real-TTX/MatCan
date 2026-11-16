namespace MatCan.Catalogs;

/// <summary>One request the seam saw (what a test checks: the host, the key header, how often).</summary>
public sealed record SeenRequest(string Method, Uri Url, IReadOnlyDictionary<string, string> Headers);

/// <summary>
/// The test seam of the catalogues (like <see cref="Services.Ai.AiTestSeam"/>): when it is registered (only the integration tests do) every request of <see cref="CatalogHttp"/> goes to
/// <see cref="Handler"/> instead of the network, so no test ever talks to a provider. <see cref="BaseUrls"/> names an address for a catalogue ahead of the configuration. Production never registers it.
/// </summary>
public sealed class CatalogTestSeam
{
    public Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>? Handler { get; set; }

    /// <summary>The address of a catalogue's API by id: wins over the configuration file and the environment.</summary>
    public Dictionary<string, string> BaseUrls { get; } = [];

    public List<SeenRequest> Requests { get; } = [];

    internal void Record(HttpRequestMessage request)
    {
        var headers = request.Headers.ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase);
        lock (Requests)
        {
            Requests.Add(new SeenRequest(request.Method.Method, request.RequestUri!, headers));
        }
    }

    public void Reset()
    {
        Handler = null;
        BaseUrls.Clear();
        lock (Requests)
        {
            Requests.Clear();
        }
    }
}
