using DesignThix.Data.Entities;
using Microsoft.AspNetCore.Html;

namespace DesignThix.UiKit;

/// <summary>The German words for the enums of the data model, and the tone of a status pill (the colour is never alone: the pill carries the word and an icon).</summary>
public static class Labels
{
    public static string Of(UserRole r) => r switch
    {
        UserRole.Admin => "Administrator",
        UserRole.Designer => "Gestalter",
        _ => "Betrachter",
    };

    /// <summary>What a role may do, in a sentence (the user form and the profile show it).</summary>
    public static string Describe(UserRole r) => r switch
    {
        UserRole.Admin => "Darf alles, auch Benutzer, KI und Einstellungen verwalten.",
        UserRole.Designer => "Gestaltet Designs, pflegt Medien, Schriften, Datenlisten und Druckbögen und führt Ausgaben aus.",
        _ => "Sieht Designs und Datenlisten und führt Ausgaben aus, ändert aber nichts.",
    };

    public static string Of(AiProvider p) => p == AiProvider.ChatGpt ? "ChatGPT-Konto" : "OpenAI-kompatibel (API-Schlüssel)";

    public static string Of(AiAction a) => a switch
    {
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
        _ => "Warnung",
    };
}
