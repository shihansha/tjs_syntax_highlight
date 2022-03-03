import { NotificationType, Range as IRange } from "vscode-languageclient";

interface InactiveRegionParams {
    range: IRange[],
    fileUri: string
}

export namespace KrkrNotificationType {
    export const InactiveRegionNotification: NotificationType<InactiveRegionParams> = new NotificationType("krkrtools/inactiveRegions");
}
