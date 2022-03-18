import { ILexer } from "../interfaces/ILexer";
import * as Node from "../ast/node";
import { NodeType } from "../ast/nodeType";
import { Token } from "../types/token";
import { TokenType } from "../types/tokenType";
import { LexerMode } from "../types/lexerMode";
import { IDiagnostic } from "../interfaces/IDiagnostic"
import { IRange } from "../interfaces/IRange";
import { IPosition } from "../interfaces/IPosition";
import { BasicTypes } from "../typeSystem/type";

const TJS_MODE = LexerMode.TJS;

const SKIP_UNTIL_GROUP = {
    /**
     * 希望遇到一个 }，一般在 class 和 property 的定义中使用。
     */
    RCURLY_EXPECTED: [TokenType.SEP_RCURLY],
    /**
     * 期望结束一条 stat。
     */
    STAT_END: [TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY],
    /**
     * 期望得到以 '(' 包裹的一个 expr。
     */
    PAREN_EXP_EXPECTED: [TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY],
    /**
     * 期望得到一个 ')'。 
     */
    RPAREN_EXPECTED: [TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY, TokenType.SEP_RPAREN],

    /**
     * 在 for 循环的三个条件表达式中。
     */
    FOR_EXPR: [TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY, TokenType.SEP_RPAREN],

    /**
     * 当 case 语句的 pred exp 中出错时。
     */
    CASE_PRED: [TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY, TokenType.SEP_COLON],

    /**
     * 在函数参数定义中时。
     */
    PARAM_LIST: [TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY, TokenType.SEP_RPAREN, TokenType.SEP_COMMA],
} as const;

export class Parser {
    /** 优先级 */
    private LBP:{[key: string]:number} = {};
    /** 哪些运算符可以放句首 */
    private head:{[key: string]:number} ={};

    public errorStack: IDiagnostic[] = [];

    constructor(
        public readonly chunkName: string,
        private readonly m_chunk: string,
        private readonly lexer: ILexer
    ) {
        this.head[TokenType.KW_IF] = 1;
        this.head[TokenType.KW_WHILE] = 1;
        this.head[TokenType.KW_DO] = 1;
        this.head[TokenType.KW_FOR] = 1;
        this.head[TokenType.SEP_LCURLY] = 1;
        this.head[TokenType.KW_CLASS] = 1;
        this.head[TokenType.KW_SWITCH] = 1;
        this.head[TokenType.KW_DEFAULT] = 1;
        this.head[TokenType.KW_CASE] = 1;
        this.head[TokenType.KW_BREAK] = 1;
        this.head[TokenType.KW_CONTINUE] = 1;
        this.head[TokenType.KW_RETURN] = 1;
        this.head[TokenType.KW_VAR] = 1;

        for(var t in TokenType)
        {
            this.LBP[t] = 0;
        }
        this.LBP[TokenType.SEP_COMMA] = 10;
        this.LBP[TokenType.NUMBER_DECIMAL] = 10;
        this.LBP[TokenType.NUMBER_BINARY] = 10;
        this.LBP[TokenType.NUMBER_OCTAL] = 10;
        this.LBP[TokenType.NUMBER_HEXIMAL] = 10;
        this.LBP[TokenType.STRING] = 10;
        this.LBP[TokenType.OP_ASSIGN] = 20;
        this.LBP[TokenType.OP_ASSIGN_ADD] = 20;
        this.LBP[TokenType.OP_ASSIGN_MINUS] = 20;
        this.LBP[TokenType.OP_ASSIGN_MOD] = 20;
        this.LBP[TokenType.OP_ASSIGN_MUL] = 20;
        this.LBP[TokenType.OP_ASSIGN_DIV] = 20;
        this.LBP[TokenType.OP_ASSIGN_IDIV] = 20;
        this.LBP[TokenType.OP_ASSIGN_AND] = 20;
        this.LBP[TokenType.OP_ASSIGN_OR] = 20;
        this.LBP[TokenType.OP_ASSIGN_BAND] = 20;
        this.LBP[TokenType.OP_ASSIGN_BOR] = 20;
        this.LBP[TokenType.OP_ASSIGN_BXOR] = 20;
        this.LBP[TokenType.OP_ASSIGN_SHL] = 20;
        this.LBP[TokenType.OP_ASSIGN_SHR] = 20;
        this.LBP[TokenType.OP_CONDITIONAL_QM] = 30;
        this.LBP[TokenType.OP_INSTANCEOF] = 40;
        this.LBP[TokenType.OP_INCONTEXTOF] = 40;
        this.LBP[TokenType.OP_OR] = 50;
        this.LBP[TokenType.OP_AND] = 60;
        this.LBP[TokenType.OP_BOR] = 70;
        this.LBP[TokenType.OP_BXOR] = 80;
        this.LBP[TokenType.OP_BAND] = 90;
        this.LBP[TokenType.OP_EQ] = 100;
        this.LBP[TokenType.OP_TPYE_EQ] = 100;
        this.LBP[TokenType.OP_NE] = 100;
        this.LBP[TokenType.OP_TYPE_NE] = 100;
        this.LBP[TokenType.OP_GT] = 110;
        this.LBP[TokenType.OP_GE] = 110;
        this.LBP[TokenType.OP_LT] = 110;
        this.LBP[TokenType.OP_LE] = 110;
        this.LBP[TokenType.OP_SHL] = 120;
        this.LBP[TokenType.OP_SHR] = 120;
        this.LBP[TokenType.OP_ADD] = 130;
        this.LBP[TokenType.OP_MINUS] = 130;
        this.LBP[TokenType.OP_MUL] = 140;
        this.LBP[TokenType.OP_MOD] = 140;
        this.LBP[TokenType.OP_DIV] = 140;
        this.LBP[TokenType.OP_IDIV] = 140;

        this.LBP[TokenType.OP_INC] = 190;
        this.LBP[TokenType.OP_DEC] = 190;
        this.LBP[TokenType.SEP_LBRACK] = 200;
        this.LBP[TokenType.SEP_DOT] = 200;
        this.LBP[TokenType.SEP_LPAREN] = 200;
    }

    private next(mode: LexerMode = LexerMode.TJS) {
        return this.lexer.nextToken(mode);
    }
    private lookAhead(mode: LexerMode = LexerMode.TJS) {
        return this.lexer.lookAhead(mode);
    }

    private skipIf(types: readonly TokenType[]) {
        const lookAhead = this.lookAhead();
        if (types.includes(lookAhead)) {
            this.next();
            return true;
        }
        return false;
    }
    private skipUntil(types: readonly TokenType[]) {
        let lookAhead = this.lookAhead();
        var blockcount = 0;
        while(lookAhead != TokenType.EOF)
        {
            if (blockcount == 0 && (types.includes(lookAhead)))
                break;
            if (lookAhead == TokenType.SEP_LCURLY)
                blockcount++;
            else if (lookAhead == TokenType.SEP_RCURLY)
                blockcount--;
            this.next();
            lookAhead = this.lookAhead();
        }
    }

    private skipToLineEnd()
    {
        const lookAhead = this.lookAhead();
        var blockcount = 0;
        while(lookAhead != TokenType.EOF)
        {
            if(blockcount == 0 && (lookAhead == TokenType.SEP_SEMI || lookAhead == TokenType.SEP_RCURLY))
                break;
            if (lookAhead == TokenType.SEP_LCURLY)
                blockcount++;
            if (lookAhead == TokenType.SEP_RCURLY)
                blockcount--;
            this.next();
        }
    }

    private posAhead(mode: LexerMode = LexerMode.TJS): IRange {
        return this.lexer.lookAheadRange(mode);
    }

    private assertAndTake(tokenType: TokenType, mode?: LexerMode) {
        const ahead = this.lookAhead(mode);
        if (ahead !== tokenType) {
            const msg = `'${tokenType}' expected.`;
            this.errorStack.push(IDiagnostic.create(this.posAhead(), msg));
            return false;
        }
        this.next();
        return true;
    }

    private _parse(rbp : number) : Node.Node | undefined
    {
        var token = this.next();
        var next = this.lookAhead();
        if (rbp >= 5 && !(this.head[token.type] > 0))
        {
            //var e = new TJSException("this token must be at line head");
            //e.AddTrace(token.line, token.pos);
            //throw e;
            this.errorStack.push(IDiagnostic.create(token.range, "this token must be at line head"));
            this.skipToLineEnd();
            return;
        }
        //占位初始化
        var node: Node.Node = new Node.Node(NodeType.END);
        // 这里是单目运算符及while等单目语句的处理
        switch(token.type)
        {
            case TokenType.NUMBER_BINARY:
            case TokenType.NUMBER_DECIMAL:
            case TokenType.NUMBER_HEXIMAL:
            case TokenType.NUMBER_OCTAL:
                node = this.handleNumber(token);
                node.token = token;
                break;
            case TokenType.STRING:
                node = new Node.ConstantNode(token.value, BasicTypes.String);
                node.token = token;
                break;
            case TokenType.SEP_LCURLY: // {
                node = this.statBlock();
                break;
            case TokenType.KW_IF: // if
                node = this.statIf();
                break;
            case TokenType.KW_WHILE: // while
                node = this.statWhile();
                break;
            case TokenType.KW_DO: // do
                node = this.statDo();
                break;
            case TokenType.KW_FOR: // for
                node = this.statFor();
                break;
            case TokenType.KW_SWITCH:
                node = this.statSwitch();
                break;
            case TokenType.KW_TRY:
                node = this.statTry();
                break;
            case TokenType.KW_FUNCTION:
                node = this.statFunction();
                break;
            case TokenType.KW_PROPERTY:
                node = this.statProperty();
                break;
            case TokenType.KW_CLASS:
                node = this.statClass();
                break;
            case TokenType.KW_WITH:
                node = this.statWith();
                break;
            case TokenType.SEP_SEMI: // ;
                // empty statement
                // 吃掉;然后return一个空stat
                if(rbp>0)
                {
                    //parse exp时不吃掉，并且返回undefined，作为一个特殊的Exp，
                    //因为除了for的()外，其余地方都不能接受空exp
                    return;
                }
                this.next();
                let n = new Node.StatNode();
                n.completed = true;
                return n;
            case TokenType.OP_ADD:
                node = new Node.UnaryOperator(NodeType.PRE_ADD);
                break;
            case TokenType.OP_MINUS:
                node = new Node.UnaryOperator(NodeType.PRE_SUB);
                break;
            case TokenType.OP_NOT:
                node = new Node.UnaryOperator(NodeType.NOT);
                break;
            case TokenType.OP_BNOT:
                node = new Node.UnaryOperator(NodeType.BITNOT);
                break;
            case TokenType.OP_INC:
                node = new Node.UnaryOperator(NodeType.PRE_ADD);
                break;
            case TokenType.OP_DEC:
                node = new Node.UnaryOperator(NodeType.PRE_SUB);
                break;
            // default:
            //     return this.statExpr();
        }
        // 这里是双目的处理
        while(rbp < this.LBP[next])
        {
            token = this.next();
            next = this.lookAhead();
            switch(token.type)
            {
                case TokenType.OP_ADD:
                    node = node.addParent(new Node.BinaryOperator(NodeType.ADD));
                    node.children.push(this._parse(this.LBP[token.type]));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_MINUS:
                    node = node.addParent(new Node.BinaryOperator(NodeType.SUB));
                    node.children.push(this._parse(this.LBP[token.type]));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_MUL:
                    node = node.addParent(new Node.BinaryOperator(NodeType.MUL));
                    node.children.push(this._parse(this.LBP[token.type]));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_DIV:
                    node = node.addParent(new Node.BinaryOperator(NodeType.DIV));
                    node.children.push(this._parse(this.LBP[token.type]));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_IDIV:
                    node = node.addParent(new Node.BinaryOperator(NodeType.INTDIV));
                    node.children.push(this._parse(this.LBP[token.type]));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_MOD:
                    node = node.addParent(new Node.BinaryOperator(NodeType.MOD));
                    node.children.push(this._parse(this.LBP[token.type]));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_ASSIGN:
                    node = node.addParent(new Node.BinaryOperator(NodeType.SET));
                    // 又结合
                    node.children.push(this._parse(this.LBP[token.type] - 1));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_ASSIGN_ADD:
                    node = node.addParent(new Node.BinaryOperator(NodeType.SETADD));
                    // 又结合
                    node.children.push(this._parse(this.LBP[token.type] - 1));
                    node.completed = !!node.children[1];
                    break;
                case TokenType.OP_ASSIGN_CHANGE:
                    node = node.addParent(new Node.BinaryOperator(NodeType.CHANGE));
                    // 又结合
                    node.children.push(this._parse(this.LBP[token.type] - 1));
                    node.completed = !!node.children[1];
                    break;
                // TODO
            }
        }
        return node;
    }
    private handleNumber(token: Token) {
        const origin = token.value.toLowerCase();
        let outNum: number;
        if (token.type === TokenType.NUMBER_BINARY) {
            const trimmed = origin.substring(2);
            outNum = handleNotDecimalTrimmedNumber(trimmed, 2);
        }
        else if (token.type === TokenType.NUMBER_OCTAL) {
            const trimmed = origin.substring(1);
            outNum = handleNotDecimalTrimmedNumber(trimmed, 8);
        }
        else if (token.type === TokenType.NUMBER_DECIMAL) {
            let numStr: string;
            let expStr: string | undefined;
            if (origin.includes("e")) {
                const spl = origin.split("e");
                numStr = spl[0];
                expStr = spl[1];
            }
            else {
                numStr = origin;
                expStr = undefined;
            }

            const num = parseFloat(numStr);
            const exp = expStr ? parseInt(expStr) : 0;
            outNum = num * (10 ** exp);
        }
        else if (token.type === TokenType.NUMBER_HEXIMAL) {
            const trimmed = origin.substring(2);
            outNum = handleNotDecimalTrimmedNumber(trimmed, 16);
        }
        else {
            throw new Error("unepected token number");
        }

        if (Math.floor(outNum) !== outNum) {
            return new Node.ConstantNode(outNum, BasicTypes.Real);
        }
        else {
            return new Node.ConstantNode(outNum, BasicTypes.Integer);
        }

        function handleNotDecimalTrimmedNumber(trimmed: string, radix: number) {
            let numStr: string;
            let expStr: string | undefined;

            if (trimmed.includes("p")) {
                const spl = trimmed.split("p");
                numStr = spl[0];
                expStr = spl[1];
            }
            else {
                numStr = trimmed;
                expStr = undefined;
            }

            let num: number;
            if (numStr.includes(".")) {
                const numSpl = trimmed.split(".");
                const intStr = numSpl[0];
                const floatStr = numSpl[1];
                const intNum = intStr === "" ? 0 : parseInt(intStr, radix);
                const floatNum = floatStr === "" ? 0 : parseInt(floatStr, radix) / (radix ** floatStr.length);
                num = intNum + floatNum;
            }
            else {
                num = parseInt(numStr, radix);
            }
            const exp = expStr ? parseInt(expStr, 10) : 0;
            return num * (2 ** exp);
        }
    }

    public parse() : Node.Stat<NodeType> {
        var pnode = new Node.ChunkNode(true);
        pnode.children.push(this.parseStatement());
        while(this.lookAhead() != TokenType.EOF)
        {
            this.skipIf([TokenType.SEP_SEMI]);
            pnode.children.push(this.parseStatement());
        }
        return pnode;
    }

    /**
     * 转换一个 expr。expr 代表存在一个值的节点。
     * 
     * 转换一个 expr 时，我们约定，出错时不调用 `skip` 方法，而是将 `completed` 标记为 `false`，然后直接返回。
     * stat 的转换器负责从错误中恢复。
     */
    private parseExpression(): Node.Expr<NodeType> | undefined {
        //介于;等结束符和,之间
        return this._parse(5) as Node.Expr<NodeType>;
    }

    /** 只有成功和失败两种可能，失败返回undefined */
    private parseIdentifier(): Node.IdentifierNode | undefined {
        var n = this.lookAhead();
        if(n!==TokenType.IDENTIFIER)
            return;
        return new Node.IdentifierNode(this.next());
    }

    
    /**
     * 转换一个 stat。我们保证无论是否转换成功，上一个 stat 已经匹配到了自己的句尾。
     * 因此递归地调用 `parseStatement` 或者其附属方法在失败时不需要调用任何 skip 方法。
     * 
     * 而且由于我们保证了一个 stat 的完整性，因此 stat 的转换失败不会将错误传播到语句的外部。
     * 
     * 吃掉最后的;
     * @returns stat 的 node。
     */
    private parseStatement(): Node.Stat<NodeType> | undefined {
        var n = this._parse(0) as Node.Stat<NodeType>;
        this.skipIf([TokenType.SEP_SEMI]);
        return n;
        /*
        const ahead = this.lookAhead();
        switch (ahead) {
            case TokenType.SEP_LCURLY: // {
                return this.statBlock();
            case TokenType.KW_IF: // if
                return this.statIf();
            case TokenType.KW_WHILE: // while
                return this.statWhile();
            case TokenType.KW_DO: // do
                return this.statDo();
            case TokenType.KW_FOR: // for
                return this.statFor();
            case TokenType.KW_SWITCH:
                return this.statSwitch();
            case TokenType.KW_TRY:
                return this.statTry();
            case TokenType.KW_FUNCTION:
                return this.statFunction();
            case TokenType.KW_PROPERTY:
                return this.statProperty();
            case TokenType.KW_CLASS:
                return this.statClass();
            case TokenType.KW_WITH:
                return this.statWith();
            case TokenType.SEP_SEMI: // ;
                // empty statement
                return new Node.StatNode();
            default:
                return this.statExpr();
        }
        */
    }
    private statExpr(): Node.Stat {
        const stat = new Node.StatNode();
        const expr = this.parseExpression();
        if (!expr?.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            this.skipIf([TokenType.SEP_SEMI]);
            return stat;
        }
        stat.children.push(expr);
        if (!this.assertAndTake(TokenType.SEP_SEMI)) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            this.skipIf([TokenType.SEP_SEMI]);
            return stat;
        }
        stat.completed = true;
        return stat;
    }

    private statWhile(): Node.Stat {
        const stat = new Node.WhileNode();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            // while连(都没找到的话应当直接跳过整段，直到;
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        const expr = this.parseExpression();
        stat.pred = expr;
        // 解析失败或是没有以)结尾，如“while(1+2;”
        if (!expr?.completed || !this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            // 如果()之间parse出了问题，是否继续parse剩下的
            return stat;
        }
        const whileBody = this.parseStatement();
        stat.stat = whileBody;
        if(whileBody)
            stat.completed = whileBody.completed;
        //默认completed是false所以不需要else
        return stat;
    }

    private statDo(): Node.Stat {
        const stat = new Node.DoNode();
        const doBody = this.parseStatement();
        stat.stat = doBody;
        if (!this.assertAndTake(TokenType.KW_WHILE)) {
            // 为了完整性，我们这里忽略不正确的 while 部分。
            // 还没读到while，要直接跳到;
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            // 仅在读到(之后skip到)，否则skip到;
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        const expr = this.parseExpression();
        if (!expr?.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            //this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.pred = expr;
        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN, TokenType.SEP_SEMI]);
            return stat;
        }
        
        this.assertAndTake(TokenType.SEP_SEMI);

        if(expr)
            stat.completed = expr.completed;
        return stat;
    }

    private statFor(): Node.Stat {
        const stat = new Node.ForNode();
        //let completeFlag = true;
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        const init = this.parseExpression();
        if (init && !init.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            //completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        stat.init = init;

        const initSemi = this.lookAhead();
        if (initSemi !== TokenType.SEP_SEMI) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            //completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        this.next();

        const pred = this.parseExpression();
        if (pred && !pred.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            //completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        stat.pred = pred;

        const predSemi = this.lookAhead();
        if (predSemi !== TokenType.SEP_SEMI) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            //completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        this.next();

        const end = this.parseExpression();
        if (end && !end.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            //completeFlag = false;
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.end = end;

        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            //completeFlag = false;
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        
        const forBody = this.parseStatement();

        stat.stat = forBody;
        if (forBody)
            stat.completed = forBody.completed;
        return stat;
    }

    private statSwitch(): Node.SwitchNode {
        const stat = new Node.SwitchNode();

        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const expr = this.parseExpression();
        if (!expr?.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }

        if (!this.assertAndTake(TokenType.SEP_LCURLY)) {
            return stat;
        }

        while (true) {
            const ahead = this.lookAhead();
            let defaultTrigged = false;
            if (ahead === TokenType.KW_CASE) {
                if (defaultTrigged) {
                    this.errorStack.push(IDiagnostic.create(this.posAhead(), "cannot define cases after default tag"));
                }
                const caseNode = new Node.CaseNode();
                this.next();
                const pred = this.parseExpression();
                if (!pred?.completed) {
                    this.skipUntil(SKIP_UNTIL_GROUP.CASE_PRED);
                    this.skipIf([TokenType.SEP_COLON]);
                }
                caseNode.pred = pred;

                if (!this.assertAndTake(TokenType.SEP_COLON)) {
                    this.skipUntil(SKIP_UNTIL_GROUP.CASE_PRED);
                    this.skipIf([TokenType.SEP_COLON]);
                }
                while (true) {
                    const ahead = this.lookAhead();
                    if (ahead === TokenType.KW_CASE
                         || ahead === TokenType.KW_DEFAULT
                         || ahead === TokenType.SEP_RCURLY) {
                        break;
                    }
                    const caseStat = this.parseStatement();
                    caseNode.stats.push(caseStat);
                }
                stat.cases.push(caseNode);
            }
            else if (ahead === TokenType.KW_DEFAULT) {
                if (defaultTrigged) {
                    this.errorStack.push(IDiagnostic.create(this.posAhead(), "cannot redefine default tag"));
                }
                const defaultNode = new Node.CaseNode();
                this.next();
                if (!this.assertAndTake(TokenType.SEP_COLON)) {
                    this.skipUntil(SKIP_UNTIL_GROUP.CASE_PRED);
                    this.skipIf([TokenType.SEP_COLON]);
                }
                while (true) {
                    const ahead = this.lookAhead();
                    if (ahead === TokenType.KW_CASE
                         || ahead === TokenType.KW_DEFAULT
                         || ahead === TokenType.SEP_RCURLY) {
                        break;
                    }
                    const caseStat = this.parseStatement();
                    defaultNode.stats.push(caseStat);
                }

                stat.cases.push(defaultNode);
                defaultTrigged = true;
            }
            else if (ahead === TokenType.SEP_RCURLY) {
                //吃掉}
                this.next();
                break;
            }
            else if (ahead === TokenType.EOF) {
                this.assertAndTake(TokenType.SEP_RCURLY);
                return stat;
            }
            else {
                this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            }
        }

        stat.completed = true;
        return stat;
    }

    private statTry(): Node.Stat {
        const stat = new Node.TryNode();
        this.next();
        let lcurlyExpected = this.lookAhead();
        if (lcurlyExpected !== TokenType.SEP_LCURLY) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'{' expected"));
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        stat.tryBlock = this.statBlock();
        if (!this.assertAndTake(TokenType.KW_CATCH)) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'catch' expected"));
            return stat;
        }
        
        const optionalLparen = this.lookAhead();
        if (optionalLparen === TokenType.SEP_LPAREN) {
            this.next();
            stat.catchParam = this.parseIdentifier();
            if (!stat.catchParam) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            }
            if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
                if (!this.skipIf([TokenType.SEP_RPAREN])) {
                    return stat;
                }
            }
        }

        lcurlyExpected = this.lookAhead();
        if (lcurlyExpected !== TokenType.SEP_LCURLY) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'{' expected"));
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        stat.catchBlock = this.statBlock();
        stat.completed = stat.tryBlock.completed && stat.catchBlock.completed;
        return stat;
    }

    private statFunction(): Node.FunctionNode {
        const func = new Node.FunctionNode();
        func.name = this.parseIdentifier();
        //name为undefined表示匿名函数，不是出错
        
        const lparenExpected = this.lookAhead();
        if (lparenExpected === TokenType.SEP_LPAREN) {
            this.next();
            if (this.lookAhead() === TokenType.SEP_RPAREN) {
                this.next();
            }
            else {
                // parse parameter list
                let varargSaw = false;
                let varargShouldBeLastParamErrorEmitted = false;
                while (true) {
                    if (varargSaw && !varargShouldBeLastParamErrorEmitted) {
                        varargShouldBeLastParamErrorEmitted = true;
                        this.errorStack.push(IDiagnostic.create(this.posAhead(), "args parameter should be the last parameter"));
                    }
                    const parNameExpected = this.lookAhead();
                    const parNode = new Node.FunctionParameterNode();
                    let pushed = false;
                    if (parNameExpected === TokenType.IDENTIFIER) {
                        const id = this.parseIdentifier();
                        if (!id?.completed) {
                            this.skipUntil(SKIP_UNTIL_GROUP.PARAM_LIST);
                            if (this.lookAhead() !== TokenType.SEP_COMMA || this.lookAhead() !== TokenType.SEP_RPAREN) {
                                return func;
                            }
                            this.skipIf([TokenType.SEP_COMMA]);
                            continue;
                        }
                        parNode.nameExpr = id;

                        if (this.lookAhead() === TokenType.VARARG) {
                            varargSaw = true;
                            this.next();
                            parNode.parType = Node.FunctionParameterNode.FunctionParameterType.Args;
                            func.paramList.push(parNode);
                            pushed = true;
                            if (this.lookAhead() === TokenType.OP_ASSIGN) {
                                this.errorStack.push(IDiagnostic.create(this.posAhead(), "args parameter should not have an initializer"));
                            }
                        }
                    }
                    else if (parNameExpected === TokenType.VARARG) {
                        varargSaw = true;
                        this.next();
                        parNode.parType = Node.FunctionParameterNode.FunctionParameterType.UnnamedArgs;
                        func.paramList.push(parNode);
                        pushed = true;
                        if (this.lookAhead() === TokenType.OP_ASSIGN) {
                            this.errorStack.push(IDiagnostic.create(this.posAhead(), "args parameter should not have an initializer"));
                        }
                    }
                    else {
                        // emit an error
                        this.skipUntil([TokenType.IDENTIFIER, TokenType.VARARG]);
                        this.skipUntil(SKIP_UNTIL_GROUP.PARAM_LIST);
                        const commaExpected = this.lookAhead();
                        if (commaExpected !== TokenType.SEP_COMMA) {
                            this.skipIf([TokenType.SEP_RPAREN]);
                            return func;
                        }
                    }

                    if(!pushed)
                    {
                        const maybeAssign = this.lookAhead();
                        if (maybeAssign === TokenType.OP_ASSIGN) {
                            if (parNode.parType !== undefined) {
                                parNode.parType = Node.FunctionParameterNode.FunctionParameterType.WithInitializer;
                            }
                            this.next();
                            const init = this.parseExpression();
                            parNode.initExpr = init;
                            if (!init?.completed) {
                                this.skipUntil(SKIP_UNTIL_GROUP.PARAM_LIST);
                                if (this.lookAhead() !== TokenType.SEP_COMMA) {
                                    this.skipIf([TokenType.SEP_RPAREN]);
                                    return func;
                                }
                            }
                        }
                    }
                    
                    const commaOrRparen = this.lookAhead();
                    if (commaOrRparen === TokenType.SEP_COMMA) {
                        this.next();
                    }
                    else if (commaOrRparen === TokenType.SEP_RPAREN) {
                        break;
                    }
                    else {
                        this.skipUntil(SKIP_UNTIL_GROUP.PARAM_LIST);
                        if (this.lookAhead() !== TokenType.SEP_COMMA) {
                            this.skipIf([TokenType.SEP_RPAREN]);
                            return func;
                        }
                    }
                }

                const rparenExpected = this.lookAhead();
                if (rparenExpected !== TokenType.SEP_RPAREN) {
                    this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
                    if (!this.skipIf([TokenType.SEP_RPAREN])) {
                        return func;
                    }
                }
                this.next();
            }
        }
        
        let lcurlyExpected = this.lookAhead();
        if (lcurlyExpected !== TokenType.SEP_LCURLY) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'{' expected"));
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return func;
        }
        const body = this.statBlock();
        func.stat = body;
        func.completed = body.completed;
        return func;

    }

    private statPropertySetter(): Node.PropertySetterNode {
        const stat = new Node.PropertySetterNode();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            if (this.lookAhead() !== TokenType.SEP_LCURLY) {
                return stat;
            }
        }
        else {
            stat.arg = this.parseIdentifier();
            if(!stat.arg)
            {
                this.errorStack.push(IDiagnostic.create(this.posAhead(), "setter must has an argument"));
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
                if (this.lookAhead() !== TokenType.SEP_RPAREN) {
                    return stat;
                }
            }

            if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
                if (this.lookAhead() === TokenType.SEP_RPAREN) {
                    this.next();
                }
                else {
                    return stat;
                }
            }
        }

        let lcurlyExpected = this.lookAhead();
        if (lcurlyExpected !== TokenType.SEP_LCURLY) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'{' expected"));
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        const setterBody = this.statBlock();
        stat.block = setterBody;
        stat.completed = setterBody.completed;
        return stat;
    }

    private statPropertyGetter(): Node.PropertyGetterNode {
        const stat = new Node.PropertyGetterNode();
        this.next();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            if (this.lookAhead() !== TokenType.SEP_LCURLY) {
                return stat;
            }
        }
        else {
            if (this.lookAhead() === TokenType.IDENTIFIER) {
                this.errorStack.push(IDiagnostic.create(this.posAhead(), "getter should not have parameters"));
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            }

            if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
                if (this.lookAhead() === TokenType.SEP_RPAREN) {
                    this.next();
                }
                else {
                    return stat;
                }
            }
        }

        let lcurlyExpected = this.lookAhead();
        if (lcurlyExpected !== TokenType.SEP_LCURLY) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'{' expected"));
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        const getterBody = this.statBlock();
        stat.block = getterBody;
        stat.completed = getterBody.completed;
        return stat;
    }

    private statProperty(): Node.PropertyNode {
        const stat = new Node.PropertyNode();
        
        stat.name = this.parseIdentifier();
        if(!stat.name)
        {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "property must has a name"));
        }

        if (!this.assertAndTake(TokenType.SEP_LCURLY)) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        let setterDefined = false;
        let getterDefined = false;

        while (true) {
            const setterOrGetter = this.lookAhead();
            if (setterOrGetter === TokenType.KW_SETTER) {
                if (setterDefined) {
                    this.errorStack.push(IDiagnostic.create(this.posAhead(), "duplicated setter"));
                }
                setterDefined = true;
                this.next();
                const setter = this.statPropertySetter();
                stat.getterAndSetter.push(setter);
            }
            else if (setterOrGetter === TokenType.KW_GETTER) {
                if (getterDefined) {
                    this.errorStack.push(IDiagnostic.create(this.posAhead(), "duplicated getter"));
                }
                getterDefined = true;
                this.next();
                const getter = this.statPropertyGetter();
                stat.getterAndSetter.push(getter);
            }
            else if (setterOrGetter === TokenType.SEP_RCURLY || setterOrGetter === TokenType.EOF) {
                break;
            }
            else {
                this.errorStack.push(IDiagnostic.create(this.posAhead(), "keyword 'getter' or 'setter' expected"));
                this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
                return stat;
            }
        }

        if (!this.assertAndTake(TokenType.SEP_RCURLY)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RCURLY_EXPECTED);
            this.next();
            return stat;
        }
        //至少有任一个
        stat.completed = getterDefined || setterDefined;
        return stat;
    }

    private statVarEntry(): Node.VarEntryNode {
        const stat = new Node.VarEntryNode();
        const id = this.parseIdentifier();
        stat.name = id;
        if (!id) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        if (this.lookAhead() === TokenType.OP_ASSIGN) {
            this.next();
            const expr = this.parseExpression();
            stat.hasInitializer = true;
            stat.initializer = expr;
            if (!expr?.completed) {
                this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
                return stat;
            }
        }
        stat.completed = true;
        return stat;
    }

    private statVar(): Node.VarNode {
        const stat = new Node.VarNode();
        while (true) {
            const var0 = this.statVarEntry();
            stat.entries.push(var0);

            if (this.lookAhead() === TokenType.SEP_COMMA) {
                this.next();
                continue;
            }
            else if (this.lookAhead() === TokenType.SEP_SEMI || this.lookAhead() === TokenType.EOF) {
                break;
            }
        }
        if (!this.assertAndTake(TokenType.SEP_SEMI)) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            this.skipIf([TokenType.SEP_SEMI]);
            return stat;
        }
        stat.completed = true;
        return stat;
    }

    private statClass(): Node.Stat {
        const stat = new Node.ClassNode();
        const id = this.parseIdentifier();
        stat.name = id;
        if (!id) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        if (this.lookAhead() === TokenType.KW_EXTENDS) {
            this.next();
            while (true) {
                const base = this.parseIdentifier();
                if(base) {
                    stat.extendList.push(base);
                }
                else {
                    this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
                    break;
                }

                if (this.lookAhead() === TokenType.SEP_COMMA) {
                    this.next();
                }
                else if (this.lookAhead() === TokenType.SEP_LCURLY || this.lookAhead() === TokenType.EOF) {
                    break;
                }
            }
        }

        if (!this.assertAndTake(TokenType.SEP_LCURLY)) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        while (true) {
            let token = this.next();
            if (token.type === TokenType.KW_VAR) {
                stat.fields.push(this.statVar());
            }
            else if (token.type === TokenType.KW_PROPERTY) {
                stat.properties.push(this.statProperty());
            }
            else if (token.type === TokenType.KW_FUNCTION) {
                stat.methods.push(this.statFunction());
            }
            else if (token.type === TokenType.SEP_RCURLY) {
                break;
            }
            else if (token.type === TokenType.EOF){
                this.skipUntil(SKIP_UNTIL_GROUP.RCURLY_EXPECTED);
                this.skipIf([TokenType.SEP_RCURLY]);
                return stat;
            }
            else {
                this.errorStack.push(IDiagnostic.create(this.posAhead(), "'var', 'property', 'function' expected"));
                this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            }
        }

        stat.completed = true;
        return stat;
    }

    private statWith(): Node.Stat {
        const stat = new Node.WithNode();
        this.next();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const expr = this.parseExpression();
        if (!expr?.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.expr = expr;
        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        const withBody = this.parseStatement();
        stat.stat = withBody;
        if(withBody)
            stat.completed = withBody.completed;
        return stat;
    }

    private statIf(): Node.Stat {
        const stat = new Node.IfNode();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const expr0 = this.parseExpression();
        if (!expr0?.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.pred = expr0;

        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        const trueStat = this.parseStatement();
        stat.trueStat = trueStat;

        if (this.lookAhead() !== TokenType.KW_ELSE) {
            if(trueStat)
                stat.completed = trueStat.completed;
            return stat;
        }

        this.next();
        const falseStat = this.parseStatement();
        stat.falseStat = falseStat;

        if(trueStat && falseStat)
            stat.completed = trueStat.completed || falseStat.completed;
        return stat;
    }

    private statBlock(): Node.ChunkNode {
        const chunk = new Node.ChunkNode(false);
        for (let ahead = this.lookAhead(); ahead !== TokenType.EOF; ahead = this.lookAhead()) {
            if (ahead === TokenType.SEP_RCURLY) {
                this.next();
                chunk.completed = true;
                return chunk;
            }
            chunk.children.push(this.parseStatement());
        }

        // 总会产生一个错误
        this.assertAndTake(TokenType.SEP_RCURLY);

        chunk.completed = true;
        return chunk;
    }
}

