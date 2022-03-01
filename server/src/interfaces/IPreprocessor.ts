import { IDefineList } from "./IDefineList";

export interface IPreprocessor {
    run(def: IDefineList): string;
}
