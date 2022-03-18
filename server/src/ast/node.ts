import { IRange } from "../interfaces/IRange";
import { Token } from "../types/token";
import * as Analysis from "../typeSystem/analysisType";
import { BasicTypes, Type } from "../typeSystem/type";
import { NodeType } from "./nodeType";

export enum Accessablity {
    RValue,
    LValue,
}

export class Node<T extends NodeType = NodeType> {
    accessability: Accessablity;
    token?: Token;
    children: (Node<NodeType> | undefined)[];
    parent?: Node<NodeType>;
    op : T;
    analysisType?: Analysis.IAnalysisType;
    range?: IRange;
    /**
     * 指示该节点是否已完整。(这与在翻译中是否出现了错误无关，如果 parser 从错误中成功恢复，节点也可能是完整的)
     */
    completed: boolean;

    public constructor(op: T) {
        this.accessability = Accessablity.RValue;
        this.children = [];
        this.op = op;
        this.completed = false;
    }

    public calcRange()
    {
        if(this.children.length > 0)
        {
            var first = this.children[0]?.range;
            var last = this.children[this.children.length - 1]?.range;
            if(first && last)
            {
                this.range = { 
                    start: first.start, 
                    end: last.end
                };
            }
        }
    }

    public addParent<U extends NodeType>(p: Node<U>): Node<U>{
        p.children.push(this);
        this.parent = p;
        return p;
    }
}

export class Stat<T extends NodeType = NodeType> extends Node<T> {
    override analysisType: undefined;
    constructor(type: T) {
        super(type);
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

    public expr?: Expr;
    public stat?: Stat;
}

export class SwitchNode extends Stat<NodeType.SWITCH> {
    constructor() {
        super(NodeType.SWITCH);
    }

    public expr?: Expr;
    public readonly cases: CaseNode[] = [];
}

export class CaseNode extends Stat<NodeType.CASE> {
    constructor() {
        super(NodeType.CASE);
    }
    public pred?: Expr;
    public readonly stats: (Stat | undefined)[] = [];
    public isDefaultBranch() {
        return this.pred === undefined;
    }
}

export class TryNode extends Stat<NodeType.TRY> {
    constructor() {
        super(NodeType.TRY);
    }
    public tryBlock?: ChunkNode;
    public catchParam?: IdentifierNode;
    public catchBlock?: ChunkNode;
}

export class FunctionNode extends Stat<NodeType.FUNCTION> {
    constructor() {
        super(NodeType.FUNCTION);
    }
    public name?: IdentifierNode;
    public paramList: FunctionParameterNode[] = [];
    public stat?: ChunkNode;
}

export class PropertyNode extends Stat<NodeType.PROPERTY> {
    constructor() {
        super(NodeType.PROPERTY);
    }
    public name?: IdentifierNode;
    public getterAndSetter: (PropertyGetterNode | PropertySetterNode)[] = [];  
}

export class PropertyGetterNode extends Stat<NodeType.GETTER> {
    constructor() {
        super(NodeType.GETTER);
    }

    public block?: ChunkNode;
}

export class PropertySetterNode extends Stat<NodeType.SETTER> {
    constructor() {
        super(NodeType.SETTER);
    }

    public arg?: IdentifierNode;
    public block?: ChunkNode;
}

export class VarEntryNode extends Stat<NodeType.VAR_ENTRY> {
    constructor() {
        super(NodeType.VAR_ENTRY);
    }
    public hasInitializer = false;
    public name?: IdentifierNode;
    public initializer?: Expr;
}

export class VarNode extends Stat<NodeType.VAR> {
    constructor() {
        super(NodeType.VAR);
    }

    public entries: VarEntryNode[] = [];
}

export class ClassNode extends Stat<NodeType.CLASS> {
    constructor() {
        super(NodeType.CLASS);
    }
    public name?: IdentifierNode;
    public extendList: IdentifierNode[] = [];
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

export class FunctionParameterNode extends Expr<NodeType.FUNCTION_PARAMETER> {
    static readonly FunctionParameterType = FunctionParameterType;
    constructor() {
        super(NodeType.FUNCTION_PARAMETER);
    }
    parType?: FunctionParameterType;
    nameExpr?: IdentifierNode;
    initExpr?: Expr;
}

export class ConstantNode extends Expr<NodeType.CONST>{
    public constructor(value: any, type: BasicTypes) {
        super(NodeType.CONST);
        let t = Type.basic[BasicTypes[type].toLowerCase() as Lowercase<keyof typeof BasicTypes>];
        this.analysisType = new Analysis.LiteralAnalysisType(value, t);
    }

    static readonly consts = {
        void: new ConstantNode(undefined, BasicTypes.void),
        true: new ConstantNode(1, BasicTypes.Integer),
        false: new ConstantNode(0, BasicTypes.Integer)
    } as const;
}

export class IdentifierNode extends Expr<NodeType.IDENTIFIER> {
    constructor(t: Token) {
        super(NodeType.IDENTIFIER);
        this.value = t.value;
        this.range = t.range;
        this.completed = true;
    }
    public value?: string;
}

export class BinaryOperator<T extends NodeType = NodeType> extends Expr<T> {
    public constructor(type: T) {
        super(type);
    }

    public a?: Expr;
    public b?: Expr;
}

export class TripleOperator<T extends NodeType = NodeType> extends Expr<T> {
    public constructor(type: T) {
        super(type);
    }

    public a?: Expr;
    public b?: Expr;
    public c?: Expr;
}

export class UnaryOperator<T extends NodeType = NodeType> extends Expr<T> {
    public constructor(type: T) {
        super(type);
    }
    public a?: Expr;
}