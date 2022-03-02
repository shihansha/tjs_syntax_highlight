import { IDefineList } from "./IDefineList";
import { IRange } from "./IRange";

export interface IPreprocessorOutput {
    defines: IDefineList;
    chunk: string;
    disabledArea: IRange[];
}
