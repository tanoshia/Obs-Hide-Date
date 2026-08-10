# Contributing to Today Alias

Thanks for helping improve Today Alias. This plugin is **purely visual** — it never renames vault files or rewrites links.

## Setup

```bash
cd obsidian-today-alias
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

That produces `main.js` from `src/main.ts`.

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

## Pull requests

Keep changes focused. Prefer updating explorer and tab display logic together (`processItem` / `processTab`) so behavior stays consistent.
