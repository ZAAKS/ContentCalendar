import { ContentCalendarContext } from '../context/content-calendar.context.js';
import '../calendar/content-calendar-grid.element.js';
import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';

const ELEMENT_NAME = 'content-calendar-dashboard';

/**
 * Content section dashboard. Provides the calendar context for its subtree and lays out the
 * headline and the calendar (whose state tiles double as legend and filters).
 */
@customElement(ELEMENT_NAME)
export class ContentCalendarDashboardElement extends UmbLitElement {
	constructor() {
		super();
		new ContentCalendarContext(this);
	}

	override render() {
		return html`
			<uui-box>
				<div slot="headline" class="headline">
					<umb-icon name="icon-calendar" aria-hidden="true"></umb-icon>
					<span>${this.localize.term('contentCalendar_headline')}</span>
				</div>

				<content-calendar-grid></content-calendar-grid>

				<p class="note">${this.localize.term('contentCalendar_scheduledPendingNote')}</p>
			</uui-box>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			:host {
				display: block;
				padding: var(--uui-size-layout-1);
				font-family: var(--uui-font-family);
			}

			.headline {
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-3);
			}

			.note {
				margin: var(--uui-size-space-4) 0 0;
				color: var(--uui-color-text-alt);
				font-size: var(--uui-type-small-size);
			}
		`,
	];
}

export default ContentCalendarDashboardElement;

declare global {
	interface HTMLElementTagNameMap {
		[ELEMENT_NAME]: ContentCalendarDashboardElement;
	}
}
