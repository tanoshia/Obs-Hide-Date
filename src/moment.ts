import { moment as obsidianMoment } from 'obsidian';

/**
 * Obsidian re-exports moment, but under the community scorecard's eslint setup
 * that binding is treated as `any`/`error`. Rebind to moment's own typings so
 * format/subtract/call sites type-check cleanly.
 */
export const moment = obsidianMoment as unknown as typeof import('moment');
