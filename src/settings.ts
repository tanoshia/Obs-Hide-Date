export interface HideDatePrefixSettings {
	/** Whether the plugin is active. */
	enabled: boolean;
	/**
	 * ISO 8601 date format using {YYYY}, {MM}, {DD}, {hh}, {mm}, {ss} tokens.
	 * Converted to a regex internally. Default: {YYYY}-{MM}-{DD}.
	 */
	dateFormat: string;
	/**
	 * List of ISO token format strings (one per line in UI) matched against the FULL filename.
	 * Uses {YYYY}, {MM}, {DD}, {hh}, {mm}, {ss} tokens; everything else is matched literally.
	 * If any pattern matches, the file is left untouched (date not hidden).
	 */
	ignorePatterns: string[];
	/**
	 * When true, a Daily Note whose filename is exactly today's date is shown
	 * using todayLabelFormat instead of the raw date.
	 */
	showTodayLabel: boolean;
	/**
	 * Format string for the Today label on bare daily notes.
	 * Supports {YYYY}, {MM}, {DD} tokens.
	 */
	todayLabelFormat: string;
	/**
	 * When true, files that match an ignore pattern but start with today's date
	 * also get the Today label (using todayLabelForIgnoredFormat).
	 */
	showTodayLabelForIgnored: boolean;
	/**
	 * Format string for the Today label prefix on ignored-pattern matches.
	 * Supports {YYYY}, {MM}, {DD} tokens. The rest of the filename is appended after.
	 */
	todayLabelForIgnoredFormat: string;
}

export const DEFAULT_SETTINGS: HideDatePrefixSettings = {
	enabled: true,
	dateFormat: '{YYYY}-{MM}-{DD}',
	ignorePatterns: [
		'{YYYY}-{MM}-{DD}',
		'{YYYY}-{MM}-{DD} Meetings',
	],
	showTodayLabel: true,
	todayLabelFormat: 'Today     -{DD}',
	showTodayLabelForIgnored: true,
	todayLabelForIgnoredFormat: 'Today\'s ',
};
