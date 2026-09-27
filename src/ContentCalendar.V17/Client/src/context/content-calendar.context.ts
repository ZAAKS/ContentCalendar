import { ContentCalendarRepository } from '../repository/content-calendar.repository.js';
import { isContentCalendarCategory, type ContentCalendarCategory } from '../shared/entry.utils.js';
import {
	toMonthKey,
	type ContentCalendarDay,
	type ContentCalendarMonth,
	type ContentCalendarMonthRef,
} from '../shared/types.js';
import { UMB_ACTION_EVENT_CONTEXT, type UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UMB_DOCUMENT_ENTITY_TYPE } from '@umbraco-cms/backoffice/document';
import {
	UmbEntityUpdatedEvent,
	UmbRequestReloadStructureForEntityEvent,
	type UmbEntityActionEvent,
} from '@umbraco-cms/backoffice/entity-action';
import { UmbArrayState, UmbBooleanState } from '@umbraco-cms/backoffice/observable-api';

/** Every month overlapping `[start, endExclusive)`, in order. */
export function getMonthRefsInRange(start: Date, endExclusive: Date): Array<ContentCalendarMonthRef> {
	const refs: Array<ContentCalendarMonthRef> = [];
	const last = new Date(endExclusive.getTime() - 1);
	let year = start.getFullYear();
	let month = start.getMonth() + 1;
	const lastYear = last.getFullYear();
	const lastMonth = last.getMonth() + 1;
	while (year < lastYear || (year === lastYear && month <= lastMonth)) {
		refs.push({ year, month });
		if (++month > 12) {
			month = 1;
			year++;
		}
	}
	return refs;
}

const HIDDEN_STORAGE_KEY = 'contentCalendar.hiddenKinds';

export interface ContentCalendarContextOptions {
	/**
	 * Show only the direct children of one document (set with `setParentKey`). Nothing is fetched until the
	 * parent is known, so the calendar never briefly shows all content.
	 */
	childrenOnly?: boolean;
	/** Where the hidden categories are remembered, so the dashboard and collection views filter independently. */
	hiddenStorageKey?: string;
}

function readStoredHidden(storageKey: string): Array<ContentCalendarCategory> {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
		return Array.isArray(parsed) ? [...new Set(parsed.filter(isContentCalendarCategory))] : [];
	} catch {
		// Storage can be unavailable (privacy mode) or hold something else; show everything.
		return [];
	}
}

/**
 * State for one calendar. Provided by the dashboard (all content) or by the calendar collection view (the
 * children of one document) and consumed by the calendar grid. The server API is month-based, so a visible range (a month, a week or a day) is
 * served by the month(s) it overlaps: usually one, two for a week that spans a month boundary.
 * Each month is fetched at most once per dashboard session (see the repository cache).
 */
export class ContentCalendarContext extends UmbContextBase {
	#repository = new ContentCalendarRepository(this);
	#requestId = 0;
	#rangeKey?: string;

	#months = new UmbArrayState<ContentCalendarMonth>([], (m) => m.monthKey);
	/** The loaded months covering the visible range. */
	readonly months = this.#months.asObservable();

	#loading = new UmbBooleanState(false);
	readonly loading = this.#loading.asObservable();

	#hasError = new UmbBooleanState(false);
	readonly hasError = this.#hasError.asObservable();

	#hiddenStorageKey: string;
	#hidden: UmbArrayState<ContentCalendarCategory>;
	/** Categories the user filtered out; remembered per browser. The months themselves are never filtered. */
	readonly hiddenCategories: ReturnType<UmbArrayState<ContentCalendarCategory>['asObservable']>;

	#childrenOnly: boolean;
	#parentKey?: string;
	/** A range asked for before the parent was known (children-only calendars). */
	#pendingRange?: { start: Date; endExclusive: Date };
	#resolveParentReady?: () => void;
	/** Resolves once a children-only calendar knows its parent. */
	#parentReady = new Promise<void>((resolve) => (this.#resolveParentReady = resolve));

	#refs: Array<ContentCalendarMonthRef> = [];
	#actionEventContext?: UmbActionEventContext;
	#documentsChanged = false;
	#openEditors = new Set<object>();
	#refreshTimer?: ReturnType<typeof setTimeout>;

	constructor(host: UmbControllerHost, options: ContentCalendarContextOptions = {}) {
		super(host, CONTENT_CALENDAR_CONTEXT);
		this.#childrenOnly = !!options.childrenOnly;
		this.#hiddenStorageKey = options.hiddenStorageKey ?? HIDDEN_STORAGE_KEY;
		this.#hidden = new UmbArrayState<ContentCalendarCategory>(readStoredHidden(this.#hiddenStorageKey), (c) => c);
		this.hiddenCategories = this.#hidden.asObservable();

		// Documents saved, published, scheduled, trashed or restored anywhere in the backoffice make the cached
		// months stale. While an editor drawer opened from the calendar is open, remember that and reload when it
		// closes (so the calendar does not jump around behind the editor). Otherwise, e.g. after "Delete" in the
		// content tree next to the dashboard, reload right away.
		this.consumeContext(UMB_ACTION_EVENT_CONTEXT, (context) => {
			this.#removeActionEventListeners();
			this.#actionEventContext = context;
			context?.addEventListener(UmbEntityUpdatedEvent.TYPE, this.#onEntityEvent);
			context?.addEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, this.#onEntityEvent);
		});
	}

	#onEntityEvent = (event: Event) => {
		if ((event as UmbEntityActionEvent).getEntityType?.() !== UMB_DOCUMENT_ENTITY_TYPE) return;
		this.#documentsChanged = true;
		if (this.#openEditors.size === 0) this.#scheduleRefresh();
	};

	/** Coalesces the bursts of events a single action dispatches (e.g. structure reload plus trashed). */
	#scheduleRefresh() {
		clearTimeout(this.#refreshTimer);
		this.#refreshTimer = setTimeout(() => this.refreshIfChanged(), 300);
	}

	/** An editor drawer owned by `owner` opened; reloads wait until it closes. */
	editorOpened(owner: object) {
		this.#openEditors.add(owner);
	}

	/** An editor drawer owned by `owner` closed; reload now if a document changed meanwhile. */
	editorClosed(owner: object) {
		this.#openEditors.delete(owner);
		if (this.#openEditors.size === 0) this.refreshIfChanged();
	}

	#removeActionEventListeners() {
		this.#actionEventContext?.removeEventListener(UmbEntityUpdatedEvent.TYPE, this.#onEntityEvent);
		this.#actionEventContext?.removeEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, this.#onEntityEvent);
	}

	/**
	 * Show a date range. Served from the in-memory cache when possible; otherwise one request per
	 * month in the range that is not cached yet. Late responses for ranges no longer in view are ignored.
	 */
	async loadRange(start: Date, endExclusive: Date, options: { force?: boolean } = {}): Promise<void> {
		if (this.#childrenOnly && !this.#parentKey) {
			this.#pendingRange = { start, endExclusive };
			this.#loading.setValue(true);
			return;
		}

		const refs = getMonthRefsInRange(start, endExclusive);
		const rangeKey = refs.map(toMonthKey).join('|');
		if (rangeKey === this.#rangeKey && !options.force && !this.#hasError.getValue() && this.#months.getValue().length)
			return;

		const requestId = ++this.#requestId;
		const isReload = rangeKey === this.#rangeKey && !!options.force;
		this.#rangeKey = rangeKey;
		this.#refs = refs;
		this.#hasError.setValue(false);

		const cached = options.force ? [] : refs.map((ref) => this.#repository.getCached(ref));
		if (cached.length === refs.length && cached.every((m) => !!m)) {
			this.#months.setValue(cached as Array<ContentCalendarMonth>);
			this.#loading.setValue(false);
			return;
		}

		// A reload of the same range keeps showing the current data until the new data arrives.
		if (!isReload) this.#months.setValue([]);
		this.#loading.setValue(true);

		const results = await Promise.all(refs.map((ref) => this.#repository.requestMonth(ref, options)));
		if (requestId !== this.#requestId) return;

		const months = results.map((r) => r.data).filter((m): m is ContentCalendarMonth => !!m);
		this.#months.setValue(months);
		this.#hasError.setValue(months.length !== refs.length);
		this.#loading.setValue(false);
	}

	/** The document whose direct children are shown (children-only calendars). */
	getParentKey(): string | undefined {
		return this.#parentKey;
	}

	/** Show the children of another document: drops the cache and loads the range in view for the new parent. */
	async setParentKey(parentKey: string | undefined): Promise<void> {
		if (parentKey === this.#parentKey) return;
		const hadParent = !!this.#parentKey;
		this.#parentKey = parentKey;
		this.#repository.parentKey = parentKey;
		if (parentKey) this.#resolveParentReady?.();

		const pending = this.#pendingRange;
		this.#pendingRange = undefined;
		if (pending) {
			await this.loadRange(pending.start, pending.endExclusive, { force: true });
		} else {
			// Another parent's children must not stay on screen while the new ones load.
			if (hadParent) this.#months.setValue([]);
			await this.refresh();
		}
	}

	/** Re-fetch the month(s) in view (e.g. after scheduling something in another tab). */
	async refresh(): Promise<void> {
		if (!this.#refs.length) return;
		const first = this.#refs[0];
		const last = this.#refs[this.#refs.length - 1];
		await this.loadRange(new Date(first.year, first.month - 1, 1), new Date(last.year, last.month, 1), {
			force: true,
		});
	}

	/**
	 * Reload only if a document was changed since the last load (see the action event listeners). Every
	 * cached month is dropped, because an edit can move content into any month, and the months in view are
	 * fetched again.
	 */
	async refreshIfChanged(): Promise<void> {
		if (!this.#documentsChanged) return;
		this.#documentsChanged = false;
		this.#repository.clearCache();
		await this.refresh();
	}

	/** Show or hide one category everywhere in the calendar. */
	toggleCategory(category: ContentCalendarCategory) {
		const hidden = this.#hidden.getValue();
		this.#setHidden(hidden.includes(category) ? hidden.filter((c) => c !== category) : [...hidden, category]);
	}

	showAllCategories() {
		this.#setHidden([]);
	}

	#setHidden(hidden: Array<ContentCalendarCategory>) {
		this.#hidden.setValue(hidden);
		try {
			localStorage.setItem(this.#hiddenStorageKey, JSON.stringify(hidden));
		} catch {
			// ignore
		}
	}

	/**
	 * One day (`yyyy-MM-dd`), from the months in view, the cache, or a request for its month. Used to open the
	 * day modal from a URL, which can point at any day.
	 */
	async getDay(dateKey: string): Promise<ContentCalendarDay | undefined> {
		const [year, month] = dateKey.split('-').map(Number);
		if (!year || !month || month < 1 || month > 12) return undefined;
		// A day modal opened from a URL can be set up before the collection has told us the parent.
		if (this.#childrenOnly) await this.#parentReady;
		const loaded = this.#months.getValue().find((m) => m.year === year && m.month === month);
		const data = loaded ?? (await this.#repository.requestMonth({ year, month })).data;
		return data?.days.find((d) => d.date === dateKey);
	}

	override destroy(): void {
		clearTimeout(this.#refreshTimer);
		this.#openEditors.clear();
		this.#removeActionEventListeners();
		this.#actionEventContext = undefined;
		this.#repository.clearCache();
		this.#months.destroy();
		this.#loading.destroy();
		this.#hasError.destroy();
		this.#hidden.destroy();
		super.destroy();
	}
}

export const CONTENT_CALENDAR_CONTEXT = new UmbContextToken<ContentCalendarContext>('ContentCalendarContext');
