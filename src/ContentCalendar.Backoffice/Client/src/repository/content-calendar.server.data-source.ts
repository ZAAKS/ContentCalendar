import type { ContentCalendarMonth, ContentCalendarMonthRef } from '../shared/types.js';
import { ContentCalendarService } from '../api/index.js';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';

/**
 * Talks to `GET /umbraco/management/api/v1/content-calendar/month` through the generated OpenAPI client.
 * With a parentKey, only that document's direct children are returned (the calendar collection view).
 * `tryExecute` surfaces failures as standard backoffice notifications.
 */
export class ContentCalendarServerDataSource {
	#host: UmbControllerHost;

	constructor(host: UmbControllerHost) {
		this.#host = host;
	}

	async getMonth(ref: ContentCalendarMonthRef, timeZone: string | undefined, parentKey?: string) {
		const { data, error } = await tryExecute(
			this.#host,
			ContentCalendarService.getMonth({
				query: { year: ref.year, month: ref.month, timeZone, parentKey },
				throwOnError: true,
			}),
		);

		return { data: data as ContentCalendarMonth | undefined, error };
	}
}
