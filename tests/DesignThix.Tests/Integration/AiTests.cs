using System.Text.Json;
using DesignThix.Core.Ai;
using DesignThix.Core.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The AI actions against a real PostgreSQL with a fake chat client (<see cref="AiTestSeam"/>): propose, check in code, apply, journal, undo; the personal-data refusal; the limits
/// (checked before the model is called); the roles; the nudges, the empty answer and the exact instruction. Runs when DESIGNTHIX_TEST_DB names a server; returns at once otherwise.
/// </summary>
[Collection("app")]
public sealed class AiIntegrationTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private AiTestSeam Seam => Factory.Services.GetRequiredService<AiTestSeam>();

    // The numbers the tests use for people (5, 6, 71 ...) are made real accounts on first use. They all work in one team of the test (the first is its Owner, the others Editors, the viewer a Viewer),
    // so what one of them makes is theirs to change, and the viewer only looks.
    private long? _team;
    private readonly Dictionary<long, long> _real = [];

    private async Task<long> RealAsync(Role role, long logical)
    {
        if (_real.TryGetValue(logical, out var known))
        {
            return known;
        }

        var id = await NewUserAsync(Factory, "ai" + logical);
        if (_team is null)
        {
            _team = (await AsUser(id, biz => SpaceLogic.CreateTeamAsync(biz, "KI-Team " + Guid.NewGuid().ToString("N")[..6]))).Id;
        }
        else
        {
            var owner = _real.Values.First();
            await AsUser(owner, biz => SpaceLogic.AddMemberAsync(biz, _team.Value, id, role == Role.Viewer ? SpaceRole.Viewer : SpaceRole.Editor));
        }

        _real[logical] = id;
        return id;
    }

    private async Task<T> As<T>(Role role, long userId, Func<Biz, Task<T>> action)
        => await AsUser(await RealAsync(role, userId), action, role == Role.Admin ? UserRole.Admin : UserRole.Member);

    private new Task<T> As<T>(Role role, Func<Biz, Task<T>> action) => As(role, 1, action);

    private async Task As(Role role, long userId, Func<Biz, Task> action)
        => await As(role, userId, async biz =>
        {
            await action(biz);
            return 0;
        });

    private new Task As(Role role, Func<Biz, Task> action) => As(role, 1, action);

    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    private static JsonElement Json(string? text) => JsonDocument.Parse(text ?? "{}").RootElement.Clone();

    /// <summary>The settings of a test: everything on, no brake, no budget (a test that wants a limit sets one), no fake answer.</summary>
    private async Task ResetAsync(Action<AiSettings>? change = null)
    {
        Seam.Handler = null;
        lock (Seam.Requests)
        {
            Seam.Requests.Clear();
        }

        var settings = new AiSettings { PerMinutePerAddress = 0, UserDailyTokens = 0, UserMonthlyTokens = 0, MonthlyTokens = 0, AddressDailyRuns = 0 };
        change?.Invoke(settings);
        await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Ai, settings, "Test"));
    }

    /// <summary>The model answers with <paramref name="text"/>; the calls are counted.</summary>
    private (Func<int> Calls, Action<string> Say) Fake(string text, int prompt = 0, int completion = 0)
    {
        var calls = 0;
        var answer = text;
        Seam.Handler = (_, _) =>
        {
            Interlocked.Increment(ref calls);
            return Task.FromResult(new AiResponse { Ok = true, Text = answer, PromptTokens = prompt, CompletionTokens = completion });
        };
        return (() => calls, t => answer = t);
    }

    private async Task<(DataList List, List<long> Ids)> ListAsync(Biz biz, bool personal = false, params (string Name, string Region)[] rows)
    {
        var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("KI-Liste "), null, personal), _team);
        await DataListLogic.SaveColumnsAsync(biz, list.Id, [new("Name", "Name", "text", null, null), new("Region", "Region", "text", null, null), new("Preis", "Preis", "price", 2, null), new("Land", "Land", "image", null, "Flaggen")]);
        var revision = (await DataListLogic.GetAsync(biz, list.Id))!.Revision;
        var (_, ids) = await DataListLogic.SaveRowsAsync(biz, list.Id, revision, [.. rows.Select(r => new GridRow(null, new Dictionary<string, string> { ["Name"] = r.Name, ["Region"] = r.Region }, 1, true))]);
        return (list, ids);
    }

    private static async Task<Dictionary<long, Dictionary<string, string>>> ValuesAsync(Biz biz, long listId)
        => (await biz.Db.DataRow.AsNoTracking().Where(r => r.DataListId == listId).ToListAsync()).ToDictionary(r => r.Id, r => DataListLogic.ParseValues(r.ValuesJson));

    private static Task<int> RevisionAsync(Biz biz, long listId) => biz.Db.DataList.AsNoTracking().Where(l => l.Id == listId).Select(l => l.Revision).FirstAsync();

    // ------------------------------------------------------------------------------------------------ data import

    [Fact]
    public async Task An_import_is_checked_in_code_applied_with_a_journal_and_undone_exactly()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (calls, _) = Fake("""
            {"rows": [
              {"Name": "Gouda", "Region": "Südholland", "Preis": "2,5 €", "Land": "FLAG-NL"},
              {"Name": "<script>alert(1)</script>", "Preis": "1", "Passwort": "geheim"},
              {"Name": "Brie", "Land": "flag-zz"}
            ], "notes": "Drei Käse."}
            """, 120, 80);

        var (list, existing, propose) = await As(Role.Designer, 5, async biz =>
        {
            var (l, ids) = await ListAsync(biz, false, ("Alt", "x"));
            var result = await AiDataLogic.ProposeImportAsync(biz, l.Id, new AiDataLogic.ImportInput("Gouda 2,50 Niederlande\nBrie ...", "Preise pro 100 g"));
            return (l, ids, result);
        });

        Assert.True(propose.Ok);
        Assert.Equal(AiRunStatus.Waiting, propose.Status);
        Assert.Equal(1, calls());
        var proposal = Json(propose.Json);
        Assert.Equal("import", proposal.GetProperty("kind").GetString());
        var rows = proposal.GetProperty("rows").EnumerateArray().ToList();
        Assert.Equal(3, rows.Count);
        Assert.Equal("Gouda", rows[0].GetProperty("values").GetProperty("Name").GetString());
        Assert.Equal("2,50", rows[0].GetProperty("values").GetProperty("Preis").GetString());
        Assert.Equal("flag-nl", rows[0].GetProperty("values").GetProperty("Land").GetString());
        Assert.False(rows[1].GetProperty("values").TryGetProperty("Name", out _));
        Assert.Contains("Skript", rows[1].GetProperty("warnings").GetProperty("Name").GetString());
        Assert.False(rows[2].GetProperty("values").TryGetProperty("Land", out _));
        Assert.Contains("flag-zz", rows[2].GetProperty("warnings").GetProperty("Land").GetString());
        Assert.Contains(proposal.GetProperty("warnings").EnumerateArray(), w => w.GetString()!.Contains("Passwort"));

        // nothing is written before "Übernehmen"
        await As(Role.Designer, 5, async biz => Assert.Single(await ValuesAsync(biz, list.Id)));

        var revisionBefore = await As(Role.Designer, 5, biz => RevisionAsync(biz, list.Id));
        var applied = await As(Role.Designer, 5, biz => AiDataLogic.ApplyAsync(biz, propose.RunId, [0, 2]));
        Assert.Equal(2, applied.Count);
        await As(Role.Designer, 5, async biz =>
        {
            var values = await ValuesAsync(biz, list.Id);
            Assert.Equal(3, values.Count);
            Assert.Contains(values.Values, v => v["Name"] == "Gouda" && v["Land"] == "flag-nl");
            Assert.Contains(values.Values, v => v["Name"] == "Brie" && !v.ContainsKey("Land"));
            Assert.Equal(revisionBefore + 1, await RevisionAsync(biz, list.Id));
            var run = await biz.Db.AiRun.AsNoTracking().Include(r => r.Steps).FirstAsync(r => r.Id == propose.RunId);
            Assert.Equal(AiRunStatus.Done, run.Status);
            Assert.Equal(200, run.TotalTokens);
            Assert.Equal(await RealAsync(Role.Designer, 5), run.UserId);
            Assert.Equal(list.Id, run.SubjectId);
            Assert.Equal(2, await biz.Db.AiJournalEntry.CountAsync(j => j.AiRunId == run.Id && j.EntityType == "DataRow"));
            Assert.Contains(run.Steps, s => s.Kind == AiStepKind.Message && s.Text.Contains("Gouda 2,50 Niederlande") && s.Text.Contains("Preise pro 100 g") && s.Text.Contains("flag-nl"));
            Assert.Contains(run.Steps, s => s.Kind == AiStepKind.Warning);
            // applying twice does nothing
            await Assert.ThrowsAsync<BizException>(() => AiDataLogic.ApplyAsync(biz, run.Id, null));
        });

        // somebody edits one of the imported rows by hand: the undo takes back the other one and says so
        await As(Role.Designer, 6, async biz =>
        {
            var grid = await DataListLogic.GridAsync(biz, list.Id);
            var brie = grid.Rows.First(r => r.Values.GetValueOrDefault("Name") == "Brie");
            var edited = grid.Rows.Select(r => r.Id == brie.Id ? r with { Values = new Dictionary<string, string>(r.Values) { ["Name"] = "Brie de Meaux" } } : r).ToList();
            await DataListLogic.SaveRowsAsync(biz, list.Id, grid.Revision, edited);
        });

        var message = await As(Role.Designer, 5, biz => AiLogic.UndoAsync(biz, propose.RunId));
        Assert.Contains("von Hand geändert", message);
        await As(Role.Designer, 5, async biz =>
        {
            var values = (await ValuesAsync(biz, list.Id)).Values.Select(v => v["Name"]).Order().ToList();
            Assert.Equal(["Alt", "Brie de Meaux"], values);
            await Assert.ThrowsAsync<BizException>(() => AiLogic.UndoAsync(biz, propose.RunId));
        });
    }

    [Fact]
    public async Task An_untouched_import_is_undone_completely_and_a_discarded_proposal_changes_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Fake("""{"rows": [{"Name": "A"}, {"Name": "B"}]}""");
        await As(Role.Designer, async biz =>
        {
            var (list, _) = await ListAsync(biz, false, ("Alt", ""));
            var first = await AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A\nB", null));
            var applied = await AiDataLogic.ApplyAsync(biz, first.RunId, null);
            Assert.Equal(2, applied.Count);
            Assert.Equal(3, (await ValuesAsync(biz, list.Id)).Count);
            Assert.Equal("Rückgängig gemacht.", await AiLogic.UndoAsync(biz, first.RunId));
            Assert.Equal(["Alt"], (await ValuesAsync(biz, list.Id)).Values.Select(v => v["Name"]));

            var second = await AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A\nB", null));
            await AiDataLogic.DiscardAsync(biz, second.RunId);
            Assert.Single(await ValuesAsync(biz, list.Id));
            Assert.Equal(AiRunStatus.Cancelled, (await biz.Db.AiRun.AsNoTracking().FirstAsync(r => r.Id == second.RunId)).Status);
            await Assert.ThrowsAsync<BizException>(() => AiDataLogic.ApplyAsync(biz, second.RunId, null));
        });
    }

    [Fact]
    public async Task An_import_checks_its_input_before_the_model_is_called()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (calls, _) = Fake("""{"rows": []}""");
        await As(Role.Designer, async biz =>
        {
            var (list, _) = await ListAsync(biz);
            await Assert.ThrowsAsync<BizException>(() => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("   ", null)));
            await Assert.ThrowsAsync<BizException>(() => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput(new string('x', AiDataLogic.MaxImportChars + 1), null)));
            await Assert.ThrowsAsync<NotFoundException>(() => AiDataLogic.ProposeImportAsync(biz, 99999999, new AiDataLogic.ImportInput("x", null)));
            var empty = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Ohne Spalten "), null, false));
            await Assert.ThrowsAsync<BizException>(() => AiDataLogic.ProposeImportAsync(biz, empty.Id, new AiDataLogic.ImportInput("x", null)));
        });
        Assert.Equal(0, calls());
    }

    // ------------------------------------------------------------------------------------------------ data fill

    [Fact]
    public async Task A_fill_is_checked_applied_with_the_revision_and_undone_to_the_old_values()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (_, say) = Fake("{}");
        var (list, ids) = await As(Role.Designer, 5, biz => ListAsync(biz, false, ("Gouda", ""), ("Brie", "alt"), ("Edamer", "")));
        var input = (long[] rows) => new AiDataLogic.FillInput(rows, "Region", ["Name"], "Schreibe die Region passend zum Namen");

        // the model also answers for a row that was not selected and for one with a script: both are dropped
        say($$"""{"values": [{"row": {{ids[0]}}, "value": "Südholland"}, {"row": {{ids[1]}}, "value": "<script>x</script>"}, {"row": {{ids[2]}}, "value": "Edam-Volendam"}]}""");
        var propose = await As(Role.Designer, 5, biz => AiDataLogic.ProposeFillAsync(biz, list.Id, input([ids[0], ids[1]])));
        Assert.True(propose.Ok);
        var proposal = Json(propose.Json);
        var values = proposal.GetProperty("values").EnumerateArray().ToList();
        Assert.Single(values);
        Assert.Equal(ids[0], values[0].GetProperty("row").GetInt64());
        Assert.Equal("Südholland", values[0].GetProperty("new").GetString());
        Assert.Equal("", values[0].GetProperty("old").GetString());
        Assert.Equal(1, values[0].GetProperty("n").GetInt32());
        Assert.Contains(proposal.GetProperty("warnings").EnumerateArray(), w => w.GetString()!.Contains("nicht ausgewählt"));
        Assert.Contains(proposal.GetProperty("warnings").EnumerateArray(), w => w.GetString()!.Contains("Skript"));

        var revision = await As(Role.Designer, 5, biz => RevisionAsync(biz, list.Id));
        var applied = await As(Role.Designer, 5, biz => AiDataLogic.ApplyAsync(biz, propose.RunId, [ids[0]]));
        Assert.Equal(1, applied.Count);
        await As(Role.Designer, 5, async biz =>
        {
            var now = await ValuesAsync(biz, list.Id);
            Assert.Equal("Südholland", now[ids[0]]["Region"]);
            Assert.Equal("alt", now[ids[1]]["Region"]);
            Assert.False(now[ids[2]].ContainsKey("Region"));
            Assert.Equal(revision + 1, await RevisionAsync(biz, list.Id));
            var entry = await biz.Db.AiJournalEntry.AsNoTracking().SingleAsync(j => j.AiRunId == propose.RunId);
            Assert.Equal(("DataRow", ids[0], "Region", "", "Südholland"), (entry.EntityType, entry.EntityId, entry.Field, entry.OldValue ?? "", entry.NewValue));
        });

        await As(Role.Designer, 5, biz => AiLogic.UndoAsync(biz, propose.RunId));
        await As(Role.Designer, 5, async biz => Assert.False((await ValuesAsync(biz, list.Id))[ids[0]].ContainsKey("Region")));

        // a proposal whose list changed meanwhile is refused (the revision check), nothing is written
        say($$"""{"values": [{"row": {{ids[0]}}, "value": "Nochmal"}]}""");
        var stale = await As(Role.Designer, 5, biz => AiDataLogic.ProposeFillAsync(biz, list.Id, input([ids[0]])));
        await As(Role.Designer, 6, async biz =>
        {
            var grid = await DataListLogic.GridAsync(biz, list.Id);
            await DataListLogic.SaveRowsAsync(biz, list.Id, grid.Revision, [.. grid.Rows]);
        });
        var conflict = await Assert.ThrowsAsync<RevisionConflictException>(() => As(Role.Designer, 5, biz => AiDataLogic.ApplyAsync(biz, stale.RunId, null)));
        Assert.True(conflict.CurrentRevision > revision);
        await As(Role.Designer, 5, async biz => Assert.False((await ValuesAsync(biz, list.Id))[ids[0]].ContainsKey("Region")));
    }

    [Fact]
    public async Task Runs_are_undone_newest_first_and_a_value_changed_since_is_left_alone()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (_, say) = Fake("{}");
        var (list, ids) = await As(Role.Designer, biz => ListAsync(biz, false, ("Gouda", "Ausgang")));
        var input = new AiDataLogic.FillInput([ids[0]], "Region", null, "Region");

        async Task<AiActionResult> FillAsync(string value)
        {
            say($$"""{"values": [{"row": {{ids[0]}}, "value": "{{value}}"}]}""");
            return await As(Role.Designer, async biz =>
            {
                var result = await AiDataLogic.ProposeFillAsync(biz, list.Id, input);
                await AiDataLogic.ApplyAsync(biz, result.RunId, null);
                return result;
            });
        }

        var first = await FillAsync("Eins");
        var second = await FillAsync("Zwei");

        var blocked = await As(Role.Designer, async biz => await Assert.ThrowsAsync<BizException>(() => AiLogic.UndoAsync(biz, first.RunId)));
        Assert.Contains($"#{second.RunId}", blocked.Message);

        await As(Role.Designer, async biz =>
        {
            Assert.Equal("Rückgängig gemacht.", await AiLogic.UndoAsync(biz, second.RunId));
            Assert.Equal("Eins", (await ValuesAsync(biz, list.Id))[ids[0]]["Region"]);
        });

        // changed by hand since: the undo leaves it and says so
        await As(Role.Designer, async biz =>
        {
            var grid = await DataListLogic.GridAsync(biz, list.Id);
            await DataListLogic.SaveRowsAsync(biz, list.Id, grid.Revision, [.. grid.Rows.Select(r => r with { Values = new Dictionary<string, string>(r.Values) { ["Region"] = "Von Hand" } })]);
            var message = await AiLogic.UndoAsync(biz, first.RunId);
            Assert.Contains("von Hand geändert", message);
            Assert.Equal("Von Hand", (await ValuesAsync(biz, list.Id))[ids[0]]["Region"]);
        });
    }

    [Fact]
    public async Task A_fill_needs_rows_a_column_and_an_instruction_and_stays_below_the_row_limit()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (calls, _) = Fake("""{"values": []}""");
        await As(Role.Designer, async biz =>
        {
            var (list, ids) = await ListAsync(biz, false, ("A", ""));
            Task<AiActionResult> Go(AiDataLogic.FillInput i) => AiDataLogic.ProposeFillAsync(biz, list.Id, i);
            await Assert.ThrowsAsync<BizException>(() => Go(new([], "Region", null, "x")));
            await Assert.ThrowsAsync<BizException>(() => Go(new(ids, "Gibtsnicht", null, "x")));
            await Assert.ThrowsAsync<BizException>(() => Go(new(ids, "Region", null, "  ")));
            await Assert.ThrowsAsync<BizException>(() => Go(new(ids, "Region", ["Nope"], "x")));
            await Assert.ThrowsAsync<BizException>(() => Go(new([.. Enumerable.Range(1, AiDataLogic.MaxFillRows + 1).Select(i => (long)i)], "Region", null, "x")));
            await Assert.ThrowsAsync<BizException>(() => Go(new([424242], "Region", null, "x")));
        });
        Assert.Equal(0, calls());
    }

    // ------------------------------------------------------------------------------------------------ personal data

    [Fact]
    public async Task A_list_with_personal_data_is_refused_unless_the_administrator_allows_it()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (calls, _) = Fake("""{"rows": [{"Name": "Max"}]}""");
        var (list, ids) = await As(Role.Designer, biz => ListAsync(biz, true, ("Max Mustermann", "")));

        var refused = await As(Role.Designer, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("Max", null)));
        Assert.False(refused.Ok);
        Assert.Equal("refused", refused.Code);
        Assert.Contains("personenbezogene Daten", refused.Error);
        Assert.Equal(0, calls());
        await As(Role.Designer, async biz =>
        {
            var run = await biz.Db.AiRun.AsNoTracking().Include(r => r.Steps).FirstAsync(r => r.Id == refused.RunId);
            Assert.Equal(AiRunStatus.Cancelled, run.Status);
            Assert.DoesNotContain(run.Steps, s => s.Kind == AiStepKind.Message);
            await Assert.ThrowsAsync<BizException>(() => AiDataLogic.ImportPromptAsync(biz, list.Id, new AiDataLogic.ImportInput("Max", null)));
            await Assert.ThrowsAsync<BizException>(() => AiDataLogic.FillPromptAsync(biz, list.Id, new AiDataLogic.FillInput(ids, "Region", null, "x")));
            Assert.NotNull(AiDataLogic.BlockedReason(biz, (await DataListLogic.GetAsync(biz, list.Id))!));
        });

        var refusedFill = await As(Role.Designer, biz => AiDataLogic.ProposeFillAsync(biz, list.Id, new AiDataLogic.FillInput(ids, "Region", null, "x")));
        Assert.Equal("refused", refusedFill.Code);
        Assert.Equal(0, calls());

        await ResetAsync(s => s.SendPersonalData = true);
        Fake("""{"rows": [{"Name": "Max"}]}""");
        var allowed = await As(Role.Designer, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("Max", null)));
        Assert.True(allowed.Ok);
        await As(Role.Designer, async biz => Assert.Null(AiDataLogic.BlockedReason(biz, (await DataListLogic.GetAsync(biz, list.Id))!)));
    }

    // ------------------------------------------------------------------------------------------------ limits, before the model is called

    [Fact]
    public async Task The_limits_are_checked_before_the_model_is_called()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.UserDailyTokens = 150);
        var (calls, _) = Fake("""{"rows": [{"Name": "A"}]}""", 100, 100);
        var (list, _) = await As(Role.Designer, 71, biz => ListAsync(biz));
        Task<AiActionResult> Go(long user) => As(Role.Designer, user, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));

        Assert.True((await Go(71)).Ok);
        Assert.Equal(1, calls());
        var day = await Go(71);
        Assert.False(day.Ok);
        Assert.Equal(AiRunStatus.LimitReached, day.Status);
        Assert.Contains("Tagesbudget", day.Error);
        Assert.Equal(1, calls());
        Assert.True((await Go(72)).Ok);   // another person has a budget of their own
        Assert.Equal(2, calls());

        await ResetAsync(s => s.UserMonthlyTokens = 150);
        Fake("""{"rows": [{"Name": "A"}]}""", 100, 100);
        Assert.True((await Go(73)).Ok);
        var month = await Go(73);
        Assert.Equal(AiRunStatus.LimitReached, month.Status);
        Assert.Contains("Monatsbudget", month.Error);

        // the budget of everybody together
        await ResetAsync();
        var (callsAll, _) = Fake("""{"rows": [{"Name": "A"}]}""", 10, 10);
        Assert.True((await Go(74)).Ok);
        await ResetAsync(s => s.MonthlyTokens = 1);
        Fake("""{"rows": [{"Name": "A"}]}""", 10, 10);
        var all = await Go(75);
        Assert.Equal(AiRunStatus.LimitReached, all.Status);
        Assert.Contains("Monatsbudget", all.Error);
        Assert.Equal(1, callsAll());

        // the brake per minute (one address) and the runs per day of one address (a daily hash, never the address)
        await ResetAsync(s => s.PerMinutePerAddress = 1);
        var (callsBrake, _) = Fake("""{"rows": [{"Name": "A"}]}""", 1, 1);
        Assert.True((await Go(76)).Ok);
        var brake = await Go(76);
        Assert.Equal(AiRunStatus.LimitReached, brake.Status);
        Assert.Contains("Zu viele Anfragen", brake.Error);
        Assert.Equal(1, callsBrake());

        await ResetAsync(s => s.AddressDailyRuns = 1);
        var dayCalls = 0;
        await As(Role.Designer, 77, async biz =>
        {
            AiLogic.Call Call() => new(AiAction.Test, "Hallo", null, null, null, biz.UserId, "203.0.113.7");
            Seam.Handler = (_, _) => { dayCalls++; return Task.FromResult(new AiResponse { Ok = true, Text = """{"ok": true, "message": "da"}""", PromptTokens = 1, CompletionTokens = 1 }); };
            Assert.True((await AiLogic.RunAsync(biz.Db, biz.Services, Call())).Ok);
            var second = await AiLogic.RunAsync(biz.Db, biz.Services, Call());
            Assert.Equal(AiRunStatus.LimitReached, second.Run.Status);
            Assert.Contains("keine weiteren", second.Error);
            Assert.NotNull(second.Run.AddressHash);
            Assert.DoesNotContain("203.0.113.7", second.Run.AddressHash);
        });
        Assert.Equal(1, dayCalls);
    }

    [Fact]
    public async Task Tokens_are_estimated_when_the_provider_gives_no_numbers()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Fake("""{"rows": [{"Name": "A"}]}""");
        await As(Role.Designer, async biz =>
        {
            var (list, _) = await ListAsync(biz);
            var result = await AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null));
            Assert.True(result.TokensEstimated);
            Assert.True(result.Tokens > 0);
            var run = await biz.Db.AiRun.AsNoTracking().FirstAsync(r => r.Id == result.RunId);
            Assert.True(run.TokensEstimated);
            Assert.Equal(TokenEstimate.Of("""{"rows": [{"Name": "A"}]}"""), run.CompletionTokens);
        });
    }

    // ------------------------------------------------------------------------------------------------ no AI, no answer, no format

    [Fact]
    public async Task Without_a_profile_the_message_differs_for_administrators_and_others()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (list, _) = await As(Role.Designer, biz => ListAsync(biz));
        var designer = await As(Role.Designer, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));
        Assert.False(designer.Ok);
        Assert.Equal("not-configured", designer.Code);
        Assert.Contains("Administrator", designer.Error);
        Assert.DoesNotContain("Verwaltung", designer.Error);
        Assert.Null(designer.SettingsHref);

        var admin = await As(Role.Admin, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));
        Assert.Equal("not-configured", admin.Code);
        Assert.Contains("Verwaltung → KI → Profile", admin.Error);
        Assert.Equal("/Admin/Ai/Profiles", admin.SettingsHref);
        Assert.Equal(AiRunStatus.Error, admin.Status);

        await As(Role.Admin, async biz => Assert.False(await AiLogic.IsAvailableAsync(biz)));
        await ResetAsync(s => s.Enabled = false);
        var off = await As(Role.Admin, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));
        Assert.Equal("disabled", off.Code);
        Assert.Equal("/Admin/Ai", off.SettingsHref);
        await As(Role.Designer, biz =>
        {
            Assert.False(AiLogic.IsEnabled(biz));
            return Task.CompletedTask;
        });
    }

    [Fact]
    public async Task An_empty_answer_is_an_error_with_a_reason_and_an_announcement_is_nudged_twice_then_stuck()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (list, _) = await As(Role.Designer, biz => ListAsync(biz));

        Seam.Handler = (_, _) => Task.FromResult(new AiResponse { Ok = false, Error = "Die KI hat eine leere Antwort geliefert." });
        var empty = await As(Role.Designer, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));
        Assert.False(empty.Ok);
        Assert.Equal(AiRunStatus.Error, empty.Status);
        Assert.Equal("Die KI hat eine leere Antwort geliefert.", empty.Error);

        var calls = 0;
        Seam.Handler = (_, _) =>
        {
            calls++;
            return Task.FromResult(new AiResponse { Ok = true, Text = "Ich schaue mir das gleich an und melde mich." });
        };
        var stuck = await As(Role.Designer, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));
        Assert.False(stuck.Ok);
        Assert.Equal(AiRunStatus.Stuck, stuck.Status);
        Assert.Equal(3, calls);
        await As(Role.Admin, async biz =>
        {
            var details = (await AiLogic.RunDetailsAsync(biz, stuck.RunId))!;
            Assert.Equal(2, details.Run.Nudges);
            Assert.Contains(details.Run.Steps, s => s.Kind == AiStepKind.Warning && s.Text.Contains("Anstoß"));
            Assert.Equal("Datenliste", details.Subject!.Kind);
            Assert.Contains($"/DataLists/Edit/{list.Id}", details.Subject.Href);
        });
        // the nudge went back to the model as a new message with the answer before it
        lock (Seam.Requests)
        {
            var last = Seam.Requests[^1];
            Assert.Equal(new[] { "system", "user", "assistant", "user", "assistant", "user" }, last.Messages.Select(m => m.Role));
        }

        // "Weitermachen": the same request again as a new run
        Fake("""{"rows": [{"Name": "Neu"}]}""");
        var (message, newRun) = await As(Role.Admin, biz => AiLogic.ContinueAsync(biz, stuck.RunId, null));
        Assert.NotNull(newRun);
        Assert.Contains("Vorschlag liegt bereit", message);
        await As(Role.Admin, async biz => Assert.Equal(AiRunStatus.Waiting, (await biz.Db.AiRun.AsNoTracking().FirstAsync(r => r.Id == newRun)).Status));
    }

    [Fact]
    public async Task An_answer_in_a_code_fence_with_a_sentence_before_it_is_read()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Fake("Klar, hier ist die Tabelle:\n```json\n{\"rows\": [{\"Name\": \"Fenced\",}],}\n```");
        await As(Role.Designer, async biz =>
        {
            var (list, _) = await ListAsync(biz);
            var result = await AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("Fenced", null));
            Assert.True(result.Ok);
            Assert.Equal("Fenced", Json(result.Json).GetProperty("rows")[0].GetProperty("values").GetProperty("Name").GetString());
        });
    }

    // ------------------------------------------------------------------------------------------------ the instruction

    [Fact]
    public async Task The_instruction_shown_before_sending_is_exactly_what_is_sent_and_has_the_layers()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s =>
        {
            s.BaseInstruction = "BASIS-TEXT-DER-WEBSITE";
            s.ActionInstructions = new Dictionary<string, string> { ["DataFill"] = "ERGAENZUNG-FUER-FUELLEN", ["DataImport"] = "ERGAENZUNG-FUER-IMPORT" };
        });
        Fake("""{"values": []}""");
        await As(Role.Designer, async biz =>
        {
            var (list, ids) = await ListAsync(biz, false, ("Gouda", "x"));
            var input = new AiDataLogic.FillInput(ids, "Region", ["Name"], "Schreibe die Region");
            var shown = await AiDataLogic.FillPromptAsync(biz, list.Id, input);
            await AiDataLogic.ProposeFillAsync(biz, list.Id, input);
            AiRequest sent;
            lock (Seam.Requests)
            {
                sent = Seam.Requests.Single();
            }

            Assert.Equal($"[system]\n{sent.Messages[0].Content}\n\n[user]\n{sent.Messages[1].Content}", shown);
            Assert.Contains("BASIS-TEXT-DER-WEBSITE", shown);
            Assert.Contains("ERGAENZUNG-FUER-FUELLEN", shown);
            Assert.DoesNotContain("ERGAENZUNG-FUER-IMPORT", shown);
            Assert.Contains("Schreibe die Region", shown);
            Assert.Contains("\"row\"", shown);
            Assert.Contains("Gouda", shown);
            Assert.True(sent.Json);
            // the order of the layers: base, addition of the site, the person's instruction, the fixed part, then the situation
            var order = new[] { "BASIS-TEXT-DER-WEBSITE", "ERGAENZUNG-FUER-FUELLEN", "Schreibe die Region", "Format und Regeln (fest)", "[user]" }.Select(t => shown.IndexOf(t, StringComparison.Ordinal)).ToList();
            Assert.Equal(order.Order(), order);
            // the code decides what the model sees: only the chosen context column of the chosen rows
            Assert.DoesNotContain("Preis", shown.Split("[user]")[1].Split("## Zeilen")[1]);
        });
    }

    [Fact]
    public async Task The_model_sees_only_the_chosen_rows_and_columns_and_the_allowed_media_of_the_category()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Fake("""{"values": []}""");
        await As(Role.Designer, async biz =>
        {
            var (list, ids) = await ListAsync(biz, false, ("Gouda", "Holland"), ("Geheim", "Nicht gewaehlt"));
            var fill = await AiDataLogic.FillPromptAsync(biz, list.Id, new AiDataLogic.FillInput([ids[0]], "Region", ["Name"], "x"));
            Assert.Contains("Gouda", fill);
            Assert.DoesNotContain("Geheim", fill);
            Assert.DoesNotContain("Nicht gewaehlt", fill);

            var import = await AiDataLogic.ImportPromptAsync(biz, list.Id, new AiDataLogic.ImportInput("Text", null));
            Assert.Contains("flag-de = Deutschland", import);
            Assert.DoesNotContain("icon-bio", import);
            Assert.DoesNotContain("Geheim", import);
            Assert.True(import.Split('\n').Count(l => l.Contains(" = ")) <= AiDataLogic.MaxAssetsListed);
        });
    }

    // ------------------------------------------------------------------------------------------------ text suggestion

    [Fact]
    public async Task Text_suggestions_keep_the_placeholders_and_change_nothing_on_the_server()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Fake("""{"suggestions": ["Heute frisch: {{Name}} für {{Preis}} €", "{{Name}} ohne Preis", "<script>x</script> {{Name}} {{Preis}}", "Genau {{ Name }} zu {{Preis}} €", "Nur Text"]}""", 50, 20);
        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("KI-Design "), null, "label-150x100", null, null, null, null));
            var revision = design.Revision;
            var input = new AiTextLogic.SuggestInput("{{Name}} jetzt {{Preis}} €", "freundlicher", "Titel", 100, 20, "mm",
                [new("Name", "Käsename", "text", "Gouda"), new("Preis", "Preis", "price", "2.99"), new("1ungültig", "x", "text", "y")]);
            var result = await AiTextLogic.SuggestAsync(biz, design.Id, input);
            Assert.True(result.Ok);
            Assert.Equal(AiRunStatus.Done, result.Status);
            var proposal = Json(result.Json);
            Assert.Equal(["Heute frisch: {{Name}} für {{Preis}} €", "Genau {{ Name }} zu {{Preis}} €"], proposal.GetProperty("suggestions").EnumerateArray().Select(e => e.GetString()));
            Assert.Equal(3, proposal.GetProperty("warnings").GetArrayLength());

            var sent = Seam.Requests.Single().Messages[1].Content;
            Assert.Contains("Käsename", sent);
            Assert.Contains("Gouda", sent);
            Assert.Contains("100 × 20 mm", sent);
            Assert.DoesNotContain("1ungültig", sent);
            Assert.Contains("freundlicher", Seam.Requests.Single().Messages[0].Content);
            Assert.Equal(revision, (await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == design.Id)).Revision);
            var run = await biz.Db.AiRun.AsNoTracking().FirstAsync(r => r.Id == result.RunId);
            Assert.Equal(AiAction.TextSuggest, run.Action);
            Assert.Equal(nameof(Design), run.SubjectType);
            Assert.Equal(design.Id, run.SubjectId);
            Assert.Equal(70, run.TotalTokens);
            Assert.Equal(0, await biz.Db.AiJournalEntry.CountAsync(j => j.AiRunId == run.Id));

            await Assert.ThrowsAsync<BizException>(() => AiTextLogic.SuggestAsync(biz, design.Id, input with { Text = "", Instruction = "" }));
            await Assert.ThrowsAsync<BizException>(() => AiTextLogic.SuggestAsync(biz, design.Id, input with { Text = new string('x', 5001) }));
            await Assert.ThrowsAsync<NotFoundException>(() => AiTextLogic.SuggestAsync(biz, 99999999, input));
            var shown = await AiTextLogic.PromptAsync(biz, design.Id, input);
            Assert.Contains("{{Name}}, {{Preis}}", shown);
        });
    }

    // ------------------------------------------------------------------------------------------------ roles

    [Fact]
    public async Task A_viewer_can_do_nothing_and_a_designer_only_touches_their_own_runs()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Fake("""{"rows": [{"Name": "A"}]}""");
        var (list, ids) = await As(Role.Designer, 5, biz => ListAsync(biz, false, ("X", "")));
        var run = await As(Role.Designer, 5, biz => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));

        await As(Role.Viewer, 9, async biz =>
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ProposeImportAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ProposeFillAsync(biz, list.Id, new AiDataLogic.FillInput(ids, "Region", null, "x")));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ImportPromptAsync(biz, list.Id, new AiDataLogic.ImportInput("A", null)));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.FillPromptAsync(biz, list.Id, new AiDataLogic.FillInput(ids, "Region", null, "x")));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiTextLogic.SuggestAsync(biz, 1, new AiTextLogic.SuggestInput("x", null, null, null, null, null, null)));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiTextLogic.PromptAsync(biz, 1, new AiTextLogic.SuggestInput("x", null, null, null, null, null, null)));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ApplyAsync(biz, run.RunId, null));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ProposalAsync(biz, run.RunId));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.DiscardAsync(biz, run.RunId));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiLogic.UndoAsync(biz, run.RunId));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiLogic.RunsOfAsync(biz, nameof(DataList), list.Id));
            Assert.Throws<ForbiddenException>(() => AiLogic.Runs(biz));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiLogic.RunDetailsAsync(biz, run.RunId));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiLogic.ContinueAsync(biz, run.RunId, null));
        });

        // another designer cannot open, apply or undo a run that is not theirs; an administrator can
        await As(Role.Designer, 6, async biz =>
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ProposalAsync(biz, run.RunId));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ApplyAsync(biz, run.RunId, null));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.DiscardAsync(biz, run.RunId));
            Assert.Empty(await AiLogic.RunsOfAsync(biz, nameof(DataList), list.Id));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiLogic.RunDetailsAsync(biz, run.RunId));
            await Assert.ThrowsAsync<ForbiddenException>(() => AiLogic.UsageAsync(biz));
        });

        await As(Role.Designer, 5, async biz => Assert.Contains(await AiLogic.RunsOfAsync(biz, nameof(DataList), list.Id), l => l.Id == run.RunId && l.Status == AiRunStatus.Waiting));
        await As(Role.Admin, 1, async biz =>
        {
            Assert.Contains(await AiLogic.RunsOfAsync(biz, nameof(DataList), list.Id), l => l.Id == run.RunId);
            var applied = await AiDataLogic.ApplyAsync(biz, run.RunId, null);
            Assert.Equal(1, applied.Count);
            Assert.Equal("Rückgängig gemacht.", await AiLogic.UndoAsync(biz, run.RunId));
        });
    }

    [Fact]
    public async Task Nobody_without_a_session_uses_the_ai()
    {
        if (!Enabled)
        {
            return;
        }

        using var scope = Factory.Services.CreateScope();
        var biz = scope.ServiceProvider.GetRequiredService<Biz>();
        await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ProposeImportAsync(biz, 1, new AiDataLogic.ImportInput("A", null)));
        await Assert.ThrowsAsync<ForbiddenException>(() => AiTextLogic.SuggestAsync(biz, 1, new AiTextLogic.SuggestInput("x", null, null, null, null, null, null)));
        await Assert.ThrowsAsync<ForbiddenException>(() => AiDataLogic.ApplyAsync(biz, 1, null));
        await Assert.ThrowsAsync<ForbiddenException>(() => AiLogic.UndoAsync(biz, 1));
    }

    [Fact]
    public async Task The_settings_keep_the_additions_per_action()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.ActionInstructions = new Dictionary<string, string> { ["TextSuggest"] = "Immer per Du." });
        await As(Role.Admin, async biz =>
        {
            var settings = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
            Assert.Equal("Immer per Du.", settings.ActionInstructions["TextSuggest"]);
            Assert.Contains("Immer per Du.", AiLogic.FullInstruction(biz, AiAction.TextSuggest));
            Assert.DoesNotContain("Immer per Du.", AiLogic.FullInstruction(biz, AiAction.DataFill));
            foreach (var action in Enum.GetValues<AiAction>())
            {
                Assert.Contains("Format und Regeln (fest)", AiLogic.FullInstruction(biz, action));
            }
        });
        await As(Role.Designer, biz => Task.FromResult(Assert.Throws<ForbiddenException>(() => AiLogic.FullInstruction(biz, AiAction.Test))));
        await ResetAsync();
    }
}
