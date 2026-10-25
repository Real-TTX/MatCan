using DesignThix.Data.Entities;
using DesignThix.Services;

namespace DesignThix.Logic;

/// <summary>
/// Presence in the editor (docs/PLAN-PLATFORM.md section 1.11): the browser beats while a design is open, the answer lists everybody who has it open right now. Needs View on the design (a stranger gets 404);
/// a person with Edit counts as an editor ("Anna bearbeitet gerade"), one with View only as a viewer.
/// </summary>
public static class PresenceLogic
{
    /// <summary>The person has the design open: note it and return the room. <paramref name="leave"/> = the person closed it (the answer is then the room without them).</summary>
    public static async Task<List<PresenceEntry>> BeatAsync(Biz biz, long designId, bool leave = false)
    {
        var level = await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.View);
        var tracker = biz.Service<PresenceTracker>();
        var uid = biz.UserId;
        if (leave)
        {
            tracker.Leave(designId, uid);
            return tracker.Current(designId);
        }

        return tracker.Beat(designId, uid, biz.User.Name ?? "Jemand", level >= AccessLevel.Edit);
    }
}
