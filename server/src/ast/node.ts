import { IRange } from "../interfaces/IRange";
import { Token } from "../types/token";
import * as Analysis from "../typeSystem/analysisType";
import { NodeType } from "./nodeType";

export enum Accessablity {
    RValue,
    LValue,
}

export class Node<T extends NodeType = NodeType> {
    accessability: Accessablity;
    token: Token | null;
    children: Node<NodeType>[];
    parent: Node<NodeType> | null;
    op : T;
    analysisType: Analysis.IAnalysisType | null;
    range: IRange;
    completed: boolean;

    public constructor(op: T) {
        this.accessability = Accessablity.RValue;
        this.token = null;
        this.children = [];
        this.parent = null;
        this.op = op;
        this.analysisType = null;
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
        this.completed = false;
    }

    public calcRange()
    {
        if(this.children.length > 0)
        {
            this.range.start = this.children[0].range.start;
            this.range.end = this.children[this.children.length - 1].range.end;
        }
    }

    public addParent<U extends NodeType>(p: Node<U>): Node<U>{
        p.children.push(this);
        this.parent = p;
        return p;
    }
}

export class Stat<T extends NodeType = NodeType> extends Node<T> {
    override analysisType: null;
    constructor(type: T) {
        super(type);
        this.analysisType = null;
    }
}

export class Expr<T extends NodeType = NodeType> extends Node<T> {
    override analysisType: Analysis.IAnalysisType;
    constructor(type: T) {
        super(type);
        this.analysisType = new Analysis.UnknownAnalysisType();
    }
}

export class ChunkNode extends Stat<NodeType.CHUNK> {
    isglobal : boolean;

    public constructor(isglobal: boolean) {
        super(NodeType.CHUNK);
        this.isglobal = isglobal;
    }
}

export class StatNode extends Stat<NodeType.STATEMENT> {
    public constructor() {
        super(NodeType.STATEMENT);
    }
}

export class WhileNode extends Stat<NodeType.WHILE> {
    constructor() {
        super(NodeType.WHILE);
    }

    public pred?: Expr<NodeType>;
    public stat?: Stat<NodeType>;
}

export class DoNode extends Stat<NodeType.DO> {
    constructor() {
        super(NodeType.DO);
    }

    public stat?: Stat<NodeType>;
    public pred?: Expr<NodeType>;
}

export class IfNode extends Stat<NodeType.IF> {
    constructor() {
        super(NodeType.IF);
    }

    public pred?: Expr<NodeType>;
    public trueStat?: Stat<NodeType>;
    public falseStat?: Stat<NodeType>;
}

export class ForNode extends Stat<NodeType.FOR> {
    constructor() {
        super(NodeType.FOR);
    }

    public init?: Expr<NodeType>;
    public pred?: Expr<NodeType>;
    public end?: Expr<NodeType>;
    public stat?: Stat<NodeType>;
}

export class WithNode extends Stat<NodeType.WITH> {
    constructor() {
        super(NodeType.WITH);
    }

    public expr?: Expr<NodeType>;
    public stat?: Stat<NodeType>;
}

export class SwitchNode extends Stat<NodeType.SWITCH> {
    constructor() {
        super(NodeType.SWITCH);
    }

    public expr?: Expr<NodeType>;
    public readonly cases: CaseNode[] = [];
}

export class CaseNode extends Stat<NodeType.CASE> {
    constructor() {
        super(NodeType.CASE);
    }
    public pred?: Expr<NodeType>;
    public readonly stats: Stat[] = [];
    public isDefaultBranch() {
        return this.pred === undefined;
    }
}

export class TryNode extends Stat<NodeType.TRY> {
    constructor() {
        super(NodeType.TRY);
    }
    public tryBlock?: Stat<NodeType.CHUNK>;
    public catchParam?: Expr<NodeType.IDENTIFIER>;
    public catchBlock?: Stat<NodeType.CHUNK>;
}

export class FunctionNode extends Stat<NodeType.FUNCTION> {
    constructor() {
        super(NodeType.FUNCTION);
    }
    public paramList: IdentifierNode[] = [];
    public stat?: Stat<NodeType.CHUNK>;
}

export class ConstantNode extends Expr<NodeType.CONST>{
    public constructor(){
        super(NodeType.CONST);
    }
}

export class IdentifierNode extends Expr<NodeType.IDENTIFIER> {
    constructor() {
        super(NodeType.IDENTIFIER);
    }
    public value?: string;
}

export class AddNode extends Expr<NodeType.ADD> {
    public constructor() {
        super(NodeType.ADD);
    }
}

export class PreAddNode extends Expr<NodeType.PRE_ADD> {
    public constructor() {
        super(NodeType.PRE_ADD);
    }
}