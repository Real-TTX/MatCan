namespace MatCan.Data.Entities;

public enum AiProvider
{
    /// <summary>Any server with the OpenAI-compatible /chat/completions (OpenAI, Mistral, DeepSeek, OpenRouter, an own server) and an API key.</summary>
    OpenAiCompatible,

    /// <summary>A ChatGPT account, signed in with a device code (like Codex); the tokens are renewed by the app.</summary>
    ChatGpt,
}

/// <summary>
/// A named connection to an AI ("DeepSeek Flash", "OpenRouter kostenlos", "ChatGPT"). Exactly one is active. The key or the sign-in is not in
/// this row: it lies encrypted in the data volume under <see cref="SecretToken"/>, outside the database, so it is never part of a backup or a
/// restore and never sent to a browser.
/// </summary>
public class AiProfile : AuditedEntity, ISoftDeletable
{
    public string Name { get; set; } = "";

    public AiProvider Provider { get; set; } = AiProvider.OpenAiCompatible;

    /// <summary>The template the address came from ("openai", "mistral" ...), for the page only.</summary>
    public string? Preset { get; set; }

    public string BaseUrl { get; set; } = "";

    public string Model { get; set; } = "";

    public bool IsActive { get; set; }

    /// <summary>The name of the secret file of this profile (the key, or the ChatGPT sign-in). A copy of a profile gets a new one.</summary>
    public Guid SecretToken { get; set; } = Guid.NewGuid();

    public string? Note { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

public enum AiAction
{
    /// <summary>A test of the active profile from the settings.</summary>
    Test,

    /// <summary>Free text or a pasted table becomes new rows of a data list (a preview first, then "Übernehmen"; the journal can take the rows back).</summary>
    DataImport,

    /// <summary>One column is filled for the selected rows from an instruction (a preview first; the journal keeps the old values).</summary>
    DataFill,

    /// <summary>Up to five alternatives for the text of a design element; nothing is saved on the server.</summary>
    TextSuggest,

    /// <summary>The design assistant (docs/PLAN-AI-DESIGN.md): one run per message of a conversation, a loop of model calls and tools that change the design, every step written down as it happens.</summary>
    DesignAgent,
}

/// <summary>How a run ended. Running only while it runs.</summary>
public enum AiRunStatus
{
    Running,
    Done,
    Waiting,
    LimitReached,
    Stuck,
    Error,
    Cancelled,
}

/// <summary>One run of the AI: what was asked, by whom, through which profile, what it cost and how it ended. Every step is in <see cref="AiRunStep"/>.</summary>
public class AiRun : AuditedEntity
{
    public AiAction Action { get; set; }

    public AiRunStatus Status { get; set; } = AiRunStatus.Running;

    /// <summary>What the run worked on (a design, a data list ...): the kind and the id, for the run list.</summary>
    public string? SubjectType { get; set; }

    public long? SubjectId { get; set; }

    public long? UserId { get; set; }

    /// <summary>The per-address brake: a hash of the address that changes every day, never the address.</summary>
    public string? AddressHash { get; set; }

    public string ProfileName { get; set; } = "";

    public string Model { get; set; } = "";

    /// <summary>"profile" (an own connection) or "relay".</summary>
    public string Transport { get; set; } = "profile";

    public int PromptTokens { get; set; }

    public int CompletionTokens { get; set; }

    /// <summary>The provider gave no numbers: the tokens are estimated (characters / 4).</summary>
    public bool TokensEstimated { get; set; }

    public int Nudges { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public string? Error { get; set; }

    /// <summary>The conversation of the design assistant this run belongs to (one run per message); null for the other actions.</summary>
    public long? ConversationId { get; set; }

    /// <summary>The number of the run in its conversation (1, 2, ...); 0 for the other actions.</summary>
    public int Number { get; set; }

    /// <summary>The checked result (jsonb), what the page shows: for the data actions the proposal that "Übernehmen" applies (the code checked it, never the model).</summary>
    public string ResultJson { get; set; } = "{}";

    /// <summary>What the person asked (jsonb): list, text, hint / rows, column, instruction. "Weitermachen" starts the same request again.</summary>
    public string RequestJson { get; set; } = "{}";

    public List<AiRunStep> Steps { get; set; } = [];

    public int TotalTokens => PromptTokens + CompletionTokens;
}

public enum AiStepKind
{
    Message,
    Action,
    Result,
    Warning,

    // the design assistant (a conversation): what the person wrote, what the model wrote, what a tool did, grey and red lines, and how the run ended
    User,
    Assistant,
    Info,
    Error,
    End,
}

public class AiRunStep : AuditedEntity
{
    public long AiRunId { get; set; }

    public AiRun? AiRun { get; set; }

    public int Number { get; set; }

    public AiStepKind Kind { get; set; }

    public string Text { get; set; } = "";

    public DateTime OccurredDate { get; set; }

    /// <summary>The data of a step of the design assistant (jsonb): assistant = model, tokens, note, raw, actions; action = tool, args, ok, summary, warnings, result, pageId, elementIds, changed, revision, picture; user = files, refs; end = state.</summary>
    public string DataJson { get; set; } = "{}";
}

/// <summary>A change a run made, with the value before: the journal that "Rückgängig" walks back, the newest run first.</summary>
public class AiJournalEntry : AuditedEntity
{
    public long AiRunId { get; set; }

    public AiRun? AiRun { get; set; }

    public string EntityType { get; set; } = "";

    public long EntityId { get; set; }

    public string Field { get; set; } = "";

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public DateTime? RevertedDate { get; set; }
}

public enum AiConversationStatus
{
    Idle,
    Running,
}

/// <summary>
/// A conversation with the design assistant about ONE design. Private to its person (an administrator reads it in the run list). <see cref="HistoryJson"/> is what the model sees of it (the messages and
/// the results of its tools; pictures are not in it, they ride along with the run they came with), <see cref="ScopeJson"/> where the newest message said the AI may work.
/// </summary>
public class AiConversation : AuditedEntity, ISoftDeletable
{
    /// <summary>"Design" (what <see cref="AiRun.SubjectType"/> says too).</summary>
    public string SubjectType { get; set; } = nameof(Design);

    public long SubjectId { get; set; }

    public long UserId { get; set; }

    /// <summary>From the first message, at most 80 characters.</summary>
    public string Title { get; set; } = "";

    public AiConversationStatus Status { get; set; }

    /// <summary><c>{ kind: design|page|selection, pageId?, elementIds?, locked }</c> of the newest message.</summary>
    public string ScopeJson { get; set; } = "{}";

    /// <summary>The model-facing list <c>[{ role, content, tool, run }]</c>.</summary>
    public string HistoryJson { get; set; } = "[]";

    /// <summary>How many runs (messages) the conversation has had: the number of the newest run.</summary>
    public int Runs { get; set; }

    public int Tokens { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

/// <summary>What came with a message of a conversation: a picture (in the library, and a copy for the model under <c>{data}/ai-files</c>), the text of a document, or a reference to a design or a data list.</summary>
public class AiAttachment : AuditedEntity
{
    public long ConversationId { get; set; }

    public int RunNumber { get; set; }

    /// <summary>"image", "text" or "reference".</summary>
    public string Kind { get; set; } = "image";

    public string Name { get; set; } = "";

    /// <summary>The library image a picture was imported as.</summary>
    public long? AssetId { get; set; }

    public string? AssetKey { get; set; }

    /// <summary>The downscaled picture the model gets, relative to <c>{data}/ai-files</c>.</summary>
    public string? ModelImagePath { get; set; }

    public string? MediaType { get; set; }

    /// <summary>The text of a document (at most 60 000 characters), or the description of a reference.</summary>
    public string? TextContent { get; set; }

    /// <summary>For a reference: "design" or "datalist", and the id.</summary>
    public string? RefKind { get; set; }

    public long? RefId { get; set; }

    /// <summary>Why the file was not used (shown as a red chip); null for a file that was.</summary>
    public string? Refused { get; set; }
}
