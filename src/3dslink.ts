import { CancellationToken, Progress, Uri } from "vscode";
import { ChildProcess, ChildProcessWithoutNullStreams, spawn } from "child_process";
import path from "path";

export enum OutcomeType {
    SUCCESS,
    NO_3DS_RESPONSE,
    CONNECTION_TO_IP_FAILED,
    COMMAND_NOT_FOUND,
    FILE_NOT_ACCESSIBLE,
    PROCESS_KILLED,
    CANECELED_BY_USER,
    UNKNOWN_ERROR,
}

export class TransferOutcome {
    // The reason the function closed
    public status: OutcomeType;
    // 
    public isError: boolean;
    public exitCode?: number;
    public errorMessage?: string;
    public signal?: string;

    private constructor(status: OutcomeType, options: {
        exitCode?: number,
        errorMessage?: string,
        signal?: string,
        isError?: boolean
    }) {
        this.status = status;
        this.isError = options.isError ?? true;
        this.exitCode = options.exitCode;
        this.errorMessage = options.errorMessage;
        this.signal = options.signal;
    }

    public static success() {
        return new TransferOutcome(OutcomeType.SUCCESS, {
            exitCode: 0,
            isError: false
        });
    }

    public static error(outcome: OutcomeType, errorMessage: string, exitCode?: number) {
        return new TransferOutcome(outcome, {
            exitCode: exitCode,
            errorMessage: errorMessage
        });
    }

    public static processKilled(signal: string) {
        return new TransferOutcome(OutcomeType.PROCESS_KILLED, {
            signal: signal
        });
    }

    public static canceled() {
        return new TransferOutcome(OutcomeType.CANECELED_BY_USER, {
            isError: false
        });
    }

}

export type NotificationProgress = Progress<{
    message?: string | undefined;
    increment?: number | undefined;
}>;

export interface ProgressFeedback {
    progress: NotificationProgress,
    token: CancellationToken
}

function attachProgressUpdaters(process: ChildProcessWithoutNullStreams, fileName: string, feedback: ProgressFeedback) {
    let currentProgress = 0;

    process.stdout.on("data", (data) => {
        if (data.includes("Sending")) {
            // started sending the file
            feedback.progress.report({
                message: `Sending ${fileName}`
            });
        } else if (data.includes(" sent (")) {
            // progress update on data transfer
            const percentage = data.match(/(?<=\d+ sent \()[\d\.]+(?=%\))/m);
            const blocks = data.match(/(?<=%\), )[\d]+(?= blocks)/m);
            // update progress notification to reflect transfer progress
            feedback.progress.report({
                message: `${percentage}% sent (${blocks} blocks)`,
                increment: percentage - currentProgress
            });

            // progress gets incremented, so keep track of it's current value for next time
            currentProgress = percentage;
        }
    });
}

function handleMessage(data: string, ipAddress?: string): TransferOutcome | undefined {
    if (data.includes("Sending") || data.includes(" sent (")) {
        // Normal messages, ignore them
        return undefined;
    } else if (data.includes(`Connection to ${ipAddress} failed`)) {
        // could not connect to provided ip
        return TransferOutcome.error(OutcomeType.CONNECTION_TO_IP_FAILED, data);
    } else if (data.includes("No response from 3DS!")) {
        // 3dslink could not find 3ds without ip
        return TransferOutcome.error(OutcomeType.NO_3DS_RESPONSE, data);
    } else if (data.includes("Failed to open")) {
        return TransferOutcome.error(OutcomeType.FILE_NOT_ACCESSIBLE, data);
    } else {
        // unknown error
        return TransferOutcome.error(OutcomeType.UNKNOWN_ERROR, data);
    }
};

/**
 * Try sending the file at the provided uri to the 3ds.
 * If no ip address is provided, the program will search for the 3ds.
 * The ip may need to be specified if the function returned a {@link TransferOutcome} with status {@link OutcomeType.NO_3DS_RESPONSE NO_3DS_RESPONSE}
 * @param uri the {@link Uri} of the file to send.
 * @param ipAddress An optional string containing the ipv4 address of the 3ds.
 * @param feedback An optional {@link ProgressFeedback} to be updated with the status of the transfer.
 * @returns A promise containing a {@link TransferOutcome} signifying the status of the transfer.
 */
async function genericSend3dsx(uri: Uri, ipAddress?: string, feedback?: ProgressFeedback): Promise<TransferOutcome> {
    const fileName = path.basename(uri.path);

    let processes: ChildProcess[] = [];

    try {
        return await new Promise<TransferOutcome>((resolve) => {
            // spawn the 3dslink command
            const process = spawn("3dslink", ipAddress ? [uri.path, "-a", ipAddress] : [uri.path]);
            processes.push(process);

            let outcome: TransferOutcome | undefined;

            if (feedback) {
                attachProgressUpdaters(process, fileName, feedback);
                
                // kill on cancel
                feedback.token.onCancellationRequested(() => {
                    outcome = TransferOutcome.canceled();
                    process.kill();
                });
            }

            process.on("close", (code, signal) => {
                const exitCode = code ?? NaN;

                if (signal) {
                    resolve(TransferOutcome.processKilled(signal));
                } else if (code !== 0) {
                    // exited with error
                    if (outcome) {
                        outcome.exitCode = exitCode;
                        resolve(outcome);
                    } else {
                        // no specific outcome, send a generic one
                        resolve(TransferOutcome.error(OutcomeType.UNKNOWN_ERROR, "Unknown error", exitCode));
                    }
                } else {
                    // trasnfer succeeded
                    resolve(TransferOutcome.success());
                }
            });

            process.on("error", (error) => {
                console.log(error);
                if (error.message.includes("ENOENT")) {
                    // 3dslink command not found
                    outcome = TransferOutcome.error(OutcomeType.COMMAND_NOT_FOUND, error.message);
                } else {
                    // unknown error
                    outcome = TransferOutcome.error(OutcomeType.UNKNOWN_ERROR, error.message);
                }
            });

            process.stderr.on("data", (data) => {
                console.log("stderr:" + data);
                outcome = handleMessage(data, ipAddress);
            });


            process.stdout.on("data", (data) => {
                console.log("stdout:" + data);
                outcome = handleMessage(data, ipAddress);
            });
        });
    } finally {
        // cleanup: kill process if something goes wrong
        for (const process of processes) {
            process.kill();
        }
    }
}

/**
 * Try sending the file at the provided uri to the 3ds.
 * If no ip address is provided, the program will search for the 3ds.
 * The ip may need to be specified if the function returned a {@link TransferOutcome} with status {@link OutcomeType.NO_3DS_RESPONSE NO_3DS_RESPONSE}
 * @param uri the {@link Uri} of the file to send.
 * @param ipAddress An optional string containing the ipv4 address of the 3ds.
 * @returns A promise containing a {@link TransferOutcome} signifying the status of the transfer.
 */
export async function send3dsx(uri: Uri, ipAddress?: string): Promise<TransferOutcome> {
    return genericSend3dsx(uri, ipAddress);
}

/**
 * Try sending the file at the provided uri to the 3ds.
 * If no ip address is provided, the program will search for the 3ds.
 * The ip may need to be specified if the function returned a {@link TransferOutcome} with status {@link OutcomeType.NO_3DS_RESPONSE NO_3DS_RESPONSE}
 * @param uri the {@link Uri} of the file to send.
 * @param feedback An optional {@link ProgressFeedback} to be updated with the status of the transfer.
 * @param ipAddress An optional string containing the ipv4 address of the 3ds.
 * @returns A promise containing a {@link TransferOutcome} signifying the status of the transfer.
 */
export async function send3dsxWithProgress(uri: Uri, feedback: ProgressFeedback, ipAddress?: string): Promise<TransferOutcome> {
    return genericSend3dsx(uri, ipAddress, feedback);
}