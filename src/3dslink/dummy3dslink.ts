import { RelativePattern, Uri, workspace } from "vscode";
import fs from "fs/promises";

import { TransferOutcome, OutcomeType, ProgressFeedback, ThreeDSLinkSender } from "./I3dslink";

class Dummy3dslink implements ThreeDSLinkSender {
    /**
     * Specifies whether the dummy can "find" the 3ds without an ip address
     */
    canFind3dsViaBroadcast = false;
    /**
     * Specifies the ip that the dummy will accept as a valid 3ds.
     */
    threeDSIp?: string;
    /**
     * How long the dummy takes to simulate the file transfer in seconds
     */
    fileTransferTime = 10;

    async send3dsx(uri: Uri, ipAddress?: string | undefined): Promise<TransferOutcome> {
        throw new Error("Method not implemented.");
    }
    async send3dsxWithProgress(uri: Uri, feedback: ProgressFeedback, ipAddress?: string | undefined): Promise<TransferOutcome> {
        throw new Error("Method not implemented.");
    }

    private async fakeSend3dsx(uri: Uri, ipAddress?: string, feedback?: ProgressFeedback): Promise<TransferOutcome> {
        return await new Promise<TransferOutcome>(async (resolve) => {
            if ((await workspace.findFiles(uri.fsPath))[0] ) {
                resolve(TransferOutcome.error(OutcomeType.FILE_NOT_ACCESSIBLE, "could not find file"));
            }

            if (feedback) {
                // kill on cancel
                feedback.token.onCancellationRequested(() => {
                    resolve(TransferOutcome.canceled());
                });
            }

            if (!ipAddress) {
                if (this.canFind3dsViaBroadcast) {
                    resolve(this.fakeTransferFile(uri, feedback));
                } else {
                    resolve(TransferOutcome.error(OutcomeType.NO_3DS_RESPONSE, "dummy set to not fnd via broadcast"));
                }
            }

            if (ipAddress !== this.threeDSIp) {
                resolve(TransferOutcome.error(OutcomeType.CONNECTION_TO_IP_FAILED, "ip not recognized by dummy"));
            }


        });
    }

    private async fakeTransferFile(uri: Uri, feedback?: ProgressFeedback): Promise<TransferOutcome> {
        const size = fs.stat(uri.fsPath);
    }
}