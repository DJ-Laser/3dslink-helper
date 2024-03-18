import { CancellationToken, Progress, Uri } from "vscode";

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

export interface ThreeDSLinkSender {
    /**
     * Try sending the file at the provided uri to the 3ds.
     * If no ip address is provided, the program will search for the 3ds.
     * The ip may need to be specified if the function returned a {@link TransferOutcome} with status {@link OutcomeType.NO_3DS_RESPONSE NO_3DS_RESPONSE}
     * @param uri the {@link Uri} of the file to send.
     * @param ipAddress An optional string containing the ipv4 address of the 3ds.
     * @returns A promise containing a {@link TransferOutcome} signifying the status of the transfer.
     */
    send3dsx(uri: Uri, ipAddress?: string): Promise<TransferOutcome>;

    /**
     * Try sending the file at the provided uri to the 3ds.
     * If no ip address is provided, the program will search for the 3ds.
     * The ip may need to be specified if the function returned a {@link TransferOutcome} with status {@link OutcomeType.NO_3DS_RESPONSE NO_3DS_RESPONSE}
     * @param uri the {@link Uri} of the file to send.
     * @param feedback An optional {@link ProgressFeedback} to be updated with the status of the transfer.
     * @param ipAddress An optional string containing the ipv4 address of the 3ds.
     * @returns A promise containing a {@link TransferOutcome} signifying the status of the transfer.
     */
    send3dsxWithProgress(uri: Uri, feedback: ProgressFeedback, ipAddress?: string): Promise<TransferOutcome>;
}
