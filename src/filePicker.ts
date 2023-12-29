import * as path from "path";
import { Uri, window, Disposable, GlobPattern, QuickPickItem, workspace } from "vscode";



/**
 * Autogenerates a quick pick item from a file uri
 * @class FileItem
 * @implements {QuickPickItem}
 */
class FileItem implements QuickPickItem {

	label: string;
	detail: string;
	description?: string | undefined;

	constructor(public uri: Uri, descripton?: string) {
		this.label = path.basename(uri.fsPath);
		this.detail = path.dirname(uri.fsPath);
		this.description = descripton;
	}
}


/**
 * Value-object describing how a file picker
 */
interface FilePickerOptions {
	/**
	 * Placeholder text for the search bar
	 * Note this is the grayed out text and does not impact the search.
	 * To set initial search text, see {@link boxText}
	 */
	placeholder?: string,
	/**
	 * Initial text in the search box, this is actual text and impacts searching
	 */
	boxText?: string,
	/**
	 * A list of {@link Uri}s to be placed above the rest in the search list
	 * This order will only apply until anything is typed into the search box, in which case
	 * it will revert to the default order.
	 */
	customOrder?: Uri[]
	/**
	 * A list of detail strings for each custom ordered item. The index of the detail
	 * corresponds to the index of the {@link customOrder} list.
	 */
	orderDetail?: (string | undefined)[]
}

/**
 * Opens a quick pick menu to select a file
 * @export
 * @param pattern The {@link GlobPattern} used to search the workspace for files
 * @param options 
 * @returns The uri of the selected file, or undefined if none were selected
 */
export async function pickFile(pattern: GlobPattern, options: FilePickerOptions = {}): Promise<Uri | undefined> {
	const disposables: Disposable[] = [];

	try {
		return await new Promise<Uri | undefined>(async (resolve, reject) => {
			const input = window.createQuickPick<FileItem>();
			input.placeholder = options.placeholder;
			input.value = options.boxText ?? "";

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

			input.busy = true;
			input.show();

			let items = (await workspace.findFiles(pattern)).map(uri => new FileItem(uri));

			if (items.length === 0) {
				return;
			}

			options.customOrder = options.customOrder ?? [];
			options.orderDetail = options.orderDetail ?? [];
			const newItems: FileItem[] = [];
			for (const i in options.customOrder) {
				const item = options.customOrder[i];
				const detail = options.orderDetail[i];

				items = items.filter((value, index, array) => {
					console.log(value.uri.toString());
					if (value.uri.path === item.path) {
						const item = array[index];
						item.description = detail;
						newItems.push(item);
						return false;
					} else {
						return true;
					}
				});
			}
			
			input.items = newItems.concat(items.sort());
			input.busy = false;

		});
	} finally {
		disposables.forEach(d => d.dispose());
	}
}
