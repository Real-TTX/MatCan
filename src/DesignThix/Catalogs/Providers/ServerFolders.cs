using System.Text.RegularExpressions;
using DesignThix.Core.Media;

namespace DesignThix.Catalogs.Providers;

/// <summary>
/// The paths of the folder catalogue (<see cref="FolderCatalog"/>), and the one place that decides what may be read: the folders the administrator names below <c>{data}/catalogs</c>, and in them
/// only what a RELATIVE path of plain names reaches. A name with <c>..</c>, a drive, a colon, a slash that leads out, a backslash or a control character is no path of ours (null), a link
/// (symbolic link, junction) is never followed, and the full path that comes out must lie below the root: checked twice, by the segments and by the resulting path.
/// </summary>
public static partial class ServerFolders
{
    /// <summary>The folder all catalogue folders live in; it is made when it is missing.</summary>
    public static string Root(string dataDir)
    {
        var root = Path.GetFullPath(Path.Combine(dataDir, "catalogs"));
        Directory.CreateDirectory(root);
        return root;
    }

    [GeneratedRegex(@"^[A-Za-z0-9ÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß _.\-]{0,59}$")]
    private static partial Regex FolderNamePattern();

    /// <summary>The name an administrator may give a folder of the catalogue: plain letters, digits, space, dot, dash, underscore (no path, no leading dot, not ending in a dot or space).</summary>
    public static bool IsFolderName(string? name)
        => name is not null && FolderNamePattern().IsMatch(name) && !name.EndsWith('.') && !name.EndsWith(' ') && !name.Contains("..", StringComparison.Ordinal);

    /// <summary>One name of a path inside a folder: not empty, not <c>.</c> or <c>..</c>, no separator, drive colon, wildcard or control character, not ending in a dot or space (Windows reads those as another name).</summary>
    public static bool IsSafeSegment(string? segment)
    {
        if (string.IsNullOrEmpty(segment) || segment.Length > 120 || segment is "." or ".." || segment.StartsWith('.') || segment.EndsWith('.') || segment.EndsWith(' '))
        {
            return false;
        }

        return segment.All(c => !char.IsControl(c) && "\\/:*?\"<>|".IndexOf(c) < 0);
    }

    private static StringComparison PathComparison => OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    /// <summary>The full path of one catalogue folder; null when the name is not a folder name, the folder does not exist, or it is a link.</summary>
    public static string? ResolveFolder(string root, string? name)
    {
        if (!IsFolderName(name))
        {
            return null;
        }

        return ResolveSegments(root, [name!]) is { } path && Directory.Exists(path) ? path : null;
    }

    /// <summary>Whether the first segment of a relative path is one of the folders the administrator named (exactly, case as written).</summary>
    public static bool IsListed(IReadOnlyCollection<string> folders, string? relative)
    {
        var first = (relative ?? "").Replace('\\', '/').Split('/', 2)[0];
        return folders.Contains(first, StringComparer.Ordinal);
    }

    /// <summary>
    /// The full path of <paramref name="relative"/> (<c>folder/sub/file.png</c>) below the root, or null when the path is not safe: the first segment must be a named folder, every segment must be a
    /// plain name, no part may be a link, and the result must lie below the root.
    /// </summary>
    public static string? ResolvePath(string root, IReadOnlyCollection<string> folders, string? relative)
    {
        if (string.IsNullOrWhiteSpace(relative) || relative.Length > 500 || relative.Contains('\\') || relative.StartsWith('/'))
        {
            return null;
        }

        var segments = relative.Split('/');
        if (!folders.Contains(segments[0], StringComparer.Ordinal) || !IsFolderName(segments[0]) || !segments.Skip(1).All(IsSafeSegment))
        {
            return null;
        }

        return ResolveSegments(root, segments);
    }

    private static string? ResolveSegments(string root, IReadOnlyList<string> segments)
    {
        var rootFull = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var full = Path.GetFullPath(Path.Combine([rootFull, .. segments]));
        if (!full.StartsWith(rootFull + Path.DirectorySeparatorChar, PathComparison))
        {
            return null;
        }

        // walk down from the root and refuse a link on the way: a junction or symbolic link inside the folder could lead anywhere
        var current = rootFull;
        foreach (var segment in segments)
        {
            current = Path.Combine(current, segment);
            if (!File.Exists(current) && !Directory.Exists(current))
            {
                return full;
            }

            try
            {
                if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                {
                    return null;
                }
            }
            catch (IOException)
            {
                return null;
            }
        }

        return full;
    }

    /// <summary>The path of a file below the root as <c>folder/sub/file.png</c>; null when it does not lie below it.</summary>
    public static string? RelativeOf(string root, string fullPath)
    {
        var rootFull = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(fullPath);
        return full.StartsWith(rootFull, PathComparison) ? full[rootFull.Length..].Replace(Path.DirectorySeparatorChar, '/') : null;
    }

    /// <summary>The names of the folders directly inside a folder (not links, not hidden, safe names only), sorted.</summary>
    public static IEnumerable<string> SubFolders(string directory)
    {
        try
        {
            return Directory.EnumerateDirectories(directory)
                .Where(d => (new DirectoryInfo(d).Attributes & (FileAttributes.ReparsePoint | FileAttributes.Hidden | FileAttributes.System)) == 0)
                .Select(d => Path.GetFileName(d))
                .Where(IsSafeSegment)
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        catch (IOException)
        {
            return [];
        }
    }

    /// <summary>The folders that exist below the root (what the administrator can name); safe folder names only, no links.</summary>
    public static IReadOnlyList<string> Existing(string dataDir)
        => [.. SubFolders(Root(dataDir)).Where(n => IsFolderName(n))];

    /// <summary>What the first bytes of the file say it is; null when it is not a picture, cannot be read, or is too big for a picture of the library.</summary>
    public static SniffResult? SniffImage(string path)
    {
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            if (stream.Length > Logic.AssetLogic.MaxUploadFileBytes)
            {
                return null;
            }

            var buffer = new byte[(int)Math.Min(stream.Length, 64 * 1024)];
            var read = stream.ReadAtLeast(buffer, buffer.Length, throwOnEndOfStream: false);
            var sniffed = FileSniffer.Sniff(buffer.AsSpan(0, read));
            return sniffed.IsImage ? sniffed : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }
}
