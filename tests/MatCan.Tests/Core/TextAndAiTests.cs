using System.Text.Json.Nodes;
using MatCan.Core.Ai;
using MatCan.Core.Text;

namespace MatCan.Tests.Core;

public sealed class TextToolsTests
{
    [Theory]
    [InlineData("IT-Support für Größe", "it-support-fuer-groesse")]
    [InlineData("  ", "")]
    public void Slugs_are_made_from_names(string name, string slug) => Assert.Equal(slug, Slug.From(name));

    [Theory]
    [InlineData("Fett i. Tr.", "fett_i_tr")]
    [InlineData("Käse-Preis", "kaese_preis")]
    public void Keys_are_made_from_labels(string label, string key) => Assert.Equal(key, Slug.Key(label));

    [Theory]
    [InlineData("it-support", true)]
    [InlineData("It Support", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void A_slug_is_lower_case_with_dashes(string? slug, bool valid) => Assert.Equal(valid, Slug.IsValid(slug));

    [Fact]
    public void Personal_data_is_masked()
    {
        var masked = Pii.Mask("Bitte an max.muster@example.com oder +49 171 1234567 schreiben, Max Muster.", ["Max Muster"]);
        Assert.Equal("Bitte an [E-Mail] oder [Telefon] schreiben, [Name].", masked);
    }
}

public sealed class LenientJsonTests
{
    [Theory]
    [InlineData("```json\n{\"reply\": \"<p>Hi</p>\",}\n```")]
    [InlineData("Gern, hier ist die Antwort: {\"reply\": \"<p>Hi</p>\"} Viel Erfolg!")]
    [InlineData("{ /* Kommentar */ \"reply\": \"<p>Hi</p>\" }")]
    public void The_object_is_found_in_what_models_write(string text)
    {
        var o = LenientJson.FirstObject(text);
        Assert.NotNull(o);
        Assert.Equal("<p>Hi</p>", o.Value.Text("reply"));
    }

    [Fact]
    public void Braces_inside_strings_do_not_confuse_the_reader()
        => Assert.Equal("a } b", LenientJson.FirstObject("x {\"t\": \"a } b\"}")!.Value.Text("t"));

    [Fact]
    public void Nothing_is_nothing() => Assert.Null(LenientJson.FirstObject("Ich schaue mir das an …"));

    [Fact]
    public void Values_are_read_forgivingly()
    {
        var o = LenientJson.FirstObject("{\"id\": \"12\", \"ok\": \"ja\", \"n\": 3}")!.Value;
        Assert.Equal(12, o.Long("id"));
        Assert.True(o.Bool("ok"));
        Assert.Equal(3, o.Long("n"));
    }

    [Fact]
    public void Tokens_are_estimated_from_characters() => Assert.Equal(3, TokenEstimate.Of("123456789"));
}

public sealed class ChatCompletionsTests
{
    [Fact]
    public void Plain_messages_stay_plain_strings()
    {
        var messages = ChatCompletionsClient.BuildMessages([AiMessage.System("Regeln"), AiMessage.User("Frage"), AiMessage.Assistant("Antwort")], withAttachments: true);
        Assert.Equal(3, messages.Count);
        Assert.Equal("system", messages[0]!["role"]!.GetValue<string>());
        Assert.Equal("Frage", messages[1]!["content"]!.GetValue<string>());
        Assert.Equal("assistant", messages[2]!["role"]!.GetValue<string>());
    }

    [Fact]
    public void An_unknown_role_is_a_user_message()
    {
        var messages = ChatCompletionsClient.BuildMessages([new AiMessage { Role = "tool", Content = "x" }], withAttachments: false);
        Assert.Equal("user", messages[0]!["role"]!.GetValue<string>());
    }

    [Fact]
    public void A_picture_becomes_a_data_url_part_or_a_note_when_files_are_switched_off()
    {
        var message = AiMessage.User("Was ist das?");
        message.Attachments.Add(new AiAttachment { Kind = "image", MediaType = "image/png", Name = "etikett.png", Data = "QUJD" });

        var withFiles = ChatCompletionsClient.BuildMessages([message], withAttachments: true);
        var parts = Assert.IsType<JsonArray>(withFiles[0]!["content"]);
        Assert.Equal("text", parts[0]!["type"]!.GetValue<string>());
        Assert.Equal("data:image/png;base64,QUJD", parts[1]!["image_url"]!["url"]!.GetValue<string>());

        var without = ChatCompletionsClient.BuildMessages([message], withAttachments: false);
        Assert.Contains("etikett.png", without[0]!["content"]!.GetValue<string>());
    }

    [Fact]
    public void Tokens_of_a_conversation_are_the_sum_of_its_messages()
        => Assert.Equal(TokenEstimate.Of("abcd") + TokenEstimate.Of("12345678"), TokenEstimate.Of([AiMessage.User("abcd"), AiMessage.Assistant("12345678")]));

    [Fact]
    public void The_presets_name_a_provider_inside_the_eu()
    {
        Assert.Contains(AiPresets.All, p => p.Id == "mistral");
        Assert.NotNull(AiPresets.Find("mistral"));
        Assert.Null(AiPresets.Find("gibt-es-nicht"));
    }
}
