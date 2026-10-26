namespace DesignThix.Catalogs;

/// <summary>What the administrator set for one catalogue (page Verwaltung → Kataloge). A number of 0 means "the default of the catalogue".</summary>
public sealed class CatalogSetting
{
    /// <summary>null = the default of the catalogue (<see cref="ICatalog.EnabledByDefault"/>).</summary>
    public bool? Enabled { get; set; }

    /// <summary>The place of the catalogue among its tabs (small numbers first).</summary>
    public int Order { get; set; }

    /// <summary>Requests to the provider one person may cause per minute (an answer from the cache costs nothing; 0 = <see cref="CatalogInfo.DefaultPerUserPerMinute"/>).</summary>
    public int PerUserPerMinute { get; set; }

    /// <summary>Requests per hour that the key of the provider may make together for everybody (0 = <see cref="CatalogInfo.DefaultPerHour"/>; no budget when that is 0 too).</summary>
    public int PerHour { get; set; }

    public bool SafeSearch { get; set; } = true;

    /// <summary>Licence codes a catalogue with several licences lets through (Openverse, Iconify); empty = the defaults of the catalogue.</summary>
    public List<string> AllowedLicences { get; set; } = [];

    /// <summary>The folder catalogue: the names of the folders below <c>{data}/catalogs</c> that are offered.</summary>
    public List<string> Folders { get; set; } = [];
}

/// <summary>The setting <see cref="Logic.SettingStore.Catalogs"/>: the settings of the catalogues by id.</summary>
public sealed class CatalogsSettings
{
    public Dictionary<string, CatalogSetting> Items { get; set; } = [];
}
