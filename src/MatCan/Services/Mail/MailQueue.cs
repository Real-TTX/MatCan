using System.Threading.Channels;
using MatCan.Configuration;
using MatCan.Logic;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace MatCan.Services.Mail;

/// <summary>
/// Something that should become a mail. <b>A job carries ids only</b>: the mail is written later from the database (<see cref="MailComposer"/>), so a job never holds content that could be
/// stale or hostile, and a person who changed their mail settings in the meantime is respected.
/// </summary>
public abstract record MailJob
{
    /// <summary>An invitation by e-mail address: the mail has the link.</summary>
    public sealed record Invitation(long InvitationId) : MailJob;

    /// <summary>A notification (share, access request, mention ...) that the person gets by mail as well when their profile says so.</summary>
    public sealed record Notification(long NotificationId) : MailJob;

    public sealed record Test(string To, TaskCompletionSource<string?> Done) : MailJob;
}

/// <summary>
/// The mails of the platform go through a queue: a page never waits for a mail server, and a mail server that is down never breaks a page. Without mail settings the jobs are dropped quietly
/// (the composer returns nothing). The tests listen to <see cref="Queued"/>.
/// </summary>
public sealed class MailQueue
{
    private readonly Channel<MailJob> _channel = Channel.CreateBounded<MailJob>(new BoundedChannelOptions(500) { FullMode = BoundedChannelFullMode.DropOldest });

    public ChannelReader<MailJob> Reader => _channel.Reader;

    /// <summary>Raised for every job that is put into the queue (before the sender takes it).</summary>
    public event Action<MailJob>? Queued;

    private void Write(MailJob job)
    {
        Queued?.Invoke(job);
        _channel.Writer.TryWrite(job);
    }

    public void InvitationCreated(long invitationId) => Write(new MailJob.Invitation(invitationId));

    public void NotificationWritten(long notificationId) => Write(new MailJob.Notification(notificationId));

    /// <summary>Sends a test mail and says what went wrong (null: sent).</summary>
    public async Task<string?> TestAsync(string to)
    {
        var done = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        await _channel.Writer.WriteAsync(new MailJob.Test(to, done));
        var finished = await Task.WhenAny(done.Task, Task.Delay(TimeSpan.FromSeconds(45)));
        return finished == done.Task ? done.Task.Result : "Der Mailserver hat nicht rechtzeitig geantwortet.";
    }
}

/// <summary>Writes and sends the mails of <see cref="MailQueue"/>.</summary>
public sealed class MailSender(MailQueue queue, MailComposer composer, SettingStore settings, SecretProtector secrets, ILogger<MailSender> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await HandleAsync(job, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "A mail of {Job} could not be sent.", job.GetType().Name);
                if (job is MailJob.Test test)
                {
                    test.Done.TrySetResult(ex.Message);
                }
            }
        }
    }

    private async Task HandleAsync(MailJob job, CancellationToken ct)
    {
        var mail = settings.Get<MailSettings>(SettingStore.Mail);
        if (job is MailJob.Test test)
        {
            if (!mail.IsUsable)
            {
                test.Done.TrySetResult("Die Mail-Einstellungen sind nicht vollständig oder ausgeschaltet.");
                return;
            }

            var body = "Diese Nachricht kommt von MatCan. Der Versand funktioniert.";
            await SendAsync(mail, MailContent.Build(test.To, "MatCan: Testnachricht", [body], null, null), ct);
            test.Done.TrySetResult(null);
            return;
        }

        if (await composer.ComposeAsync(job, ct) is { } outgoing)
        {
            await SendAsync(mail, outgoing, ct);
        }
    }

    private async Task SendAsync(MailSettings mail, OutgoingMail outgoing, CancellationToken ct)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(MailContent.Header(mail.FromName), mail.FromAddress));
        message.To.Add(MailboxAddress.Parse(outgoing.To));
        message.Subject = outgoing.Subject;
        message.Body = new BodyBuilder { HtmlBody = outgoing.Html, TextBody = outgoing.Text }.ToMessageBody();

        using var client = new SmtpClient { Timeout = 30_000 };
        var security = mail.Security switch
        {
            "ssl" => SecureSocketOptions.SslOnConnect,
            "none" => SecureSocketOptions.None,
            _ => SecureSocketOptions.StartTls,
        };
        await client.ConnectAsync(mail.Host, mail.Port, security, ct);
        if (!string.IsNullOrEmpty(mail.UserName))
        {
            await client.AuthenticateAsync(mail.UserName, secrets.Unprotect(mail.PasswordProtected), ct);
        }

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
