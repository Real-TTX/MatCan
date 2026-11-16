using MatCan.Core.Data;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace MatCan.Tests.Integration;

/// <summary>
/// The migration of plan 3 (<see cref="PlatformMigration"/>, docs/PLAN-PLATFORM.md section 6) against databases of plan 2: a database of its own is made, migrated to the first schema (<c>Initial</c>),
/// filled with what the old app held (users with the roles Admin, Designer and Viewer, designs, templates, a data list, a job, uploads, fonts, a sheet layout, the global brand kit), and then brought to the
/// platform. Runs when MATCAN_TEST_DB names a server.
/// </summary>
public sealed class MigrationTests
{
    private const string InitialMigration = "20261024163455_Initial";

    private static bool Enabled => AppTests.AppFactory.Connection is not null;

    private sealed class NobodyActing : ICurrentUser
    {
        public long? UserId => null;

        public string? Name => null;

        public UserRole? Role => null;

        public bool IsAuthenticated => false;

        public bool IsAdmin => false;

        public string? IpAddress => null;

        public IDisposable RunAs(long? userId, string? name, UserRole role = UserRole.Admin) => new Nothing();

        private sealed class Nothing : IDisposable
        {
            public void Dispose()
            {
            }
        }
    }

    /// <summary>A database of its own (dropped at the end), migrated to the schema of plan 2.</summary>
    private sealed class OldDatabase : IAsyncDisposable
    {
        private readonly string _name = "matcan_mig_" + Guid.NewGuid().ToString("N")[..10];

        private readonly string _server = AppTests.AppFactory.Connection!;

        private string ConnectionString => new NpgsqlConnectionStringBuilder(_server) { Database = _name }.ConnectionString;

        public DtDbContext Open() => new(new DbContextOptionsBuilder<DtDbContext>().UseNpgsql(ConnectionString).Options, new NobodyActing(), TimeProvider.System);

        public async Task CreateAsync()
        {
            await using var admin = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(_server) { Database = "postgres" }.ConnectionString);
            await admin.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE \"{_name}\"", admin);
            await create.ExecuteNonQueryAsync();
            await using var db = Open();
            await db.GetService<IMigrator>().MigrateAsync(InitialMigration);
        }

        public async Task SqlAsync(string sql)
        {
            await using var connection = new NpgsqlConnection(ConnectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(sql, connection);
            await command.ExecuteNonQueryAsync();
        }

        public async Task<T> ScalarAsync<T>(string sql)
        {
            await using var connection = new NpgsqlConnection(ConnectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(sql, connection);
            var value = await command.ExecuteScalarAsync();
            return value is null or DBNull ? default! : (T)Convert.ChangeType(value, typeof(T));
        }

        public async ValueTask DisposeAsync()
        {
            NpgsqlConnection.ClearAllPools();
            await using var admin = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(_server) { Database = "postgres" }.ConnectionString);
            await admin.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_name}\" WITH (FORCE)", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private const string Stamp = "now(), now()";

    private static string Q(string text) => "'" + text.Replace("'", "''") + "'";

    private static async Task<long> UserAsync(OldDatabase old, string email, string role, bool deleted = false)
        => await old.ScalarAsync<long>($"INSERT INTO \"User\" (\"Email\",\"DisplayName\",\"Role\",\"IsActive\",\"Theme\",\"FailedLogins\",\"UpdateState\",\"CreateDate\",\"UpdateDate\") VALUES ({Q(email)},{Q(email)},{Q(role)},true,'system',0,{(deleted ? 0 : 1)},{Stamp}) RETURNING \"Id\"");

    private static string DocumentWith(string asset)
        => $$"""{"schema":2,"unit":"mm","width":100,"height":100,"pages":[{"id":"p1","background":{"color":"#ffffff","asset":"{{asset}}","fit":"cover"},"elements":[]}]}""";

    private static async Task<long> DesignAsync(OldDatabase old, string name, bool template, string document, int state = 1)
        => await old.ScalarAsync<long>($"INSERT INTO \"Design\" (\"Name\",\"IsTemplate\",\"DocumentJson\",\"Revision\",\"Width\",\"Height\",\"Unit\",\"UpdateState\",\"CreateDate\",\"UpdateDate\") VALUES ({Q(name)},{template},{Q(document)}::jsonb,1,100,100,'mm',{state},{Stamp}) RETURNING \"Id\"");

    private static async Task<long> AssetAsync(OldDatabase old, string key, bool builtIn)
        => await old.ScalarAsync<long>($"INSERT INTO \"Asset\" (\"Key\",\"Name\",\"Category\",\"Tags\",\"ContentType\",\"Extension\",\"Bytes\",\"ContentHash\",\"SizeBytes\",\"IsBuiltIn\",\"UpdateState\",\"CreateDate\",\"UpdateDate\") VALUES ({Q(key)},{Q(key)},'Uploads','','image/png','png','\\x0102'::bytea,{Q(key + "0000000000")},2,{builtIn},1,{Stamp}) RETURNING \"Id\"");

    // ------------------------------------------------------------------------------------------------ a database with content

    [Fact]
    public async Task A_database_of_plan_2_becomes_personal_areas_and_one_shared_team_that_keeps_everybodys_rights()
    {
        if (!Enabled)
        {
            return;
        }

        await using var old = new OldDatabase();
        await old.CreateAsync();

        var admin = await UserAsync(old, "admin@old.test", "Admin");
        var designer = await UserAsync(old, "gerd@old.test", "Designer");
        var viewer = await UserAsync(old, "bea@old.test", "Viewer");
        var gone = await UserAsync(old, "weg@old.test", "Designer", deleted: true);

        // the built-in templates and the demo are the ones the app ships; the others are somebody's
        var shipped = TemplateSeeder.Slugs().Select(s => System.Text.Json.JsonDocument.Parse(TemplateSeeder.Read(s)!).RootElement.GetProperty("name").GetString()!).First();
        var demoName = DemoSeeder.DesignName()!;
        var builtInTemplate = await DesignAsync(old, shipped, true, DocumentWith("flag-de"));
        var demoTemplate = await DesignAsync(old, demoName, true, DocumentWith("flag-de"));
        var ownTemplate = await DesignAsync(old, "Meine Vorlage", true, DocumentWith("logo-a"));
        var design = await DesignAsync(old, "Mein Schild", false, DocumentWith("logo-a"));
        var deletedDesign = await DesignAsync(old, "Gelöscht", false, DocumentWith("logo-a"), state: 0);

        await AssetAsync(old, "flag-de", builtIn: true);
        await AssetAsync(old, "logo-a", builtIn: false);
        await AssetAsync(old, "logo-b", builtIn: false);
        await old.SqlAsync($"INSERT INTO \"Font\" (\"Family\",\"Weight\",\"Style\",\"Format\",\"Bytes\",\"ContentHash\",\"SizeBytes\",\"IsBuiltIn\",\"License\",\"UpdateState\",\"CreateDate\",\"UpdateDate\") VALUES ('Eingebaut','400','normal','ttf','\\x00'::bytea,'h1',1,true,'OFL',1,{Stamp}), ('Eigene','400','normal','ttf','\\x00'::bytea,'h2',1,false,'x',1,{Stamp})");
        await old.SqlAsync($"INSERT INTO \"SheetLayout\" (\"Name\",\"PaperWidth\",\"PaperHeight\",\"MarginTop\",\"MarginLeft\",\"Columns\",\"Rows\",\"CellWidth\",\"CellHeight\",\"GapX\",\"GapY\",\"CropMarks\",\"IsBuiltIn\",\"UpdateState\",\"CreateDate\",\"UpdateDate\") VALUES ('Eingebaut',210,297,0,0,1,1,100,100,0,0,false,true,1,{Stamp}), ('Eigener',210,297,0,0,1,1,100,100,0,0,false,false,1,{Stamp})");
        var list = await old.ScalarAsync<long>($"INSERT INTO \"DataList\" (\"Name\",\"ColumnsJson\",\"ContainsPersonalData\",\"Revision\",\"UpdateState\",\"CreateDate\",\"UpdateDate\") VALUES ('Meine Liste',{Q(ColumnDefs.ToJson([new ColumnDef("Land", "Land", "image", null, null)]))}::jsonb,false,1,1,{Stamp}) RETURNING \"Id\"");
        await old.SqlAsync($"INSERT INTO \"DataRow\" (\"DataListId\",\"Position\",\"ValuesJson\",\"Copies\",\"IsActive\",\"CreateDate\",\"UpdateDate\") VALUES ({list},0,'{{\"Land\":\"logo-b\"}}'::jsonb,1,true,{Stamp})");
        var job = await old.ScalarAsync<long>($"INSERT INTO \"OutputJob\" (\"Name\",\"DesignId\",\"DataListId\",\"RowSelection\",\"SelectedRowIdsJson\",\"Copies\",\"Mode\",\"Format\",\"Dpi\",\"CropMarks\",\"Scale\",\"StartPosition\",\"FileNamePattern\",\"UpdateState\",\"CreateDate\",\"UpdateDate\") VALUES ('Mein Lauf',{design},{list},'All','[]'::jsonb,1,'Single','Print',300,false,'Fit',1,'{{Design}}-{{Nr}}',1,{Stamp}) RETURNING \"Id\"");
        await old.SqlAsync($"INSERT INTO \"Setting\" (\"Key\",\"Value\",\"CreateDate\",\"UpdateDate\") VALUES ('Brand','{{\"colors\":[\"#112233\"],\"fonts\":{{}},\"logos\":[\"logo-a\"]}}',{Stamp}), ('Demo.Seeded','2026-10-01',{Stamp})");

        await using (var db = old.Open())
        {
            await db.Database.MigrateAsync();
            Assert.True(await PlatformMigration.RunAsync(db, NullLogger.Instance));
        }

        // the roles: Admin stays, Designer and Viewer are members; everybody is approved and has a personal area of their own
        Assert.Equal(1, await old.ScalarAsync<int>("SELECT count(*) FROM \"User\" WHERE \"Role\" = 'Admin'"));
        Assert.Equal(3, await old.ScalarAsync<int>("SELECT count(*) FROM \"User\" WHERE \"Role\" = 'Member' AND \"ApprovalState\" = 'Approved'"));
        Assert.Equal(0, await old.ScalarAsync<int>("SELECT count(*) FROM \"User\" WHERE \"Role\" IN ('Designer', 'Viewer')"));
        Assert.Equal(3, await old.ScalarAsync<int>("SELECT count(*) FROM \"User\" WHERE \"PersonalSpaceId\" IS NOT NULL"));
        Assert.Equal(3, await old.ScalarAsync<int>("SELECT count(*) FROM \"SpaceMember\" m JOIN \"Space\" s ON s.\"Id\" = m.\"SpaceId\" WHERE s.\"Kind\" = 'Personal' AND m.\"Role\" = 'Owner' AND m.\"UserId\" IN (SELECT \"Id\" FROM \"User\" WHERE \"PersonalSpaceId\" = s.\"Id\")"));
        Assert.Null(await ReadAsync(old, $"SELECT \"PersonalSpaceId\"::text FROM \"User\" WHERE \"Id\" = {gone}"));

        // the team: Admin = Owner, Designer = Editor, Viewer = Viewer, so everybody keeps what they could do
        var team = await old.ScalarAsync<long>($"SELECT \"Id\" FROM \"Space\" WHERE \"Kind\" = 'Team' AND \"Name\" = {Q(PlatformMigration.TeamName)}");
        Assert.Equal("Owner", await old.ScalarAsync<string>($"SELECT \"Role\" FROM \"SpaceMember\" WHERE \"SpaceId\" = {team} AND \"UserId\" = {admin}"));
        Assert.Equal("Editor", await old.ScalarAsync<string>($"SELECT \"Role\" FROM \"SpaceMember\" WHERE \"SpaceId\" = {team} AND \"UserId\" = {designer}"));
        Assert.Equal("Viewer", await old.ScalarAsync<string>($"SELECT \"Role\" FROM \"SpaceMember\" WHERE \"SpaceId\" = {team} AND \"UserId\" = {viewer}"));
        Assert.Equal(0, await old.ScalarAsync<int>($"SELECT count(*) FROM \"SpaceMember\" WHERE \"SpaceId\" = {team} AND \"UserId\" = {gone}"));
        Assert.Contains("#112233", await old.ScalarAsync<string>($"SELECT \"BrandJson\"::text FROM \"Space\" WHERE \"Id\" = {team}"));

        // the content went into the team, what the platform ships stayed without an area
        foreach (var system in new[] { builtInTemplate, demoTemplate })
        {
            Assert.Null(await ReadAsync(old, $"SELECT \"SpaceId\"::text FROM \"Design\" WHERE \"Id\" = {system}"));
        }

        foreach (var own in new[] { ownTemplate, design })
        {
            Assert.Equal(team, await old.ScalarAsync<long>($"SELECT \"SpaceId\" FROM \"Design\" WHERE \"Id\" = {own}"));
        }

        Assert.Equal(team, await old.ScalarAsync<long>($"SELECT \"SpaceId\" FROM \"DataList\" WHERE \"Id\" = {list}"));
        Assert.Equal(team, await old.ScalarAsync<long>($"SELECT \"SpaceId\" FROM \"OutputJob\" WHERE \"Id\" = {job}"));
        Assert.Equal(2, await old.ScalarAsync<int>($"SELECT count(*) FROM \"Asset\" WHERE \"SpaceId\" = {team} AND NOT \"IsBuiltIn\""));
        Assert.Equal(0, await old.ScalarAsync<int>("SELECT count(*) FROM \"Asset\" WHERE \"IsBuiltIn\" AND \"SpaceId\" IS NOT NULL"));
        Assert.Equal(1, await old.ScalarAsync<int>($"SELECT count(*) FROM \"Font\" WHERE \"SpaceId\" = {team} AND NOT \"IsBuiltIn\""));
        Assert.Equal(1, await old.ScalarAsync<int>($"SELECT count(*) FROM \"SheetLayout\" WHERE \"SpaceId\" = {team} AND NOT \"IsBuiltIn\""));
        Assert.Equal(0, await old.ScalarAsync<int>("SELECT count(*) FROM \"Font\" WHERE \"IsBuiltIn\" AND \"SpaceId\" IS NOT NULL"));
        Assert.Equal(deletedDesign, await old.ScalarAsync<long>($"SELECT \"Id\" FROM \"Design\" WHERE \"Id\" = {deletedDesign} AND \"UpdateState\" = 0"));

        // the images every design and list uses are known
        Assert.Contains("logo-a", await RefsAsync(old, "Design", design));
        Assert.Contains("flag-de", await RefsAsync(old, "Design", builtInTemplate));
        Assert.Equal(["logo-b"], await RefsAsync(old, "DataList", list));

        // the demo is not seeded again, and a second run does nothing
        Assert.Equal(1, await old.ScalarAsync<int>($"SELECT count(*) FROM \"Setting\" WHERE \"Key\" = {Q(DemoSeeder.PersonalMarker)}"));
        await using (var db = old.Open())
        {
            Assert.False(await PlatformMigration.RunAsync(db, NullLogger.Instance));
        }

        Assert.Equal(1, await old.ScalarAsync<int>("SELECT count(*) FROM \"Space\" WHERE \"Kind\" = 'Team'"));
        Assert.Equal(4, await old.ScalarAsync<int>("SELECT count(*) FROM \"Space\""));
    }

    private static Task<string?> ReadAsync(OldDatabase old, string sql) => old.ScalarAsync<string?>(sql);

    private static async Task<List<string>> RefsAsync(OldDatabase old, string kind, long id)
    {
        await using var db = old.Open();
        return await db.ItemAssetRef.AsNoTracking().Where(r => r.ItemKind == Enum.Parse<ItemKind>(kind) && r.ItemId == id).Select(r => r.AssetKey).OrderBy(k => k).ToListAsync();
    }

    // ------------------------------------------------------------------------------------------------ without content, and a fresh database

    [Fact]
    public async Task A_database_with_only_an_administrator_gets_a_personal_area_and_no_team()
    {
        if (!Enabled)
        {
            return;
        }

        await using var old = new OldDatabase();
        await old.CreateAsync();
        await UserAsync(old, "admin@old.test", "Admin");
        await DesignAsync(old, DemoSeeder.DesignName()!, true, DocumentWith("flag-de"));
        await AssetAsync(old, "flag-de", builtIn: true);
        await using (var db = old.Open())
        {
            await db.Database.MigrateAsync();
            Assert.True(await PlatformMigration.RunAsync(db, NullLogger.Instance));
        }

        Assert.Equal(0, await old.ScalarAsync<int>("SELECT count(*) FROM \"Space\" WHERE \"Kind\" = 'Team'"));
        Assert.Equal(1, await old.ScalarAsync<int>("SELECT count(*) FROM \"Space\" WHERE \"Kind\" = 'Personal'"));
        Assert.Null(await ReadAsync(old, "SELECT \"SpaceId\"::text FROM \"Design\" LIMIT 1"));
    }

    [Fact]
    public async Task A_fresh_database_gets_nothing_but_the_marker_so_the_demo_is_still_to_come()
    {
        if (!Enabled)
        {
            return;
        }

        await using var old = new OldDatabase();
        await old.CreateAsync();
        await using (var db = old.Open())
        {
            await db.Database.MigrateAsync();
            Assert.True(await PlatformMigration.RunAsync(db, NullLogger.Instance));
        }

        Assert.Equal(0, await old.ScalarAsync<int>("SELECT count(*) FROM \"Space\""));
        Assert.Equal(1, await old.ScalarAsync<int>($"SELECT count(*) FROM \"Setting\" WHERE \"Key\" = {Q(PlatformMigration.Marker)}"));
        Assert.Equal(0, await old.ScalarAsync<int>($"SELECT count(*) FROM \"Setting\" WHERE \"Key\" = {Q(DemoSeeder.PersonalMarker)}"));
    }
}
