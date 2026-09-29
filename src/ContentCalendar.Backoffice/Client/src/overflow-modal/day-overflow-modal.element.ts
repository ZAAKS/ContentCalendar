import type {
	ContentCalendarDayOverflowModalData,
	ContentCalendarDayOverflowModalValue,
} from './day-overflow-modal.token.js';
import { CONTENT_CALENDAR_CONTEXT, type ContentCalendarContext } from '../context/content-calendar.context.js';
import { registerDocumentWorkspaceModal } from '../shared/document-workspace-modal.js';
import { filterDay, getEntryEditPath, getEntryKey, getEntryStyle, type ContentCalendarCategory } from '../shared/entry.utils.js';
import type { ContentCalendarDay, ContentCalendarEntry } from '../shared/types.js';
import { css, customElement, html, repeat, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';

type SortColumn = 'name' | 'documentType' | 'date' | 'state' | 'culture';

const ELEMENT_NAME = 'content-calendar-day-overflow-modal';

/**
 * Full, sortable listing of one day's entries. A routed sidebar modal (see the calendar grid), so focus
 * trapping / escape-to-close / layout match first-party dialogs, and items open in the document editor
 * drawer on top of it, like the content picker's "infinite editing". When a document changed in that drawer,
 * the calendar reloads and this listing follows the reloaded data.
 */
@customElement(ELEMENT_NAME)
export class ContentCalendarDayOverflowModalElement extends UmbModalBaseElement<
	ContentCalendarDayOverflowModalData,
	ContentCalendarDayOverflowModalValue
> {
	@state()
	private _sortColumn: SortColumn = 'date';

	@state()
	private _sortDescending = false;

	@state()
	private _workspacePath?: string;

	/** The latest data for this day from the calendar context, once it has (re)loaded the day's month. */
	@state()
	private _liveDay?: ContentCalendarDay;

	/** Categories hidden with the calendar's filter tiles; the listing hides them too. */
	@state()
	private _hidden: ReadonlySet<ContentCalendarCategory> = new Set();

	#context?: ContentCalendarContext;
	#collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

	constructor() {
		super();

		registerDocumentWorkspaceModal(
			this,
			(path) => (this._workspacePath = path),
			() => this.#context?.editorClosed(this),
			() => this.#context?.editorOpened(this),
		);

		// Modals resolve contexts through the element that opened them, i.e. the calendar grid.
		this.consumeContext(CONTENT_CALENDAR_CONTEXT, (context) => {
			this.#context = context;
			if (!context) return;
			this.observe(
				context.months,
				(months) => {
					const date = this.data?.day.date;
					const month = date ? months.find((m) => m.monthKey === date.slice(0, 7)) : undefined;
					if (!date || !month) return;
					this._liveDay = month.days.find((d) => d.date === date) ?? {
						date,
						createdCount: 0,
						scheduledCount: 0,
						scheduledUnpublishCount: 0,
						deletedCount: 0,
						entries: [],
					};
				},
				'_observeMonths',
			);
			this.observe(context.hiddenCategories, (hidden) => (this._hidden = new Set(hidden)), '_observeHidden');
		});
	}

	#getDay(): ContentCalendarDay | undefined {
		const day = this._liveDay ?? this.data?.day;
		return day ? filterDay(day, this._hidden) : undefined;
	}

	#sortedEntries(): Array<ContentCalendarEntry> {
		const entries = [...(this.#getDay()?.entries ?? [])];
		const direction = this._sortDescending ? -1 : 1;
		const kindLabel = (e: ContentCalendarEntry) => this.#kindLabel(e);

		const compare = (a: ContentCalendarEntry, b: ContentCalendarEntry): number => {
			switch (this._sortColumn) {
				case 'name':
					return this.#collator.compare(a.name, b.name);
				case 'documentType':
					return this.#collator.compare(a.documentType.name, b.documentType.name);
				case 'state':
					return this.#collator.compare(kindLabel(a), kindLabel(b));
				case 'culture':
					return this.#collator.compare(a.culture ?? '', b.culture ?? '');
				case 'date':
				default:
					return Date.parse(a.date) - Date.parse(b.date);
			}
		};

		// Stable tie-breakers: date, then name.
		return entries.sort(
			(a, b) =>
				direction * compare(a, b) ||
				Date.parse(a.date) - Date.parse(b.date) ||
				this.#collator.compare(a.name, b.name),
		);
	}

	#kindLabel(entry: ContentCalendarEntry): string {
		return this.localize.term(getEntryStyle(entry).labelKey);
	}

	#setSort(column: SortColumn) {
		if (this._sortColumn === column) {
			this._sortDescending = !this._sortDescending;
		} else {
			this._sortColumn = column;
			this._sortDescending = false;
		}
	}

	#close = () => this._rejectModal();

	#formatDayHeadline(): string {
		const date = this.#getDay()?.date;
		if (!date) return '';
		// `date` is a local calendar date (yyyy-MM-dd); build it at local noon to avoid DST edge cases.
		const [y, m, d] = date.split('-').map(Number);
		return this.localize.date(new Date(y, m - 1, d, 12), { dateStyle: 'full' });
	}

	override render() {
		const entries = this.#sortedEntries();
		const hasCultures = entries.some((e) => !!e.culture);

		return html`
			<umb-body-layout
				headline=${this.localize.term('contentCalendar_dayOverflowHeadline', this.#formatDayHeadline())}>
				<uui-box>
					<uui-table aria-label=${this.localize.term('contentCalendar_dayOverflowHeadline', this.#formatDayHeadline())}>
						<uui-table-head>
							<uui-table-head-cell style="width: 60px;"></uui-table-head-cell>
							${this.#renderSortableHeader('name', 'contentCalendar_columnName')}
							${this.#renderSortableHeader('documentType', 'contentCalendar_columnDocumentType')}
							${this.#renderSortableHeader('date', 'contentCalendar_columnDate')}
							${this.#renderSortableHeader('state', 'contentCalendar_columnState')}
							${hasCultures ? this.#renderSortableHeader('culture', 'contentCalendar_columnCulture') : ''}
							<uui-table-head-cell>
								<span class="visually-hidden">${this.localize.term('contentCalendar_columnActions')}</span>
							</uui-table-head-cell>
						</uui-table-head>
						${repeat(entries, getEntryKey, (entry) => this.#renderRow(entry, hasCultures))}
					</uui-table>
				</uui-box>

				<uui-button
					slot="actions"
					look="primary"
					label=${this.localize.term('contentCalendar_close')}
					@click=${this.#close}></uui-button>
			</umb-body-layout>
		`;
	}

	#renderSortableHeader(column: SortColumn, labelKey: string) {
		const label = this.localize.term(labelKey);
		const active = this._sortColumn === column;
		return html`
			<uui-table-head-cell
				aria-sort=${active ? (this._sortDescending ? 'descending' : 'ascending') : 'none'}>
				<button
					type="button"
					aria-label=${this.localize.term('contentCalendar_sortBy', label)}
					@click=${() => this.#setSort(column)}>
					<span>${label}</span>
					<uui-symbol-sort ?active=${active} ?descending=${this._sortDescending}></uui-symbol-sort>
				</button>
			</uui-table-head-cell>
		`;
	}

	#renderRow(entry: ContentCalendarEntry, hasCultures: boolean) {
		const style = getEntryStyle(entry);
		const editPath = getEntryEditPath(entry, this._workspacePath);
		// Without a drawer route the link leaves the calendar, so close this modal along the way.
		const onClick = this._workspacePath ? undefined : this.#close;
		return html`
			<uui-table-row>
				<uui-table-cell class="icon-cell">
					<umb-icon name=${entry.documentType.icon} aria-hidden="true"></umb-icon>
				</uui-table-cell>
				<uui-table-cell>
					<a class="name ${style.className}" href=${editPath} @click=${onClick}>${entry.name}</a>
				</uui-table-cell>
				<uui-table-cell>${entry.documentType.name}</uui-table-cell>
				<uui-table-cell>
					<time datetime=${entry.date}>
						${this.localize.date(entry.date, { dateStyle: 'medium', timeStyle: 'short' })}
					</time>
				</uui-table-cell>
				<uui-table-cell>
					<uui-tag color=${style.color} look="secondary">
						<span class="tag-content">
							<umb-icon name=${style.icon} aria-hidden="true"></umb-icon>
							${this.#kindLabel(entry)}
						</span>
					</uui-tag>
				</uui-table-cell>
				${hasCultures ? html`<uui-table-cell>${entry.culture ?? ''}</uui-table-cell>` : ''}
				<uui-table-cell class="actions-cell">
					<uui-button
						look="secondary"
						compact
						href=${editPath}
						label=${this.localize.term('contentCalendar_openItem', entry.name)}
						@click=${onClick}>
						${this.localize.term('contentCalendar_open')}
					</uui-button>
				</uui-table-cell>
			</uui-table-row>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			:host {
				font-family: var(--uui-font-family);
			}

			uui-box {
				--uui-box-default-padding: 0;
			}

			uui-table-head-cell:focus-within,
			uui-table-head-cell:hover {
				--uui-symbol-sort-hover: 1;
			}

			uui-table-head-cell button {
				padding: 0;
				background-color: transparent;
				color: inherit;
				border: none;
				cursor: pointer;
				font-family: inherit;
				font-weight: inherit;
				font-size: inherit;
				display: inline-flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--uui-size-space-2);
				width: 100%;
				text-align: inherit;
			}

			uui-table-head-cell button:focus-visible {
				outline: 2px solid var(--uui-color-focus);
				outline-offset: 2px;
			}

			.icon-cell {
				text-align: center;
				font-size: var(--uui-size-6);
			}

			.name {
				color: var(--uui-color-interactive);
				font-weight: 700;
				text-decoration: none;
			}

			.name:hover,
			.name:focus-visible {
				color: var(--uui-color-interactive-emphasis);
				text-decoration: underline;
			}

			.name.deleted {
				text-decoration: line-through;
			}

			.tag-content {
				display: inline-flex;
				align-items: center;
				gap: var(--uui-size-space-1);
				white-space: nowrap;
			}

			.actions-cell {
				text-align: right;
			}

			.visually-hidden {
				position: absolute;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip: rect(0 0 0 0);
				white-space: nowrap;
			}
		`,
	];
}

export default ContentCalendarDayOverflowModalElement;

declare global {
	interface HTMLElementTagNameMap {
		[ELEMENT_NAME]: ContentCalendarDayOverflowModalElement;
	}
}
