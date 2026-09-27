import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UMB_DOCUMENT_ENTITY_TYPE } from '@umbraco-cms/backoffice/document';
import { UmbModalRouteRegistrationController } from '@umbraco-cms/backoffice/router';
import { UMB_WORKSPACE_MODAL } from '@umbraco-cms/backoffice/workspace';

/**
 * Registers the document workspace as a routed sidebar modal on `host`: the same "infinite editing" the
 * content picker uses. Links built from the reported base path (see `getEntryEditPath`) open the editor
 * in a drawer on top of the current view instead of navigating away, and the browser back button closes it.
 *
 * `onPath` receives the modal's base path, or `undefined` while the host is not inside a routable context.
 * `onOpen` runs when the drawer opens, `onClose` whenever it closes (saved or not).
 */
export function registerDocumentWorkspaceModal(
	host: UmbControllerHost,
	onPath: (basePath: string | undefined) => void,
	onClose?: () => void,
	onOpen?: () => void,
): UmbModalRouteRegistrationController<typeof UMB_WORKSPACE_MODAL.DATA, typeof UMB_WORKSPACE_MODAL.VALUE> {
	return new UmbModalRouteRegistrationController(host, UMB_WORKSPACE_MODAL)
		.onSetup(() => {
			onOpen?.();
			return { data: { entityType: UMB_DOCUMENT_ENTITY_TYPE, preset: {} } };
		})
		.onSubmit(() => onClose?.())
		.onReject(() => onClose?.())
		.observeRouteBuilder((routeBuilder) => {
			const path = routeBuilder({});
			onPath(path ? path.replace(/\/+$/, '') : undefined);
		});
}
