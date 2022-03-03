/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, window, DecorationRangeBehavior, Range, Position, Disposable } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { KrkrNotificationType } from './notificationTypes/notificationType';

let client: LanguageClient;
const inactiveRegionsDecorations = new Map<string, Range[]>();
const inactiveRegionsDecorationType = window.createTextEditorDecorationType({
	opacity: 0.55.toString(), // cpp extension default opacity
	rangeBehavior: DecorationRangeBehavior.ClosedOpen
});
const disposables: Disposable[] = [];

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'krkr' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},
		
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	client.start();

	client.onReady().then(
		() => {
			client.onNotification(KrkrNotificationType.InactiveRegionNotification, (params) => {

				// let debugMsg = {
				// 	editors: [] as string[],
				// 	params: params
				// };
				// window.visibleTextEditors.forEach(e => debugMsg.editors.push(e.document.uri.toString()));
				// window.showInformationMessage(JSON.stringify(debugMsg));
				const vscodeRange = params.range.map(r => new Range(new Position(r.start.line, r.start.character), new Position(r.end.line, r.end.character)));
				inactiveRegionsDecorations.set(params.fileUri, vscodeRange);
				window.visibleTextEditors.filter(e => e.document.uri.toString() === params.fileUri).forEach(e => {
					e.setDecorations(inactiveRegionsDecorationType, vscodeRange);
				})
			});
		}
	);

	disposables.push(window.onDidChangeActiveTextEditor(e => {
		const valuePair = inactiveRegionsDecorations.get(e.document.uri.toString());
		if (valuePair) {
			e.setDecorations(inactiveRegionsDecorationType, valuePair);
		}
	}));
}


export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	disposables.forEach(d => d.dispose());
	return client.stop();
}
