import { IDefineList } from "./IDefineList";
import { IDiagnostic } from "./IDiagnostic";
import { IRange } from "./IRange";

export interface IPreprocessorOutput {
    defines: IDefineList;
    chunk: string;
    disabledArea: IRange[];
    diagnostics: IDiagnostic[];
}
