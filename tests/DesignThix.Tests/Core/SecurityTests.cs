using DesignThix.Core.Security;

namespace DesignThix.Tests.Core;

public sealed class TotpTests
{
    // RFC 6238, appendix B: the shared secret "12345678901234567890" (SHA-1). The RFC lists eight digits; the app uses the last six.
    private const string Secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    [Theory]
    [InlineData(59L, "287082")]
    [InlineData(1111111109L, "081804")]
    [InlineData(1111111111L, "050471")]
    [InlineData(1234567890L, "005924")]
    [InlineData(2000000000L, "279037")]
    public void Codes_match_the_test_vectors_of_the_rfc(long unixSeconds, string expected)
        => Assert.Equal(expected, Totp.Code(Secret, Totp.StepOf(DateTimeOffset.FromUnixTimeSeconds(unixSeconds))));

    [Fact]
    public void A_code_is_accepted_in_a_window_of_one_step_either_side()
    {
        var now = DateTimeOffset.FromUnixTimeSeconds(1111111109);
        var step = Totp.StepOf(now);
        Assert.Equal(step, Totp.Verify(Secret, Totp.Code(Secret, step), now, 0));
        Assert.Equal(step - 1, Totp.Verify(Secret, Totp.Code(Secret, step - 1), now, 0));
        Assert.Equal(step + 1, Totp.Verify(Secret, Totp.Code(Secret, step + 1), now, 0));
        Assert.Null(Totp.Verify(Secret, Totp.Code(Secret, step + 2), now, 0));
    }

    [Fact]
    public void A_code_works_once()
    {
        var now = DateTimeOffset.FromUnixTimeSeconds(1111111109);
        var step = Totp.StepOf(now);
        var code = Totp.Code(Secret, step);
        Assert.Equal(step, Totp.Verify(Secret, code, now, 0));
        Assert.Null(Totp.Verify(Secret, code, now, step));
    }

    [Theory]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("abcdef")]
    public void Input_that_is_not_six_digits_is_refused(string input)
        => Assert.Null(Totp.Verify(Secret, input, DateTimeOffset.UtcNow, 0));

    [Fact]
    public void Spaces_in_the_typed_code_do_not_matter()
    {
        var now = DateTimeOffset.FromUnixTimeSeconds(1111111109);
        var code = Totp.Code(Secret, Totp.StepOf(now));
        Assert.NotNull(Totp.Verify(Secret, code[..3] + " " + code[3..], now, 0));
    }

    [Fact]
    public void Base32_survives_a_round_trip_and_new_secrets_differ()
    {
        var bytes = new byte[] { 1, 2, 3, 250, 251, 252, 0, 7, 8 };
        Assert.Equal(bytes, Totp.Base32Decode(Totp.Base32Encode(bytes)));
        Assert.NotEqual(Totp.NewSecret(), Totp.NewSecret());
        Assert.Equal(32, Totp.NewSecret().Length);
        Assert.Throws<FormatException>(() => Totp.Base32Decode("not*base32"));
    }

    [Fact]
    public void The_address_for_the_authenticator_app_names_issuer_and_account()
    {
        var uri = Totp.Uri("DesignThix", "anna@example.com", Secret);
        Assert.StartsWith("otpauth://totp/DesignThix:anna%40example.com?secret=" + Secret, uri);
        Assert.Contains("digits=6", uri);
        Assert.Contains("period=30", uri);
    }
}

public sealed class PasswordHasherTests
{
    [Fact]
    public void A_password_verifies_against_its_own_hash_only()
    {
        var hash = PasswordHasher.Hash("ein-langes-passwort");
        Assert.True(PasswordHasher.Verify("ein-langes-passwort", hash));
        Assert.False(PasswordHasher.Verify("ein-anderes-passwort", hash));
    }

    [Fact]
    public void Two_hashes_of_one_password_differ_because_of_the_salt()
        => Assert.NotEqual(PasswordHasher.Hash("gleich"), PasswordHasher.Hash("gleich"));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("kein-hash")]
    [InlineData("v1.abc.def.ghi")]
    [InlineData("v2.1000.AAAA.AAAA")]
    public void Garbage_never_verifies_and_never_throws(string? stored)
        => Assert.False(PasswordHasher.Verify("egal", stored));

    [Fact]
    public void A_hash_with_a_lower_cost_wants_a_new_one()
    {
        Assert.False(PasswordHasher.NeedsRehash(PasswordHasher.Hash("x")));
        Assert.True(PasswordHasher.NeedsRehash("v1.1000.AAAA.AAAA"));
    }

    [Fact]
    public void Codes_have_the_length_asked_for_and_only_clear_characters()
    {
        Assert.Matches("^[0-9]{6}$", PasswordHasher.RandomDigits(6));
        Assert.Matches("^[A-HJ-NP-Z2-9]{10}$", PasswordHasher.RandomCode(10));
    }

    [Fact]
    public void Token_hashes_ignore_case_and_blanks_but_not_the_context()
    {
        Assert.Equal(PasswordHasher.HashToken("abc-123", "recovery"), PasswordHasher.HashToken(" ABC-123 ", "recovery"));
        Assert.NotEqual(PasswordHasher.HashToken("abc-123", "recovery"), PasswordHasher.HashToken("abc-123", "other"));
    }
}
