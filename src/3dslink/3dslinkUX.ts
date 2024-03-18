import { Uri, window, ProgressLocation } from "vscode";
import path from "path";

import { pickFile } from "../filePicker";
import { ThreeDSLinkHelper } from "../extension";
import { TransferOutcome, OutcomeType, ProgressFeedback, ThreeDSLinkSender } from "./I3dslink";
import { ThreeDSLinkFromCLI } from "./3dslinkFromCLI"; 

let ThreeDSLinkProvider: ThreeDSLinkSender = new ThreeDSLinkFromCLI;

/**
 * 
 */
export function set3dslinkProvder(provider: ThreeDSLinkSender) {
    ThreeDSLinkProvider = provider;
}

/**
 * open a quick pick menu containing all the 3dsx files in the workspace and get the users selection
 * @returns the uri of the file the user picked or undefined if none were selected
 */
export async function pick3dsx(): Promise<Uri | undefined> {
    // if the last file was saved, set that as the first item.
    let last3dsx = ThreeDSLinkHelper.getLastSent3dsx();
    let uri = await pickFile("**/*.3dsx", {
        placeholder: "Select a 3dsx file to run on your 3DS.",
        customOrder: last3dsx === undefined ? last3dsx : [last3dsx],
        orderDetail: ["(recently used)"]
    });

    ThreeDSLinkHelper.setLastSent3dsx(uri);
    return uri;
}

/**
 * Open a dialog box with the placeholder set to the last used ip address.
 * The last uded ip address will automatically be set to the returned value if it is not undefined.
 * Use {@link inputIp} if you don't want to modify the last used ip.
 * @param altPlaceholder a placeholder to use instead of the last used ip address
 * set this to an empty string for no placeholder
 * @returns a string with the ip address or undefined if the user cancelled the dialog
 * @see {@link inputIp}
 */
export async function smartInputIp(altPlaceholder?: string): Promise<string | undefined> {
    let placeholder = altPlaceholder?? "";
    let ip = await inputIp(placeholder);
    if (ip) { ThreeDSLinkHelper.setLastUsedIp(ip); }
    return ip;
}

/**
* Open a dialog box for the user to input an ipv4 address.
* Use {@link smartInputIp} to automatically set the placeholder to the last used ip
* and set the last used ip to the returned value.
* @param placeholderIp the ip that should be in the box by default
* @returns a string with the ip address or undefined if the user cancelled the dialog
* @see {@link smartInputIp}
*/
export async function inputIp(placeholderIp: string = ""): Promise<string | undefined> {
   // show an input for the 3ds ipv4 address
   return await window.showInputBox({
       value: placeholderIp,
       valueSelection: [0, placeholderIp.length],
       placeHolder: "Input the ip address displayed on the homebrew launcher",
       validateInput: text => {
           // Regex to match an ipv4 address
           return text.match(/^(?:(?:25[0-5]|(?:2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/) ? null : "Invalid ipv4 address.";
       }
   });
}

export async function send3dsxwithNotifications(uri: Uri, ipAddress?: string): Promise<boolean> {
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
        const outcome = await ThreeDSLinkProvider.send3dsxWithProgress(uri, feedback, ipAddress);

        return handle3dsxNotification(outcome, feedback, uri, ipAddress);
    });
}

async function handle3dsxNotification(outcome: TransferOutcome, feedback: ProgressFeedback, uri: Uri, ipAddress?: string): Promise<boolean> {
    const fileName = path.basename(uri.path);
    switch (outcome.status) {
        case OutcomeType.SUCCESS: {
            return true;
        }
        // could not automatically find 3ds
        case OutcomeType.NO_3DS_RESPONSE: {
            const newOutcome = await ThreeDSLinkProvider.send3dsxWithProgress(uri, feedback, await smartInputIp());
            return handle3dsxNotification(newOutcome, feedback, uri, ipAddress);
        }
        case OutcomeType.CONNECTION_TO_IP_FAILED: {
            if (ipAddress) {
                // ip was provided as argument, so it was a default ip
                // try again but let user select the ip
                return await send3dsxwithNotifications(uri, await smartInputIp());
            } else {
                return await show3dsxRetryMessage(uri, ipAddress);
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
        // user cancelled the transfer, do nothing
        case OutcomeType.CANECELED_BY_USER: {
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

async function show3dsxRetryMessage(uri: Uri, ip?: string | undefined) {
    // show notification letting the user decide whether to try another ip
    const result = await window.showWarningMessage(
        "Failed to connect to 3ds. It it connected to the network and in 3dsx loading mode?",
        "Retry", "Cancel"
    );
    if (result === "Retry") {
        // user wants to try again
        const newIp = await smartInputIp(ip);
        return await send3dsxwithNotifications(uri, newIp);
    } else {
        // user pressed cancel
        return false;
    }
}
