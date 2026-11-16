using System.Linq.Expressions;
using MatCan.Data.Entities;
using MatCan.Logic;

namespace MatCan.UiKit;

/// <summary>
/// The filter "Bereich" of the library lists (docs/PLAN-PLATFORM.md section 1.19): Alle (no filter), Meine Projekte, each team of the person, and (for things that can be shared) Freigegeben =
/// what lies in an area the person does not belong to. It narrows what the person may see anyway; the access rules are those of the list.
/// </summary>
public static class AreaFilter
{
    public const string Name = "bereich";

    /// <summary>The filter for rows that carry an area id (<paramref name="space"/> reads it). <paramref name="withShared"/> adds "Freigegeben".</summary>
    public static async Task<FilterSpec<T>> CreateAsync<T>(Biz biz, Expression<Func<T, long?>> space, bool withShared = true)
    {
        var spaces = await SpaceLogic.MySpacesAsync(biz);
        var personal = spaces.FirstOrDefault(s => s.Kind == SpaceKind.Personal)?.Id;
        var teams = spaces.Where(s => s.Kind == SpaceKind.Team).ToList();
        var mine = spaces.Select(s => (long?)s.Id).ToList();
        var options = new List<FilterOption> { new("mine", SpaceLogic.PersonalName) };
        options.AddRange(teams.Select(t => new FilterOption($"team-{t.Id}", "Team " + t.Name)));
        if (withShared)
        {
            options.Add(new FilterOption("shared", "Freigegeben"));
        }

        return new FilterSpec<T>(Name, "Bereich", options, (query, value) =>
        {
            List<long?> only;
            bool outside = false;
            if (value == "mine")
            {
                only = [personal];
            }
            else if (value == "shared")
            {
                only = mine;
                outside = true;
            }
            else if (value.StartsWith("team-", StringComparison.Ordinal) && long.TryParse(value.AsSpan(5), out var id) && teams.Any(t => t.Id == id))
            {
                only = [id];
            }
            else
            {
                only = [];
            }

            var contains = Expression.Call(Expression.Constant(only), typeof(List<long?>).GetMethod(nameof(List<long?>.Contains))!, space.Body);
            Expression body = outside
                ? Expression.AndAlso(Expression.NotEqual(space.Body, Expression.Constant(null, typeof(long?))), Expression.Not(contains))
                : contains;
            return query.Where(Expression.Lambda<Func<T, bool>>(body, space.Parameters));
        });
    }
}
