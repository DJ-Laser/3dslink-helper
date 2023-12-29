import { ExtensionContext, Uri, commands, window, ProgressLocation, Progress, CancellationToken } from "vscode";
import path from "path";

import { pickFile } from "./filePicker";
import { send3dsx, TransferOutcome, OutcomeType, send3dsxWithProgress, ProgressFeedback } from "./3dslink";

export function activate(context: ExtensionContext) {
	new ThreeDSLinkHelper(context);
}

class ThreeDSLinkHelper {
	constructor(private context: ExtensionContext) {


		this.registerCommand("3dslink-helper.send3dsxFromPalette", async () => {
			const uri = await this.pick3dsx();
			if (uri) {
				await this.send3dsx(uri, this.getGlobalState<string>("lastUsedIp"));
			}
		});

		this.registerCommand("3dslink-helper.send3dsxFromMenu", async (uri: Uri) => {
			await this.send3dsx(uri, this.getGlobalState<string>("lastUsedIp"));
		});
	}

	async send3dsx(uri: Uri, ipAddress?: string): Promise<boolean> {
		const fileName = path.basename(uri.path);
		// show a progress notification, with busy indicator and progress bar for large files
		return await window.withProgress({
			location: ProgressLocation.Notification,
			title: `Preparing to send ${fileName}`
		}, async (progress, token) => {
			const feedback = {
				progress: progress,
				token: token
			};
			const outcome = await send3dsxWithProgress(uri, feedback, ipAddress);

			return this.handle3dsxNotification(outcome, feedback, uri, ipAddress);
		});
	}

	async handle3dsxNotification(outcome: TransferOutcome, feedback: ProgressFeedback, uri: Uri, ipAddress?: string): Promise<boolean> {
		const fileName = path.basename(uri.path);
		switch (outcome.status) {
			case OutcomeType.SUCCESS: {
				// set sent file as first in list for next time
				this.setWorkspaceState("last3dsx", uri);
				return true;
			}
			case OutcomeType.NO_3DS_RESPONSE: {
				const newOutcome = await send3dsxWithProgress(uri, feedback, await this.inputIp());
				return this.handle3dsxNotification(newOutcome, feedback, uri, ipAddress);
			}
			case OutcomeType.CONNECTION_TO_IP_FAILED: {
				if (ipAddress) {
					// ip was provided as argument, so it was a default ip
					// try again but let user select the ip
					return await this.send3dsx(uri, await this.inputIp());
				} else {
					return await this.show3dsxRetryMessage(uri, ipAddress);
				}
			}
			case OutcomeType.COMMAND_NOT_FOUND: {
				window.showErrorMessage("3dslink command not found. is devkitARM for 3DS installed?");
				break;
			}
			case OutcomeType.FILE_NOT_ACCESSIBLE: {
				window.showErrorMessage(
					`3dslink process failed to open ${uri.fsPath}.
					Does it still exist?`
				);
				break;
			}
			case OutcomeType.PROCESS_KILLED: {
				window.showErrorMessage("3dslink process killed with signal " + outcome.signal);
				break;
			}
			case OutcomeType.UNKNOWN_ERROR: {
				window.showErrorMessage(
					`Error sending ${fileName}. 3dslink exited with error code
					${outcome.exitCode}${outcome.errorMessage ? ":" : ""} ${outcome.errorMessage}`
				);
				break;
			}
		}
		return false;
	}

	async show3dsxRetryMessage(uri: Uri, ip?: string | undefined) {
		// show notification letting the user decide whether to try another ip
		const result = await window.showWarningMessage(
			"Failed to connect to 3ds. It it connected to the network and in 3dsx loading mode?",
			"Retry", "Cancel"
		);
		if (result === "Retry") {
			// user wants to try again
			const newIp = await this.inputIp(ip);
			return await this.send3dsx(uri, newIp);
		} else {
			// user pressed cancel
			return false;
		}
	}

	async pick3dsx(): Promise<Uri | undefined> {
		// if the last file was saved, set that as the first item.
		let last3dsx = this.getWorkspaceState<Uri>("last3dsx");
		return await pickFile("**/*.3dsx", {
			placeholder: "Select a 3dsx file to run on your 3DS.",
			customOrder: last3dsx === undefined ? last3dsx : [last3dsx],
			orderDetail: ["(recently used)"]
		});
	}

	async inputIp(ip: string = ""): Promise<string | undefined> {
		// show an input for the 3ds ipv4 address
		return await window.showInputBox({
			value: ip,
			valueSelection: [0, ip.length],
			placeHolder: "Input the ip address displayed on the homebrew launcher",
			validateInput: text => {
				// Regex to match an ipv4 address
				return text.match(/^(?:(?:25[0-5]|(?:2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/) ? null : "Invalid ipv4 address.";
			}
		});
	}

	getWorkspaceState<T>(key: string): T | undefined {
		const item = this.context.workspaceState.get(key);
		return (item as T);
	}

	setWorkspaceState<T>(key: string, value: T) {
		return this.context.workspaceState.update(key, value);
	}

	getGlobalState<T>(key: string): T | undefined {
		const item = this.context.globalState.get(key);
		return (item as T);
	}

	setGlobalState<T>(key: string, value: T) {
		return this.context.globalState.update(key, value);
	}

	registerCommand(name: string, command: (...args: any[]) => any) {
		this.context.subscriptions.push(commands.registerCommand(name, command));
	}
}