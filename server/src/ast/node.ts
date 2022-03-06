import { IRange } from "../interfaces/IRange";
import { Token } from "../types/token";
import * as Analysis from "../typeSystem/analysisType";
import { Opcode } from "./opcode";

export enum Accessablity {
    RValue,
    LValue,
}

export class Node {
    accessability: Accessablity;
    tokens: Token[];
    op : Opcode;
    analysisType: Analysis.IAnalysisType;
    range: IRange;

    public constructor(op: Opcode) {
        this.accessability = Accessablity.RValue;
        this.tokens = [];
        this.op = op;
        this.analysisType = new Analysis.UnknownAnalysisType();
        this.range = { 
            start: { 
                line: 0, 
                character: 0 
            }, 
            end: { 
                line: 0, 
                character: 0 
            } 
        };
    }

    public calcRange()
    {
        if(this.tokens.length > 0)
        {
            this.range.start = this.tokens[0].range.start;
            this.range.end = this.tokens[this.tokens.length - 1].range.end;
        }
    }
}

export class ChunkNode extends Node {
    isglobal : boolean;

    public constructor(isglobal: boolean) {
        super(Opcode.CHUNK);
        this.isglobal = isglobal;
    }
}

export class StatNode extends Node {
    public constructor() {
        super(Opcode.STATEMENT);
    }
}

export class AddNode extends Node {
    public constructor() {
        super(Opcode.ADD);
    }
}

export class PreAddNode extends Node {
    public constructor() {
        super(Opcode.PRE_ADD);
    }
}