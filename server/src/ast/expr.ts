import { IRange } from "../interfaces/IRange";
import { Token } from "../types/token";
import { IAnalysisType } from "../typeSystem/analysisType";

export enum Accessablity {
    RValue,
    LValue,
}

export interface Expr {
    accessability: Accessablity;
    tokens: Token[];
    analysisType: IAnalysisType;
    range: IRange;
}
