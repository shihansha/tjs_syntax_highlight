import { IRange } from "../interfaces/IRange";

export class Diagnostic {
    public constructor(
        public readonly range: IRange,
        public readonly diagnostic: string,
    ) { }
    
}
