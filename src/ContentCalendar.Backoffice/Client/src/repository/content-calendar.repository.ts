import { ContentCalendarServerDataSource } from './content-calendar.server.data-source.js';
import { ContentCalendarMonthStore } from '../store/content-calendar-month.store.js';
import { toMonthKey, type ContentCalendarMonth, type ContentCalendarMonthRef } from '../shared/types.js';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';

export interface ContentCalendarRequestOptions {
	/** Bypass (and replace) the cached month. */
	force?: boolean;
}

/**
 * App-facing API for calendar data. Cache-first: a month is fetched from the server at most once per
 * dashboard session (unless explicitly refreshed), and requests are always for exactly one month.
 */
export class ContentCalendarRepository extends UmbRepositoryBase {
	#dataSource: ContentCalendarServerDataSource;
	#store = new ContentCalendarMonthStore();
	#timeZone = ContentCalendarRepository.#resolveTimeZone();
	#parentKey?: string;

	constructor(host: UmbControllerHost) {
		super(host);
		this.#dataSource = new ContentCalendarServerDataSource(this);
	}

	/** Limits every request to the direct children of this document. Changing it drops the cache. */
	get parentKey(): string | undefined {
		return this.#parentKey;
	}

	set parentKey(value: string | undefined) {
		if (value === this.#parentKey) return;
		this.#parentKey = value;
		this.#store.clear();
	}

	get timeZone(): string | undefined {
		return this.#timeZone;
	}

	getCached(ref: ContentCalendarMonthRef): ContentCalendarMonth | undefined {
		return this.#store.get(toMonthKey(ref));
	}

	async requestMonth(
		ref: ContentCalendarMonthRef,
		options: ContentCalendarRequestOptions = {},
	): Promise<{ data?: ContentCalendarMonth; error?: unknown }> {
		const key = toMonthKey(ref);

		if (options.force) {
			this.#store.delete(key);
		} else {
			const cached = this.#store.get(key);
			if (cached) return { data: cached };
		}

		let request = options.force ? undefined : this.#store.getInFlight(key);
		let error: unknown;
		if (!request) {
			const parentKey = this.#parentKey;
			request = this.#dataSource.getMonth(ref, this.#timeZone, parentKey).then((result) => {
				error = result.error;
				// A late response for a previous parent must not end up in the new parent's cache.
				if (result.data && parentKey === this.#parentKey) this.#store.set(key, result.data);
				return result.data;
			});
			this.#store.setInFlight(key, request);
		}

		const data = await request;
		return data ? { data } : { error: error ?? new Error('No data') };
	}

	clearCache(): void {
		this.#store.clear();
	}

	static #resolveTimeZone(): string | undefined {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
		} catch {
			return undefined;
		}
	}
}
