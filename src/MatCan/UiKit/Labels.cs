using MatCan.Data.Entities;
using Microsoft.AspNetCore.Html;

namespace MatCan.UiKit;

/// <summary>The German words for the enums of the data model, and the tone of a status pill (the colour is never alone: the pill carries the word and an icon).</summary>
public static class Labels
{
    public static string Of(UserRole r) => r switch
    {
        UserRole.Admin => "Administrator",
        _ => "Mitglied",
    };

    /// <summary>What a role may do, in a sentence (the user form and the profile show it).</summary>
    public static string Describe(UserRole r) => r switch
    {
        UserRole.Admin => "Betreibt die Plattform: Benutzer, KI, Einstellungen und die Vorlagen und Medien, die allen gehören. Die Inhalte anderer sieht der Administrator nicht.",
        _ => "Arbeitet im eigenen Bereich und in Teams; was jemand mit einem Design, einer Datenliste oder einem Bild darf, ergibt sich aus Besitz, Teamrolle und Freigaben.",
    };

    /// <summary>The role of a person in a team.</summary>
    public static string Of(SpaceRole r) => r switch
    {
        SpaceRole.Owner => "Inhaber",
        SpaceRole.Admin => "Admin",
        SpaceRole.Editor => "Bearbeiter",
        _ => "Betrachter",
    };

    /// <summary>What a team role may do, in a sentence (the member list and the invitation dialog show it).</summary>
    public static string Describe(SpaceRole r) => r switch
    {
        SpaceRole.Owner => "Darf alles, auch das Team löschen und die Inhaberschaft übergeben.",
        SpaceRole.Admin => "Verwaltet Mitglieder, Einladungen, Marke, Vorlagen und Einstellungen und arbeitet im Team mit.",
        SpaceRole.Editor => "Legt alles im Teambereich an und ändert es, teilt, verschiebt und löscht.",
        _ => "Sieht den Teambereich nur an.",
    };

    public static string Of(ApprovalState s) => s switch
    {
        ApprovalState.Pending => "Wartet auf Freigabe",
        ApprovalState.Declined => "Abgelehnt",
        _ => "Freigegeben",
    };

    public static string Of(AiProvider p) => p == AiProvider.ChatGpt ? "ChatGPT-Konto" : "OpenAI-kompatibel (API-Schlüssel)";

    public static string Of(AiAction a) => a switch
    {
        AiAction.DataImport => "Daten übernehmen",
        AiAction.DataFill => "Spalte füllen",
        AiAction.TextSuggest => "Text vorschlagen",
        AiAction.DesignAgent => "Design (Assistent)",
        _ => "Verbindungstest",
    };

    public static string Of(AiRunStatus s) => s switch
    {
        AiRunStatus.Running => "Läuft",
        AiRunStatus.Done => "Fertig",
        AiRunStatus.Waiting => "Wartet",
        AiRunStatus.LimitReached => "Grenze erreicht",
        AiRunStatus.Stuck => "Hängt",
        AiRunStatus.Error => "Fehler",
        _ => "Abgebrochen",
    };

    public static IHtmlContent Pill(AiRunStatus s) => s switch
    {
        AiRunStatus.Running => Ui.Pill(Of(s), "busy", "refresh"),
        AiRunStatus.Done => Ui.Pill(Of(s), "ok", "check"),
        AiRunStatus.Waiting => Ui.Pill(Of(s), "info", "clock"),
        AiRunStatus.LimitReached => Ui.Pill(Of(s), "warn", "alert"),
        AiRunStatus.Stuck => Ui.Pill(Of(s), "warn", "pause"),
        AiRunStatus.Error => Ui.Pill(Of(s), "error", "x-circle"),
        _ => Ui.Pill(Of(s), "plain", "stop"),
    };

    public static string Of(AiStepKind k) => k switch
    {
        AiStepKind.Message => "Nachricht",
        AiStepKind.Action => "Aktion",
        AiStepKind.Result => "Ergebnis",
        AiStepKind.User => "Nachricht der Person",
        AiStepKind.Assistant => "Antwort der KI",
        AiStepKind.Info => "Hinweis",
        AiStepKind.Error => "Fehler",
        AiStepKind.End => "Ende",
        _ => "Warnung",
    };
}
