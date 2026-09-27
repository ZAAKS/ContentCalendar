import type { ContentCalendarDay, ContentCalendarEntry } from './types.js';
import { UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN } from '@umbraco-cms/backoffice/document';

/**
 * What an entry looks like on the calendar. The server's `kind` says why an entry is there; the category
 * additionally splits "Created" into draft and published pages, which is what the colours and filters use.
 */
export type ContentCalendarCategory = 'draft' | 'published' | 'scheduledPublish' | 'scheduledUnpublish' | 'deleted';

/**
 * Tag colours deliberately mirror the document status tags in the v17 content list
 * (packages/documents/documents/variant-state/utils.ts):
 *   Draft                  -> color "default"   => created, not published
 *   Published              -> color "positive"  => created, currently published
 *   Published with pending -> color "warning"   => scheduled to publish / unpublish (dashed, block icon)
 *   Trashed                -> color "danger"    => deleted (in the recycle bin)
 * Chips, dots and tiles use the matching `--content-calendar-<className>-color` custom property.
 */
export type ContentCalendarEntryStyle = {
	color: 'default' | 'positive' | 'warning' | 'danger';
	icon: string;
	/** CSS class for chips, dots, tiles and list rows (`cc-<className>` on FullCalendar events). */
	className: string;
	/** State label for a single entry, e.g. "Publish at". */
	labelKey: string;
	/** Short name of the category for tiles, e.g. "Published". */
	tileKey: string;
	/** One-line description of the category for its tile. */
	tileTextKey: string;
	/** "%0% …" count text for dots and tooltips. */
	countKey: string;
};

export const CONTENT_CALENDAR_CATEGORY_STYLE: Record<ContentCalendarCategory, ContentCalendarEntryStyle> = {
	draft: {
		color: 'default',
		icon: 'icon-edit',
		className: 'draft',
		labelKey: 'contentCalendar_kindCreated',
		tileKey: 'contentCalendar_tileDraft',
		tileTextKey: 'contentCalendar_tileTextDraft',
		countKey: 'contentCalendar_draftCount',
	},
	published: {
		color: 'positive',
		icon: 'icon-globe',
		className: 'published',
		labelKey: 'contentCalendar_kindPublished',
		tileKey: 'contentCalendar_tilePublished',
		tileTextKey: 'contentCalendar_tileTextPublished',
		countKey: 'contentCalendar_publishedCount',
	},
	scheduledPublish: {
		color: 'warning',
		icon: 'icon-time',
		className: 'scheduled',
		labelKey: 'contentCalendar_kindScheduled',
		tileKey: 'contentCalendar_tileScheduled',
		tileTextKey: 'contentCalendar_tileTextScheduled',
		countKey: 'contentCalendar_scheduledCount',
	},
	scheduledUnpublish: {
		color: 'warning',
		icon: 'icon-block',
		className: 'unpublish',
		labelKey: 'contentCalendar_kindUnpublish',
		tileKey: 'contentCalendar_tileUnpublish',
		tileTextKey: 'contentCalendar_tileTextUnpublish',
		countKey: 'contentCalendar_unpublishCount',
	},
	deleted: {
		color: 'danger',
		icon: 'icon-trash',
		className: 'deleted',
		labelKey: 'contentCalendar_kindDeleted',
		tileKey: 'contentCalendar_tileDeleted',
		tileTextKey: 'contentCalendar_tileTextDeleted',
		countKey: 'contentCalendar_deletedCount',
	},
};

/** Display order of the categories in tiles and dots. */
export const CONTENT_CALENDAR_CATEGORIES: ReadonlyArray<ContentCalendarCategory> = [
	'draft',
	'published',
	'scheduledPublish',
	'scheduledUnpublish',
	'deleted',
];

export function isContentCalendarCategory(value: unknown): value is ContentCalendarCategory {
	return CONTENT_CALENDAR_CATEGORIES.includes(value as ContentCalendarCategory);
}

export function getEntryCategory(entry: ContentCalendarEntry): ContentCalendarCategory {
	switch (entry.kind) {
		case 'ScheduledPublish':
			return 'scheduledPublish';
		case 'ScheduledUnpublish':
			return 'scheduledUnpublish';
		case 'Deleted':
			return 'deleted';
		default:
			return entry.isPublished ? 'published' : 'draft';
	}
}

export function getEntryStyle(entry: ContentCalendarEntry): ContentCalendarEntryStyle {
	return CONTENT_CALENDAR_CATEGORY_STYLE[getEntryCategory(entry)];
}

/** Number of entries per category in `days`. */
export function countByCategory(days: Iterable<ContentCalendarDay>): Record<ContentCalendarCategory, number> {
	const counts: Record<ContentCalendarCategory, number> = {
		draft: 0,
		published: 0,
		scheduledPublish: 0,
		scheduledUnpublish: 0,
		deleted: 0,
	};
	for (const day of days) for (const entry of day.entries) counts[getEntryCategory(entry)]++;
	return counts;
}

/** `day` without the entries of hidden categories; its per-kind counts follow the remaining entries. */
export function filterDay(day: ContentCalendarDay, hidden: ReadonlySet<ContentCalendarCategory>): ContentCalendarDay {
	if (hidden.size === 0) return day;
	const entries = day.entries.filter((e) => !hidden.has(getEntryCategory(e)));
	if (entries.length === day.entries.length) return day;
	const count = (kind: ContentCalendarEntry['kind']) => entries.filter((e) => e.kind === kind).length;
	return {
		...day,
		entries,
		createdCount: count('Created'),
		scheduledCount: count('ScheduledPublish'),
		scheduledUnpublishCount: count('ScheduledUnpublish'),
		deletedCount: count('Deleted'),
	};
}

/**
 * Link to edit an entry. With `workspaceModalPath` (see `registerDocumentWorkspaceModal`) the editor opens
 * in a sidebar modal over the calendar; without it, the link falls back to the full document workspace.
 */
export function getEntryEditPath(entry: ContentCalendarEntry, workspaceModalPath?: string): string {
	if (workspaceModalPath) {
		return `${workspaceModalPath}/${UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN.generateLocal({ unique: entry.id })}`;
	}
	return UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN.generateAbsolute({ unique: entry.id });
}

/** Unique key for an entry within a day (the same node can be created and scheduled, or scheduled per culture). */
export function getEntryKey(entry: ContentCalendarEntry): string {
	return `${entry.kind}|${entry.id}|${entry.culture ?? ''}|${entry.date}`;
}
