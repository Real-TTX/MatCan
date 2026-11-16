using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace MatCan.Logic;

/// <summary>An element found in a document: itself, the list that holds it, its place there, its page and the groups around it (outermost first).</summary>
public sealed record Located(JsonObject Element, JsonArray List, int Index, JsonObject Page, IReadOnlyList<JsonObject> Chain);

/// <summary>
/// The document of a design as a tree of JSON nodes, and the small operations the tools of the design assistant make on it: find a page or an element, new ids, move and resize (a group moves and scales its
/// children, which are in page coordinates), the boxes of groups, the rotation of a group baked into its children when it is dissolved. The same arithmetic as <c>designer.core.js</c> (<c>D.translate</c>,
/// <c>D.setBox</c>, <c>D.fixGroups</c>, <c>bake</c>), so a document the assistant changed is what the editor would have made. The result of every change is run through <c>DocumentValidator</c> by the caller.
/// </summary>
public static partial class AiDocOps
{
    [GeneratedRegex(@"^e(\d+)$")]
    private static partial Regex ElementIdPattern();

    [GeneratedRegex(@"^p(\d+)$")]
    private static partial Regex PageIdPattern();

    /// <summary>The document of a stored design: always an object with a list of pages (the Core has upgraded it before).</summary>
    public static JsonObject Parse(string json)
    {
        var node = JsonNode.Parse(json, documentOptions: new JsonDocumentOptions { MaxDepth = 64 }) as JsonObject ?? throw new BizException("Das Design ist beschädigt.");
        if (node["pages"] is not JsonArray)
        {
            throw new BizException("Das Design ist beschädigt.");
        }

        node["fields"] ??= new JsonArray();
        return node;
    }

    public static JsonArray Pages(JsonObject doc) => (JsonArray)doc["pages"]!;

    public static JsonArray Fields(JsonObject doc) => doc["fields"] as JsonArray ?? [];

    public static JsonArray Elements(JsonObject page) => page["elements"] as JsonArray ?? (JsonArray)(page["elements"] = new JsonArray());

    public static string Str(JsonNode? node) => node is JsonValue v && v.TryGetValue<string>(out var s) ? s : "";

    public static string Id(JsonObject element) => Str(element["id"]);

    public static string Type(JsonObject element) => Str(element["type"]);

    /// <summary>A number of a node (0 when it is none): JSON numbers read from text and numbers made in code both work.</summary>
    public static double Num(JsonNode? node)
    {
        if (node is not JsonValue v)
        {
            return 0;
        }

        if (v.TryGetValue<double>(out var d))
        {
            return d;
        }

        if (v.TryGetValue<long>(out var l))
        {
            return l;
        }

        if (v.TryGetValue<int>(out var i))
        {
            return i;
        }

        if (v.TryGetValue<decimal>(out var m))
        {
            return (double)m;
        }

        return v.TryGetValue<string>(out var s) && double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
    }

    public static bool Flag(JsonNode? node) => node is JsonValue v && v.TryGetValue<bool>(out var b) && b;

    public static double Round(double value, int digits = 4) => Math.Round(value, digits, MidpointRounding.AwayFromZero);

    public static JsonNode Number(double value) => JsonValue.Create(Round(value, 4) == 0 ? 0d : Round(value, 4))!;

    public static string Unit(JsonObject doc) => Str(doc["unit"]) == "px" ? "px" : "mm";

    // ------------------------------------------------------------------------------------------------ walking and finding

    /// <summary>Every node of a list, depth first, parents before their children.</summary>
    public static IEnumerable<JsonObject> Walk(JsonArray list)
    {
        foreach (var node in list)
        {
            if (node is not JsonObject element)
            {
                continue;
            }

            yield return element;
            if (Type(element) == "group" && element["children"] is JsonArray children)
            {
                foreach (var child in Walk(children))
                {
                    yield return child;
                }
            }
        }
    }

    public static IEnumerable<JsonObject> AllElements(JsonObject doc) => Pages(doc).OfType<JsonObject>().SelectMany(p => Walk(Elements(p)));

    public static HashSet<string> AllIds(JsonObject doc) => [.. AllElements(doc).Select(Id)];

    /// <summary>A generator of element ids ("e12") that are used nowhere in the document, like <c>D.idMaker</c>.</summary>
    public static Func<string> IdMaker(JsonObject doc, IEnumerable<string>? extraUsed = null)
    {
        var used = AllIds(doc);
        foreach (var id in extraUsed ?? [])
        {
            used.Add(id);
        }

        var n = 0;
        foreach (var id in used)
        {
            var m = ElementIdPattern().Match(id);
            if (m.Success && int.TryParse(m.Groups[1].Value, out var number))
            {
                n = Math.Max(n, number);
            }
        }

        return () =>
        {
            do
            {
                n++;
            }
            while (used.Contains("e" + n));
            used.Add("e" + n);
            return "e" + n;
        };
    }

    /// <summary>A page id ("p3") that no page has.</summary>
    public static string NewPageId(JsonObject doc)
    {
        var used = Pages(doc).OfType<JsonObject>().Select(Id).ToHashSet(StringComparer.Ordinal);
        var n = 0;
        foreach (var id in used)
        {
            var m = PageIdPattern().Match(id);
            if (m.Success && int.TryParse(m.Groups[1].Value, out var number))
            {
                n = Math.Max(n, number);
            }
        }

        do
        {
            n++;
        }
        while (used.Contains("p" + n));
        return "p" + n;
    }

    /// <summary>A page by its id ("p2") or its number (2, "2": counted from 1); null when there is none.</summary>
    public static JsonObject? FindPage(JsonObject doc, string? idOrNumber)
    {
        var key = (idOrNumber ?? "").Trim();
        if (key.Length == 0)
        {
            return null;
        }

        var pages = Pages(doc).OfType<JsonObject>().ToList();
        var byId = pages.FirstOrDefault(p => string.Equals(Id(p), key, StringComparison.OrdinalIgnoreCase));
        if (byId is not null)
        {
            return byId;
        }

        return int.TryParse(key, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number) && number >= 1 && number <= pages.Count ? pages[number - 1] : null;
    }

    public static int PageNumber(JsonObject doc, JsonObject page) => Pages(doc).OfType<JsonObject>().ToList().IndexOf(page) + 1;

    /// <summary>The element with this id on any page, with the list that holds it.</summary>
    public static Located? Locate(JsonObject doc, string? id)
    {
        if (string.IsNullOrEmpty(id))
        {
            return null;
        }

        foreach (var page in Pages(doc).OfType<JsonObject>())
        {
            var found = Find(Elements(page), id, page, []);
            if (found is not null)
            {
                return found;
            }
        }

        return null;
    }

    private static Located? Find(JsonArray list, string id, JsonObject page, List<JsonObject> chain)
    {
        for (var i = 0; i < list.Count; i++)
        {
            if (list[i] is not JsonObject element)
            {
                continue;
            }

            if (Id(element) == id)
            {
                return new Located(element, list, i, page, chain);
            }

            if (Type(element) == "group" && element["children"] is JsonArray children)
            {
                var inner = Find(children, id, page, [.. chain, element]);
                if (inner is not null)
                {
                    return inner;
                }
            }
        }

        return null;
    }

    public static int CountNodes(JsonArray list) => Walk(list).Count();

    /// <summary>The depth of nested groups below a node (a node that is no group: 0).</summary>
    public static int GroupDepth(JsonObject node) => Type(node) != "group" ? 0 : 1 + (node["children"] as JsonArray ?? []).OfType<JsonObject>().Select(GroupDepth).DefaultIfEmpty(0).Max();

    // ------------------------------------------------------------------------------------------------ geometry

    public readonly record struct Box(double X, double Y, double W, double H);

    public static Box BoxOf(JsonObject e) => new(Num(e["x"]), Num(e["y"]), Num(e["w"]), Num(e["h"]));

    /// <summary>The axis-aligned box around the (rotated) element in the frame of its parent.</summary>
    public static Box Aabb(JsonObject e)
    {
        var box = BoxOf(e);
        var rotation = Num(e["rotation"]);
        if (rotation == 0)
        {
            return box;
        }

        var cx = box.X + (box.W / 2);
        var cy = box.Y + (box.H / 2);
        var r = rotation * Math.PI / 180;
        var cos = Math.Cos(r);
        var sin = Math.Sin(r);
        double x1 = double.PositiveInfinity, y1 = double.PositiveInfinity, x2 = double.NegativeInfinity, y2 = double.NegativeInfinity;
        foreach (var (px, py) in new[] { (-box.W / 2, -box.H / 2), (box.W / 2, -box.H / 2), (box.W / 2, box.H / 2), (-box.W / 2, box.H / 2) })
        {
            var x = cx + (px * cos) - (py * sin);
            var y = cy + (px * sin) + (py * cos);
            x1 = Math.Min(x1, x);
            y1 = Math.Min(y1, y);
            x2 = Math.Max(x2, x);
            y2 = Math.Max(y2, y);
        }

        return new Box(x1, y1, x2 - x1, y2 - y1);
    }

    public static Box Union(IEnumerable<Box> boxes)
    {
        double x1 = double.PositiveInfinity, y1 = double.PositiveInfinity, x2 = double.NegativeInfinity, y2 = double.NegativeInfinity;
        foreach (var b in boxes)
        {
            x1 = Math.Min(x1, b.X);
            y1 = Math.Min(y1, b.Y);
            x2 = Math.Max(x2, b.X + b.W);
            y2 = Math.Max(y2, b.Y + b.H);
        }

        return new Box(x1, y1, x2 - x1, y2 - y1);
    }

    private static void SetBoxValues(JsonObject e, Box box)
    {
        e["x"] = Number(box.X);
        e["y"] = Number(box.Y);
        e["w"] = Number(box.W);
        e["h"] = Number(box.H);
    }

    /// <summary>Moves a node by (dx, dy): a group moves its children (page coordinates) too.</summary>
    public static void Translate(JsonObject node, double dx, double dy)
    {
        node["x"] = Number(Num(node["x"]) + dx);
        node["y"] = Number(Num(node["y"]) + dy);
        if (Type(node) == "group" && node["children"] is JsonArray children)
        {
            foreach (var child in children.OfType<JsonObject>())
            {
                Translate(child, dx, dy);
            }
        }
    }

    /// <summary>Sets the box of a node; a group scales its children (each around its own centre) with it.</summary>
    public static void SetBox(JsonObject node, Box to)
    {
        if (Type(node) == "group")
        {
            ScaleDescendants(node, BoxOf(node), to);
        }

        SetBoxValues(node, to);
    }

    private static void ScaleDescendants(JsonObject group, Box from, Box to)
    {
        var fx = from.W > 0 ? to.W / from.W : 1;
        var fy = from.H > 0 ? to.H / from.H : 1;
        foreach (var child in (group["children"] as JsonArray ?? []).OfType<JsonObject>())
        {
            var old = BoxOf(child);
            var cx = to.X + ((old.X + (old.W / 2) - from.X) * fx);
            var cy = to.Y + ((old.Y + (old.H / 2) - from.Y) * fy);
            var next = new Box(0, 0, old.W * fx, old.H * fy);
            next = next with { X = cx - (next.W / 2), Y = cy - (next.H / 2) };
            if (Type(child) == "group")
            {
                ScaleDescendants(child, old, next);
            }

            SetBoxValues(child, next);
        }
    }

    /// <summary>Sets the box of every group to the union of its children (bottom up) and removes groups without children (<c>D.fixGroups</c>).</summary>
    public static void FixGroups(JsonArray list)
    {
        for (var i = list.Count - 1; i >= 0; i--)
        {
            if (list[i] is not JsonObject g || Type(g) != "group")
            {
                continue;
            }

            var children = g["children"] as JsonArray ?? [];
            FixGroups(children);
            if (children.Count == 0)
            {
                list.RemoveAt(i);
                continue;
            }

            SetBoxValues(g, Union(children.OfType<JsonObject>().Select(Aabb)));
        }
    }

    public static void FixGroups(JsonObject doc)
    {
        foreach (var page in Pages(doc).OfType<JsonObject>())
        {
            FixGroups(Elements(page));
        }
    }

    private static double NormAngle(double degrees)
    {
        var a = degrees % 360;
        if (a > 180)
        {
            a -= 360;
        }

        if (a <= -180)
        {
            a += 360;
        }

        return a;
    }

    /// <summary>A child leaves its group: the group's rotation, flip and opacity are baked into the child so that it stays where it was (<c>bake</c> of the editor).</summary>
    public static void Bake(JsonObject group, JsonObject child)
    {
        var rot = Num(group["rotation"]);
        var flipX = Flag(group["flipX"]);
        var flipY = Flag(group["flipY"]);
        var opacity = group["opacity"] is null ? 1 : Num(group["opacity"]);
        if (rot == 0 && !flipX && !flipY && opacity == 1)
        {
            return;
        }

        var box = BoxOf(group);
        var cx = box.X + (box.W / 2);
        var cy = box.Y + (box.H / 2);
        var c = BoxOf(child);
        var centre = (X: c.X + (c.W / 2), Y: c.Y + (c.H / 2));
        var dx = (flipX ? -1 : 1) * (centre.X - cx);
        var dy = (flipY ? -1 : 1) * (centre.Y - cy);
        var r = rot * Math.PI / 180;
        var moved = (X: cx + (dx * Math.Cos(r)) - (dy * Math.Sin(r)), Y: cy + (dx * Math.Sin(r)) + (dy * Math.Cos(r)));
        var shiftX = moved.X - centre.X;
        var shiftY = moved.Y - centre.Y;
        var mirrored = flipX != flipY;
        if (Type(child) == "group")
        {
            Translate(child, shiftX, shiftY);
        }
        else
        {
            child["x"] = Number(c.X + shiftX);
            child["y"] = Number(c.Y + shiftY);
            if (flipX)
            {
                child["flipX"] = !Flag(child["flipX"]);
            }

            if (flipY)
            {
                child["flipY"] = !Flag(child["flipY"]);
            }
        }

        child["rotation"] = Number(NormAngle((Num(child["rotation"]) * (mirrored ? -1 : 1)) + rot));
        child["opacity"] = Number(Num(child["opacity"] is null ? JsonValue.Create(1d) : child["opacity"]) * opacity);
    }
}
