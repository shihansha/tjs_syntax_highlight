import { ILexer } from "../interfaces/ILexer";
import * as Node from "../ast/node";
import { NodeType } from "../ast/nodeType";
import { Token } from "../types/token";
import { TokenType } from "../types/tokenType";
import { LexerMode } from "../types/lexerMode";
import { IDiagnostic } from "../interfaces/IDiagnostic"
import { IRange } from "../interfaces/IRange";
import { IPosition } from "../interfaces/IPosition";

const TJS_MODE = LexerMode.TJS;

const SKIP_UNTIL_GROUP = {
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
        const lookAhead = this.lookAhead();
        var blockcount = 0;
        while(lookAhead != TokenType.EOF)
        {
            if (lookAhead == TokenType.SEP_LCURLY)
                blockcount++;
            if (lookAhead == TokenType.SEP_RCURLY)
                blockcount--;
            if (blockcount == 0 && (types.includes(lookAhead)))
                break;
            this.next();
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

    private _parse(rbp : number, tree: Node.Node)
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
        var node: Node.Node | undefined;
        switch(token.type)
        {
            case TokenType.NUMBER_BINARY:
            case TokenType.NUMBER_DECIMAL:
            case TokenType.NUMBER_HEXIMAL:
            case TokenType.NUMBER_OCTAL:
            case TokenType.STRING:
                node = new Node.ConstantNode();
                node.token = token;
                break;
        }
        while(rbp < this.LBP[next])
        {
            token = this.next();
            next = this.lookAhead();
            switch(token.type)
            {
                case TokenType.OP_ADD:
                    node = node?.addParent(new Node.AddNode());
            }
        }
    }

    public parse() : Node.Node {
        var pnode = new Node.ChunkNode(true);
        pnode.children.push(new Node.StatNode());
        this._parse(0, pnode.children[0]);
        while(this.lookAhead() != TokenType.EOF)
        {
            if(this.lookAhead() == TokenType.SEP_SEMI)
                this.next();
            var stat = new Node.StatNode();
            this._parse(0, stat);
            pnode.children.push(stat);
        }
        return pnode;
    }

    private parseExpression(): Node.Expr {
        throw new Error("Method not implemented.");
    }
    
    /**
     * 转换一个 stat。我们保证无论是否转换成功，上一个 stat 已经匹配到了自己的句尾。
     * 因此递归地调用 `parseStatement` 或者其附属方法在失败时不需要调用任何 skip 方法。
     * 
     * 而且由于我们保证了一个 stat 的完整性，因此 stat 的转换失败不会将错误传播到语句的外部。
     * @returns stat 的 node。
     */
    private parseStatement(): Node.Stat {
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
                const unexpected = this.next();
                this.errorStack.push(IDiagnostic.create(unexpected.range, `unexpected token '${unexpected.value}'`));
                this.skipToLineEnd();
                // return an empty statement node
                return new Node.StatNode();    
        }
    }
    private statExpr(): Node.Stat {
        const stat = new Node.StatNode();
        const expr = this.parseExpression();
        if (!expr.completed) {
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
        this.next();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const expr = this.parseExpression();
        if (!expr.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.pred = expr;
        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        const whileBody = this.parseStatement();
        stat.stat = whileBody;
        stat.completed = true;
        return stat;
    }

    private statDo(): Node.Stat {
        const stat = new Node.DoNode();
        this.next();
        const doBody = this.parseStatement();
        stat.stat = doBody;
        if (!this.assertAndTake(TokenType.KW_WHILE)) {
            // 为了完整性，我们这里忽略不正确的 while 部分。
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return doBody;
        }

        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return doBody;
        }
        const expr = this.parseExpression();
        if (!expr.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return doBody;
        }
        stat.pred = expr;
        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN, TokenType.SEP_SEMI]);
            return doBody;
        }
        
        this.assertAndTake(TokenType.SEP_SEMI);

        stat.completed = true;
        return stat;
    }
    private statFor(): Node.Stat {
        const stat = new Node.ForNode();
        let completeFlag = true;
        this.next();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const init = this.parseExpression();
        if (!init.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        stat.init = init;

        const initSemi = this.lookAhead();
        if (initSemi !== TokenType.SEP_SEMI) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        this.next();

        const pred = this.parseExpression();
        if (!pred.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        stat.pred = pred;

        const predSemi = this.lookAhead();
        if (predSemi !== TokenType.SEP_SEMI) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        this.next();

        const end = this.parseExpression();
        if (!end.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.end = end;

        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            completeFlag = false;
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        
        const forBody = this.parseStatement();

        stat.stat = forBody;
        stat.completed = completeFlag;
        return stat;
    }
    private statSwitch(): Node.SwitchNode {
        const stat = new Node.SwitchNode();
        this.next();

        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const expr = this.parseExpression();
        if (!expr.completed) {
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
            if (ahead === TokenType.KW_CASE) {
                // const caseNode = new Node.CaseNode();
                
            }
            else if (ahead === TokenType.KW_DEFAULT) {

            }
            else if (ahead === TokenType.SEP_RCURLY) {
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
        throw new Error("Method not implemented.");
    }

    private statTry(): Node.Stat {
        throw new Error("Method not implemented.");
    }
    private statFunction(): Node.Stat {
        throw new Error("Method not implemented.");
    }
    private statProperty(): Node.Stat {
        throw new Error("Method not implemented.");
    }
    private statClass(): Node.Stat {
        throw new Error("Method not implemented.");
    }
    private statWith(): Node.Stat {
        const stat = new Node.WithNode();
        this.next();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const expr = this.parseExpression();
        if (!expr.completed) {
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
        stat.completed = true;
        return stat;
    }

    private statIf(): Node.Stat {
        const stat = new Node.IfNode();
        this.next();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return stat;
        }
        const expr0 = this.parseExpression();
        if (!expr0.completed) {
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
            stat.completed = true;
            return stat;
        }

        this.next();
        const falseStat = this.parseStatement();
        stat.falseStat = falseStat;

        stat.completed = true;
        return stat;
    }

    private statBlock(): Node.ChunkNode {
        const chunk = new Node.ChunkNode(false);

        this.next();
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

