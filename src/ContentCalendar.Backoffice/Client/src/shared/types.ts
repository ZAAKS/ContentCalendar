import type {
	ContentCalendarDayModel,
	ContentCalendarEntryKindModel,
	ContentCalendarEntryModel,
	ContentCalendarMonthResponseModel,
} from '../api/index.js';

export type ContentCalendarEntryKind = ContentCalendarEntryKindModel;
export type ContentCalendarEntry = ContentCalendarEntryModel;
export type ContentCalendarDay = ContentCalendarDayModel;
export type ContentCalendarMonth = ContentCalendarMonthResponseModel;

/** A month identity. `month` is 1-12. */
export interface ContentCalendarMonthRef {
	year: number;
	month: number;
}

/** `yyyy-MM`, matching the server's `monthKey`. */
export function toMonthKey(ref: ContentCalendarMonthRef): string {
	return `${ref.year.toString().padStart(4, '0')}-${ref.month.toString().padStart(2, '0')}`;
}

/** Local `yyyy-MM-dd` for a Date (as FullCalendar hands us local-midnight dates). */
export function toLocalDateKey(date: Date): string {
	const y = date.getFullYear().toString().padStart(4, '0');
	const m = (date.getMonth() + 1).toString().padStart(2, '0');
	const d = date.getDate().toString().padStart(2, '0');
	return `${y}-${m}-${d}`;
}
