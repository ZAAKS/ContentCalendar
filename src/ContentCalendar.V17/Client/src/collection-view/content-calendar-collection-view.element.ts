import { ContentCalendarContext } from '../context/content-calendar.context.js';
import '../calendar/content-calendar-grid.element.js';
import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UMB_DOCUMENT_COLLECTION_CONTEXT, UMB_DOCUMENT_WORKSPACE_CONTEXT } from '@umbraco-cms/backoffice/document';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';

const ELEMENT_NAME = 'content-calendar-collection-view';

/**
 * "Calendar" view of a document collection (the Collection property editor's child items), next to the core
 * Grid and Table views. Shows only the direct children of the document the collection belongs to.
 *
 * The collection's own items are not used: they are paged and carry no scheduled publish/unpublish or
 * trash dates. The calendar asks the Content Calendar API for the children of the collection's parent instead.
 */
@customElement(ELEMENT_NAME)
export class ContentCalendarCollectionViewElement extends UmbLitElement {
	#calendarContext = new ContentCalendarContext(this, {
		childrenOnly: true,
		hiddenStorageKey: 'contentCalendar.collection.hiddenKinds',
	});
	#filterUnique?: string;
	#workspaceUnique?: string;

	constructor() {
		super();

		// The document collection filters on its parent's key; the document workspace is the fallback.
		this.consumeContext(UMB_DOCUMENT_COLLECTION_CONTEXT, (collection) => {
			this.observe(
				collection?.filter,
				(filter) => {
					const unique = (filter as { unique?: unknown } | undefined)?.unique;
					this.#filterUnique = typeof unique === 'string' && unique ? unique : undefined;
					this.#updateParent();
				},
				'_observeCollectionFilter',
			);
		});

		this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, (workspace) => {
			this.observe(
				workspace?.unique,
				(unique) => {
					this.#workspaceUnique = unique ?? undefined;
					this.#updateParent();
				},
				'_observeWorkspaceUnique',
			);
		});
	}

	#updateParent() {
		const parentKey = this.#filterUnique ?? this.#workspaceUnique;
		if (parentKey) this.#calendarContext.setParentKey(parentKey);
	}

	override render() {
		return html`
			<content-calendar-grid></content-calendar-grid>
			<p class="note">${this.localize.term('contentCalendar_collectionNote')}</p>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			:host {
				display: block;
				font-family: var(--uui-font-family);
			}

			.note {
				margin: var(--uui-size-space-4) 0 0;
				color: var(--uui-color-text-alt);
				font-size: var(--uui-type-small-size);
			}
		`,
	];
}

export default ContentCalendarCollectionViewElement;

declare global {
	interface HTMLElementTagNameMap {
		[ELEMENT_NAME]: ContentCalendarCollectionViewElement;
	}
}
