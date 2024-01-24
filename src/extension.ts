import { ExtensionContext, Uri, commands } from "vscode";
import { send3dsxwithNotifications, pick3dsx } from "./3dslinkUX";

export function activate(context: ExtensionContext) {
	ThreeDSLinkHelper.init(context);
}

export class ThreeDSLinkHelper {
	private static context: ExtensionContext;

	static init(context: ExtensionContext) {
		this.registerCommand("3dslink-helper.send3dsxFromPalette", async () => {
			const uri = await pick3dsx();
			if (uri) {
				await send3dsxwithNotifications(uri, this.getGlobalState<string>("lastUsedIp"));
			}
		});

		this.registerCommand("3dslink-helper.send3dsxFromMenu", async (uri: Uri) => {
			await send3dsxwithNotifications(uri, this.getGlobalState<string>("lastUsedIp"));
		});
	}

	public static getLastSent3dsx(): Uri | undefined {
		return this.getWorkspaceState<Uri>("last3dsx");
	}

	public static setLastSent3dsx(uri: Uri | undefined): void {
		this.setWorkspaceState<Uri>("last3dsx", uri);
	}

	public static getLastUsedIp(): string | undefined {
		return this.getGlobalState<string>("last3dsx");
	}

	public static setLastUsedIp(ip: string | undefined): void {
		this.setGlobalState<string>("last3dsx", ip);
	}

	/*
		Internal functions
	*/

	private static getWorkspaceState<T>(key: string): T | undefined {
		const item = this.context.workspaceState.get(key);
		return (item as T);
	}

	private static setWorkspaceState<T>(key: string, value: T | undefined) {
		return this.context.workspaceState.update(key, value);
	}

	private static getGlobalState<T>(key: string): T | undefined {
		const item = this.context.globalState.get(key);
		return (item as T);
	}

	private static setGlobalState<T>(key: string, value: T | undefined) {
		return this.context.globalState.update(key, value);
	}

	private static registerCommand(name: string, command: (...args: any[]) => any) {
		this.context.subscriptions.push(commands.registerCommand(name, command));
	}
}