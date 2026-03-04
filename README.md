# Hide Date Prefix — Obsidian Plugin

**Version 1.3.2**

Hides the leading ISO 8601 date prefix (e.g. `{YYYY}-{MM}-{DD}`) from note titles in the **file explorer** while leaving the underlying filenames — and therefore all date-based sorting — completely intact. This is a purely visual change; no files are ever renamed or modified.

## Features

- **Date prefix hiding** — strips the configured date prefix from the displayed title in the file explorer
- **ISO 8601 token format** — all fields use `{YYYY}`, `{MM}`, `{DD}`, `{hh}`, `{mm}`, `{ss}` tokens; no regex required
- **Sort order preserved** — Obsidian sorts by the actual filename; only what you see changes
- **"Today" label** — a Daily Note whose filename matches today's date is shown with a configurable label (default `Today     -03`), updating automatically at midnight
- **Ignore patterns** — token-based list to keep certain filenames fully untouched; bare Daily Notes and Meetings notes are pre-filled by default
- **Custom ignore Today label** — ignored-pattern matches that start with today's date get their own configurable label prefix (default `Today'\s `)
- **Live rename support** — display updates correctly on every filename rename, no lag or skipped updates
- **Clean unload** — all elements are restored to plain text when the plugin is disabled or unloaded

## Example

| Filename on disk | Shown in explorer |
|---|---|
| `2026-03-03` *(today, bare daily note)* | `Today     -03` |
| `2026-03-03 Meetings` *(today, ignored pattern)* | `Today's Meetings` |
| `2026-03-02 Meetings` *(ignored pattern, not today)* | `2026-03-02 Meetings` *(unchanged)* |
| `2026-03-02 M! Alice meeting email planning` | `M! Alice meeting email planning` |
| `2026-01-15 Project kickoff` | `Project kickoff` |
| `2026-02-03` *(bare daily note, ignored)* | `2026-02-03` *(unchanged)* |

## How it works

1. On load the plugin attaches a `MutationObserver` to the file-explorer container, watching for all DOM mutations (child additions, text swaps, character data changes).
2. A `vault.on('rename')` listener acts as a safety net to catch any edge cases the observer misses.
3. Whenever a `.nav-file-title-content` element is painted or updated:
   - If the filename exactly equals today's date and **Show Today label** is on → replaced with the configured label (e.g. `Today     -03`)
   - If the filename matches any **ignore pattern** and **Show Today label for ignore matches** is on and it starts with today's date → replaced with the configured prefix label + the rest of the filename
   - If the filename matches any **ignore pattern** otherwise → left completely untouched
   - Otherwise the date prefix is wrapped in a hidden `<span class="hdp-date">` and the rest shown in `<span class="hdp-rest">`
4. A midnight timeout fires each night to refresh the Today label for the new date automatically.
5. On unload every element is restored to its original plain-text form; no trace is left behind.

## Settings

All patterns use **ISO 8601 token format**: `{YYYY}` `{MM}` `{DD}` `{hh}` `{mm}` `{ss}` — no regex knowledge required.

| Setting | Default | Description |
|---|---|---|
| **Enable** | `true` | Toggle date-prefix hiding without uninstalling. |
| **Date format** | `{YYYY}-{MM}-{DD}` | ISO token format of the date prefix at the start of filenames. Example for full datetime: `{YYYY}-{MM}-{DD}T{hh}:{mm}:{ss}Z`. |
| **Patterns to ignore** | `{YYYY}-{MM}-{DD}` / `{YYYY}-{MM}-{DD} Meetings` | One token pattern per line. Files whose full name exactly matches are left untouched. Literal characters match literally. |
| **Show "Today" label for daily note** | `true` | Replaces a bare Today's dated Daily Note with the label below. Updates at midnight. |
| **→ Label format** | `Today     -{DD}` | Token format for the Today label. Supports `{YYYY}`, `{MM}`, `{DD}`. |
| **Show "Today" label for pattern ignore matches** | `true` | Also applies a Today prefix to ignored-pattern files that start with today's date. |
| **→ Label format** | `Today's ` | Token format for the prefix. The rest of the filename is appended after. |

## Installation (manual / development)

```bash
cd ~/MiscCode/obsidian-hide-date-prefix
npm install
npm run build          # produces main.js
```

Copy `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder:

```
<your vault>/.obsidian/plugins/hide-date-prefix/
```

Reload Obsidian (**Ctrl/Cmd+R** in developer mode, or close and reopen), then go to **Settings → Community plugins** and enable **Hide Date Prefix**.

## Why not rename the files?

Renaming would break internal links and require vault reorganisation. This plugin is **purely visual** — filenames, links, frontmatter and every other Obsidian feature are never touched.


## Next Up:

Renaming affected tabs too (consistency)