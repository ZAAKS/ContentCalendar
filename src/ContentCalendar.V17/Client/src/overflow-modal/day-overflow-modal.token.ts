import { CONTENT_CALENDAR_DAY_OVERFLOW_MODAL_ALIAS } from '../constants.js';
import type { ContentCalendarDay } from '../shared/types.js';
import { UmbModalToken } from '@umbraco-cms/backoffice/modal';

export interface ContentCalendarDayOverflowModalData {
	/** The full day (all entries), as returned by the server. */
	day: ContentCalendarDay;
}

export type ContentCalendarDayOverflowModalValue = undefined;

export const CONTENT_CALENDAR_DAY_OVERFLOW_MODAL = new UmbModalToken<
	ContentCalendarDayOverflowModalData,
	ContentCalendarDayOverflowModalValue
>(CONTENT_CALENDAR_DAY_OVERFLOW_MODAL_ALIAS, {
	modal: {
		type: 'sidebar',
		size: 'large',
	},
});
