import { IRange } from "../interfaces/IRange";
import { TokenType } from "./tokenType";

export class Token<T extends TokenType = TokenType> {
    public constructor(
        public readonly type: T,
        public readonly range: IRange,
        public readonly value: string,
    ) { }
    
}
