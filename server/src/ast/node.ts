import { IRange } from "../interfaces/IRange";
import { Token } from "../types/token";
import * as Analysis from "../typeSystem/analysisType";
import { BasicTypes, Type } from "../typeSystem/type";
import { NodeType } from "./nodeType";

export enum Accessablity {
    RValue,
    LValue,
}

export class Node {
    public completed = false;
    public parent?: Node;
}

export class Stat extends Node {

}

export class ExprStat extends Stat {
    public expr?: Expr;
}

export class Expr extends Node {
    public accessablity: Accessablity = Accessablity.RValue;
    public analysisType: Analysis.IAnalysisType = Analysis.UnknownAnalysisType.Instance;
}

export class BlockNode extends Stat {
    public constructor(
        public readonly isGlobal = false,
    ) {
        super();
    }

    public readonly stats: Stat[] = [];
}

export class WhileNode extends Stat {
    public pred?: Expr;
    public stat?: Stat;
}

export class DoNode extends Stat {
    public stat?: Stat;
    public pred?: Expr;
}

export class IfNode extends Stat {
    public pred?: Expr;
    public trueStat?: Stat;
    public falseStat?: Stat;
}

export class ForNode extends Stat {
    public init?: Expr;
    public pred?: Expr;
    public end?: Expr;
    public stat?: Stat;
}

export class WithNode extends Stat {
    public expr?: Expr;
    public stat?: Stat;
}

export class SwitchNode extends Stat {
    public expr?: Expr;
    public readonly cases: CaseNode[] = [];
}

export class CaseNode extends Stat {
    public pred?: Expr;
    public readonly stats: Stat[] = [];
    public isDefaultBranch() {
        return this.pred === undefined;
    }
}

export class TryNode extends Stat {
    public tryBlock?: BlockNode;
    public catchParam?: IdentifierNode;
    public catchBlock?: BlockNode;
}

export class FunctionNode extends Stat {
    public id?: IdentifierNode;
    public paramList: FunctionParameterNode[] = [];
    public stat?: BlockNode;
}

export class PropertyNode extends Stat {
    public getterAndSetter: (PropertyGetterNode | PropertySetterNode)[] = [];
}

export class PropertyGetterNode extends Stat {
    public block?: BlockNode;
}

export class PropertySetterNode extends Stat {
    public arg?: IdentifierNode;
    public block?: BlockNode;
}

export class VarEntryNode extends Stat {
    public hasInitializer = false;
    public name?: IdentifierNode;
    public initializer?: Expr;
}

export class VarNode extends Stat {
    public entries: VarEntryNode[] = [];
}

export class ClassNode extends Stat {
    public name?: IdentifierNode;
    public extendList: Expr[] = [];
    public properties: PropertyNode[] = [];
    public methods: FunctionNode[] = [];
    public fields: VarNode[] = [];
}

enum FunctionParameterType {
    Normal,
    WithInitializer,
    Args,
    UnnamedArgs
}

export class FunctionParameterNode extends Expr {
    static readonly FunctionParameterType = FunctionParameterType;
    parType?: FunctionParameterType;
    nameExpr?: IdentifierNode;
    initExpr?: Expr;
}

enum ParEntryType {
    Normal,
    UnnamedArgs,
    CallerArgs,
    Empty,
}

export class ParEntryNode extends Expr {
    static readonly ParEntryType = ParEntryType;
    parType?: ParEntryType;
    expr?: Expr;
}

export class ParListNode extends Expr {
    readonly params: ParEntryNode[] = [];
}

export class LiteralNode extends Expr {
    public constructor(value: string, type: BasicTypes.String, tok: Token);
    public constructor(value: number, type: BasicTypes.Integer | BasicTypes.Real, tok: Token);
    public constructor(value: number[], type: BasicTypes.Octet, tok: Token);
    public constructor(value: undefined, type: BasicTypes.void, tok: Token);
    public constructor(value: undefined, type: BasicTypes.void);
    public constructor(value: any, type: BasicTypes, tok?: Token) {
        super();
        const t = Type.basic[BasicTypes[type].toLowerCase() as Lowercase<keyof typeof BasicTypes>];
        this.analysisType = new Analysis.LiteralAnalysisType(value, t);
        this.accessablity = Accessablity.RValue;
        if (tok) {
            this.completed = true;
            tok.owner = this;
        }
    }
    // illegal node
    static readonly illegal = new LiteralNode(undefined, BasicTypes.void);
    // empty node
    static readonly epsilon = new LiteralNode(undefined, BasicTypes.void);
}

export class IdentifierNode extends Expr {
    public constructor(value: string, tok: Token);
    public constructor();
    public constructor(public readonly value?: string, tok?: Token) {
        super();
        if (tok) {
            this.completed = true;
            tok.owner = this;
        }
    }

    static readonly illegal = new IdentifierNode();
}

export class BinaryOpExpr extends Expr {
    public constructor(
        public readonly left: Expr,
        public readonly op: Token,
        public readonly right: Expr) {
        super();
    }
}

export class UnaryOpExpr extends Expr {
    public constructor(
        public readonly op: Token,
        public readonly operand: Expr,
        public readonly isPre: boolean) {
        super();
    }
}

export class CondOpExpr extends Expr {
    public constructor(
        public readonly pred: Expr,
        public readonly trueBranch: Expr,
        public readonly falseBranch: Expr) {
        super();
    }
}

export class InterpolatedString extends Expr {
    public readonly children: Expr[] = [];
}

export class ArrayExpr extends Expr {
    public entries?: ParListNode;
}

export class DictExpr extends Expr {
    public entries?: ParListNode;
}
