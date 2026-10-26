using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DesignThix.Logic;

/// <summary>
/// Makes the saves of ONE item (the document of a design, the rows of a data list) take turns. A save reads the revision, checks it against the one the person started from, and then writes the
/// new state, the history entry and the list of the images it uses; two saves at the same moment (autosave and the keep-alive request of a closing tab, two tabs, two people) used to run in
/// parallel and the one that lost hit a unique index (<c>DesignRevision</c>, <c>ItemAssetRef</c>) and became a 500. With the lock the loser waits, then reads the new revision and gets the
/// ordinary <see cref="RevisionConflictException"/> (HTTP 409, the dialog "Als Kopie speichern").
/// <para>
/// A PostgreSQL advisory lock that belongs to a transaction: it is let go at the commit or the rollback, also when the process dies. The caller reads the item AFTER <see cref="AcquireAsync"/>, writes,
/// and calls <see cref="Held.CommitAsync"/>; leaving the scope without it rolls back.
/// </para>
/// </summary>
public static class ItemLock
{
    /// <summary>A held lock (and, when the context had no transaction yet, the transaction that carries it).</summary>
    public sealed class Held : IAsyncDisposable
    {
        private readonly IDbContextTransaction? _transaction;

        internal Held(IDbContextTransaction? transaction) => _transaction = transaction;

        /// <summary>Ends the transaction that carries the lock (a transaction of the caller is left to the caller).</summary>
        public async Task CommitAsync()
        {
            if (_transaction is not null)
            {
                await _transaction.CommitAsync();
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (_transaction is not null)
            {
                await _transaction.DisposeAsync();
            }
        }
    }

    /// <summary>Waits for the lock of the item and holds it until the returned value is committed or disposed.</summary>
    public static async Task<Held> AcquireAsync(DtDbContext db, ItemKind kind, long id)
    {
        var owned = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync() : null;
        try
        {
            // one key per item: the kind in the lowest bits (there are fewer than 8 kinds), the id above
            var key = (id << 3) | (long)kind;
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({key})");
            return new Held(owned);
        }
        catch
        {
            if (owned is not null)
            {
                await owned.DisposeAsync();
            }

            throw;
        }
    }
}
