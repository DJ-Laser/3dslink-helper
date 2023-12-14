// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { createFilePicker } from './filePicker';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "3dslink-helper" is now active!');

	context.subscriptions.push(vscode.commands.registerCommand('3dslink-helper.send3dsx', async () => {
		const filepicker = createFilePicker("**/*.*");
		const options: { [key: string]: (context: vscode.ExtensionContext) => Promise<void> } = {
			"load 3dsx": filepicker
		};
		const quickPick = vscode.window.createQuickPick();
		quickPick.items = Object.keys(options).map(label => ({ label }));
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
				options[selection[0].label](context)
					.catch(console.error);
			}
		});
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
