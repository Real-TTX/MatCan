# DesignThix – plan 3: a platform

Plan 2 (`PLAN-CANVA.md`) made DesignThix a Canva-like design tool for one shared workspace. Plan 3 turns it into a **platform**: every person
has an own area, people work together in **teams**, and designs, folders and data lists are **shared** with people, teams or by link.
Owner decisions (2026-10-25):

- **Registration**: invitations (links, optionally by mail) **and** self-registration that the administrator switches on/off, optionally with approval.
- **Teams** like Canva: own area, shared brand kit, members with roles.
- **Sharing**: with people and teams (Kann ansehen / Kann bearbeiten) **and** by link: "Alle Angemeldeten mit dem Link" or a **public view link**
  without sign-in (the administrator can switch public links off).
- **Global roles**: only **Administrator** (runs the platform) and **Mitglied** (everybody else). What a person may do with a thing follows from
  ownership, team membership and shares. Existing designers and viewers become members (viewers keep read-only rights through the migration, §6).

This plan wins over `PLAN.md` and `PLAN-CANVA.md` where they differ. User-facing text German with "du"; code, comments, docs English.

---

## 1. What "platform" means here (acceptance list)

**Areas and folders**
1. Every person has a **personal area** ("Meine Projekte"). Every team has a **team area**. An area holds folders (nested, any depth up to 8),
   designs, uploads (images), data lists and output jobs; fonts and sheet layouts belong to an area but not to folders.
2. **Projekte** page = a file browser for one area: breadcrumb (Meine Projekte › Ordner › Unterordner), toggle grid / list, filter by kind
   (Alle, Designs, Ordner, Bilder, Datenlisten, Serienausgaben), sort (Zuletzt geändert, Name, Erstellt), search in the area, multi-select
   (checkbox, Shift/Ctrl click), drag items onto folders and onto the breadcrumb, context menu and "⋯" per item (Öffnen, Umbenennen, Teilen …,
   Verschieben nach …, Kopie erstellen, Mit Stern markieren, Herunterladen (designs), In den Papierkorb), button **"Neu"** (Design, Ordner,
   Bilder hochladen, Datenliste). Dropping files from the explorer onto the browser uploads them into the open folder. Folder tiles show up to
   four previews of their content and a colour.
3. **Verschieben nach …** dialog: tree of the areas the person may write to (own area, teams with role Bearbeiter or higher) and their folders,
   "Neuer Ordner" inside the dialog. Moving between areas is allowed for people with *Verwalten* (§3) on the item and write access to the target;
   the shares of the item stay.
4. **Mit Stern** (per person), **Zuletzt verwendet** (per person: opened or edited; start page and its own filter), **Papierkorb** (items of my
   areas that were deleted; restore, "Endgültig löschen", emptied automatically after **30 days**; deleting a folder trashes its content with it
   and restoring the folder restores that content).
5. **Speicherplatz**: images and fonts count against the area (default 2 GB personal, 10 GB per team; the administrator changes the defaults
   and per area). The Uploads page and the team page show the usage bar; an upload over the limit is refused with a clear message.

**Sharing**
6. **"Teilen"** dialog (Canva-like) for designs, folders, data lists and output jobs, reachable from the editor top bar (button "Teilen" next to
   "Herunterladen"), from every item menu and from the folder header:
   - field "Personen oder Teams hinzufügen" (search by name or e-mail among active members and my teams; at least 2 characters; shows at most 8),
     permission per entry **Kann ansehen** / **Kann bearbeiten**, optional message; the list of everybody who has access (owner, team, shares,
     inherited from a folder: shown as "über Ordner X", changed there) with change/remove;
   - **Link**: "Nur Personen mit Zugriff" (default) / "Alle Angemeldeten mit dem Link" (ansehen or bearbeiten) / "Öffentlich – jeder mit dem Link
     kann ansehen" (only when the administrator allows public links; designs and folders only; option "Herunterladen erlauben"; optional expiry
     date); "Link kopieren"; "Link zurücksetzen" (new token, old link dead).
7. **Freigegeben** page ("Für mich freigegeben"): everything shared with me directly, through a team share or opened through a sign-in link;
   folders open in the browser with a breadcrumb that starts at the shared folder. Filter by kind, sort, search; "Entfernen" hides an item that
   came through a link (removes my link grant).
8. **Public view** `/s/{token}` (no sign-in, `noindex`): a design shows its pages (engine, sample values, never data list rows) with page
   navigation, zoom and – if allowed – "Herunterladen" (PNG/PDF via the print view); a folder shows a gallery of its designs (and subfolders)
   that open the same viewer. A signed-in link opened by a signed-in person grants access and opens the item; not signed in → sign-in, then back.
   An expired, reset or revoked link shows a friendly "Dieser Link ist nicht mehr gültig".
9. **Zugriff anfordern**: a signed-in person who opens an item without access gets a page with "Zugriff anfordern" (ansehen/bearbeiten, message);
   the owner/managers get a notification with one-click "Gewähren" / "Ablehnen".
10. **View-only designs** open in the editor read-only (as the viewer mode of plan 2) with "Kopie erstellen" (into an area I can write to),
    "Herunterladen", "Drucken"; a data list with view rights is read-only; an output job with view rights can be run.
11. **Presence**: the editor shows the avatars of the people who have the design open right now ("Anna bearbeitet gerade"); a second editor gets
    a hint, the revision check of plan 2 still guards the save (conflict dialog).

**Teams**
12. **Teams** page: my teams (tiles with name, colour, member avatars, storage), "Team erstellen" (members may create teams unless the
    administrator switched it off). Team page tabs: **Projekte** (the browser of §1.2 on the team area), **Mitglieder** (list, role, remove, leave,
    invite), **Marke** (the brand kit of the team: colours, fonts, logos), **Vorlagen** (team templates), **Einstellungen** (name, colour,
    description, delete team – owner only, with the name typed to confirm; content goes to the trash of the team and then away).
13. Team roles: **Inhaber** (everything incl. delete/transfer; at least one), **Admin** (members, invitations, brand, templates, settings),
    **Bearbeiter** (create and change everything in the team area, share, move, delete), **Betrachter** (sees the team area read-only).
14. **Einladen**: by e-mail address(es) (mail is sent when SMTP is configured, else the link is shown to copy) or as an **invitation link**
    (role, expiry 1/7/30 days, max uses); pending invitations listed with "Erneut senden" / "Zurückziehen". Accepting: signed in → join; not
    registered → registration through the invitation (works even when self-registration is off; the address must match when the invitation
    named one).

**Accounts and administration**
15. **Registrierung** (`/Account/Register`): name, e-mail, password (policy of plan 1), accept; modes set by the administrator: **Aus** (only
    invitations), **Offen**, **Mit Freigabe** (account waits until an administrator approves; sign-in says so); optional allowed e-mail domains.
    Rate limited per address; the page says nothing about whether an e-mail exists.
16. **Administration**: Benutzer (filter Wartet auf Freigabe / Aktiv / Deaktiviert; approve, deactivate, make administrator, set storage,
    delete with **transfer of content** to another person or team), **Teams** (list, members, storage, open as administrator for support:
    the administrator can add themselves to a team; this is logged), **Einstellungen › Plattform** (registration mode + domains, invitations by
    members on/off, members may create teams, public links on/off, default storage personal/team, trash days), **E-Mail** (SMTP, test mail;
    ported from MatTicket's `MailQueue`/`MailSettings`). The administrator does **not** see personal content of others; content is reached only
    through teams, shares and the transfer on deletion.
17. **Benachrichtigungen**: bell in the menu header with unread count; list (shared with you, invitation accepted, access requested/granted,
    comment/mention, team membership changed); click opens the item and marks it read; "Alle als gelesen markieren". Optional mail per kind
    (profile setting) when SMTP is configured.
18. **Kommentare** (Canva-like) in the editor: panel "Kommentare" in the rail, comment on the page or pinned to an element (pin on the canvas),
    replies, `@Name` mentions (people with access), resolve/reopen, delete own; people with view rights may comment. Notifications for
    mentions and replies.

**Navigation** (menu of `UiKit/Shell.cs`)
19. "Design erstellen" (asks "Speichern in: Meine Projekte / Team …" when the person has teams; default = the area they are in), Start,
    **Projekte**, **Freigegeben**, **Mit Stern**, group **Teams** (one entry per team + "Team erstellen" / "Alle Teams"), **Vorlagen**,
    group Bibliothek (Uploads, Marke, Schriften), group **Serien (Zusatz)** (Datenlisten, Serienausgaben, Druckbögen), **Papierkorb**,
    then the admin menu. The lists Datenlisten / Serienausgaben / Uploads / Schriften / Druckbögen show what the person can see, with a
    filter "Bereich" (Alle, Meine Projekte, each team, Freigegeben).

---

## 2. Data model (EF Core, one migration `Platform`; PascalCase, bigint Id, audit columns, UpdateState as before)

| Entity | Columns (besides Id/audit/UpdateState) | Notes |
|---|---|---|
| `Space` | `Kind` (Personal\|Team), `Name`, `Slug` (team, unique among live teams), `Description`, `Color` (#hex), `BrandJson` (jsonb, the brand kit of plan 2), `StorageQuotaBytes` (null = default), `DeletedDate` | A personal space per user (created with the user), a team = a space of kind Team. |
| `SpaceMember` | `SpaceId`, `UserId`, `Role` (Owner\|Admin\|Editor\|Viewer) | Unique (SpaceId, UserId). Personal space: exactly one Owner. |
| `Folder` | `SpaceId`, `ParentId?`, `Name` (≤ 120), `Color?`, `Path` (`/1/7/12/`, ids of the ancestors and itself), `TrashedDate?`, `TrashedWithFolderId?` | Depth ≤ 8. Moving rewrites `Path` of the subtree in one statement. |
| `Design`, `DataList`, `OutputJob`, `Asset` | + `SpaceId?` (null only for built-ins/system templates), `FolderId?`, `TrashedDate?`, `TrashedWithFolderId?` | Asset: built-ins keep `SpaceId = null`. |
| `Font`, `SheetLayout` | + `SpaceId?` (null = built-in) | No folders. |
| `Share` | `ItemKind` (Folder\|Design\|DataList\|OutputJob), `ItemId`, `UserId?` xor `SpaceId?` (a team), `Permission` (View\|Edit) | Unique per item and principal. |
| `ShareLink` | `ItemKind`, `ItemId`, `Token` (uuid, the secret), `Audience` (SignedIn\|Public), `Permission` (View\|Edit; Public = View), `AllowDownload`, `ExpiresDate?`, `RevokedDate?` | At most one live link per item; "zurücksetzen" revokes and creates a new one. |
| `LinkGrant` | `ShareLinkId`, `UserId`, `LastUsedDate` | A signed-in person who opened a SignedIn link; dies with the link. |
| `AccessRequest` | `ItemKind`, `ItemId`, `UserId`, `Permission`, `Message?`, `State` (Open\|Granted\|Declined), `DecidedUserId?`, `DecidedDate?` | |
| `Invitation` | `Token` (uuid), `SpaceId?` (team; null = platform invitation by an administrator), `Email?`, `Role` (team role), `ExpiresDate`, `MaxUses`, `Uses`, `RevokedDate?` | |
| `Star` | `UserId`, `ItemKind`, `ItemId` | Unique. |
| `ItemVisit` | `UserId`, `ItemKind`, `ItemId`, `LastOpenedDate` | Upsert on open/edit; feeds "Zuletzt verwendet". |
| `Notification` | `UserId`, `Kind`, `DataJson` (ids and names, never free HTML), `Url`, `ReadDate?` | Newest 500 per person kept. |
| `Comment` | `DesignId`, `PageId?`, `ElementId?`, `X?`, `Y?` (pin in document units), `ParentId?`, `Text` (≤ 2000, plain), `ResolvedDate?`, `ResolvedUserId?` | Soft delete. |
| `ItemAssetRef` | `ItemKind` (Design\|DataList), `ItemId`, `AssetKey` | Maintained on every save of a design/list (and by the migration): the asset keys it uses. |
| `User` | `Role` Admin\|Member (enum text; Designer/Viewer migrate to Member), `ApprovalState` (Approved\|Pending\|Declined), `PersonalSpaceId`, `NotifyMailJson` | |

Indexes for every foreign key, for `(SpaceId, FolderId, TrashedDate)`, `Folder.Path` (text_pattern_ops), `Share(ItemKind, ItemId)`,
`Share(UserId)`, `Share(SpaceId)`, `ShareLink.Token` unique, `Invitation.Token` unique, `ItemAssetRef(AssetKey)`, `ItemAssetRef(ItemKind, ItemId)`.

Settings (JSON in the settings table, `SettingLogic`): `Platform` `{ registration: "off"|"open"|"approval", allowedDomains: [], membersMayInvite: true,
membersMayCreateTeams: true, publicLinks: true, personalQuotaMb: 2048, teamQuotaMb: 10240, trashDays: 30 }`, `Mail` (as MatTicket; password through
`SecretProtector`). The global `Brand` setting of plan 2 is migrated (§6) and then unused.

---

## 3. Access (the heart; `Logic/Access.cs`, static, unit + integration tested)

Levels: **None < View < Edit < Manage**. `Manage` = share, links, move, rename folders, trash/restore, delete for good.

Effective level of a person on an item = the maximum of:
1. **Area membership** of the item's space: personal Owner → Manage; team Owner/Admin/Editor → Manage; team Viewer → View.
2. **Shares** on the item or on any folder above it (`Folder.Path` prefix): to the person, or to a team the person is a member of (any team role
   counts as the team) → View/Edit.
3. **Link grants**: a live SignedIn link of the item or of a folder above it that the person opened → its permission.
4. A **public link** gives View only inside the public pages (`/s/{token}`), never in the app.
5. Built-ins and system templates: View for everybody signed in.
6. Trashed items: only Manage-level people see them (in the trash); everything else treats them as missing.

Platform administrators get **no** content access from their role (§1.16); administration methods check `RequireAdmin`.

API of `Access` (all take `Biz`):
- `LevelAsync(biz, ItemKind, id)` and `RequireAsync(biz, ItemKind, id, Level)` (403 via `ForbiddenException`; a missing or invisible item is
  **404**, never 403, so ids cannot be probed: `NotFoundException` → middleware 404).
- `Visible<T>(biz, Level min)` → `IQueryable<T>` filter for Design/DataList/OutputJob/Asset/Folder (one SQL each: `EXISTS` subqueries over
  membership, shares with path prefix, link grants). **Every list, search, recent, starred, picker and API that returns items uses it.**
- `WritableSpaces(biz)` (spaces where the person may create: personal + teams with Editor+), `RequireSpaceRole(biz, spaceId, role)`.
- Sharing rules: Manage may share with View/Edit and create/change links; Edit may share with people/teams up to Edit but no links;
  View cannot share. Public links only for designs and folders and only when `Platform.publicLinks`. Sharing to a person who is not an active
  approved member is impossible.

**Assets and fonts (no leak by guessing keys)**
- Asset keys stay globally unique (plan 1 rule), so documents stay unambiguous across areas.
- `/media/{key}?v={hash}` serves when `v` equals the stored content hash (a **capability**: hashes are only handed out by APIs that checked
  access); without a matching `v` only built-ins and assets the person may see by membership. Same for thumbnails
  (`/designs/{id}/thumbnail.png?v=hash`) and fonts (`/fonts/{id}-{hash}.{ext}` is already a capability). These routes work without sign-in
  (needed by public links); they add `Cache-Control: private` for non-built-ins.
- **Key resolution** (`/api/assets/resolve?context=design:{id}|datalist:{id}` and inside payloads): returns url+hash for keys that are used by an
  item the person may View (via `ItemAssetRef`), or visible by membership, or built in.
- **Saving a design or data list** checks every asset key that is **new** compared with the stored version: it must exist and be visible to the saver
  (membership, built in, or referenced by an item the saver may View). Otherwise `BizException` "Das Bild „key“ ist für dich nicht verfügbar."
  Import (.dtx.json) brings its own assets into the target area, so it passes. Templates use built-ins.
- Fonts: `/fonts.css?space={id}` and `/api/fonts?space=` list built-ins + fonts of the areas the person is a member of + the fonts of the design's
  area when opened with `design={id}` (View on it required). On a family name clash the design's area wins.
- The media browser shows tabs Uploads (my area / the design's area / each team as a chip), Flaggen, Siegel, Logos (of the brand kit of the
  design's area), Alle.

**Quotas**: `StorageLogic.UsedBytes(spaceId)` (assets + fonts not deleted); upload/import checks before writing.

---

## 4. Server and pages (who owns what is in §5)

- **Logic** (static, `Biz` first): `SpaceLogic` (personal space creation, teams CRUD, members, roles, leave, transfer ownership, quotas),
  `FolderLogic` (CRUD, move with path rewrite, tree for the move dialog, folder previews), `ItemLogic` (cross-kind browser query: one result
  type `ItemRow { Kind, Id, Name, FolderId, SpaceId, UpdateDate, ThumbUrl, Starred, Size, Owner }` with filter/sort/paging; move, copy, trash,
  restore, purge; stars; visits; recent), `ShareLogic` (shares, links, grants, access requests, the "who has access" list, user/team search),
  `InviteLogic`, `RegistrationLogic`, `NotificationLogic`, `CommentLogic`, `PresenceLogic` (in memory: design id → people + last beat, 30 s),
  `StorageLogic`, `MailLogic` (+ `Services/Mail/MailQueue` from MatTicket: templates for invitation, share, access request, mention; plain
  text + simple HTML with encoded values). Existing logic (`DesignLogic`, `DataListLogic`, `AssetLogic`, `FontLogic`, `OutputLogic`, `SheetLogic`,
  `BrandLogic`, `DesignPackageLogic`, `AiDataLogic`, `AiTextLogic`) switches from roles to `Access`: create needs a writable space; read needs
  View; change needs Edit; delete/move/share needs Manage. `BrandLogic` reads/writes `Space.BrandJson` (team Admin+ / personal owner).
- **Background**: `TrashPurger` (hourly: trashed longer than `trashDays` → UpdateState Deleted, bytes released), presence cleanup.
- **Endpoints** (all POSTs through `LibraryEndpoints.Guard`): `/api/items` (browser query), `/api/items/move|copy|trash|restore|purge|star`,
  `/api/folders` (+ `/{id}`, `/{id}/rename`, `/tree`), `/api/share/{kind}/{id}` (GET who has access, POST add/change/remove, POST link
  create/change/reset/revoke), `/api/share/search?q=`, `/api/access-requests` (+ decide), `/api/notifications` (+ read, read-all, unread count),
  `/api/designs/{id}/comments` (+ reply, resolve, delete), `/api/designs/{id}/presence` (POST heartbeat → list), `/api/assets/resolve`,
  `/api/s/{token}` (public payload; anonymous; rate limited), `/api/spaces/{id}/brand`.
- **Pages**: `Projects/Index` (`/Projekte` and `/Projekte/Ordner/{id}`, team area `/Teams/{slug}/Projekte[/Ordner/{id}]`), `Shared/Index`
  (`/Freigegeben`), `Starred` (`/Mit-Stern`), `Trash` (`/Papierkorb`), `Teams/Index`, `Teams/Create`, `Teams/Team` (tabs), `Account/Register`,
  `Account/Invite` (`/Einladung/{token}`), `Account/Pending`, `Account/Notifications` (+ bell partial), `Share/View` (`/s/{token}`, layout
  `_Bare`/`_Print`-like, anonymous), `Share/NoAccess` (request access), `Admin/Teams`, `Admin/Platform`, `Admin/Mail`, `Admin/Users` (extended).
- **Scripts**: `js/browser.js` (+ `css/browser.css`: the file browser, used by Projekte, team Projekte, Freigegeben, Mit Stern, Papierkorb with
  modes), `js/share.js` (+ css: the Teilen dialog; `window.DtShare.open({ kind, id, name })` – the one entry point everybody calls),
  `js/movepicker.js` (`window.DtMove.pick({ kinds, exclude }, cb(spaceId, folderId))`), `js/notify.js` (bell), `js/public-view.js`,
  editor modules `designer.share.js` (top bar Teilen + avatars + presence) and `designer.panel-comments.js` (+ pins on the canvas overlay).

All rules of `CLAUDE.md` hold: no inline styles/scripts, no `innerHTML`, CSP, antiforgery, German "du", one code base per control, list pages
with toolbar/pager, `PermissionTests`.

---

## 5. Phases (Sonnet agents; the planner reviews, looks at screenshots and commits after each)

**P1 – Foundation** (alone; owns `Data/**`, the migration, `Logic/Access.cs`, `Logic/Biz.cs`, every existing logic class, `Services/StartupFixes`,
`Services/*Seeder`, endpoints' access checks, `/media` + `/fonts` + thumbnail serving, `tests/DesignThix.Tests/**`).
Entities + migration `Platform` + the data migration of §6, `Access` with `Visible<T>` and levels, `NotFoundException` → 404, roles Admin/Member
(policies: `Admin`, `SignedIn`; the `Designer` policy disappears; viewer-only UI switches now come from the item level, pass `CanEdit` etc. to the
pages from the logic), personal space on user creation (setup, admin create), asset capability serving + key rule on save + `ItemAssetRef`,
fonts per space, quotas, trash columns (logic only: trash/restore/purge + `TrashPurger`), `ItemLogic`/`FolderLogic`/`ShareLogic`/`SpaceLogic`
core methods WITHOUT UI, brand per space. Existing pages keep working (they show the person's visible items; create goes into the personal space).
**Tests**: an access matrix (`Integration/AccessTests`): for every kind and every path (owner, team Owner/Admin/Editor/Viewer, share View/Edit to
person and to team, folder share inherited 3 levels down, SignedIn link grant, revoked link, public link outside `/s`, stranger, platform admin,
trashed item) × every logic method that reads or writes. `PermissionTests` rewritten on top of it. Migration test from a plan-2 database
(designs, lists, jobs, assets, fonts, viewer/designer users) → expected spaces, memberships, refs. Key-guessing tests (save with a foreign key,
resolve without access, `/media` without hash). All existing tests green (adapted where roles changed). Browser checks green (adapt account
creation: the checks' "viewer" becomes a member with a View share or team Viewer).

**P2 – Projects, folders, trash, navigation** (after P1; owns `Pages/Projects/**`, `Pages/Starred/**`, `Pages/Trash/**`, `UiKit/Shell.cs` + menu,
`js/browser.js`, `js/movepicker.js`, css, start page changes, the create dialog's area choice, Uploads/Datenlisten/Serienausgaben/Schriften/
Druckbögen list filter "Bereich", `tests/e2e/projects-check.js`). §1 items 1–5, 19, and the start page: "Zuletzt verwendet" from `ItemVisit`,
search over visible items. The Teilen menu entries call `window.DtShare.open` (P3 provides it; until then a stub that shows a toast).

**P3 – Sharing** (after P1, parallel to P2 with disjoint files; owns `js/share.js`, `Pages/Shared/**`, `Pages/Share/**` (public view + no access),
`js/public-view.js`, `designer.share.js`, the editor top bar Teilen button and read-only "Kopie erstellen", presence, access requests UI,
`tests/e2e/share-check.js`). §1 items 6–11. Public view must look as good as the editor preview (dark neutral background, centred pages, logo
small, "Erstellt mit DesignThix").

**P4 – Teams, accounts, administration, mail, notifications** (after P2 and P3; owns `Pages/Teams/**`, `Pages/Account/Register|Invite|Pending|
Notifications`, `Pages/Admin/**` changes, `js/notify.js`, `Services/Mail/**`, `tests/e2e/teams-check.js`). §1 items 12–17. Team page "Projekte"
reuses the browser of P2; "Marke" reuses the `/Brand` page component with a space; the bell goes into the menu header (coordinate with Shell.cs).

**P5 – Comments** (after P4; owns `designer.panel-comments.js`, canvas pins, `CommentLogic` UI, `tests/e2e/comments-check.js`). §1 item 18.

**P6 – Final pass** (planner + one agent): migration on a copy of the owner's local database (pg_dump → new database → start → look), all browser
checks on a fresh database on 3053 twice, security review (IDOR on every endpoint with ids of another area, link tokens, public payload has no
data rows, `/media` capability, invitation abuse, registration rate limit, mail header injection), README (platform section, screenshots: Projekte,
Teilen dialog, team page, public view), CLAUDE.md, this plan's status.

---

## 6. Migration of existing data (P1, inside the migration's data step or `StartupFixes`, idempotent, one transaction)

1. Every user: role `Admin` stays Admin, `Designer`/`Viewer` → `Member`; `ApprovalState = Approved`; a personal space (Owner).
2. If the database holds any non-built-in content (designs that are not built-in templates, data lists, output jobs, uploaded assets/fonts,
   custom sheet layouts): create the team **"Gemeinsamer Bereich"** (colour = accent) with every user: Admin → Owner, Designer → Editor,
   Viewer → Viewer; move all that content into it (no folders); the global `Brand` setting becomes its `BrandJson`. Users keep exactly the rights
   they had.
3. Built-in templates (TemplateSeeder) and the Käsetheke template → system (SpaceId null, View for everybody). User-made templates → templates of
   the team.
4. `ItemAssetRef` filled from every design and data list.
5. Fresh install: the setup assistant creates the administrator with a personal space; `DemoSeeder` then puts the demo data list and output job
   into that personal space (the demo design stays a system template). The local admin account `admin@example.com` must keep working.

---

## 7. Out of scope (for now)

Real-time co-editing (presence + revision check instead), comments on data lists, SSO/Entra, public galleries/marketplace, version branching,
per-item audit trail beyond the existing activity log and design history.
