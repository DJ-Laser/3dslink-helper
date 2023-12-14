/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as cp from 'child_process';
import { Uri, window, Disposable } from 'vscode';
import { QuickPickItem } from 'vscode';
import { workspace } from 'vscode';

/**
 * A file opener using window.createQuickPick().
 * 
 * It shows how the list of items can be dynamically updated based on
 * the user's input in the filter field.
 */
export async function quickOpen() {
	const uri = await pickFile();
	if (uri) {
		const document = await workspace.openTextDocument(uri);
		await window.showTextDocument(document);
	}
}

class FileItem implements QuickPickItem {

	label: string;
	description: string;

	constructor(public uri: Uri) {
		this.label = path.basename(uri.fsPath);
		this.description = path.dirname(uri.fsPath);
	}
}

export async function pickFile(): Promise<Uri | undefined> {
	const disposables: Disposable[] = [];

	try {
		return await new Promise<Uri | undefined>((resolve, reject) => {
			const input = window.createQuickPick<FileItem>();
			input.placeholder = 'Type to search for files';

			disposables.push(
				input.onDidChangeValue(async value => {
					input.busy = true;
					const items = (await workspace.findFiles("**/*.3dsx")).map(uri => new FileItem(uri));
					input.items = items ? items : [];
					input.busy = false;
				}),
				input.onDidChangeSelection(items => {
					const item = items[0];
					resolve(item.uri);
					input.hide();
				}),
				input.onDidHide(() => {
					resolve(undefined);
					input.dispose();
				})
			);

			input.show();
		});
	} finally {
		disposables.forEach(d => d.dispose());
	}
}
