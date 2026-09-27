import { css } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';

/**
 * FullCalendar injects its own structural CSS into this element's shadow root. These rules only
 * re-theme it with UUI design tokens so the grid follows the backoffice theme (incl. dark/high contrast).
 */
export const contentCalendarGridStyles = [
	UmbTextStyles,
	css`
		:host {
			display: block;
			/* Umbraco's standard typeface everywhere, including FullCalendar's markup and native buttons. */
			font-family: var(--uui-font-family, 'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif);
			/* Grid lines use the standard Umbraco border colour, as uui-table rows and uui-box do (black in high contrast). */
			--content-calendar-grid-line-color: var(--uui-color-border, #d8d7d9);
			--fc-border-color: var(--content-calendar-grid-line-color);
			--fc-page-bg-color: var(--uui-color-surface);
			--fc-neutral-bg-color: var(--uui-color-surface-alt);
			--fc-today-bg-color: transparent;
			--fc-small-font-size: var(--uui-type-small-size);
			/* Entry colours; override these on content-calendar-grid (or an ancestor) to re-theme. */
			--content-calendar-draft-color: var(--uui-color-default);
			--content-calendar-published-color: var(--uui-color-positive);
			--content-calendar-scheduled-color: #a17700;
			--content-calendar-deleted-color: #df2a5d;
			--cc-radius: 8px;
		}

		/* One colour variable per state; chips, dots, tiles, events, list rows and the hover card all use it. */
		.cc-draft {
			--cc-kind: var(--content-calendar-draft-color);
			--cc-tint: 10%;
		}
		.cc-published {
			--cc-kind: var(--content-calendar-published-color);
		}
		.cc-scheduled,
		.cc-unpublish {
			--cc-kind: var(--content-calendar-scheduled-color);
		}
		.cc-deleted {
			--cc-kind: var(--content-calendar-deleted-color);
		}

		/* ---------- Toolbar ---------- */

		.toolbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--uui-size-space-4);
			margin-bottom: var(--uui-size-space-4);
			flex-wrap: wrap;
		}

		.nav,
		.actions {
			display: flex;
			align-items: center;
			gap: var(--uui-size-space-2);
			min-width: 0;
		}

		.nav .title {
			margin: 0 0 0 var(--uui-size-space-3);
			font-size: var(--uui-type-h4-size);
			font-weight: 700;
			letter-spacing: -0.01em;
			text-transform: capitalize;
			white-space: nowrap;
		}

		.segmented {
			display: inline-flex;
			gap: 2px;
			padding: 3px;
			border-radius: var(--cc-radius);
			background: var(--uui-color-surface-alt);
			border: 1px solid var(--content-calendar-grid-line-color);
		}

		.segmented button {
			display: inline-flex;
			align-items: center;
			gap: var(--uui-size-space-2);
			min-height: 28px;
			padding: 5px var(--uui-size-space-4);
			border: 0;
			border-radius: 6px;
			background: transparent;
			color: var(--uui-color-text-alt);
			font: inherit;
			font-size: var(--uui-type-small-size);
			font-weight: 600;
			cursor: pointer;
			transition:
				background-color 120ms ease,
				color 120ms ease,
				box-shadow 120ms ease;
		}

		.segmented button:hover {
			color: var(--uui-color-text);
			background: color-mix(in srgb, var(--uui-color-text) 6%, transparent);
		}

		/* Pressed: raised surface, outline and bold text, so the state never depends on colour alone. */
		.segmented button[aria-pressed='true'] {
			background: var(--uui-color-surface);
			color: var(--uui-color-text);
			font-weight: 700;
			box-shadow:
				0 1px 2px rgb(0 0 0 / 12%),
				0 0 0 1px var(--content-calendar-grid-line-color);
		}

		.segmented button:focus-visible {
			outline: 2px solid var(--uui-color-focus);
			outline-offset: 1px;
		}

		@media (max-width: 720px) {
			.segmented button span {
				display: none;
			}
		}

		/* ---------- State tiles (legend + summary + filter) ---------- */

		/* Styled after the cards of Umbraco's welcome dashboard (umb-news-card): white, 16px corners. */
		.cc-tiles {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
			gap: var(--uui-size-space-5);
			margin-bottom: var(--uui-size-space-5);
		}

		.cc-tile {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			min-width: 0;
			box-sizing: border-box;
			/* umb-news-card uses layout-2 (30px); a bit less on the sides so five cards fit in a row. */
			padding: var(--uui-size-space-6) var(--uui-size-space-5);
			/* The cards sit on the white dashboard box, so a standard border marks their edge. */
			border: 1px solid var(--uui-color-border);
			border-radius: 16px;
			background: var(--uui-color-surface);
			color: var(--uui-color-text);
		}

		/* Title as the card title (uui-h4, regular weight), with the state icon in the state colour as the legend. */
		.cc-tile-name {
			display: flex;
			align-items: baseline;
			gap: var(--uui-size-space-3);
			max-width: 100%;
			margin: 0 0 var(--uui-size-space-3);
			font-size: var(--uui-type-h4-size, 21px);
			font-weight: 400;
			line-height: 1.35;
		}

		.cc-tile-name umb-icon {
			flex: none;
			align-self: flex-start;
			margin-top: 0.2em;
			font-size: 0.85em;
			color: color-mix(in srgb, var(--cc-kind) 75%, var(--uui-color-text));
		}

		/* Long state names wrap rather than being cut off. */
		.cc-tile-label {
			min-width: 0;
			overflow-wrap: anywhere;
		}

		.cc-tile-text {
			margin: 0 0 var(--uui-size-space-5);
			line-height: 1.5;
		}

		.cc-tile-count {
			font-weight: 700;
			font-variant-numeric: tabular-nums;
		}

		/* The button stays at the bottom so the buttons line up when the texts wrap differently. */
		.cc-tile-toggle {
			margin-top: auto;
			white-space: nowrap;
		}

		/*
		 * Hidden: the card looks disabled (UUI disabled background, greyed text, dashed outline) while its button
		 * stays fully styled, because it is what shows the items again. The grey text still meets 4.5:1 (about
		 * 5.6:1); --uui-color-disabled-contrast would be too faint to read.
		 */
		.cc-tile.is-hidden {
			--cc-tile-disabled-text: color-mix(in srgb, var(--uui-color-text) 62%, var(--uui-color-disabled));
			border: 1px dashed var(--uui-color-border-emphasis);
			background: var(--uui-color-disabled);
			color: var(--cc-tile-disabled-text);
		}

		.cc-tile.is-hidden .cc-tile-name umb-icon {
			color: var(--cc-tile-disabled-text);
		}

		.cc-tile.is-hidden .cc-tile-count {
			font-weight: 400;
		}

		.cc-tile.is-hidden .cc-tile-toggle {
			--uui-button-background-color: var(--uui-color-surface);
			--uui-button-background-color-hover: var(--uui-color-surface-emphasis);
		}
		/* ---------- Status / empty states ---------- */

		.status {
			min-height: 4px;
			margin-bottom: var(--uui-size-space-3);
		}

		.message {
			display: flex;
			align-items: center;
			gap: var(--uui-size-space-3);
			padding: var(--uui-size-space-3) var(--uui-size-space-4);
			border-radius: var(--cc-radius);
			margin-top: var(--uui-size-space-2);
		}

		.message.empty {
			flex-direction: column;
			justify-content: center;
			padding: var(--uui-size-space-5);
			border: 1px dashed var(--content-calendar-grid-line-color);
			background: transparent;
			color: var(--uui-color-text-alt);
			text-align: center;
		}

		.message-icon {
			display: grid;
			place-items: center;
			width: 2.75rem;
			height: 2.75rem;
			border-radius: 50%;
			background: var(--uui-color-surface-alt);
			color: var(--uui-color-text-alt);
			font-size: 1.25rem;
		}

		.message.warning {
			background: var(--uui-color-warning);
			color: var(--uui-color-warning-contrast);
		}

		.message.error {
			background: var(--uui-color-danger);
			color: var(--uui-color-danger-contrast);
		}

		/* ---------- Calendar frame ---------- */

		#calendar {
			background: var(--uui-color-surface);
			color: var(--uui-color-text);
			font-family: var(--uui-font-family, inherit);
			--fc-now-indicator-color: var(--uui-color-danger);
			--fc-list-event-hover-bg-color: var(--uui-color-surface-alt);
		}

		.calendar-wrap {
			position: relative;
			transition: opacity 120ms ease-in-out;
		}

		.calendar-wrap.is-loading {
			opacity: 0.6;
		}

		#calendar .fc-scrollgrid,
		#calendar .fc-list {
			border-radius: var(--cc-radius);
			overflow: hidden;
		}

		/* Column headers as in uui-table-head (bold, sentence case, only a line underneath), centred over the columns. */
		#calendar .fc-col-header th {
			background: var(--uui-color-surface);
			text-align: center;
			vertical-align: middle;
		}

		#calendar .fc-col-header th:not(:first-child) {
			border-left-color: transparent;
		}

		#calendar .fc-col-header th:not(:last-child) {
			border-right-color: transparent;
		}

		#calendar .fc-col-header-cell-cushion {
			display: block;
			box-sizing: border-box;
			min-height: var(--uui-size-12);
			padding: var(--uui-size-3) var(--uui-size-5);
			color: var(--uui-color-text);
			font-weight: 700;
			line-height: calc(var(--uui-size-12) - 2 * var(--uui-size-3));
			text-decoration: none;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		/* ---------- Month ---------- */

		#calendar .fc-daygrid-day.fc-day-today {
			background-color: transparent;
		}

		#calendar .fc-daygrid-day.cc-weekend {
			background-color: color-mix(in srgb, var(--uui-color-surface-alt) 45%, var(--uui-color-surface));
		}

		#calendar .fc-daygrid-day.fc-day-other {
			background-color: var(--uui-color-surface-alt);
		}

		#calendar .fc-daygrid-day-frame {
			position: relative;
			min-height: 7.5rem;
			display: flex;
			flex-direction: column;
		}

		#calendar .fc-daygrid-day-number {
			display: inline-grid;
			place-items: center;
			min-width: 1.75rem;
			height: 1.75rem;
			margin: var(--uui-size-space-1);
			padding: 0 0.35rem;
			box-sizing: border-box;
			border-radius: 999px;
			color: var(--uui-color-text);
			font-size: var(--uui-type-small-size);
			font-weight: 600;
			font-variant-numeric: tabular-nums;
			text-decoration: none;
		}

		/* FullCalendar fades the whole day header of other-month days to 30% opacity; use a readable colour instead. */
		#calendar .fc-day-other .fc-daygrid-day-top {
			opacity: 1;
		}

		#calendar .fc-day-other .fc-daygrid-day-number {
			/* About 5:1 on the shaded other-month background in both themes. */
			color: color-mix(in srgb, var(--uui-color-text-alt) 70%, var(--uui-color-surface-alt));
			font-weight: 400;
		}

		#calendar .fc-day-today .fc-daygrid-day-number {
			background: var(--uui-color-selected);
			color: var(--uui-color-selected-contrast);
			font-weight: 700;
		}

		#calendar .fc-daygrid-day-events,
		#calendar .fc-daygrid-day-bg {
			display: none;
		}

		.cc-day {
			container-type: inline-size;
			display: flex;
			flex-direction: column;
			gap: var(--uui-size-space-1);
			padding: 0 var(--uui-size-space-2) var(--uui-size-space-2);
			min-width: 0;
		}

		/* Per-state dots next to the day number (top-left; the number sits top-right). */
		.cc-dots {
			display: flex;
			align-items: center;
			gap: 4px;
		}

		.cc-day .cc-dots {
			position: absolute;
			top: calc(var(--uui-size-space-1) + 0.875rem - 4px);
			left: var(--uui-size-space-3);
		}

		.cc-dot-item {
			display: inline-flex;
			align-items: center;
			gap: 3px;
		}

		.cc-dot {
			display: block;
			width: 8px;
			height: 8px;
			box-sizing: border-box;
			border-radius: 50%;
			background: var(--cc-kind);
		}

		.cc-unpublish .cc-dot {
			background: transparent;
			border: 2px solid var(--cc-kind);
		}

		.cc-dots.with-numbers {
			gap: var(--uui-size-space-2);
		}

		.cc-dot-count {
			color: var(--uui-color-text-alt);
			font-size: var(--uui-type-small-size);
			font-weight: 600;
			font-variant-numeric: tabular-nums;
		}

		.cc-dot-icon {
			color: color-mix(in srgb, var(--cc-kind) 75%, var(--uui-color-text));
			font-size: 0.875rem;
		}

		.tag-content {
			display: inline-flex;
			align-items: center;
			gap: var(--uui-size-space-1);
		}

		.cc-chips {
			list-style: none;
			margin: 0;
			padding: 0;
			display: flex;
			flex-direction: column;
			gap: 3px;
			min-width: 0;
		}

		/* Tinted chip with an accent bar in the state colour; text keeps the normal colour for contrast. */
		.cc-chip {
			--cc-chip-bg: color-mix(in srgb, var(--cc-kind) var(--cc-tint, 14%), var(--uui-color-surface));
			position: relative;
			display: flex;
			align-items: center;
			gap: var(--uui-size-space-1);
			min-width: 0;
			/* WCAG 2.5.8 target size. */
			min-height: 24px;
			box-sizing: border-box;
			padding: 3px var(--uui-size-space-2) 3px calc(var(--uui-size-space-2) + 3px);
			border-radius: 6px;
			background: var(--cc-chip-bg);
			color: var(--uui-color-text);
			font-size: var(--uui-type-small-size);
			line-height: 1.4;
			text-decoration: none;
			transition: background-color 120ms ease;
		}

		.cc-chip::before {
			content: '';
			position: absolute;
			inset: 3px auto 3px 3px;
			width: 3px;
			border-radius: 3px;
			background: var(--cc-kind);
		}

		.cc-chip.cc-unpublish::before {
			background: repeating-linear-gradient(to bottom, var(--cc-kind) 0 3px, transparent 3px 5px);
		}

		.cc-chip:hover {
			--cc-chip-bg: color-mix(in srgb, var(--cc-kind) 24%, var(--uui-color-surface));
		}

		.cc-chip:focus-visible {
			outline: 2px solid var(--uui-color-focus);
			outline-offset: 1px;
		}

		.cc-chip umb-icon {
			flex: none;
		}

		.cc-chip-type {
			margin-left: 2px;
		}

		/* The state as an icon too, so chips do not rely on colour alone (WCAG 1.4.1). */
		.cc-chip-state {
			font-size: 0.85em;
			color: color-mix(in srgb, var(--cc-kind) 75%, var(--uui-color-text));
		}

		.cc-chip-name {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 500;
		}

		/* Deleted items get a solid background so they stand out from everything that still exists. */
		.cc-chip.cc-deleted {
			--cc-chip-bg: var(--content-calendar-deleted-color);
			color: #fff;
		}

		.cc-chip.cc-deleted:hover {
			--cc-chip-bg: color-mix(in srgb, var(--content-calendar-deleted-color) 85%, #000);
		}

		.cc-chip.cc-deleted::before {
			background: color-mix(in srgb, var(--content-calendar-deleted-color) 55%, #000);
		}

		.cc-chip.cc-deleted umb-icon {
			--uui-icon-color: currentColor !important;
			color: inherit;
		}

		.cc-chip.cc-deleted .cc-chip-name {
			text-decoration: line-through;
		}

		.cc-chip.cc-deleted .cc-chip-time,
		.cc-chip.cc-deleted .cc-chip-culture {
			color: inherit;
			opacity: 0.9;
		}

		.cc-chip.cc-deleted .cc-chip-culture {
			background: rgb(255 255 255 / 20%);
		}

		.cc-chip-culture {
			flex: none;
			padding: 0 4px;
			border-radius: 4px;
			background: color-mix(in srgb, var(--uui-color-text) 8%, transparent);
			color: var(--uui-color-text-alt);
			font-size: 0.8em;
		}

		.cc-chip-time {
			flex: none;
			color: var(--uui-color-text-alt);
			font-size: 0.85em;
			font-variant-numeric: tabular-nums;
		}

		@container (max-width: 180px) {
			.cc-chip-time {
				display: none;
			}
		}

		.cc-more {
			align-self: flex-start;
			min-height: 24px;
			padding: 1px var(--uui-size-space-2);
			border: 0;
			border-radius: 6px;
			background: transparent;
			color: var(--uui-color-interactive);
			font: inherit;
			font-size: var(--uui-type-small-size);
			font-weight: 600;
			cursor: pointer;
		}

		.cc-more:hover {
			background: var(--uui-color-surface-alt);
			color: var(--uui-color-interactive-emphasis);
		}

		.cc-more:focus-visible {
			outline: 2px solid var(--uui-color-focus);
			outline-offset: 1px;
		}

		/* ---------- Skeleton ---------- */

		.cc-skeleton {
			display: flex;
			flex-direction: column;
			gap: 4px;
			padding-top: 2px;
		}

		.cc-skeleton-bar {
			display: block;
			height: 0.9rem;
			border-radius: 6px;
			background: linear-gradient(
				90deg,
				var(--uui-color-surface-alt) 0%,
				color-mix(in srgb, var(--uui-color-surface-alt) 40%, var(--uui-color-surface)) 50%,
				var(--uui-color-surface-alt) 100%
			);
			background-size: 200% 100%;
			animation: cc-shimmer 1.4s ease-in-out infinite;
		}

		@keyframes cc-shimmer {
			from {
				background-position: 100% 0;
			}
			to {
				background-position: -100% 0;
			}
		}

		.cc-list-skeleton {
			display: flex;
			flex-direction: column;
			gap: var(--uui-size-space-4);
			padding: var(--uui-size-space-4);
			border: 1px solid var(--content-calendar-grid-line-color);
			border-radius: var(--cc-radius);
			margin-bottom: var(--uui-size-space-3);
		}

		.cc-list-skeleton-row {
			display: flex;
			gap: var(--uui-size-space-4);
		}

		.calendar-wrap.is-skeleton.view-list #calendar {
			display: none;
		}

		@media (prefers-reduced-motion: reduce) {
			.cc-skeleton-bar {
				animation: none;
			}
			.cc-chip,
			.segmented button,
			.calendar-wrap {
				transition: none;
			}
		}

		/* ---------- Week / Day (time grid) ---------- */

		#calendar .fc-timegrid-slot-label-cushion,
		#calendar .fc-timegrid-axis-cushion {
			color: var(--uui-color-text-alt);
			font-size: var(--uui-type-small-size);
		}

		#calendar .fc-timegrid-slot {
			height: 1.75em;
		}

		/* Hour lines are a reading aid only (the axis has the times), so they stay lighter than the grid. */
		#calendar .fc-timegrid-slot-lane,
		#calendar .fc-timegrid-slot-label {
			border-color: var(--content-calendar-grid-line-color);
		}

		#calendar .fc-timegrid-slot-minor {
			border-top-style: none;
		}

		.view-week #calendar .fc-timegrid-col.fc-day-today {
			background: color-mix(in srgb, var(--uui-color-selected) 4%, transparent);
		}

		#calendar .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion {
			color: var(--uui-color-selected);
		}

		.cc-head {
			display: flex;
			align-items: center;
			justify-content: center;
			flex-wrap: wrap;
			gap: var(--uui-size-space-2);
			margin-top: calc(-1 * var(--uui-size-2));
			padding: 0 var(--uui-size-5) var(--uui-size-3);
		}

		.cc-head-all {
			font-size: var(--uui-type-small-size);
		}

		#calendar .fc-timegrid-event.cc-event {
			background: transparent;
			border: 0;
			box-shadow: none;
			text-decoration: none;
		}

		/* The event is the link in the time grid; show focus on it instead of FullCalendar's dark overlay. */
		#calendar .fc-timegrid-event.cc-event:focus {
			box-shadow: none;
		}

		#calendar .fc-timegrid-event.cc-event:focus::after {
			display: none;
		}

		#calendar .fc-timegrid-event.cc-event:focus-visible {
			outline: 2px solid var(--uui-color-focus);
			outline-offset: 1px;
			z-index: 5;
		}

		#calendar .fc-timegrid-event.cc-event:hover .cc-chip:not(.cc-deleted) {
			--cc-chip-bg: color-mix(in srgb, var(--cc-kind) 24%, var(--uui-color-surface));
		}

		#calendar .fc-timegrid-event .fc-event-main {
			padding: 0;
			color: var(--uui-color-text);
		}

		.cc-event-content {
			container-type: inline-size;
			height: 100%;
			min-width: 0;
		}

		.cc-event-content > .cc-chip {
			box-sizing: border-box;
			height: 100%;
			align-items: flex-start;
			box-shadow: 0 0 0 1px var(--uui-color-surface);
		}

		/* The time axis already shows when it happens. */
		.cc-event-content .cc-chip-time {
			display: none;
		}

		#calendar .fc-timegrid-more-link {
			min-height: 24px;
			box-sizing: border-box;
			background: var(--uui-color-surface);
			border: 1px solid var(--content-calendar-grid-line-color);
			border-radius: 6px;
			color: var(--uui-color-interactive);
			font-size: var(--uui-type-small-size);
			font-weight: 700;
			box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
		}

		#calendar .fc-timegrid-more-link:hover {
			background: var(--uui-color-surface-alt);
			color: var(--uui-color-interactive-emphasis);
		}

		#calendar .fc-more-link:focus-visible {
			outline: 2px solid var(--uui-color-focus);
			outline-offset: 1px;
		}

		/* ---------- List ---------- */

		#calendar .fc-list-day-cushion {
			padding: var(--uui-size-space-3) var(--uui-size-space-4);
			background: var(--uui-color-surface-alt);
		}

		#calendar .fc-list-day-text,
		#calendar .fc-list-day-side-text {
			color: var(--uui-color-text);
			font-weight: 700;
			text-decoration: none;
			text-transform: capitalize;
		}

		#calendar .fc-list-day-side-text {
			color: var(--uui-color-text-alt);
			font-weight: 400;
		}

		#calendar .fc-list-event td {
			padding: var(--uui-size-space-3) var(--uui-size-space-4);
			vertical-align: middle;
		}

		#calendar .fc-list-event-time {
			color: var(--uui-color-text-alt);
			font-variant-numeric: tabular-nums;
			white-space: nowrap;
		}

		/* The dot becomes a short vertical bar in the state colour. */
		#calendar .fc-list-event-graphic {
			padding-left: 0;
			padding-right: 0;
		}

		#calendar .fc-list-event.cc-event .fc-list-event-dot {
			display: block;
			width: 4px;
			height: 1.25rem;
			border: 0;
			border-radius: 2px;
			background: var(--cc-kind);
		}

		#calendar .fc-list-event.cc-unpublish .fc-list-event-dot {
			background: repeating-linear-gradient(to bottom, var(--cc-kind) 0 3px, transparent 3px 5px);
		}

		#calendar .fc-list-event.cc-deleted .cc-list-name {
			text-decoration: line-through;
		}

		/* The status area explains an empty range, so hide FullCalendar's own (empty) placeholder. */
		#calendar .fc-list-empty {
			display: none;
		}

		#calendar .fc-list:has(.fc-list-empty) {
			border: 0;
		}

		.cc-list-item {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: var(--uui-size-space-3);
			min-width: 0;
		}

		.cc-list-link {
			display: inline-flex;
			align-items: center;
			gap: var(--uui-size-space-2);
			min-width: 0;
			color: var(--uui-color-text);
			font-weight: 600;
			text-decoration: none;
		}

		.cc-list-link:hover {
			color: var(--uui-color-interactive-emphasis);
			text-decoration: underline;
		}

		.cc-list-link:focus-visible {
			outline: 2px solid var(--uui-color-focus);
			outline-offset: 1px;
		}

		.cc-list-type {
			color: var(--uui-color-text-alt);
			font-size: var(--uui-type-small-size);
		}

		.cc-list-kind {
			margin-left: auto;
			font-size: var(--uui-type-small-size);
		}

		/* ---------- Hover card ---------- */

		.cc-hovercard {
			position: absolute;
			z-index: 10;
			box-sizing: border-box;
			display: flex;
			flex-direction: column;
			gap: var(--uui-size-space-2);
			padding: var(--uui-size-space-4);
			border: 1px solid var(--content-calendar-grid-line-color);
			border-top: 3px solid var(--cc-kind);
			border-radius: var(--cc-radius);
			background: var(--uui-color-surface);
			color: var(--uui-color-text);
			box-shadow:
				0 10px 24px rgb(0 0 0 / 14%),
				0 2px 6px rgb(0 0 0 / 8%);
			/* Hoverable (WCAG 1.4.13): the pointer can move onto the card without it disappearing. */
			pointer-events: auto;
			animation: cc-pop 120ms ease-out;
		}

		@keyframes cc-pop {
			from {
				opacity: 0;
				transform: translateY(2px);
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.cc-hovercard {
				animation: none;
			}
		}

		.cc-hovercard-head {
			display: flex;
			align-items: center;
			gap: var(--uui-size-space-2);
			min-width: 0;
		}

		.cc-hovercard-head umb-icon {
			flex: none;
			font-size: 1.1rem;
		}

		.cc-hovercard-name {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.cc-hovercard-meta,
		.cc-hovercard-hint {
			color: var(--uui-color-text-alt);
			font-size: var(--uui-type-small-size);
		}

		.cc-hovercard-state {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: var(--uui-size-space-1);
			font-size: var(--uui-type-small-size);
		}

		.cc-hovercard-hint {
			padding-top: var(--uui-size-space-2);
			border-top: 1px solid var(--uui-color-border);
		}

		.visually-hidden {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}

		/* ---------- Windows high contrast / forced colours ---------- */

		@media (forced-colors: active) {
			:host {
				--content-calendar-grid-line-color: CanvasText;
			}

			.cc-chip,
			.cc-tile,
			.cc-hovercard,
			#calendar .fc-timegrid-more-link {
				border: 1px solid CanvasText;
			}

			.cc-chip::before,
			.cc-dot,
			#calendar .fc-list-event.cc-event .fc-list-event-dot {
				forced-color-adjust: none;
				background: CanvasText;
			}

			.cc-unpublish .cc-dot {
				background: Canvas;
				border-color: CanvasText;
			}

			.cc-chip.cc-deleted {
				forced-color-adjust: auto;
			}

			#calendar .fc-day-today .fc-daygrid-day-number,
			.segmented button[aria-pressed='true'] {
				forced-color-adjust: none;
				background: Highlight;
				color: HighlightText;
				border-color: Highlight;
			}

			.cc-tile.is-hidden {
				border: 1px dashed GrayText;
				color: GrayText;
			}

			.cc-tile.is-hidden .cc-tile-name umb-icon {
				color: GrayText;
			}

			.cc-skeleton-bar {
				forced-color-adjust: none;
				background: GrayText;
			}
		}
	`,
];
