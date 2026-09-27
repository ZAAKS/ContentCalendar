import {
	CONTENT_CALENDAR_DASHBOARD_ALIAS,
	CONTENT_CALENDAR_DAY_OVERFLOW_MODAL_ALIAS,
	CONTENT_CALENDAR_DOCUMENT_COLLECTION_VIEW_ALIAS,
} from './constants.js';

/**
 * Every extension the Content Calendar registers. Exported as `manifests` from the bundle entry
 * (`content-calendar.js`), which `umbraco-package.json` declares as a single `bundle` extension.
 */
export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'backofficeEntryPoint',
		alias: 'ContentCalendar.EntryPoint',
		name: 'Content Calendar Entry Point',
		js: () => import('./entrypoint/entrypoint.js'),
	},
	{
		type: 'localization',
		alias: 'ContentCalendar.Localization.En',
		name: 'Content Calendar English',
		meta: {
			culture: 'en',
		},
		js: () => import('./localization/en.js'),
	},
	{
		type: 'dashboard',
		alias: CONTENT_CALENDAR_DASHBOARD_ALIAS,
		name: 'Content Calendar Dashboard',
		weight: 20,
		element: () => import('./dashboard/content-calendar-dashboard.element.js'),
		meta: {
			label: '#contentCalendar_dashboardLabel',
			pathname: 'content-calendar',
		},
		conditions: [
			{
				alias: 'Umb.Condition.SectionAlias',
				match: 'Umb.Section.Content',
			},
		],
	},
	{
		type: 'collectionView',
		alias: CONTENT_CALENDAR_DOCUMENT_COLLECTION_VIEW_ALIAS,
		// Also the default layout name when picked under a Collection data type's Layouts.
		name: 'Content Calendar',
		element: () => import('./collection-view/content-calendar-collection-view.element.js'),
		// After core's Table (300) and Grid (200) views.
		weight: 100,
		meta: {
			// Collection view labels are shown as-is (not localized) by the view switcher.
			label: 'Calendar',
			icon: 'icon-calendar',
			pathName: 'calendar',
		},
		conditions: [
			{
				alias: 'Umb.Condition.CollectionAlias',
				match: 'Umb.Collection.Document',
			},
		],
	},
	{
		type: 'modal',
		alias: CONTENT_CALENDAR_DAY_OVERFLOW_MODAL_ALIAS,
		name: 'Content Calendar Day Overflow Modal',
		element: () => import('./overflow-modal/day-overflow-modal.element.js'),
	},
];
