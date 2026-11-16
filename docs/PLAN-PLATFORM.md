# MatCan – plan 3: a platform

Plan 2 (`PLAN-CANVA.md`) made MatCan a Canva-like design tool for one shared workspace. Plan 3 turns it into a **platform**: every person
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

## Status: done (2026-10-26)

P1 to P6 are finished: the foundation (areas, `Access`, migration of the data of plan 2), projects and folders, sharing and the public view, teams / accounts / mail / notifications, comments, and the final pass (the migration tried on a copy of the owner's real database, a security review with fixes, the README with new screenshots, a clean run of every browser check on a fresh database, twice).
The text below is the plan as it was written; where the result differs, the status sections of the phases at the end of this file say so (**P1, P3, P2, P4, P5, P6 status**), the security review of P6 is the last section. The short list:

- **Roles**: Administrator and Member as planned; the data migration is the C# service `Services/PlatformMigration`, not SQL (the old role names are no value of the new enum). The platform's own items (`SpaceId` null) are View for everybody, Manage for an administrator.
- **Pages** (`/Zugriff/{kind}/{id}` instead of a bare 403/404 for pages, team tabs as one page each, `/Einladung/{token}` joins by a button), **notifications and mails** (`MailQueue` carries ids only), **comments** (key `K`, pins in their own layer, not in the SVG) and the file browser differ in details that the status sections list.
- **P6 added**: advisory lock per design/list save (`ItemLock`), the brake on notifications per person who writes, `SafeUrl` for the address of a notification, links in mails from the address chosen by the administrator (never from a Host header), brakes on the anonymous routes that serve by hash, a stricter hash (12 characters) for fonts, sessions only for approved accounts, no Owner role for a support join, `X-Robots-Tag` everywhere; `LogicCoverageTests` keeps the rule "a new method of the business layer goes into a test".

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
`Services/*Seeder`, endpoints' access checks, `/media` + `/fonts` + thumbnail serving, `tests/MatCan.Tests/**`).
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
small, "Erstellt mit MatCan").

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

---

## P1 status (what the result does differently)

- The data migration is the C# service `Services/PlatformMigration` (marker setting `Platform.Migrated`), not SQL in the EF migration: the old role names Designer/Viewer are no value of the new `UserRole` enum. `ItemKind` also has `Asset`.
- Platform-owned items (`SpaceId` null: built-in media, templates, fonts, sheets) are View for every signed-in person; an administrator has Manage on them. The demo design is such a system template; the demo list and job go into the first administrator's personal area.
- Deleting a user's item moves it to the trash (`TrashedDate`, cascade through `TrashedWithFolderId`); system items are soft deleted at once; `TrashPurger` (hourly) and `ItemLogic.PurgeOlderAsync` empty the trash.
- A person with Edit through a share may change or remove only the shares they made themselves. A link counts as long as it is not revoked (an expired one is still listed; it grants nothing). The sharing search returns teams first, at most 8 hits. Sign-in is refused for Pending/Declined accounts.
- `/media/{key}` without `?v=hash` needs a signed-in person who may see the asset (anonymous: 401, signed in without access: 404). Extra endpoints: `/api/spaces*`, `/api/share/open`, `/api/spaces/{id}/brand`. Notifications are not written by `ShareLogic` yet (P5).
- Switching a design to a template needs Manage. The AI "Weitermachen" of an administrator only works where the administrator has Edit on the subject.

## P3 status (what the result does differently)

- Where the plan says an item the person may not see is a 404, the **pages** (Designer, Designs/Edit, Print, DataLists/Edit, Outputs/Edit and Run) send a signed-in person to `/Zugriff/{kind}/{id}` (`Pages/Share/NoAccess`), which offers "Zugriff anfordern" and never says whether the item exists (a request for an id that is not there writes nothing and answers the same). The APIs still answer 404. The page for a folder opened without access belongs to P2's folder pages.
- The public payload (`/api/s/{token}`, `/api/s/{token}/d/{id}`) is built by `PublicShareLogic` from the design itself; "Herunterladen erlauben" is a courtesy of the viewer (the document is public anyway). The brake is 240 requests per minute and address, a request that finds nothing costs 5 (`PublicRateLimiter`). Public links stop working while `Platform.publicLinks` is off and work again when it is switched on.
- `ShareLogic.AddAsync` takes the optional message of the dialog; until P4 notifies it is written to the activity log only. `LinkInfo` has `GrantCount` and `Expired`. Notifications (P4) hook into `AccessRequestLogic.CreateAsync`/`DecideAsync` and `ShareLogic.AddAsync`.
- A SignedIn link of a folder lands on `/Freigegeben/Ordner/{id}` (P2 redirects to the area when the person is a member). The editor's presence is in memory (`PresenceTracker`, 30 s); the toast names only editors.
- Teilen buttons also sit on the edit pages of designs, data lists and output jobs (`data-share-open`).

---

## P2 status (what the result does differently)

- The browser pages are `Pages/Projects` (four small pages over one base class: area and team area, each with and without a folder), `Pages/Shared/Freigegeben*` (the folder `Pages/Shared` is also the folder of the layouts: the pages there are `/Freigegeben` and `/Freigegeben/Ordner/{id}`), `Pages/Starred`, `Pages/Trash`. The start page row "Zuletzt verwendet" and its search use the same control (modes "recent" and "search").
- The menu keeps "Designs" (the flat list with the filter "Bereich") in the group Gestalten next to Vorlagen; "Papierkorb" sits in a group "Aufräumen". "Alle Teams" links to `/Teams` (page of P4).
- Dragging items uses mouse and pen; on a touch screen the long press opens the menu and "Verschieben nach …" does the move. "Herunterladen" in the item menu exists for images only (the editor has no address that opens its download dialog).
- `DtMenu` (`js/dt-menu.js`) is the menu control of the shell; the editor still has its own copy in `designer.menu.js`. A right click or long press does not select the item (the menu acts on the item, or on the selection when the item is part of it).
- "Zuletzt verwendet" holds what the person opened or made (`ItemVisit`, also written by creating, copying and duplicating); it is not the newest-first list of the older start page. The storage bar of the page Uploads & Medien shows the personal area; the browser header shows the area that is open.
- New logic: `ItemLogic.RenameAsync`, `DuplicateAsync` (next to the original), `ItemQuery.ExcludeTemplates`, `ItemRow.Level/Previews/TrashedWithFolderId`; endpoints `/api/items/duplicate|rename|new-datalist`; the personal area of somebody else is called "Projekte von {Name}" in lists.

## P4 status (what the result does differently)

- The team page is **one page per tab** (`/Teams/{slug}/Projekte|Mitglieder|Marke|Vorlagen|Einstellungen`; `/Teams/{slug}` redirects to Projekte), not one page with client-side tabs: the address says which tab is open, and `/Teams/{slug}/Projekte` of P2 stayed the file browser (its head carries the team badge and the tabs). Einstellungen exists for Owner and Admin only (403 for others, no tab).
- `/Einladung/{token}` joins through a **button** (POST "Einladung annehmen"), not by opening the page: a link that a mail program or another site fetches must not add anybody. A member who opens a used link again is welcomed, not told it is dead.
- Registration in the mode "open" leads to the sign-in page with a toast (no automatic sign-in), because signing in only for new addresses would tell whether an address exists. Registration through an invitation signs in and opens the team. Platform invitations have a page of their own, `/Account/Invitations` (user menu, /Teams, Admin/Users); team invitations are made on the Mitglieder tab.
- The profile groups are Freigaben, Zugriffsanfragen, Erwähnungen and "Einladungen und Teams" (an accepted invitation and being added to a team are mailed with it); role changes, removal, declined requests and transfers are notifications without a mail. Two kinds were added to the plan's list: `registration-pending` (to the administrators) and `content-transferred` (to the heir of a deleted account).
- A deleted team's content stays in the trash only until the purger removes it: the memberships are gone with the team, so nobody can restore it (as in P1). The settings page says so.
- Deleting an account with a transfer puts everything into a new folder "Übernommen von {Name}" in the target area; a team the person owns alone passes to its first Admin (without an Admin the deletion is refused with the reason).
- Teams, registration and invitations are rate limited with the one `PublicRateLimiter` (the keys differ: `register:`, `register-mail:`, `invite:`).
- Extra endpoints: `POST /api/spaces/{id}` (update), `/delete`, `/transfer`; `/api/notifications*`.

## P5 status (what the result does differently)

- The key for a comment is **K**, not `C` as the brief said: `C` already adds a circle (documented in the dialog "Tastenkürzel" and used by the checks). The same entry is in the context menu ("Kommentieren"; on the empty page "Kommentar hier schreiben") and, on a phone, in the Mehr menu ("Kommentare (n)").
- `Comment` got two columns (migration `Comments`): `MentionsJson` (ids of the people the text mentions) and `EditedDate` (an edit; `UpdateDate` also moves with a resolve, which is no edit). A mention is the name in the text (`@Name`) plus the id the client sends; the server keeps an id only when the person can see the design and the name is really in the text, so nobody is pinged without a visible sign. Who can see the design is worked out by `CommentLogic.AudienceAsync` (area members, shares on the item or a folder above, directly or through a team, people who opened a live sign-in link); a public link gives nobody anything.
- The platform's own templates (no area) cannot be commented: every signed-in person could see them, so every person could write on them.
- The e-mail address of a candidate is only given to somebody who manages the design (and only they can search by address); everybody else finds people by the start of the name.
- Avatars are not coloured by the server: the script colours them from the name (as the Teilen dialog does).
- Pins sit in their own layer `#dt-pins` inside the sheet, not in the SVG overlay: they need to be clickable buttons, and they must never reach a download, a print or a thumbnail. An element pin is drawn at the current centre of the element, as the brief said; the stored point of the comment is the fallback when the element is gone.
- The list is fetched every 30 s while the tab is visible (also with the panel closed, because of the badge), not only while the panel is open.
- On a phone the sheet gets bottom padding while it shows comments (`is-comments-open`), so a pin can be scrolled into the part of the page above it.

## P6 status (what the result does differently)

- **Migration on a copy of the real database** (2026-10-26, local stack at the state of plan 2: one EF migration `Initial`, three users, no two-factor): `pg_dump -Fc` of `matcan` into a new database, the app started from source against the copy, the original untouched (the counts of the original were identical before and after). The start applied `Platform` and `Comments` and ran `PlatformMigration` without an error; a second start applied nothing.
  Counts before and after, equal: users 3, designs 459 live (517 rows with the soft deleted; 10 templates and 449 of the people), data lists 79 (89 rows), data rows 3 001, output jobs 57, images 345 (36 built in, 309 uploads), fonts 21 (17 built in, 4 own), sheet layouts 6 (built in), history entries 859, log 2 067 (+3 for the sign-ins of the look), AI runs 126.
  Result: users Admin / Member / Member (all Approved), a personal area each (Owner), the team "Gemeinsamer Bereich" (`gemeinsamer-bereich`) with admin Owner, `k2designer` Editor, `k2viewer` Viewer; every design, list, job, upload and own font of the people in the team (449 + 79 + 57 + 309 + 4), the ten templates, the built-in images, fonts and sheets with `SpaceId` null (system), the `Brand` setting in the team, `ItemAssetRef` filled (212 designs with 579 keys, 69 lists with 492 keys), `Platform.Migrated` set. `admin@example.com` signs in (it has no second factor); the member `k2viewer` opens the team read-only and gets 403 on its settings; start page, Projekte, the team page and a design in the editor looked as they should (screenshots at 1440 looked at, no console error).
  The copy was dropped afterwards; nothing of the local stack was changed.
- **Security review**: the section below lists what was checked and what was fixed; `Integration/SecurityReviewTests` (26 tests) has a test for every fix, `Web/LogicCoverageTests` the guard that every method of the business layer is named in a test (an exemption needs a reason), `PermissionTests` got the row `AiProfileLogic.LoadModelsAsync`.
- **README and screenshots**: a German section "Projekte, Teams und Teilen" and six new images (`projects`, `share`, `team-members`, `public-view`, `comments`, `notifications`). `screens.js` makes them with four members (Mia Hofmann, Jonas Weber, Lea Schneider, Tim Brandt) and the team "Team Marketing" and removes everything again at the end (`--platform-only` runs just these). The older images were taken again with the same script. The shot of the Teilen dialog shows the address of the link with a made-up host (the script rewrites the field before the shot).
- **Browser checks**: `screens.js` on a fresh database (the app from source on port 3056, new database, `DT_ACCOUNT_FILE` outside the repository), then `run-all.js --fake-host 127.0.0.1 --fake-port 3068` twice on the same database, all green both times (1 823 checks a pass, about nine minutes): engine 193, pwa 48, demo 58, home 67, projects 121, templates 23, designer 148, canva 245, content 352, output 114, share 106, comments 122, teams 143, ai 83. The app log of the whole run holds no error (before: about 50 duplicate-key errors). Two checks had to change: `teams` named the administrator of `lib.js` ("E2E Admin"/"Test Admin") and failed for the administrator `screens.js` makes (it now compares the e-mail address; its first click on "Team erstellen" also works on a database without a team), and its bell section shared from the designer to the viewer, a pair that the other checks had used up for the brake on notifications (10 of a kind in 10 minutes) - the sender is now the person the check registers. The badge "99+" of a long-used database no longer breaks the bell checks (`parseInt`, the exact count from the API). The other known flakes (`home` "Eigene Größe 120 × 80", the presence check "after B left") did not occur in five full passes and screens runs; no change was made for them.
- **Tests**: `dotnet build` 0 warnings; `dotnet test` 1 292 tests (1 263 before; +29: the 26 of `SecurityReviewTests`, the 2 of `LogicCoverageTests`, one row of `PermissionTests`), all green against PostgreSQL 17.
- **Left open**: see "Known and accepted" in the review below (no confirmation of e-mail addresses, the member search, forwarded headers).

## Security review (P6)

Scope: everything plans 3 added (P1 to P5). Method: every endpoint and page that takes an id was read against `Access`; the business-layer methods were listed by reflection and each one is named in a test; the scripts and pages were searched for the patterns the rules forbid. A finding is a fix with a test, or a decision written down here.

**Checked, no change needed**
- **Ids of other areas and people** (items, folders, shares, links, spaces, teams, invitations, access requests, notifications, comments, presence, `/api/assets/resolve`, `/api/s/{token}/d/{id}`, fonts, sheets, images, previews of folders, the trash): a thing the person may not see is a 404 from the logic, a thing they only see a 403; `PermissionTests` (items, areas, administrators, no sign-in) and `AccessTests` hold the matrix, `SecurityReviewTests` the methods that take another kind of id (a share, a comment, a request, an invitation, a notification, the trash, fonts and sheets of a team).
- **Link tokens** are random GUIDs (122 bits); a revoked, reset, expired link, a link of an item in the trash, of the wrong audience or while the administrator switched public links off is dead (`PublicShareTests`, `SharingTests`); the public payload holds the design's own sample values, never rows of a list, and only the images and fonts the design uses and may use (`PublicShareTests`); `/media`, fonts and thumbnails serve by hash or to people who may see the thing (`KeyGuessingTests`).
- **Invitations**: the use of a link is claimed with one statement (six people accept the last use at once: one gets in), an address that does not match, an expired, used-up or revoked invitation is refused, opening the page joins nobody (a button does), the token of a deleted team is dead (`InviteTests`, `SecurityReviewTests`). **Registration**: the modes, the domain list, the same answer for an address that exists, the brakes (10 per client, 3 per address and minute), a pending account cannot sign in (`RegistrationTests`).
- **Mail**: the queue holds ids only; names and messages are flattened in headers and encoded in the HTML (`InviteTests`, `SecurityReviewTests`: a name with CR/LF and markup in the sender, the item and the message); the receiver is the only recipient.
- **Scripts and pages**: no `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `eval`, `new Function`, `style=` or `.style.cssText` in the app's scripts (the only hits are comments and a read of `CSSRule.cssText`); every `Html.Raw` and `HtmlString` in the pages is a constant, the sprite or encoded data. Every `MapPost` goes through `Guard` (antiforgery); no GET changes anything but `/Account/Notifications?handler=Open` (marks one notification read) and `/s/{token}` of a link for signed-in people (grants the access the link names, by design).

**Fixed (each with a test in `Integration/SecurityReviewTests` unless said otherwise)**
1. **Two saves of one design at the same moment ended in a 500** (about 50 duplicate-key errors in the log of a full run): `SaveDocumentAsync` read the revision, checked it and wrote the new state, the history entry and the image references in parallel for both; the loser hit the unique index of `DesignRevision` or `ItemAssetRef` before the check of the revision could refuse it. A real race (autosave and the keep-alive request of a closing tab, two tabs, two people). Now `ItemLock` (a transaction-scoped PostgreSQL advisory lock per item) makes the saves of one design or one list (`SaveRowsAsync`, same pattern) take turns; the loser reads the new revision and gets the ordinary 409. Tests: eight saves at once, four rounds, for designs and for data lists.
2. **Host header poisoning of the links in mails**: `PublicUrl` remembered the `Host` of any request, signed in or not, and the mails (invitation tokens!) used it when `Server.PublicUrl` was not configured, so a stranger could make the next mail point to his own server. Now only requests of a signed-in administrator are remembered, `MailSettings.PublicBase` ("Adresse für Links in Mails" on `/Admin/Mail`, filled with the address of the administrator when left empty) wins over that, `Server.PublicUrl` over both. Test: anonymous and member requests with a foreign Host change nothing, the composed mail has the chosen base.
3. **Mention spam** (P5's note): a person with View could ping a person up to 30 comments a minute (and by sharing and unsharing, by access requests, by role changes without any limit). Now `NotificationLogic.NotifyAsync` lets one author write at most 10 notifications of one kind to one person within 10 minutes; the next ones are merged into the newest of them ("… (und 5 weitere)", `repeats` in its data; the row turns unread again, so nothing is lost and nobody gets more rows) and send no mail. Tests: 15 mentions, the author of a share toggled 15 times, another author and another kind are not affected, the window ends after 10 minutes, the mail queue gets exactly ten jobs.
4. **The address of a notification** is only a path of this app: `NotificationLogic.SafeUrl` (list, open, mail link) and `notify.js` refuse `//host`, `/\host`, `https:`, `javascript:` and control characters. The page already used `LocalRedirect`; now the data is clean as well. Tests: the function, a row with a hostile address through the HTTP page (redirects to the list), the list and the mail.
5. **A platform administrator could add himself to any team as Owner** through `POST /api/spaces/{id}/members` (the support path was meant to give Admin): now a 403 for the role Owner; the support join still works as Admin.
6. **Short font addresses**: `/fonts/{id}-{hash}.ttf` accepted 6 characters of the hash (24 bits, for anybody, no sign-in); now 12 like media and thumbnails.
7. **Guessing at the routes that anybody may call**: `/media`, `/fonts` and thumbnails have a brake for addresses that are not signed in and keep missing (120 per minute, a miss costs 4, then 429 with `Retry-After`, before any work); the page `/s/{token}` has the brake of its API; `/api/share/search` (names and addresses of members) 120 per minute and person. Tests for each.
8. **A declined account kept its session**: `SessionCache` only asked for `IsActive`. Now an account must be active and approved to have a session, `SetApprovalAsync(false)` signs the person out everywhere, and an administrator account is deactivated, never declined (test: the browser of a declined member is sent to the sign-in at once).
9. **Headers**: `X-Robots-Tag: noindex, nofollow` on every response except `robots.txt` and `llms.txt` (the meta tag was only in the pages), `Cache-Control: no-store` on `/Einladung/{token}`; test: every page that anybody may open (sign-in, registration, waiting page, invitation, link, public API, offline page, health) has CSP, `nosniff`, `noindex`, the referrer policy.
10. **Rows missing from the tables** (every method that writes or reads by id belongs in them): `AiProfileLogic.LoadModelsAsync` (administrator), and `Web/LogicCoverageTests` now fails when a public method of the business layer is named in no test, so the next one cannot be forgotten.

**Known and accepted** (decisions, not bugs)
- **The e-mail address of a registration is not confirmed.** The domain list limits what may be typed, not who owns the address: with open registration anybody can register `name@firma.de`, and a person who registers an address before the real owner gets the invitations that name it. The closed mode is "Mit Freigabe" (the administrator checks every account); the settings page says so. An e-mail confirmation (a mail with a token) is a feature for later.
- **Every member can find every active member by name and address** (`/api/share/search`, needed by the Teilen dialog); with open registration that means anybody. Braked (120 per minute and person), at most 8 hits per call, two characters minimum; the settings page says so. Masking the address would cost the disambiguation in the dialog.
- **`ForwardedHeaders` trusts every proxy** (`KnownProxies` is cleared, as in MatTicket's container setup): the brakes per client address hold when the app is reached through the reverse proxy alone (the proxy writes the last entry); a client that talks to the container directly can write its own `X-Forwarded-For`. The port is for the proxy, not for the internet.
- `GET /Account/Notifications?handler=Open&id=…` marks one notification of the signed-in person as read and redirects to a path of the app: a foreign page can cause nothing else. A `/s/{token}` link for signed-in people grants its access to whoever opens it while signed in - that is its purpose.
- A multi-use invitation link with the role Owner is a decision of the Owner who made it.
