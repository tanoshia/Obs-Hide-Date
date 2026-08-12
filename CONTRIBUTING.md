# Contributing to Today Alias

Thanks for helping improve Today Alias. This plugin is **purely visual** — it never renames vault files or rewrites links.

## Setup

```bash
npm install
```

## Develop

```bash
npm run dev     # esbuild watch → rebuilds main.js on change
```

## Build

```bash
npm run build   # tsc -noEmit + production esbuild bundle
```

That produces `main.js` from `src/main.ts` (and `src/moment.ts`, `src/settings.ts`).

## Layout

| Path | Role |
| --- | --- |
| `src/main.ts` | Plugin lifecycle, DOM observers, settings tab |
| `src/moment.ts` | Typed rebind of Obsidian’s `moment` export |
| `src/settings.ts` | Settings interface + defaults |
| `styles.css` | Hide `.ta-date`; settings layout |
| `manifest.json` / `versions.json` | Plugin id, version, `minAppVersion` map |

`minAppVersion` is currently **1.2.3**. Settings use `getSettingDefinitions()` for Obsidian 1.13+ search indexing, with `display()` as the pre-1.13 fallback (shared `mountSettings()` UI).

## Install into a vault (manual)

Copy these three files into your vault’s plugin folder:

```
main.js
manifest.json
styles.css
```

Destination:

```
<your vault>/.obsidian/plugins/today-alias/
```

Reload Obsidian (**Ctrl/Cmd+R** in developer mode, or restart), then enable **Today Alias** under **Settings → Community plugins**.

## Release

1. Bump `version` in `manifest.json` and `package.json`, and add an entry in `versions.json` (`"x.y.z": "<minAppVersion>"`).
2. `npm run build`
3. Commit and push to `main`.
4. Push an annotated tag matching the version (no `v` prefix), e.g. `git tag -a 2.0.6 -m "2.0.6" && git push origin 2.0.6`.
5. `.github/workflows/release.yml` builds, attests `main.js` / `styles.css` / `manifest.json`, and creates the GitHub Release assets Obsidian’s crawler expects.

## Pull requests

Keep changes focused. Prefer updating explorer and tab display logic together (`processItem` / `processTab`) so behavior stays consistent. Bulk DOM work must cover all workspace windows via `queryAllDocuments()` / `getWorkspaceDocuments()`.
