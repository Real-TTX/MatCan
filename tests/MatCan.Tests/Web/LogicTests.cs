using MatCan.Configuration;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.UiKit;

namespace MatCan.Tests.Web;

public sealed class AiInstructionTests
{
    [Fact]
    public void The_layers_come_in_their_order()
    {
        var op = new OperatorAiConfig { OperatorInstruction = "BETREIBER", ActionInstructions = new() { ["Test"] = "AKTION" } };
        var text = AiInstructions.SystemText(op, new AiSettings { BaseInstruction = "WEBSITE" }, new SiteSettings(), AiAction.Test, "SCHRITT");
        var order = new[] { "BETREIBER", "AKTION", "WEBSITE", "SCHRITT", "ANTWORTFORMAT" }.Select(s => text.IndexOf(s, StringComparison.Ordinal)).ToList();
        Assert.DoesNotContain(-1, order);
        Assert.Equal(order.OrderBy(i => i), order);
    }

    [Fact]
    public void An_empty_base_instruction_means_the_built_in_one()
    {
        var text = AiInstructions.SystemText(new OperatorAiConfig(), new AiSettings { BaseInstruction = "" }, new SiteSettings(), AiAction.Test, null);
        Assert.Contains(AiInstructions.DefaultBase, text);
        Assert.DoesNotContain("Vorgabe des Betreibers", text);
    }

    [Fact]
    public void The_test_action_asks_for_a_json_object_with_ok()
    {
        Assert.Equal("ok", AiInstructions.RequiredField(AiAction.Test));
        Assert.Contains("\"ok\": true", AiInstructions.Fixed(AiAction.Test));
        Assert.Contains("\"ok\"", AiInstructions.Nudge(AiAction.Test));
    }
}

public sealed class PasswordRuleTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("kurz")]
    [InlineData("neunzeich")]
    public void Short_passwords_are_refused(string? password) => Assert.NotNull(UserLogic.CheckPassword(password));

    [Fact]
    public void A_long_password_is_fine_unless_it_is_the_address()
    {
        Assert.Null(UserLogic.CheckPassword("zehn-zeichen!", "anna@example.com"));
        Assert.NotNull(UserLogic.CheckPassword("Anna@Example.com", "anna@example.com"));
    }
}

public sealed class RoleLabelTests
{
    [Theory]
    [InlineData(UserRole.Admin, "Administrator")]
    [InlineData(UserRole.Member, "Mitglied")]
    public void Roles_have_their_german_names(UserRole role, string label) => Assert.Equal(label, Labels.Of(role));

    [Fact]
    public void The_menu_of_a_page_that_exists_marks_its_item_as_active()
    {
        var menus = new[] { new NavSet("main", "Test", "home", [new(null, [new("Start", "/", "dashboard"), new("Benutzer", "/Admin/Users", "users")])]) };
        Assert.Equal("/", Navigation.ActiveHref(menus, "/"));
        Assert.Equal("/Admin/Users", Navigation.ActiveHref(menus, "/Admin/Users/Edit"));
    }
}
