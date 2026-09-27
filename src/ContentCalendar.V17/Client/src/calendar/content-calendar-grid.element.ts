import { CONTENT_CALENDAR_CONTEXT, type ContentCalendarContext } from '../context/content-calendar.context.js';
import { CONTENT_CALENDAR_MAX_CHIPS_PER_DAY } from '../constants.js';
import { CONTENT_CALENDAR_DAY_OVERFLOW_MODAL } from '../overflow-modal/day-overflow-modal.token.js';
import { registerDocumentWorkspaceModal } from '../shared/document-workspace-modal.js';
import {
	CONTENT_CALENDAR_CATEGORIES,
	CONTENT_CALENDAR_CATEGORY_STYLE,
	countByCategory,
	filterDay,
	getEntryEditPath,
	getEntryKey,
	getEntryStyle,
	type ContentCalendarCategory,
} from '../shared/entry.utils.js';
import {
	toLocalDateKey,
	type ContentCalendarDay,
	type ContentCalendarEntry,
	type ContentCalendarMonth,
} from '../shared/types.js';
import { contentCalendarGridStyles } from './content-calendar-grid.styles.js';
import {
	Calendar,
	type DatesSetArg,
	type DayCellMountArg,
	type DayHeaderMountArg,
	type EventContentArg,
	type EventInput,
	type EventMountArg,
	type EventSourceApi,
	type MoreLinkArg,
} from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import {
	customElement,
	html,
	nothing,
	property,
	render,
	repeat,
	state,
	type PropertyValues,
} from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UMB_MODAL_MANAGER_CONTEXT } from '@umbraco-cms/backoffice/modal';
import { UmbModalRouteRegistrationController } from '@umbraco-cms/backoffice/router';

export type ContentCalendarViewName = 'month' | 'week' | 'day' | 'list';

interface ContentCalendarViewDef {
	name: ContentCalendarViewName;
	fcType: string;
	labelKey: string;
	icon: string;
	previousKey: string;
	nextKey: string;
}

const VIEWS: Array<ContentCalendarViewDef> = [
	{
		name: 'month',
		fcType: 'dayGridMonth',
		labelKey: 'contentCalendar_viewMonth',
		icon: 'icon-calendar',
		previousKey: 'contentCalendar_previousMonth',
		nextKey: 'contentCalendar_nextMonth',
	},
	{
		name: 'week',
		fcType: 'timeGridWeek',
		labelKey: 'contentCalendar_viewWeek',
		icon: 'icon-thumbnails-small',
		previousKey: 'contentCalendar_previousWeek',
		nextKey: 'contentCalendar_nextWeek',
	},
	{
		name: 'day',
		fcType: 'timeGridDay',
		labelKey: 'contentCalendar_viewDay',
		icon: 'icon-time',
		previousKey: 'contentCalendar_previousDay',
		nextKey: 'contentCalendar_nextDay',
	},
	{
		name: 'list',
		fcType: 'listMonth',
		labelKey: 'contentCalendar_viewList',
		icon: 'icon-bulleted-list',
		previousKey: 'contentCalendar_previousMonth',
		nextKey: 'contentCalendar_nextMonth',
	},
];

const VIEW_STORAGE_KEY = 'contentCalendar.view';

function readStoredView(): ContentCalendarViewName {
	try {
		const stored = localStorage.getItem(VIEW_STORAGE_KEY);
		if (VIEWS.some((v) => v.name === stored)) return stored as ContentCalendarViewName;
	} catch {
		// Storage can be unavailable (privacy mode); fall back to the default.
	}
	return 'month';
}
/** Entries are points in time; give them a nominal length so they are visible in the time grid. */
const EVENT_DURATION_MS = 30 * 60 * 1000;

/** Hover card delay, so it does not flash while the pointer merely crosses the grid. */
const HOVER_DELAY_MS = 350;
/** Grace period to move the pointer from a chip onto its hover card (WCAG 1.4.13: the card must be hoverable). */
const HOVER_HIDE_DELAY_MS = 200;
const HOVER_CARD_WIDTH = 288;
const HOVER_CARD_HEIGHT_ESTIMATE = 170;

interface HoverCard {
	entry: ContentCalendarEntry;
	left: number;
	/** Distance from the top of the calendar wrapper (card below the chip) ... */
	top?: number;
	/** ... or from its bottom (card above the chip, when there is no room below). */
	bottom?: number;
}

interface TrackedCell {
	date: Date;
	dateKey: string;
	isOther: boolean;
	cellEl: HTMLElement;
	container: HTMLElement;
}

interface TrackedHeader {
	date: Date;
	dateKey: string;
	headerEl: HTMLElement;
	container: HTMLElement;
}

const ELEMENT_NAME = 'content-calendar-grid';

/**
 * Calendar built on FullCalendar (ESM, no jQuery) with Month, Week, Day and List views.
 *
 * FullCalendar only owns layout; it never fetches data. Its `datesSet` callback tells the calendar
 * context which dates are in view, and the context/repository decide whether that needs a request
 * (the API is month-based and every month is cached, so switching views rarely fetches anything).
 *
 * - Month: day cell contents (count tags, chips, "+N") are rendered with Lit into each cell.
 * - Week/Day: entries are time-grid events whose content is a Lit chip; overlapping entries collapse
 *   into FullCalendar's "+N" link, which opens the same day modal as the month view. Column headers
 *   carry the day's count tags.
 * - List: the month as an agenda, one row per entry.
 */
@customElement(ELEMENT_NAME)
export class ContentCalendarGridElement extends UmbLitElement {
	/** Max chips per day in the month view before collapsing into "+N". */
	@property({ type: Number, attribute: 'max-chips' })
	maxChips = CONTENT_CALENDAR_MAX_CHIPS_PER_DAY;

	@state()
	private _title = '';

	@state()
	private _view: ContentCalendarViewName = readStoredView();

	@state()
	private _loading = false;

	@state()
	private _hasError = false;

	@state()
	private _months: Array<ContentCalendarMonth> = [];

	@state()
	private _range?: { start: Date; end: Date };

	@state()
	private _hidden: ReadonlySet<ContentCalendarCategory> = new Set();

	@state()
	private _hover?: HoverCard;

	#context?: ContentCalendarContext;
	#calendar?: Calendar;
	#eventSource?: EventSourceApi;
	/** FullCalendar view type the current event source was built for (events differ per view). */
	#eventsViewType?: string;
	#a11yObserver?: MutationObserver;
	#a11yQueued = false;
	#cells = new Map<string, TrackedCell>();
	#headers = new Map<string, TrackedHeader>();
	#daysByDate = new Map<string, ContentCalendarDay>();
	#entriesByKey = new Map<string, ContentCalendarEntry>();
	#hoverTarget?: HTMLElement;
	#hoverTimer?: ReturnType<typeof setTimeout>;
	#hoverHideTimer?: ReturnType<typeof setTimeout>;
	#weekendDays: ReadonlySet<number> = new Set([0, 6]);
	#scrolledRangeKey?: string;
	#resizeObserver?: ResizeObserver;
	/** Base path of the routed document editor drawer; undefined until the route context is known. */
	#workspacePath?: string;
	#dayModalReady = false;

	/** The day listing is a routed modal so the editor drawer can open on top of it (nested infinite editing). */
	#dayModal = new UmbModalRouteRegistrationController(this, CONTENT_CALENDAR_DAY_OVERFLOW_MODAL)
		.addAdditionalPath(':date')
		.onSetup(async (params) => {
			const date = String(params.date ?? '');
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
			const context = this.#context ?? (await this.getContext(CONTENT_CALENDAR_CONTEXT));
			const day = (await context?.getDay(date)) ?? {
				date,
				createdCount: 0,
				scheduledCount: 0,
				scheduledUnpublishCount: 0,
				deletedCount: 0,
				entries: [],
			};
			return { data: { day } };
		})
		.observeRouteBuilder((routeBuilder) => (this.#dayModalReady = !!routeBuilder));

	constructor() {
		super();

		registerDocumentWorkspaceModal(
			this,
			(path) => {
				if (path === this.#workspacePath) return;
				this.#workspacePath = path;
				// Chips are rendered imperatively into FullCalendar's DOM, so re-render them with the new links.
				this.#renderCells();
				this.#syncEvents();
			},
			() => this.#context?.editorClosed(this),
			() => this.#context?.editorOpened(this),
		);

		this.consumeContext(CONTENT_CALENDAR_CONTEXT, (context) => {
			this.#context = context;
			if (!context) return;

			this.observe(
				context.loading,
				(loading) => {
					this._loading = loading;
					// Month cells show skeleton placeholders while a range loads for the first time.
					this.#renderCells();
				},
				'_observeLoading',
			);
			this.observe(context.hasError, (hasError) => (this._hasError = hasError), '_observeError');
			this.observe(
				context.hiddenCategories,
				(hidden) => {
					this._hidden = new Set(hidden);
					this.#hideHover();
					this.#renderCells();
					this.#renderHeaders();
					this.#syncEvents();
				},
				'_observeHidden',
			);
			this.observe(
				context.months,
				(months) => {
					this._months = months;
					this.#indexDays(months);
					this.#hideHover();
					this.#renderCells();
					this.#renderHeaders();
					this.#syncEvents();
				},
				'_observeMonths',
			);

			// The calendar may already be showing dates before the context arrived.
			if (this._range) context.loadRange(this._range.start, this._range.end);
		});
	}

	protected override firstUpdated(changed: PropertyValues): void {
		super.firstUpdated(changed);
		const calendarEl = this.renderRoot.querySelector<HTMLElement>('#calendar');
		if (!calendarEl) return;
		this.#weekendDays = this.#getWeekendDays();

		this.#calendar = new Calendar(calendarEl, {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
			initialView: this.#getViewDef(this._view).fcType,
			// `height` is a calendar-level option (FullCalendar ignores it per view), so it is set with the view.
			height: this.#getHeight(this.#getViewDef(this._view).fcType),
			headerToolbar: false,
			// FullCalendar formats dates with Intl using these codes, so no FullCalendar locale bundles are needed.
			locale: this.localize.lang() || navigator.language,
			firstDay: this.#getFirstDayOfWeek(),
			fixedWeekCount: false,
			showNonCurrentDates: true,
			allDaySlot: false,
			nowIndicator: true,
			displayEventEnd: false,
			eventTimeFormat: { hour: 'numeric', minute: '2-digit' },
			scrollTime: '08:00:00',
			stickyHeaderDates: true,
			eventMaxStack: 3,
			eventContent: (arg) => this.#renderEventContent(arg),
			eventDidMount: (arg) => this.#onEventMount(arg),
			moreLinkContent: (arg) => this.localize.term('contentCalendar_moreButton', arg.num),
			moreLinkHint: (num: number) => this.localize.term('contentCalendar_moreLinkHint', num),
			moreLinkClick: (arg) => this.#onMoreLinkClick(arg),
			// The status area above the calendar already explains an empty range.
			noEventsContent: () => '',
			views: {
				dayGridMonth: {
					dayHeaderFormat: { weekday: 'short' },
				},
				timeGrid: {
					expandRows: false,
				},
				timeGridWeek: {
					dayHeaderFormat: { weekday: 'short', day: 'numeric' },
					// Week columns are narrow; overlapping entries collapse into "+N" sooner than in the day view.
					eventMaxStack: 1,
				},
				timeGridDay: {
					dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' },
				},
			},
			dayCellClassNames: (arg) => (this.#weekendDays.has(arg.dow) ? ['cc-weekend'] : []),
			dayCellDidMount: (arg) => this.#onDayCellMount(arg),
			dayCellWillUnmount: (arg) => this.#onDayCellUnmount(arg),
			dayHeaderDidMount: (arg) => this.#onDayHeaderMount(arg),
			dayHeaderWillUnmount: (arg) => this.#onDayHeaderUnmount(arg),
			datesSet: (arg) => this.#onDatesSet(arg),
		});
		this.#calendar.render();

		this.#a11yObserver = new MutationObserver(this.#queueA11yFix);
		this.#a11yObserver.observe(calendarEl, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['role', 'aria-label', 'aria-expanded', 'aria-controls'],
		});
		this.#fixA11y();

		this.#resizeObserver = new ResizeObserver(() => this.#calendar?.updateSize());
		this.#resizeObserver.observe(this);
	}

	override connectedCallback(): void {
		super.connectedCallback();
		// Scroll doesn't bubble, so listen in the capture phase to close the hover card on any scroll.
		window.addEventListener('scroll', this.#hideHover, { capture: true, passive: true });
		window.addEventListener('keydown', this.#onWindowKeyDown);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener('scroll', this.#hideHover, { capture: true });
		window.removeEventListener('keydown', this.#onWindowKeyDown);
		this.#a11yObserver?.disconnect();
		this.#a11yObserver = undefined;
		clearTimeout(this.#hoverTimer);
		clearTimeout(this.#hoverHideTimer);
		this.#hoverTarget = undefined;
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = undefined;
		this.#calendar?.destroy();
		this.#calendar = undefined;
		this.#eventSource = undefined;
		this.#eventsViewType = undefined;
		this.#cells.clear();
		this.#headers.clear();
	}


	#getViewDef(name: ContentCalendarViewName): ContentCalendarViewDef {
		return VIEWS.find((v) => v.name === name) ?? VIEWS[0];
	}

	#isTimeGrid(viewType?: string) {
		return !!viewType?.startsWith('timeGrid');
	}

	#getFirstDayOfWeek(): number {
		try {
			const locale = new Intl.Locale(this.localize.lang() || navigator.language) as Intl.Locale & {
				getWeekInfo?: () => { firstDay: number };
				weekInfo?: { firstDay: number };
			};
			const info = locale.getWeekInfo?.() ?? locale.weekInfo;
			// Intl uses 1 (Mon) .. 7 (Sun); FullCalendar uses 0 (Sun) .. 6 (Sat).
			if (info?.firstDay) return info.firstDay % 7;
		} catch {
			// fall through
		}
		return 1;
	}

	/** Weekend days as FullCalendar day-of-week numbers (0 = Sunday), from the locale where the browser knows them. */
	#getWeekendDays(): ReadonlySet<number> {
		try {
			const locale = new Intl.Locale(this.localize.lang() || navigator.language) as Intl.Locale & {
				getWeekInfo?: () => { weekend: Array<number> };
				weekInfo?: { weekend: Array<number> };
			};
			const weekend = (locale.getWeekInfo?.() ?? locale.weekInfo)?.weekend;
			// Intl uses 1 (Mon) .. 7 (Sun).
			if (weekend?.length) return new Set(weekend.map((d) => d % 7));
		} catch {
			// fall through
		}
		return new Set([0, 6]);
	}

	#setView(name: ContentCalendarViewName) {
		if (name === this._view) return;
		this.#hideHover();
		this._view = name;
		try {
			localStorage.setItem(VIEW_STORAGE_KEY, name);
		} catch {
			// ignore
		}
		const calendar = this.#calendar;
		if (!calendar) return;
		const fcType = this.#getViewDef(name).fcType;
		calendar.batchRendering(() => {
			calendar.setOption('height', this.#getHeight(fcType));
			calendar.changeView(fcType);
		});
	}

	/** Month and list grow with their content; the time grid scrolls within a fixed height. */
	#getHeight(fcType: string): number | 'auto' {
		return this.#isTimeGrid(fcType) ? 720 : 'auto';
	}

	#onDatesSet(arg: DatesSetArg) {
		this.#hideHover();
		this._title = arg.view.title;
		this._range = { start: arg.view.currentStart, end: arg.view.currentEnd };
		this.#context?.loadRange(arg.view.currentStart, arg.view.currentEnd);
		if (this.#eventsViewType !== arg.view.type) this.#syncEvents();
		this.#scrollToEarliest();
	}

	/* ---------- Month view: Lit content inside each day cell ---------- */

	#onDayCellMount(arg: DayCellMountArg) {
		if (arg.view.type !== 'dayGridMonth') return;
		const container = document.createElement('div');
		container.className = 'cc-day';
		const dateKey = toLocalDateKey(arg.date);
		const cell: TrackedCell = { date: arg.date, dateKey, isOther: arg.isOther, cellEl: arg.el, container };
		this.#cells.set(dateKey, cell);
		this.#attachCell(cell);
		this.#renderCell(cell);
	}

	#onDayCellUnmount(arg: DayCellMountArg) {
		const dateKey = toLocalDateKey(arg.date);
		const cell = this.#cells.get(dateKey);
		if (!cell || cell.cellEl !== arg.el) return;
		render(nothing, cell.container);
		cell.container.remove();
		this.#cells.delete(dateKey);
	}

	#attachCell(cell: TrackedCell) {
		const frame = cell.cellEl.querySelector('.fc-daygrid-day-frame') ?? cell.cellEl;
		if (cell.container.parentElement !== frame) frame.appendChild(cell.container);
	}

	#indexDays(months: Array<ContentCalendarMonth>) {
		this.#daysByDate.clear();
		this.#entriesByKey.clear();
		for (const month of months)
			for (const day of month.days) {
				this.#daysByDate.set(day.date, day);
				for (const entry of day.entries) this.#entriesByKey.set(getEntryKey(entry), entry);
			}
	}

	/** A day's data with the hidden categories filtered out (undefined when the day has no data at all). */
	#getVisibleDay(dateKey: string): ContentCalendarDay | undefined {
		const day = this.#daysByDate.get(dateKey);
		return day ? filterDay(day, this._hidden) : undefined;
	}

	/** First load of a range: nothing to show yet, so draw placeholders instead of an empty grid. */
	#isSkeleton() {
		return this._loading && this._months.length === 0;
	}

	#renderCells() {
		for (const cell of this.#cells.values()) this.#renderCell(cell);
	}

	#renderCell(cell: TrackedCell) {
		this.#attachCell(cell);
		const dateLabel = this.#formatDayLabel(cell.date);

		if (this.#isSkeleton()) {
			cell.cellEl.setAttribute('aria-label', dateLabel);
			render(cell.isOther ? nothing : this.#renderSkeletonCell(cell.date), cell.container, { host: this });
			return;
		}

		// Only the month in view is loaded for the month view; leading/trailing days of other months stay empty.
		const day = cell.isOther ? undefined : this.#getVisibleDay(cell.dateKey);
		const hasEntries = !!day?.entries.length;

		cell.cellEl.setAttribute(
			'aria-label',
			day && hasEntries
				? this.localize.term(
						'contentCalendar_dayLabel',
						dateLabel,
						day.createdCount,
						day.scheduledCount,
						day.scheduledUnpublishCount,
						day.deletedCount,
					)
				: dateLabel,
		);

		render(day && hasEntries ? this.#renderDay(day, dateLabel) : nothing, cell.container, { host: this });
	}

	#renderSkeletonCell(date: Date) {
		// A stable, varied number of bars per day so the placeholder grid does not look like a pattern.
		const bars = (date.getDate() * 7) % 3;
		return html`<div class="cc-skeleton" aria-hidden="true">
			${Array.from({ length: bars }, (_, i) => html`<span class="cc-skeleton-bar" style="width: ${i ? 64 : 88}%"></span>`)}
		</div>`;
	}

	#renderDay(day: ContentCalendarDay, dateLabel: string) {
		const visible = day.entries.slice(0, this.maxChips);
		const hidden = day.entries.length - visible.length;

		return html`
			${this.#renderDots(day, false)}
			<ul class="cc-chips">
				${repeat(visible, getEntryKey, (entry) => html`<li>${this.#renderChip(entry)}</li>`)}
			</ul>
			${hidden > 0
				? html`<button
						type="button"
						class="cc-more"
						aria-label=${this.localize.term('contentCalendar_moreLabel', day.entries.length, dateLabel)}
						@click=${() => this.#openDay(day)}>
						${this.localize.term('contentCalendar_moreText', hidden)}
					</button>`
				: nothing}
		`;
	}

	/* ---------- Week/Day views: counts in the column headers ---------- */

	#onDayHeaderMount(arg: DayHeaderMountArg) {
		if (!this.#isTimeGrid(arg.view.type)) return;
		const container = document.createElement('div');
		container.className = 'cc-head';
		const dateKey = toLocalDateKey(arg.date);
		const header: TrackedHeader = { date: arg.date, dateKey, headerEl: arg.el, container };
		this.#headers.set(dateKey, header);
		this.#renderHeader(header);
	}

	#onDayHeaderUnmount(arg: DayHeaderMountArg) {
		const dateKey = toLocalDateKey(arg.date);
		const header = this.#headers.get(dateKey);
		if (!header || header.headerEl !== arg.el) return;
		render(nothing, header.container);
		header.container.remove();
		this.#headers.delete(dateKey);
	}

	#renderHeaders() {
		for (const header of this.#headers.values()) this.#renderHeader(header);
	}

	#renderHeader(header: TrackedHeader) {
		const inner = header.headerEl.querySelector('.fc-scrollgrid-sync-inner') ?? header.headerEl;
		if (header.container.parentElement !== inner) inner.appendChild(header.container);

		const day = this.#getVisibleDay(header.dateKey);
		const dateLabel = this.#formatDayLabel(header.date);
		render(
			day?.entries.length
				? html`${this.#renderDots(day, true)}
						<uui-button
							class="cc-head-all"
							look="outline"
							compact
							label=${this.localize.term('contentCalendar_moreLabel', day.entries.length, dateLabel)}
							@click=${() => this.#openDay(day)}>
							<uui-icon name="icon-bulleted-list"></uui-icon>
						</uui-button>`
				: nothing,
			header.container,
			{ host: this },
		);
	}

	/* ---------- Week/Day/List views: entries as FullCalendar events ---------- */

	#syncEvents() {
		const calendar = this.#calendar;
		if (!calendar) return;

		// Month cells render their own content (see #renderCell); events are only for the other views.
		const viewType = calendar.view.type;
		const usesEvents = viewType !== 'dayGridMonth';
		// FullCalendar always renders time-grid events as `<a>`, so the event itself is the link (a link inside
		// it would be a nested link). List rows keep their own link: a `url` there makes FullCalendar navigate itself.
		const eventsAreLinks = this.#isTimeGrid(viewType);
		this.#eventsViewType = viewType;

		const events: Array<EventInput> = [];
		for (const day of usesEvents ? this.#daysByDate.values() : []) {
			for (const entry of filterDay(day, this._hidden).entries) {
				const start = new Date(entry.date);
				if (Number.isNaN(start.getTime())) continue;
				const endOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
				const end = new Date(Math.min(start.getTime() + EVENT_DURATION_MS, endOfDay.getTime()));
				events.push({
					id: getEntryKey(entry),
					title: entry.name,
					start,
					end,
					allDay: false,
					url: eventsAreLinks ? getEntryEditPath(entry, this.#workspacePath) : undefined,
					classNames: ['cc-event', `cc-${getEntryStyle(entry).className}`],
					extendedProps: { entry, dayKey: day.date },
				});
			}
		}

		calendar.batchRendering(() => {
			this.#eventSource?.remove();
			this.#eventSource = calendar.addEventSource(events);
		});
		this.#scrollToEarliest();
	}

	/** In the time grid, scroll once per range to just before the first entry so it is in view. */
	#scrollToEarliest() {
		const calendar = this.#calendar;
		const range = this._range;
		// While a range is loading the context exposes no months; wait for the data before deciding.
		if (!calendar || !range || !this.#isTimeGrid(calendar.view.type) || !this._months.length) return;

		const rangeKey = `${calendar.view.type}|${toLocalDateKey(range.start)}`;
		if (this.#scrolledRangeKey === rangeKey) return;
		this.#scrolledRangeKey = rangeKey;

		let earliest: number | undefined;
		for (const day of this.#getRangeDays(true)) {
			for (const entry of day.entries) {
				const d = new Date(entry.date);
				const minutes = d.getHours() * 60 + d.getMinutes();
				if (earliest === undefined || minutes < earliest) earliest = minutes;
			}
		}
		const hour = earliest === undefined ? 8 : Math.max(0, Math.floor(earliest / 60) - 1);
		calendar.scrollToTime({ hours: hour });
	}

	#renderEventContent(arg: EventContentArg) {
		const entry = arg.event.extendedProps.entry as ContentCalendarEntry | undefined;
		if (!entry) return true;
		const el = document.createElement('div');
		el.className = 'cc-event-content';
		render(arg.view.type.startsWith('list') ? this.#renderListItem(entry) : this.#renderChip(entry, false), el, {
			host: this,
		});
		return { domNodes: [el] };
	}

	/** Time-grid events are FullCalendar's own `<a>`: give it the chip's accessible name and hover key. */
	#onEventMount(arg: EventMountArg) {
		const entry = arg.event.extendedProps.entry as ContentCalendarEntry | undefined;
		if (!entry || !this.#isTimeGrid(arg.view.type)) return;
		arg.el.setAttribute('aria-label', this.#describe(entry));
		arg.el.dataset.entryKey = getEntryKey(entry);
	}

	/* ---------- Accessibility fixes for FullCalendar's markup ---------- */

	#queueA11yFix = () => {
		if (this.#a11yQueued) return;
		this.#a11yQueued = true;
		queueMicrotask(() => {
			this.#a11yQueued = false;
			this.#fixA11y();
		});
	};

	/**
	 * FullCalendar's markup has a few ARIA problems; patch them after every render. Idempotent: attributes
	 * are only written when they differ, so the observer that calls this does not loop.
	 * - `role="grid"`/`gridcell` promise arrow-key navigation that FullCalendar does not implement, so they
	 *   are exposed as a plain table (Tab moves through the chips and buttons instead).
	 * - Day numbers and column headers are `<a>` without an href but with an aria-label, which is not
	 *   allowed on a generic element; the full date moves to the column header (day cells already have it).
	 * - "+N" is an `<a>` without an href acting as a button, with `aria-expanded` for a popover we replace
	 *   with a modal.
	 */
	#fixA11y() {
		const root = this.renderRoot.querySelector<HTMLElement>('#calendar');
		if (!root) return;
		const set = (el: Element, name: string, value: string) => {
			if (el.getAttribute(name) !== value) el.setAttribute(name, value);
		};

		root.querySelectorAll('[role="grid"]').forEach((el) => set(el, 'role', 'table'));
		root.querySelectorAll('[role="gridcell"]').forEach((el) => set(el, 'role', 'cell'));

		root.querySelectorAll('a:not([href])[aria-label]:not(.fc-more-link)').forEach((anchor) => {
			const label = anchor.getAttribute('aria-label') ?? '';
			anchor.removeAttribute('aria-label');
			const header = anchor.closest('th.fc-col-header-cell');
			if (header && label && label !== anchor.textContent?.trim()) set(header, 'aria-label', label);
		});

		root.querySelectorAll('.fc-more-link').forEach((more) => {
			set(more, 'role', 'button');
			set(more, 'aria-haspopup', 'dialog');
			more.removeAttribute('aria-expanded');
			more.removeAttribute('aria-controls');
			const hint = more.getAttribute('title');
			if (hint) set(more, 'aria-label', hint);
		});
	}

	#onMoreLinkClick(arg: MoreLinkArg) {
		const dayKey = arg.allSegs[0]?.event.extendedProps.dayKey as string | undefined;
		const day = dayKey ? this.#daysByDate.get(dayKey) : undefined;
		if (day) this.#openDay(day);
		// Any truthy non-string value tells FullCalendar the click was handled (no popover, no navigation).
		return true as unknown as string;
	}

	/* ---------- Shared rendering ---------- */

	#formatDayLabel(date: Date) {
		return this.localize.date(date, { weekday: 'long', day: 'numeric', month: 'long' });
	}

	#getKindLabel(entry: ContentCalendarEntry) {
		return this.localize.term(getEntryStyle(entry).labelKey);
	}

	#describe(entry: ContentCalendarEntry) {
		const when = this.localize.date(entry.date, { dateStyle: 'full', timeStyle: 'short' });
		const culture = entry.culture ? ` (${entry.culture})` : '';
		return `${entry.name}${culture}, ${entry.documentType.name}, ${this.#getKindLabel(entry)}, ${when}`;
	}

	#renderDots(day: ContentCalendarDay, withNumbers: boolean) {
		const counts = countByCategory([day]);
		const present = CONTENT_CALENDAR_CATEGORIES.filter((c) => counts[c] > 0);
		const title = present
			.map((c) => this.localize.term(CONTENT_CALENDAR_CATEGORY_STYLE[c].countKey, counts[c]))
			.join(', ');
		// Month cells read out their counts in the cell label, so their dots are purely visual; the week/day
		// column headers have no such label, so there the counts are also available as hidden text.
		return html`<div class="cc-dots ${withNumbers ? 'with-numbers' : ''}" title=${title} aria-hidden=${withNumbers ? 'false' : 'true'}>
			${present.map(
				(c) => html`<span class="cc-dot-item cc-${CONTENT_CALENDAR_CATEGORY_STYLE[c].className}" aria-hidden="true">
					${withNumbers
						? // With room for numbers, the state icon tells the states apart without relying on colour.
							html`<umb-icon class="cc-dot-icon" name=${CONTENT_CALENDAR_CATEGORY_STYLE[c].icon}></umb-icon
								><span class="cc-dot-count">${counts[c]}</span>`
						: html`<span class="cc-dot"></span>`}
				</span>`,
			)}
			${withNumbers ? html`<span class="visually-hidden">${title}</span>` : nothing}
		</div>`;
	}

	/**
	 * An entry chip. In the month view it is the link itself; in the time grid FullCalendar's event `<a>` is
	 * the link (see #syncEvents and #onEventMount), so the chip is only its visual content.
	 */
	#renderChip(entry: ContentCalendarEntry, asLink = true) {
		const style = getEntryStyle(entry);
		const content = html`<umb-icon class="cc-chip-type" name=${entry.documentType.icon} aria-hidden="true"></umb-icon>
			<span class="cc-chip-name">${entry.name}</span>
			${entry.culture ? html`<span class="cc-chip-culture">${entry.culture}</span>` : nothing}
			<time class="cc-chip-time" datetime=${entry.date}>${this.localize.date(entry.date, { timeStyle: 'short' })}</time>
			<umb-icon class="cc-chip-state" name=${style.icon} aria-hidden="true"></umb-icon>`;

		if (!asLink) return html`<span class="cc-chip cc-${style.className}" aria-hidden="true">${content}</span>`;

		// No `title`: the hover card shows the details (the aria-label covers assistive technology).
		return html`<a
			class="cc-chip cc-${style.className}"
			data-entry-key=${getEntryKey(entry)}
			href=${getEntryEditPath(entry, this.#workspacePath)}
			aria-label=${this.#describe(entry)}>
			${content}
		</a>`;
	}

	#renderListItem(entry: ContentCalendarEntry) {
		const style = getEntryStyle(entry);
		const description = this.#describe(entry);

		return html`<div class="cc-list-item">
			<a class="cc-list-link" href=${getEntryEditPath(entry, this.#workspacePath)} aria-label=${description}>
				<umb-icon name=${entry.documentType.icon} aria-hidden="true"></umb-icon>
				<span class="cc-list-name">${entry.name}</span>
			</a>
			${entry.culture ? html`<span class="cc-chip-culture">${entry.culture}</span>` : nothing}
			<span class="cc-list-type">${entry.documentType.name}</span>
			<uui-tag class="cc-list-kind" color=${style.color} look="secondary">
				<span class="tag-content">
					<umb-icon name=${style.icon} aria-hidden="true"></umb-icon>
					${this.#getKindLabel(entry)}
				</span>
			</uui-tag>
		</div>`;
	}

	async #openDay(day: ContentCalendarDay) {
		if (this.#dayModalReady) {
			this.#dayModal.open({ date: day.date });
			return;
		}
		// Not inside a routable context (should not happen on a dashboard): fall back to a plain modal.
		const modalManager = await this.getContext(UMB_MODAL_MANAGER_CONTEXT);
		modalManager?.open(this, CONTENT_CALENDAR_DAY_OVERFLOW_MODAL, { data: { day } });
	}

	/** Days (with entries) inside the visible range; with `visibleOnly`, as filtered by the state tiles. */
	#getRangeDays(visibleOnly = false): Array<ContentCalendarDay> {
		const range = this._range;
		if (!range) return [];
		const startKey = toLocalDateKey(range.start);
		const endKey = toLocalDateKey(range.end);
		const days = [...this.#daysByDate.values()].filter((d) => d.date >= startKey && d.date < endKey);
		return visibleOnly ? days.map((d) => filterDay(d, this._hidden)).filter((d) => d.entries.length > 0) : days;
	}

	/* ---------- Hover card ---------- */

	#findChip(event: Event): HTMLElement | undefined {
		return event
			.composedPath()
			.find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.entryKey);
	}

	#isInHoverCard(event: Event) {
		return event
			.composedPath()
			.some((el) => el instanceof HTMLElement && el.classList.contains('cc-hovercard'));
	}

	#onPointerOver = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		// The card itself is hoverable (WCAG 1.4.13), so moving onto it keeps it open.
		if (this.#isInHoverCard(event)) {
			clearTimeout(this.#hoverHideTimer);
			return;
		}
		this.#scheduleHover(this.#findChip(event));
	};

	#onFocusIn = (event: FocusEvent) => this.#scheduleHover(this.#findChip(event));

	#onFocusOut = (event: FocusEvent) => {
		// Moving focus to another chip is handled by its focusin.
		if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.dataset.entryKey)) this.#hideHover();
	};

	#onWindowKeyDown = (event: KeyboardEvent) => {
		// Dismissible without moving the pointer or focus (WCAG 1.4.13).
		if (event.key === 'Escape' && this._hover) this.#hideHover();
	};

	#scheduleHover(chip: HTMLElement | undefined) {
		clearTimeout(this.#hoverHideTimer);
		if (chip === this.#hoverTarget) return;
		if (!chip) {
			clearTimeout(this.#hoverTimer);
			if (!this._hover) {
				this.#hoverTarget = undefined;
				return;
			}
			// A short grace period lets the pointer cross the gap between the chip and its card.
			this.#hoverHideTimer = setTimeout(this.#hideHover, HOVER_HIDE_DELAY_MS);
			return;
		}
		clearTimeout(this.#hoverTimer);
		this.#hoverTarget = chip;
		// Once a card is open, moving to the next chip updates it straight away.
		this.#hoverTimer = setTimeout(() => this.#showHover(chip), this._hover ? 0 : HOVER_DELAY_MS);
	}

	#showHover(chip: HTMLElement) {
		const entry = this.#entriesByKey.get(chip.dataset.entryKey ?? '');
		const wrap = this.renderRoot.querySelector<HTMLElement>('.calendar-wrap');
		if (!entry || !wrap || !chip.isConnected) return;

		const chipRect = chip.getBoundingClientRect();
		const wrapRect = wrap.getBoundingClientRect();
		const maxLeft = Math.max(0, wrapRect.width - HOVER_CARD_WIDTH);
		const left = Math.min(Math.max(0, chipRect.left - wrapRect.left), maxLeft);
		const roomBelow = window.innerHeight - chipRect.bottom;
		const above = roomBelow < HOVER_CARD_HEIGHT_ESTIMATE && chipRect.top > HOVER_CARD_HEIGHT_ESTIMATE;

		this._hover = above
			? { entry, left, bottom: wrapRect.bottom - chipRect.top + 6 }
			: { entry, left, top: chipRect.bottom - wrapRect.top + 6 };
	}

	#hideHover = () => {
		clearTimeout(this.#hoverTimer);
		clearTimeout(this.#hoverHideTimer);
		this.#hoverTarget = undefined;
		this._hover = undefined;
	};

	#renderHoverCard() {
		const hover = this._hover;
		if (!hover) return nothing;
		const { entry } = hover;
		const style = getEntryStyle(entry);
		const position =
			`left: ${hover.left}px; width: ${HOVER_CARD_WIDTH}px; ` +
			(hover.top !== undefined ? `top: ${hover.top}px;` : `bottom: ${hover.bottom}px;`);

		// Visual only: the chip's own label already carries the same details for assistive technology.
		return html`<div class="cc-hovercard cc-${style.className}" style=${position} aria-hidden="true">
			<div class="cc-hovercard-head">
				<umb-icon name=${entry.documentType.icon}></umb-icon>
				<strong class="cc-hovercard-name">${entry.name}</strong>
			</div>
			<div class="cc-hovercard-meta">
				${entry.documentType.name}${entry.culture ? html` · <span class="cc-chip-culture">${entry.culture}</span>` : nothing}
			</div>
			<div class="cc-hovercard-state">
				<uui-tag color=${style.color} look="secondary">
					<span class="tag-content">
						<umb-icon name=${style.icon}></umb-icon>
						${this.#getKindLabel(entry)}
					</span>
				</uui-tag>
				<time datetime=${entry.date}>${this.localize.date(entry.date, { dateStyle: 'full', timeStyle: 'short' })}</time>
			</div>
			<div class="cc-hovercard-hint">${this.localize.term('contentCalendar_hoverOpen')}</div>
		</div>`;
	}

	/* ---------- State tiles (legend, summary and filters in one) ---------- */

	#renderTiles() {
		const counts = countByCategory(this.#getRangeDays());
		return html`<div class="cc-tiles" role="group" aria-label=${this.localize.term('contentCalendar_filters')}>
			${CONTENT_CALENDAR_CATEGORIES.map((category) => {
				const style = CONTENT_CALENDAR_CATEGORY_STYLE[category];
				const label = this.localize.term(style.tileKey);
				const shown = !this._hidden.has(category);
				const n = counts[category];
				const items = this.#isSkeleton()
					? this.localize.term('contentCalendar_itemCountOther', '–')
					: this.localize.term(n === 1 ? 'contentCalendar_itemCountOne' : 'contentCalendar_itemCountOther', n);
				// The sentence is localised as a whole; the count phrase (%0%) is split out so it can be bold.
				const [before, after = ''] = this.localize.term(style.tileTextKey, '\u0001').split('\u0001');
				const action = this.localize.term(shown ? 'contentCalendar_filterHide' : 'contentCalendar_filterShow');
				const titleId = `cc-tile-${style.className}`;
				// Laid out like the cards of Umbraco's welcome dashboard (umb-news-card): title, text, then the toggle.
				return html`<div
					class="cc-tile cc-${style.className} ${shown ? '' : 'is-hidden'}"
					role="group"
					aria-labelledby=${titleId}>
					<div class="cc-tile-name" id=${titleId}>
						<umb-icon name=${style.icon} aria-hidden="true"></umb-icon>
						<span class="cc-tile-label">${label}</span>
					</div>
					<p class="cc-tile-text">${before}<strong class="cc-tile-count">${items}</strong>${after}</p>
					<uui-button
						class="cc-tile-toggle"
						look="outline"
						label=${this.localize.term('contentCalendar_filterButtonLabel', action, label)}
						@click=${() => this.#context?.toggleCategory(category)}>
						${action}
					</uui-button>
				</div>`;
			})}
		</div>`;
	}

	#prev = () => this.#calendar?.prev();
	#next = () => this.#calendar?.next();
	#today = () => this.#calendar?.today();
	#refresh = () => this.#context?.refresh();

	#onKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'PageUp') {
			event.preventDefault();
			this.#prev();
		} else if (event.key === 'PageDown') {
			event.preventDefault();
			this.#next();
		} else if (event.key === 'Escape' && this._hover) {
			this.#hideHover();
		}
	};

	/**
	 * FullCalendar renders several `<a>` elements without an href (day numbers, list day headers, "+N").
	 * The backoffice router treats every anchor click as navigation and would resolve those to the
	 * backoffice root, so keep such clicks inside the calendar. Real links (our chips) are unaffected.
	 */
	#onClick = (event: MouseEvent) => {
		if (this.#findChip(event)) this.#hideHover();
		const anchor = event.composedPath().find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
		if (anchor && !anchor.hasAttribute('href')) event.stopPropagation();
	};

	#renderEmptyMessage() {
		switch (this._view) {
			case 'week':
				return this.localize.term('contentCalendar_emptyWeek', this._title);
			case 'day':
				return this.localize.term('contentCalendar_emptyDay', this._title);
			default:
				return this.localize.term('contentCalendar_emptyMonth', this._title);
		}
	}

	#renderViewSwitcher() {
		return html`<div class="segmented" role="group" aria-label=${this.localize.term('contentCalendar_viewSwitcherLabel')}>
			${VIEWS.map((view) => {
				const active = view.name === this._view;
				return html`<button
					type="button"
					data-view=${view.name}
					aria-pressed=${active ? 'true' : 'false'}
					@click=${() => this.#setView(view.name)}>
					<uui-icon name=${view.icon} aria-hidden="true"></uui-icon>
					<span>${this.localize.term(view.labelKey)}</span>
				</button>`;
			})}
		</div>`;
	}

	#renderListSkeleton() {
		return html`<div class="cc-list-skeleton" aria-hidden="true">
			${[72, 54, 64, 48, 60].map(
				(width) => html`<div class="cc-list-skeleton-row">
					<span class="cc-skeleton-bar" style="width: 4rem"></span>
					<span class="cc-skeleton-bar" style="width: ${width}%"></span>
				</div>`,
			)}
		</div>`;
	}

	override render() {
		const viewDef = this.#getViewDef(this._view);
		const skeleton = this.#isSkeleton();
		const hasData = !this._loading && !this._hasError && this._months.length > 0;
		const isEmpty = hasData && this.#getRangeDays().length === 0;
		const isFilteredEmpty = hasData && !isEmpty && this._hidden.size > 0 && this.#getRangeDays(true).length === 0;
		const isTruncated = this._months.some((m) => m.isTruncated);
		const refreshLabel = this.localize.term('contentCalendar_refreshLabel');

		return html`
			<div class="toolbar">
				<div class="nav">
					<uui-button
						look="outline"
						label=${this.localize.term('contentCalendar_today')}
						@click=${this.#today}></uui-button>
					<uui-button
						look="default"
						compact
						label=${this.localize.term(viewDef.previousKey)}
						title=${this.localize.term(viewDef.previousKey)}
						@click=${this.#prev}>
						<uui-icon name="icon-arrow-left"></uui-icon>
					</uui-button>
					<uui-button
						look="default"
						compact
						label=${this.localize.term(viewDef.nextKey)}
						title=${this.localize.term(viewDef.nextKey)}
						@click=${this.#next}>
						<uui-icon name="icon-arrow-right"></uui-icon>
					</uui-button>
					<h3 class="title" aria-live="polite">${this._title}</h3>
				</div>

				<div class="actions">
					${this.#renderViewSwitcher()}
					<uui-button
						look="outline"
						compact
						label=${refreshLabel}
						title=${refreshLabel}
						?disabled=${this._loading}
						@click=${this.#refresh}>
						<uui-icon name="icon-refresh"></uui-icon>
					</uui-button>
				</div>
			</div>

			${this.#renderTiles()}

			<div class="status" role="status" aria-live="polite">
				${this._loading
					? html`<uui-loader-bar></uui-loader-bar
							><span class="visually-hidden">${this.localize.term('contentCalendar_loading')}</span>`
					: nothing}
				${this._hasError
					? html`<div class="message error">
							<uui-icon name="icon-alert"></uui-icon>
							${this.localize.term('contentCalendar_loadFailed')}
							<uui-button look="secondary" compact label=${this.localize.term('contentCalendar_refresh')} @click=${this.#refresh}></uui-button>
						</div>`
					: nothing}
				${isEmpty
					? html`<div class="message empty">
							<span class="message-icon"><uui-icon name="icon-calendar"></uui-icon></span>
							<span>${this.#renderEmptyMessage()}</span>
						</div>`
					: nothing}
				${isFilteredEmpty
					? html`<div class="message empty">
							<span class="message-icon"><uui-icon name="icon-filter"></uui-icon></span>
							<span>${this.localize.term('contentCalendar_emptyFiltered')}</span>
							<uui-button
								look="secondary"
								compact
								label=${this.localize.term('contentCalendar_showAll')}
								@click=${() => this.#context?.showAllCategories()}></uui-button>
						</div>`
					: nothing}
				${isTruncated
					? html`<div class="message warning">
							<uui-icon name="icon-alert"></uui-icon>
							${this.localize.term('contentCalendar_truncated')}
						</div>`
					: nothing}
			</div>

			<!-- FullCalendar owns #calendar (incl. its class list), so dynamic bindings live on the wrapper. -->
			<div
				class="calendar-wrap view-${this._view} ${this._loading && !skeleton ? 'is-loading' : ''} ${skeleton
					? 'is-skeleton'
					: ''}"
				@keydown=${this.#onKeyDown}
				@click=${this.#onClick}
				@pointerover=${this.#onPointerOver}
				@pointerleave=${this.#hideHover}
				@focusin=${this.#onFocusIn}
				@focusout=${this.#onFocusOut}>
				${skeleton && this._view === 'list' ? this.#renderListSkeleton() : nothing}
				<div id="calendar"></div>
				${this.#renderHoverCard()}
			</div>
		`;
	}

	static override styles = contentCalendarGridStyles;
}

export default ContentCalendarGridElement;

declare global {
	interface HTMLElementTagNameMap {
		[ELEMENT_NAME]: ContentCalendarGridElement;
	}
}
