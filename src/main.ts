import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { HideDatePrefixSettings, DEFAULT_SETTINGS } from './settings';

export default class HideDatePrefixPlugin extends Plugin {
	settings: HideDatePrefixSettings;
	private observer: MutationObserver | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new HideDatePrefixSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.startObserver();
		});

		// Refresh at midnight so the "Today" label moves to the new day automatically
		this.scheduleMidnightRefresh();

		// Re-process after any vault rename so the explorer always reflects the
		// latest filename immediately, regardless of how Obsidian updates the DOM.
		this.registerEvent(this.app.vault.on('rename', () => {
			if (!this.settings.enabled) return;
			setTimeout(() => {
				document
					.querySelectorAll<HTMLElement>('.nav-file-title-content')
					.forEach((el) => this.processItem(el));
			}, 50);
		}));
	}

	onunload() {
		this.stopObserver();
		this.restoreAllItems();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refresh();
	}

	// ─── Observer lifecycle ───────────────────────────────────────────────────

	startObserver() {
		const leaves = this.app.workspace.getLeavesOfType('file-explorer');
		if (leaves.length === 0) return;

		const container = (leaves[0].view as any).containerEl as HTMLElement;

		// Process what's already rendered
		if (this.settings.enabled) {
			this.processContainer(container);
		}

		// Watch for DOM changes in the explorer tree
		this.observer = new MutationObserver((mutations) => {
			if (!this.settings.enabled) return;

			const toProcess = new Set<HTMLElement>();

			for (const mutation of mutations) {
				const target = mutation.target as HTMLElement;

				// Skip mutations we caused (our own spans being inserted)
				if (target instanceof HTMLElement &&
					(target.classList.contains('hdp-date') || target.classList.contains('hdp-rest'))) {
					continue;
				}

				if (mutation.type === 'childList') {
					// Case 1: a nav-file-title-content was updated in-place (Obsidian
					// empties the element and inserts a new text node on rename)
					if (target instanceof HTMLElement &&
						target.classList.contains('nav-file-title-content')) {
						toProcess.add(target);
					}

					mutation.addedNodes.forEach((node) => {
						if (node instanceof HTMLElement) {
							// Case 2: a whole nav-file-title-content element was added
							if (node.classList.contains('nav-file-title-content')) {
								toProcess.add(node);
							} else {
								// Case 3: a parent element was added (folder expand, initial render)
								node.querySelectorAll<HTMLElement>('.nav-file-title-content')
									.forEach((el) => toProcess.add(el));
							}
						} else {
							// Case 4: a bare text node was added — parent may be title element
							const parent = node.parentElement;
							if (parent?.classList.contains('nav-file-title-content')) {
								toProcess.add(parent);
							}
						}
					});
				}

				// Case 5: text content mutated directly
				if (mutation.type === 'characterData') {
					const parent = mutation.target.parentElement;
					if (parent?.classList.contains('nav-file-title-content')) {
						toProcess.add(parent);
					}
				}
			}

			toProcess.forEach((el) => this.processItem(el));
		});

		this.observer.observe(container, { childList: true, subtree: true, characterData: true });
	}

	stopObserver() {
		this.observer?.disconnect();
		this.observer = null;
	}

	// ─── DOM processing ───────────────────────────────────────────────────────

	/**
	 * Walk every .nav-file-title-content element inside `container`
	 * and apply (or skip) date-hiding.
	 */
	processContainer(container: HTMLElement) {
		container.querySelectorAll<HTMLElement>('.nav-file-title-content').forEach((el) => {
			this.processItem(el);
		});
	}

	/**
	 * Splits the title element into a hidden date span and a visible rest span,
	 * or replaces a bare today note with the "Today     -DD" label.
	 * No-ops if the element is already processed, the filename has no date prefix,
	 * or the full filename matches one of the configured ignore patterns.
	 */
	processItem(el: HTMLElement) {
		// Already processed — skip
		if (el.querySelector('.hdp-date') || el.querySelector('.hdp-today')) return;

		const fullTitle = el.textContent ?? '';

		// Today label: check before ignore patterns so bare-date Daily Notes can
		// still be relabelled even though they match the default ignore list.
		if (this.settings.showTodayLabel) {
			const label = this.getTodayLabel(fullTitle);
			if (label !== null) {
				el.dataset.hdpOriginal = fullTitle;
				el.empty();
				el.createSpan({ cls: 'hdp-today', text: label });
				return;
			}
		}

		// Check user-defined ignore patterns against the full filename
		if (this.isIgnored(fullTitle)) {
			// Even for ignored files, show the "Today" label if the option is on
			// and the filename starts with today's date.
			if (this.settings.showTodayLabel && this.settings.showTodayLabelForIgnored) {
				const label = this.getTodayLabelForPrefixed(fullTitle);
				if (label !== null) {
					el.dataset.hdpOriginal = fullTitle;
					el.empty();
					el.createSpan({ cls: 'hdp-today', text: label });
				}
			}
			return;
		}

		const pattern = this.buildPattern();
		const match = pattern.exec(fullTitle);
		if (!match) return;

		const datePart = match[0];          // e.g. "2026-03-02 "
		const restPart = fullTitle.slice(datePart.length);
		// Safety net: skip if nothing remains after the date
		if (restPart.trim() === '') return;
		el.dataset.hdpOriginal = fullTitle;
		el.empty();
		el.createSpan({ cls: 'hdp-date', text: datePart });
		el.createSpan({ cls: 'hdp-rest', text: restPart });
	}

	/**
	 * Converts an ISO token format string into a full-match regex (^...$).
	 * Tokens ({YYYY}, {MM}, etc.) become \d{N}.
	 * `*` in literal segments matches any characters (becomes .* in regex).
	 * All other literal characters are regex-escaped.
	 */
	formatToIgnorePattern(format: string): RegExp {
		const tokenMap: Record<string, string> = {
			'{YYYY}': '\\d{4}',
			'{MM}':   '\\d{2}',
			'{DD}':   '\\d{2}',
			'{hh}':   '\\d{2}',
			'{mm}':   '\\d{2}',
			'{ss}':   '\\d{2}',
		};
		// Escape a literal segment, treating * as the .* wildcard
		const escapeLiteral = (s: string) =>
			s.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
		const tokenRegex = /\{YYYY\}|\{MM\}|\{DD\}|\{hh\}|\{mm\}|\{ss\}/g;
		let result = '';
		let lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = tokenRegex.exec(format)) !== null) {
			result += escapeLiteral(format.slice(lastIndex, m.index));
			result += tokenMap[m[0]];
			lastIndex = tokenRegex.lastIndex;
		}
		result += escapeLiteral(format.slice(lastIndex));
		return new RegExp(`^${result}$`);
	}

	/**
	 * Returns true if the full filename matches any of the configured ignore patterns.
	 */
	isIgnored(fullTitle: string): boolean {
		for (const raw of this.settings.ignorePatterns) {
			const trimmed = raw.trim();
			if (!trimmed) continue;
			try {
				if (this.formatToIgnorePattern(trimmed).test(fullTitle)) return true;
			} catch {
				// skip silently
			}
		}
		return false;
	}

	/**
	 * Restore an element to its original plain-text form.
	 */
	restoreItem(el: HTMLElement) {
		if (!el.querySelector('.hdp-date') && !el.querySelector('.hdp-today')) return;

		const original = el.dataset.hdpOriginal ?? '';
		el.empty();
		delete el.dataset.hdpOriginal;
		if (original) el.textContent = original;
	}

	restoreAllItems() {
		document
			.querySelectorAll<HTMLElement>('.nav-file-title-content')
			.forEach((el) => this.restoreItem(el));
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────

	/**
	 * Returns today's date formatted according to the configured dateFormat,
	 * e.g. "2026-03-03" for the default {YYYY}-{MM}-{DD}.
	 */
	getTodayDateStr(): string {
		return this.formatTodayLabel(this.settings.dateFormat);
	}

	/**
	 * Substitutes {YYYY}, {MM}, {DD} tokens in a format string with today's date parts.
	 */
	formatTodayLabel(format: string): string {
		const now = new Date();
		const yyyy = String(now.getFullYear());
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const dd = String(now.getDate()).padStart(2, '0');
		return format
			.replace(/\{YYYY\}/g, yyyy)
			.replace(/\{MM\}/g, mm)
			.replace(/\{DD\}/g, dd);
	}

	/**
	 * If fullTitle is exactly today's date, returns the formatted Today label.
	 * Otherwise returns null.
	 */
	getTodayLabel(fullTitle: string): string | null {
		if (fullTitle.trim() !== this.getTodayDateStr()) return null;
		return this.formatTodayLabel(this.settings.todayLabelFormat);
	}

	/**
	 * If fullTitle starts with today's date and has content after it, returns
	 * the formatted Today label prefix with the rest of the filename appended.
	 * Returns null for bare dates (handled by getTodayLabel).
	 */
	getTodayLabelForPrefixed(fullTitle: string): string | null {
		const todayStr = this.getTodayDateStr();
		const escaped = todayStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const match = new RegExp(`^${escaped}\\s*`).exec(fullTitle);
		if (!match) return null;
		const rest = fullTitle.slice(match[0].length);
		if (rest.trim() === '') return null; // bare date — handled by getTodayLabel
		return this.formatTodayLabel(this.settings.todayLabelForIgnoredFormat) + rest;
	}

	/**
	 * Schedules a refresh at the next midnight so the "Today" label
	 * automatically moves to the new date without restarting Obsidian.
	 */
	scheduleMidnightRefresh() {
		const now = new Date();
		const midnight = new Date(now);
		midnight.setDate(midnight.getDate() + 1);
		midnight.setHours(0, 0, 5, 0); // 5 s past midnight
		const ms = midnight.getTime() - now.getTime();
		const id = window.setTimeout(() => {
			this.refresh();
			this.scheduleMidnightRefresh();
		}, ms);
		this.register(() => window.clearTimeout(id));
	}

	/**
	 * Converts an ISO token format string to a regex that matches that date prefix.
	 * {YYYY} -> \d{4}, {MM}/{DD}/{hh}/{mm}/{ss} -> \d{2}.
	 * Wraps in ^(...)\s* so it anchors at the start and swallows trailing spaces.
	 */
	formatToPattern(format: string): RegExp {
		const regexBody = format
			.replace(/\{YYYY\}/g, '\\d{4}')
			.replace(/\{MM\}/g, '\\d{2}')
			.replace(/\{DD\}/g, '\\d{2}')
			.replace(/\{hh\}/g, '\\d{2}')
			.replace(/\{mm\}/g, '\\d{2}')
			.replace(/\{ss\}/g, '\\d{2}');
		return new RegExp(`^(${regexBody})\\s*`);
	}

	buildPattern(): RegExp {
		try {
			return this.formatToPattern(this.settings.dateFormat);
		} catch {
			return this.formatToPattern(DEFAULT_SETTINGS.dateFormat);
		}
	}

	/**
	 * Called after settings change: restore everything, then re-apply if enabled.
	 */
	refresh() {
		this.restoreAllItems();
		if (this.settings.enabled) {
			document
				.querySelectorAll<HTMLElement>('.nav-file-title-content')
				.forEach((el) => this.processItem(el));
		}
	}
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

class HideDatePrefixSettingTab extends PluginSettingTab {
	plugin: HideDatePrefixPlugin;

	constructor(app: App, plugin: HideDatePrefixPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable')
			.setDesc('Toggle date-prefix hiding in the file explorer.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
					})
			);

		let dateFormatInputEl: HTMLInputElement | null = null;

		new Setting(containerEl)
			.setName('Date format')
			.setDesc(
				'ISO 8601 date format at the start of filenames to hide. Uses {YYYY}, {MM}, {DD}, {hh}, {mm}, {ss} tokens.  ' +
				'Default: {YYYY}-{MM}-{DD}.  ' +
				'Example for full datetime: {YYYY}-{MM}-{DD}T{hh}:{mm}:{ss}Z'
			)
			.addText((text) => {
				dateFormatInputEl = text.inputEl;
				text
					.setPlaceholder('{YYYY}-{MM}-{DD}')
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value.trim() || DEFAULT_SETTINGS.dateFormat;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Patterns to ignore (one per line)')
			.setDesc(
				'Files whose full name matches any pattern are left untouched (date not hidden).  ' +
				'Uses {YYYY}, {MM}, {DD} tokens; use * as a wildcard for any characters; everything else is matched literally.  ' +
				'Example: "{YYYY}-{MM}-{DD} M!*" ignores any file starting with a date followed by " M!".'
			)
			.addTextArea((area) => {
				area
					.setPlaceholder('{YYYY}-{MM}-{DD}')
					.setValue(this.plugin.settings.ignorePatterns.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.ignorePatterns = value
							.split('\n')
							.map((l) => l.trim())
							.filter((l) => l.length > 0);
						await this.plugin.saveSettings();
					});
				area.inputEl.style.width = '100%';
				area.inputEl.rows = 5;
				window.requestAnimationFrame(() => {
					if (dateFormatInputEl) {
						area.inputEl.style.minWidth = dateFormatInputEl.offsetWidth + 'px';
					}
				});
			});

		// ── Today label for bare daily notes ──────────────────────────────────

		let todayFormatSetting: Setting;

		new Setting(containerEl)
			.setName('Show "Today" label for daily note')
			.setDesc(
				'Replaces today\'s bare {YYYY-MM-DD} filename with a custom label. Updates at midnight.  ' +
				'Example: "2026-03-03" → "Today     -03".'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showTodayLabel)
					.onChange(async (value) => {
						this.plugin.settings.showTodayLabel = value;
						todayFormatSetting.settingEl.style.display = value ? '' : 'none';
						await this.plugin.saveSettings();
					})
			);

		todayFormatSetting = new Setting(containerEl)
			.setName('Label format')
			.setDesc('Supports {YYYY}, {MM}, {DD}.  Default: Today     -{DD}')
			.setClass('hdp-sub-setting')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.todayLabelFormat)
					.setValue(this.plugin.settings.todayLabelFormat)
					.onChange(async (value) => {
						this.plugin.settings.todayLabelFormat = value || DEFAULT_SETTINGS.todayLabelFormat;
						await this.plugin.saveSettings();
					})
			);
		todayFormatSetting.settingEl.style.display = this.plugin.settings.showTodayLabel ? '' : 'none';

		// ── Today label for ignore-pattern matches ────────────────────────────

		let todayIgnoredFormatSetting: Setting;

		new Setting(containerEl)
			.setName('Show "Today" label for pattern ignore matches')
			.setDesc(
				'Also applies a Today label to ignored-pattern files that start with today\'s date.  ' +
				'Requires: "Show Today label" enabled.  ' +
				'Example: "2026-03-03 Meetings" → "Today\'s Meetings".'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showTodayLabelForIgnored)
					.onChange(async (value) => {
						this.plugin.settings.showTodayLabelForIgnored = value;
						todayIgnoredFormatSetting.settingEl.style.display = value ? '' : 'none';
						await this.plugin.saveSettings();
					})
			);

		todayIgnoredFormatSetting = new Setting(containerEl)
			.setName('Label format')
			.setDesc('Supports {YYYY}, {MM}, {DD}. The rest of the filename is appended after.  ' +
				'Default: Today\'s ')
			.setClass('hdp-sub-setting')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.todayLabelForIgnoredFormat)
					.setValue(this.plugin.settings.todayLabelForIgnoredFormat)
					.onChange(async (value) => {
						this.plugin.settings.todayLabelForIgnoredFormat = value || DEFAULT_SETTINGS.todayLabelForIgnoredFormat;
						await this.plugin.saveSettings();
					})
			);
		todayIgnoredFormatSetting.settingEl.style.display = this.plugin.settings.showTodayLabelForIgnored ? '' : 'none';
	}
}
