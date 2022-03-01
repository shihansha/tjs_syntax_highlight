import { IDefineList } from "./IDefineList";

export interface IPreprocessorOutput {
    defines: IDefineList;
    chunk: string;
}
