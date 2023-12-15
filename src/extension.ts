import { ExtensionContext, Uri, commands, window } from "vscode";
import * as cp from "child_process";

import { pickFile } from "./filePicker";

export function activate(context: ExtensionContext) {
	new ThreeDSLinkHelper(context);
}

class ThreeDSLinkHelper {
	constructor(private context: ExtensionContext) {
		this.registerCommand("3dslink-helper.send3dsxFromPalette", async () => {
			const uri = await this.pick3dsx();
			if (!uri) { return; }

			await this.send3dsx(uri);
		});
	}

	async send3dsx(uri: Uri, ipAddr?: string | undefined): Promise<boolean> {
		const ipArg = ipAddr ? "-a " + ipAddr : "";
		let processes: cp.ChildProcess[] = [];

		try {
			return await new Promise((resolve, reject) => {
				const process = cp.exec(`3dslink ${uri.path} ${ipArg}`, async (error, stdout, stderr) => {
					const output = stdout + stderr;

					if (false || output.includes("No response from 3DS!")) {
						console.log("could not auto find 3ds ip");

						const newIp = await this.inputIp(ipAddr);
						if (newIp) {
							resolve(await this.send3dsx(uri, newIp));
						} else {
							reject(false);
						}
					} else if (output.includes(`Connection to ${ipAddr} failed`)) {
						resolve(await this.show3dsxRetryMessage(uri, ipAddr));
					} else {
						resolve(true);
					}
				});
				processes.push(process);
			});
		} finally {
			for (const process of processes) {
				process.kill();
			}
		}
	}

	async show3dsxRetryMessage(uri: Uri, ip?: string | undefined) {
		const result = await window.showInformationMessage(
			"Failed to connect to 3ds. It it connected to the network and in .3dsx loading mode?",
			"Retry", "Cancel"
		);
		if (result === "Retry") {
			const newIp = await this.inputIp(ip);
			return await this.send3dsx(uri, newIp);
		} else {
			return false;
		}
	}

	async pick3dsx(): Promise<Uri | undefined> {
		return await pickFile("**/*.3dsx", "Select a .3dsx file to run.");
	}

	async inputIp(ip: string = ""): Promise<string | undefined> {
		return await window.showInputBox({
			value: ip,
			valueSelection: [0, ip.length],
			placeHolder: "Input the ip address displayed on your 3DS",
			validateInput: text => {
				// Regex to match an ipv4 address
				return text.match(/^(?:(?:25[0-5]|(?:2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/) ? null : "Invalid ipv4 address.";
			}
		});
	}

	registerCommand(name: string, command: (...args: any[]) => any) {
		this.context.subscriptions.push(commands.registerCommand(name, command));
	}
}