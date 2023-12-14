/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as cp from 'child_process';
import { Uri, window, Disposable, GlobPattern } from 'vscode';
import { QuickPickItem } from 'vscode';
import { workspace } from 'vscode';

class FileItem implements QuickPickItem {

	label: string;
	description: string;

	constructor(public uri: Uri) {
		this.label = path.basename(uri.fsPath);
		this.description = path.dirname(uri.fsPath);
	}
}

export function createFilePicker(pattern: GlobPattern) {
	return async () => {
		await pickFile(pattern);
	};
}

export async function pickFile(pattern: GlobPattern): Promise<Uri | undefined> {
	const disposables: Disposable[] = [];

	try {
		return await new Promise<Uri | undefined>(async (resolve, reject) => {
			const input = window.createQuickPick<FileItem>();
			input.placeholder = 'Type to search for files';
			input.busy = true;
			const items = (await workspace.findFiles(pattern)).map(uri => new FileItem(uri));

			if (items.length === 0) {
				return;
			}

			input.items = items;
			input.busy = false;

			disposables.push(
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
