import type { ContentCalendarMonth } from '../shared/types.js';

/**
 * In-memory, per-dashboard-session cache of fetched months, keyed by `yyyy-MM`.
 * Also tracks in-flight requests so the same month is never requested twice concurrently.
 */
export class ContentCalendarMonthStore {
	#months = new Map<string, ContentCalendarMonth>();
	#inFlight = new Map<string, Promise<ContentCalendarMonth | undefined>>();

	get(monthKey: string): ContentCalendarMonth | undefined {
		return this.#months.get(monthKey);
	}

	has(monthKey: string): boolean {
		return this.#months.has(monthKey);
	}

	set(monthKey: string, month: ContentCalendarMonth): void {
		this.#months.set(monthKey, month);
	}

	delete(monthKey: string): void {
		this.#months.delete(monthKey);
	}

	getInFlight(monthKey: string): Promise<ContentCalendarMonth | undefined> | undefined {
		return this.#inFlight.get(monthKey);
	}

	setInFlight(monthKey: string, request: Promise<ContentCalendarMonth | undefined>): void {
		this.#inFlight.set(monthKey, request);
		request.finally(() => {
			if (this.#inFlight.get(monthKey) === request) this.#inFlight.delete(monthKey);
		});
	}

	clear(): void {
		this.#months.clear();
		this.#inFlight.clear();
	}

	get size(): number {
		return this.#months.size;
	}
}
