namespace DesignThix.Logic;

/// <summary>An entry of a pick list that the business layer hands to a page: the id, the name, and a second quieter line.</summary>
public sealed record Choice(long Id, string Name, string? Detail = null);
