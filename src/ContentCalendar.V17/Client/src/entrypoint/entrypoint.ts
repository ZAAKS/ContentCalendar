import type { UmbEntryPointOnInit, UmbEntryPointOnUnload } from '@umbraco-cms/backoffice/extension-api';
import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';
import { client } from '../api/client.gen.js';

/**
 * Wires the generated Content Calendar API client into the backoffice auth context
 * (base URL, credentials, token refresh and the default response interceptors).
 * The framework awaits onInit, so the client is configured before any calendar element uses it.
 */
export const onInit: UmbEntryPointOnInit = async (host) => {
	const authContext = await host.getContext(UMB_AUTH_CONTEXT);
	authContext?.configureClient(client);
};

export const onUnload: UmbEntryPointOnUnload = () => {};
