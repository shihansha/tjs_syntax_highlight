import { IRange } from "../interfaces/IRange";
import { Expr } from "./expr";

export interface Stat {
    exprs: Expr[];
    range: IRange;
}
