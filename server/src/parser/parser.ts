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
     * 期望得到一个 ']'。 
     */
    RBRACK_EXPECTED: [TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY, TokenType.SEP_RBRACK],
     /**
     * 在数组的构造中。
     */
    IN_ARRAY: [TokenType.SEP_RBRACK, TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY,  TokenType.SEP_COMMA],
    /**
     * 在字典的构造中。
     */
    IN_DICT: [TokenType.SEP_RBRACK, TokenType.SEP_SEMI, TokenType.SEP_LCURLY, TokenType.SEP_RCURLY,  TokenType.SEP_COMMA, TokenType.SEP_RARRAW],
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
    public readonly errorStack: IDiagnostic[] = [];
    public readonly tokens: Token[] = [];

    constructor(
        public readonly chunkName: string,
        private readonly lexer: ILexer
    ) { }

    public parse(): Node.BlockNode {
        return this.statGlobal();
    }

    private next(mode: LexerMode = LexerMode.TJS) {
        const tok = this.lexer.nextToken(mode);
        this.tokens.push(tok);
        return tok;
    }
    private lookAhead(mode: LexerMode = LexerMode.TJS) {
        return this.lexer.lookAhead(mode);
    }

    private skipIf(types: readonly TokenType[], mode: LexerMode = LexerMode.TJS) {
        const lookAhead = this.lookAhead(mode);
        if (types.includes(lookAhead)) {
            this.next(mode);
            return true;
        }
        return false;
    }
    private skipUntil(types: readonly TokenType[], mode: LexerMode = LexerMode.TJS) {
        let lookAhead = this.lookAhead(mode);
        var blockcount = 0;
        while(lookAhead != TokenType.EOF)
        {
            if (blockcount == 0 && (types.includes(lookAhead)))
                break;
            if (lookAhead == TokenType.SEP_LCURLY)
                blockcount++;
            else if (lookAhead == TokenType.SEP_RCURLY)
                blockcount--;
            this.next(mode);
            lookAhead = this.lookAhead(mode);
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
            const val = new Node.LiteralNode(outNum, BasicTypes.Real, token);
            val.completed = true;
            return val;
        }
        else {
            const val = new Node.LiteralNode(outNum, BasicTypes.Integer, token);
            val.completed = true;
            return val;
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

    /**
     * 转换一个 expr。expr 代表存在一个值的节点。
     * 
     * 转换一个 expr 时，我们约定，出错时不调用 `skip` 方法，而是将 `completed` 标记为 `false`，然后直接返回。
     * stat 的转换器负责从错误中恢复。
     */
    private parseExpression(mode: LexerMode): Node.Expr {
        return this.exprIf(mode);
    }

    //#region parser of expression
    private exprIf(mode: LexerMode): Node.Expr {
        let operand0 = this.exprOrder(mode);
        const ops = [TokenType.OP_IF];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprOrder(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprOrder(mode: LexerMode): Node.Expr {
        let operand0 = this.exprAssign(mode);
        const ops = [TokenType.OP_SEQ];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprAssign(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprAssign(mode: LexerMode): Node.Expr {
        const operand0 = this.exprCond(mode);
        const ahead = this.lookAhead(mode);
        const ops = [TokenType.OP_ASSIGN, TokenType.OP_ASSIGN_CHANGE, TokenType.OP_ASSIGN_BAND, TokenType.OP_ASSIGN_BOR, TokenType.OP_ASSIGN_BXOR, TokenType.OP_ASSIGN_MINUS, TokenType.OP_ASSIGN_ADD, TokenType.OP_ASSIGN_MOD, TokenType.OP_ASSIGN_DIV, TokenType.OP_ASSIGN_IDIV, TokenType.OP_ASSIGN_MUL, TokenType.OP_ASSIGN_OR, TokenType.OP_ASSIGN_AND, TokenType.OP_ASSIGN_SHR, TokenType.OP_ASSIGN_SHL, TokenType.OP_ASSIGN_USHR];
        if (ops.includes(ahead)) {
            const opcode = this.next(mode);
            const operand1 = this.exprAssign(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            return res;
        }
        else {
            return operand0;
        }

    }

    private exprCond(mode: LexerMode): Node.Expr {
        let operand0 = this.exprLogicOr(mode);
        while (this.lookAhead(mode) === TokenType.OP_CONDITIONAL_QM) {
            this.next(mode);
            const operand1 = this.exprCond(mode);
            if (!this.assertAndTake(TokenType.OP_CONDITIONAL_COLON, mode)) {
                const res = new Node.CondOpExpr(operand0, operand1, Node.LiteralNode.illegal);
                operand0.parent = res;
                operand1.parent = res;
                res.completed = false;
                return res;
            }
            const operand2 = this.exprCond(mode);
            const res = new Node.CondOpExpr(operand0, operand1, operand2);
            operand0.parent = res;
            operand1.parent = res;
            operand2.parent = res;
            res.completed = operand0.completed && operand1.completed && operand2.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprLogicOr(mode: LexerMode): Node.Expr {
        let operand0 = this.exprLogicAnd(mode);
        const ops = [TokenType.OP_OR];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprLogicAnd(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprLogicAnd(mode: LexerMode): Node.Expr {
        let operand0 = this.exprBitwiseOr(mode);
        const ops = [TokenType.OP_AND];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprBitwiseOr(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprBitwiseOr(mode: LexerMode): Node.Expr {
        let operand0 = this.exprBitwiseXor(mode);
        const ops = [TokenType.OP_BOR];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprBitwiseXor(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprBitwiseXor(mode: LexerMode): Node.Expr {
        let operand0 = this.exprBitwiseAnd(mode);
        const ops = [TokenType.OP_BXOR];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprBitwiseAnd(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprBitwiseAnd(mode: LexerMode): Node.Expr {
        let operand0 = this.exprEqu(mode);
        const ops = [TokenType.OP_BAND];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprEqu(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprEqu(mode: LexerMode): Node.Expr {
        let operand0 = this.exprComp(mode);
        const ops = [TokenType.OP_EQ, TokenType.OP_NE, TokenType.OP_TPYE_EQ, TokenType.OP_TYPE_NE];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprComp(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }
    
    private exprComp(mode: LexerMode): Node.Expr {
        let operand0 = this.exprShift(mode);
        const ops = [TokenType.OP_LT, TokenType.OP_GT, TokenType.OP_LE, TokenType.OP_GE];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprShift(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprShift(mode: LexerMode): Node.Expr {
        let operand0 = this.exprAddSub(mode);
        const ops = [TokenType.OP_SHR, TokenType.OP_SHL, TokenType.OP_USHR];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprAddSub(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprAddSub(mode: LexerMode): Node.Expr {
        let operand0 = this.exprMulDiv(mode);
        const ops = [TokenType.OP_ADD, TokenType.OP_MINUS];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprMulDiv(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;

    }

    private exprMulDiv(mode: LexerMode): Node.Expr {
        let operand0 = this.exprUnary(mode);
        const ops = [TokenType.OP_MOD, TokenType.OP_DIV, TokenType.OP_IDIV, TokenType.OP_MUL];
        while (ops.includes(this.lookAhead(mode))) {
            const opcode = this.next(mode);
            const operand1 = this.exprUnary(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            operand0 = res;
        }
        return operand0;
    }

    private exprUnary(mode: LexerMode): Node.Expr {
        const ahead = this.lookAhead(mode);
        const ops = [TokenType.OP_NOT, TokenType.OP_BNOT, TokenType.OP_DEC, TokenType.OP_INC, TokenType.OP_NEW, TokenType.OP_INVALIDATE, TokenType.OP_ISVALID, TokenType.OP_DELETE, TokenType.OP_TYPEOF, TokenType.OP_CHAR_ENCODE, TokenType.OP_CHAR_DECODE, TokenType.OP_UNARY_PLUS, TokenType.OP_UNARY_MINUS, TokenType.OP_PROPERTY_GETOBJ, TokenType.OP_PROPERTY_CALLOBJ, TokenType.OP_INSTANCEOF, TokenType.OP_INCONTEXTOF, TokenType.OP_MUL];
        if (ops.includes(ahead)) {
            const opcode = this.next(mode);
            const operand = this.exprSpecial(mode);
            const res = new Node.UnaryOpExpr(opcode, operand, true);
            operand.parent = res;
            res.completed = operand.completed;
            return res;
        }
        else {
            return this.exprSpecial(mode);
        }
    }

    private exprSpecial(mode: LexerMode): Node.Expr {
        const ahead = this.lookAhead(mode);
        if (ahead === TokenType.SEP_LPAREN) {
            this.next(mode);
            const exp = this.parseExpression(mode);
            if (!this.assertAndTake(TokenType.SEP_RPAREN, mode)) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED, mode);
                this.skipIf([TokenType.SEP_RPAREN], mode);
            }
            return exp;
        }
        else if (ahead === TokenType.SEP_LBRACK) {
            return this.exprArr(mode);
        }
        else if (ahead === TokenType.SEP_LDICT) {
            return this.exprDict(mode);
        }
        else if (ahead === TokenType.SEP_AT) {
            this.next(mode);
            const isDoubleQuote = this.lookAhead(LexerMode.TJSInterpolatedStringDoubleQuoted) === TokenType.SEP_QUOTE_DOUBLE;
            const isSingleQuote = this.lookAhead(LexerMode.TJSInterpolatedStringSingleQuoted) === TokenType.SEP_QUOTE_SINGLE;
            if (isDoubleQuote) {
                return this.exprInterpolateString(TokenType.SEP_QUOTE_DOUBLE);
            }
            else if (isSingleQuote) {
                return this.exprInterpolateString(TokenType.SEP_QUOTE_SINGLE);
            }
            else {
                this.errorStack.push(IDiagnostic.create(this.posAhead(mode), "'\"' or ''' expected"));
                return Node.LiteralNode.illegal;
            }
        }
        else if (ahead === TokenType.OP_INT || ahead === TokenType.OP_REAL || ahead === TokenType.OP_STRING) {
            const op = this.next(mode);
            // right-associated operator
            const operand = this.exprSpecial(mode);
            const res = new Node.UnaryOpExpr(op, operand, false);
            operand.parent = res;
            res.completed = operand.completed;
            return res;
        }

        const operand0 = this.exprBasic(mode);
        const op = this.lookAhead(mode);
        if (op === TokenType.SEP_LPAREN) {
            const opcode = this.next(mode);
            let operand1 = Node.LiteralNode.epsilon;
            operand1.completed = true;
            if (this.lookAhead() !== TokenType.SEP_RPAREN) {
                operand1 = this.parListExpr(mode, TokenType.SEP_RPAREN, SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            }
            if (!this.assertAndTake(TokenType.SEP_RPAREN, mode)) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED, mode);
                this.skipIf([TokenType.SEP_RPAREN], mode);
            }
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            return res;
        }
        else if (op === TokenType.SEP_LBRACK) {
            const opcode = this.next(mode);
            const operand1 = this.parseExpression(mode);
            if (!this.assertAndTake(TokenType.SEP_RBRACK, mode)) {
                this.skipUntil(SKIP_UNTIL_GROUP.RBRACK_EXPECTED, mode);
                this.skipIf([TokenType.SEP_RBRACK], mode);
            }
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            return res;
        }
        else if (op === TokenType.OP_ACCESS) {
            const opcode = this.next(mode);
            const operand1 = this.exprSpecial(mode);
            const res = new Node.BinaryOpExpr(operand0, opcode, operand1);
            operand0.parent = res;
            operand1.parent = res;
            res.completed = operand0.completed && operand1.completed;
            return res;
        }
        else if (op === TokenType.OP_INC) {
            const opcode = this.next(mode);
            const res = new Node.UnaryOpExpr(opcode, operand0, false);
            operand0.parent = res;
            res.completed = operand0.completed;
            return res;
        }
        else if (op === TokenType.OP_DEC) {
            const opcode = this.next(mode);
            const res = new Node.UnaryOpExpr(opcode, operand0, false);
            operand0.parent = res;
            res.completed = operand0.completed;
            return res;
        }
        else if (op === TokenType.OP_EVAL) {
            const opcode = this.next(mode);
            const res = new Node.UnaryOpExpr(opcode, operand0, false);
            operand0.parent = res;
            res.completed = operand0.completed;
            return res;
        }
        return operand0;
    }

    private exprArr(mode: LexerMode): Node.Expr {
        this.next(mode);
        const arr = new Node.ArrayExpr();
        const parList = this.parListExpr(mode, TokenType.SEP_RBRACK, SKIP_UNTIL_GROUP.RBRACK_EXPECTED);
        arr.entries = parList;
        parList.parent = arr;
        if (!this.assertAndTake(TokenType.SEP_RBRACK, mode)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RBRACK_EXPECTED, mode);
            if (!this.skipIf([TokenType.SEP_RBRACK], mode)) {
                return arr;
            }
        }
        arr.completed = parList.completed;
        return arr;
    }

    private exprDict(mode: LexerMode): Node.Expr {
        this.next(mode);
        const dict = new Node.DictExpr();
        if (this.lookAhead(mode) === TokenType.SEP_RBRACK) {
            dict.completed = true;
            return dict;
        }

        let count = 0;
        let expectSep = false;

        const parList = new Node.ParListNode();
        dict.entries = parList;
        parList.parent = dict;

        while (true) {
            if (this.lookAhead(mode) === TokenType.EOF) {
                return dict;
            }
            if (this.lookAhead(mode) === TokenType.SEP_COMMA
                || this.lookAhead(mode) === TokenType.SEP_RARRAW) {
                if (!expectSep) {
                    count++;
                    const emptyParEntry = new Node.ParEntryNode();
                    emptyParEntry.parType = Node.ParEntryNode.ParEntryType.Empty;
                    parList.params.push(emptyParEntry);
                    emptyParEntry.parent = parList;
                }
                const tok = this.next(mode);
                if (tok.type === TokenType.SEP_RARRAW && (count % 2 === 0)) {
                    this.errorStack.push(IDiagnostic.create(tok.range, "should use ','"));
                }

                expectSep = false;
                continue;
            }
            if (this.lookAhead(mode) === TokenType.SEP_RBRACK) {
                parList.completed = true;
                break;
            }
            count++;
            expectSep = true;
            if (this.lookAhead(mode) === TokenType.VARARG) {
                this.next(mode);
                const varargEntry = new Node.ParEntryNode();
                varargEntry.parType = Node.ParEntryNode.ParEntryType.UnnamedArgs;
                parList.params.push(varargEntry);
                varargEntry.parent = parList;
            }
            else if (this.lookAhead(mode) === TokenType.CALLERARG) {
                this.next(mode);
                const callerargEntry = new Node.ParEntryNode();
                callerargEntry.parType = Node.ParEntryNode.ParEntryType.CallerArgs;
                parList.params.push(callerargEntry);
                callerargEntry.parent = parList;
            }
            else {
                const exprEntry = new Node.ParEntryNode();
                const expr = this.exprAssign(mode);
                exprEntry.expr = expr;
                exprEntry.completed = expr.completed;
                expr.parent = exprEntry;
                parList.params.push(exprEntry);
                exprEntry.parent = parList;
                if (!expr.completed) {
                    this.skipUntil(SKIP_UNTIL_GROUP.RCURLY_EXPECTED, mode);
                    if (this.lookAhead(mode) !== TokenType.SEP_RBRACK) {
                        return dict;
                    }
                }
            }
        }

        this.next(mode);
        dict.completed = parList.completed;
        return dict;
    }

    private exprTerminatedExpr(ter: TokenType, quoteType: TokenType.SEP_QUOTE_SINGLE | TokenType.SEP_QUOTE_DOUBLE, mode: LexerMode) {
        if (this.lookAhead(mode) === ter) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(mode), "expression expected"));
            this.next(mode);
            return Node.LiteralNode.illegal;
        }
        const expr = this.parseExpression(LexerMode.TJS);
        if (!this.assertAndTake(ter, mode)) {
            this.skipUntil([ter, quoteType], mode);
            if (this.lookAhead(mode) === ter) {
                this.next(mode);
            }
        }
        return expr;
    }

    private exprInterpolateString(quoteType: TokenType.SEP_QUOTE_SINGLE | TokenType.SEP_QUOTE_DOUBLE): Node.InterpolatedString {
        const mode = quoteType === TokenType.SEP_QUOTE_DOUBLE ? LexerMode.TJSInterpolatedStringDoubleQuoted : LexerMode.TJSInterpolatedStringDoubleQuoted;
        this.next(mode);
        const iStr = new Node.InterpolatedString();

        while (true) {
            const tok = this.next(mode);
            if (tok.type === TokenType.EOF) {
                return iStr;
            }
            else if (tok.type === TokenType.UNEXPECTED) {
                return iStr;
            }
            else if (tok.type === TokenType.SEP_LINTER_DOLLAR) {
                const expr = this.exprTerminatedExpr(TokenType.SEP_RINTER_DOLLAR, quoteType, mode);
                expr.parent = iStr;
                iStr.children.push(expr);
            }
            else if (tok.type === TokenType.SEP_LINTER_AND) {
                const expr = this.exprTerminatedExpr(TokenType.SEP_RINTER_AND, quoteType, mode);
                expr.parent = iStr;
                iStr.children.push(expr);
            }
            else if (tok.type === quoteType) {
                iStr.completed = true;
                return iStr;
            }
            else if (tok.type === TokenType.STRING_INTERPOLATED) {
                const expr = new Node.LiteralNode(tok.value, BasicTypes.String, tok);
                expr.parent = iStr;
                iStr.children.push(expr);
            }
            else {
                throw new Error("unexpected token");
            }
        }
    }
    //#endregion

    private exprBasic(mode: LexerMode): Node.Expr {
        const ahead = this.lookAhead(mode);
        if (ahead === TokenType.IDENTIFIER) {
            return this.exprIdentifier(mode);
        }
        else {
            return this.exprLiteral(mode);
        }
    }

    private exprIdentifier(mode: LexerMode): Node.IdentifierNode {
        const ahead = this.lookAhead(mode);
        if (ahead === TokenType.IDENTIFIER) {
            const tok = this.next(mode);
            const id = new Node.IdentifierNode(tok.value, tok);
            id.completed = true;
            return id;
        }
        this.assertAndTake(TokenType.IDENTIFIER, mode);
        return Node.IdentifierNode.illegal;
    }

    private exprLiteral(mode: LexerMode): Node.LiteralNode {
        const ahead = this.lookAhead(mode);
        const numType = [TokenType.NUMBER_BINARY, TokenType.NUMBER_OCTAL, TokenType.NUMBER_DECIMAL, TokenType.NUMBER_HEXIMAL];
        if (numType.includes(ahead)) {
            return this.parseNumber(mode);
        }
        else if (ahead === TokenType.STRING) {
            const tok = this.next(mode);
            const node = new Node.LiteralNode(tok.value, BasicTypes.String, tok);
            node.completed = true;
            return node;
        }
        const msg = `Literal value expected.`;
        this.errorStack.push(IDiagnostic.create(this.posAhead(), msg));
        return Node.LiteralNode.illegal;
    }

    private parseNumber(mode: LexerMode): Node.LiteralNode {
        const ahead = this.lookAhead(mode);
        if (ahead === TokenType.NUMBER_BINARY ||
            ahead === TokenType.NUMBER_OCTAL ||
            ahead === TokenType.NUMBER_DECIMAL ||
            ahead === TokenType.NUMBER_HEXIMAL) {
            const val = this.handleNumber(this.next(mode));
            return val;
        }
        return Node.LiteralNode.illegal;
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
            case TokenType.KW_VAR:
                return this.statVar();
            case TokenType.SEP_SEMI: // ;
                // empty statement
                return new Node.Stat();
            default:
                return this.statExpr();
        }
    }
    private parListExpr(mode: LexerMode, endTokenType: TokenType, skipList: readonly TokenType[]): Node.ParListNode {
        const parList = new Node.ParListNode();
        let expectSep = false;
        while (true) {
            if (this.lookAhead(mode) === TokenType.EOF) {
                return parList;
            }
            if (this.lookAhead(mode) === TokenType.SEP_COMMA) {
                this.next(mode);
                if (!expectSep) {
                    const emptyParEntry = new Node.ParEntryNode();
                    emptyParEntry.parType = Node.ParEntryNode.ParEntryType.Empty;
                    parList.params.push(emptyParEntry);
                    emptyParEntry.parent = parList;
                }
                expectSep = false;
                continue;
            }
            if (this.lookAhead(mode) === endTokenType) {
                parList.completed = true;
                return parList;
            }
            expectSep = true;
            if (this.lookAhead(mode) === TokenType.VARARG) {
                this.next(mode);
                const varargEntry = new Node.ParEntryNode();
                varargEntry.parType = Node.ParEntryNode.ParEntryType.UnnamedArgs;
                parList.params.push(varargEntry);
                varargEntry.parent = parList;
            }
            else if (this.lookAhead(mode) === TokenType.CALLERARG) {
                this.next(mode);
                const callerargEntry = new Node.ParEntryNode();
                callerargEntry.parType = Node.ParEntryNode.ParEntryType.CallerArgs;
                parList.params.push(callerargEntry);
                callerargEntry.parent = parList;
            }
            else {
                const exprEntry = new Node.ParEntryNode();
                const expr = this.exprAssign(mode);
                exprEntry.expr = expr;
                exprEntry.completed = expr.completed;
                expr.parent = exprEntry;
                parList.params.push(exprEntry);
                exprEntry.parent = parList;
                if (!expr.completed) {
                    this.skipUntil(skipList, mode);
                    if (this.lookAhead(mode) !== endTokenType) {
                        return parList;
                    }
                }
            }
        }
    }
    private statExpr(): Node.Stat {
        const stat = new Node.ExprStat();
        const expr = this.parseExpression(LexerMode.TJS);
        expr.parent = stat;
        stat.expr = expr;
        if (!expr.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            this.assertAndTake(TokenType.SEP_SEMI);
            return stat;
        }
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
        const expr = this.parseExpression(LexerMode.TJS);
        if (!expr.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.pred = expr;
        expr.parent = stat;
        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        const whileBody = this.parseStatement();
        stat.stat = whileBody;
        whileBody.parent = stat;
        stat.completed = true;
        return stat;
    }

    private statDo(): Node.Stat {
        const stat = new Node.DoNode();
        this.next();
        const doBody = this.parseStatement();
        stat.stat = doBody;
        doBody.parent = stat;
        if (!this.assertAndTake(TokenType.KW_WHILE)) {
            // 为了完整性，我们这里忽略不正确的 while 部分。
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return doBody;
        }

        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            return doBody;
        }
        const expr = this.parseExpression(LexerMode.TJS);
        if (!expr.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return doBody;
        }
        stat.pred = expr;
        expr.parent = stat;
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
        const init = this.parseExpression(LexerMode.TJS);
        if (!init.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        stat.init = init;
        init.parent = stat;

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

        const pred = this.parseExpression(LexerMode.TJS);
        if (!pred.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            if (this.lookAhead() !== TokenType.SEP_SEMI) {
                this.skipIf([TokenType.SEP_RPAREN]);
                return stat;
            }
        }
        stat.pred = pred;
        pred.parent = stat;

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

        const end = this.parseExpression(LexerMode.TJS);
        if (!end.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.FOR_EXPR);
            completeFlag = false;
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.end = end;
        end.parent = stat;

        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            completeFlag = false;
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        
        const forBody = this.parseStatement();

        stat.stat = forBody;
        forBody.parent = stat;
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
        const expr = this.parseExpression(LexerMode.TJS);
        stat.expr = expr;
        expr.parent = stat;
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
            let defaultTrigged = false;
            if (ahead === TokenType.KW_CASE) {
                if (defaultTrigged) {
                    this.errorStack.push(IDiagnostic.create(this.posAhead(), "cannot define cases after default tag"));
                }
                const caseNode = new Node.CaseNode();
                this.next();
                const pred = this.parseExpression(LexerMode.TJS);
                if (!pred.completed) {
                    this.skipUntil(SKIP_UNTIL_GROUP.CASE_PRED);
                    this.skipIf([TokenType.SEP_COLON]);
                }
                caseNode.pred = pred;
                pred.parent = caseNode;

                if (!this.assertAndTake(TokenType.SEP_COLON)) {
                    this.skipUntil(SKIP_UNTIL_GROUP.CASE_PRED);
                    this.skipIf([TokenType.SEP_COLON]);
                }
                while (true) {
                    const ahead = this.lookAhead();
                    if (ahead === TokenType.KW_CASE || ahead === TokenType.KW_DEFAULT || ahead === TokenType.SEP_RCURLY) {
                        break;
                    }
                    const caseStat = this.parseStatement();
                    caseNode.stats.push(caseStat);
                    caseStat.parent = caseNode;
                }

                stat.cases.push(caseNode);
                caseNode.parent = stat;
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
                    if (ahead === TokenType.KW_CASE || ahead === TokenType.KW_DEFAULT || ahead === TokenType.SEP_RCURLY) {
                        break;
                    }
                    const caseStat = this.parseStatement();
                    defaultNode.stats.push(caseStat);
                    caseStat.parent = defaultNode;
                }

                stat.cases.push(defaultNode);
                defaultNode.parent = stat;
                defaultTrigged = true;
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
        
        stat.completed = true;
        return stat;
    }

    private statTry(): Node.Stat {
        const stat = new Node.TryNode();
        this.next();
        const lcurlyExpected = this.lookAhead();
        if (lcurlyExpected !== TokenType.SEP_LCURLY) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'{' expected"));
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        const tryBlock = this.statBlock();
        stat.tryBlock = tryBlock;
        tryBlock.parent = stat;
        if (!this.assertAndTake(TokenType.KW_CATCH)) {
            this.errorStack.push(IDiagnostic.create(this.posAhead(), "'catch' expected"));
            return stat;
        }
        
        const optionalLparen = this.lookAhead();
        if (optionalLparen === TokenType.SEP_LPAREN) {
            this.next();
            const optionalIdentifier = this.exprIdentifier(LexerMode.TJS);
            if (!optionalIdentifier.completed) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            }
            stat.catchParam = optionalIdentifier;
            optionalIdentifier.parent = stat;
            if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
                this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
                if (!this.skipIf([TokenType.SEP_RPAREN])) {
                    return stat;
                }
            }
        }

        const catchBlock = this.statBlock();
        stat.catchBlock = catchBlock;
        catchBlock.parent = stat;
        stat.completed = true;
        return stat;
    }
    private statFunction(): Node.FunctionNode {
        const func = new Node.FunctionNode();
        this.next();
        const funcName = this.exprIdentifier(LexerMode.TJS);
        if (!funcName.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return func;
        }
        func.id = funcName;
        funcName.parent = func;
        
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
                    if (parNameExpected === TokenType.IDENTIFIER) {
                        const id = this.exprIdentifier(LexerMode.TJS);
                        if (!id.completed) {
                            this.skipUntil(SKIP_UNTIL_GROUP.PARAM_LIST);
                            if (this.lookAhead() !== TokenType.SEP_COMMA || this.lookAhead() !== TokenType.SEP_RPAREN) {
                                return func;
                            }
                            this.skipIf([TokenType.SEP_COMMA]);
                            continue;
                        }
                        parNode.nameExpr = id;
                        id.parent = parNode;

                        if (this.lookAhead() === TokenType.VARARG) {
                            varargSaw = true;
                            this.next();
                            parNode.parType = Node.FunctionParameterNode.FunctionParameterType.Args;
                            func.paramList.push(parNode);
                            parNode.parent = func;
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
                        parNode.parent = func;
                        if (this.lookAhead() === TokenType.OP_ASSIGN) {
                            this.errorStack.push(IDiagnostic.create(this.posAhead(), "args parameter should not have an initializer"));
                        }
                    }
                    else {
                        // emit an error
                        this.errorStack.push(IDiagnostic.create(this.posAhead(), "identifier, '...', '*' or ')' expected"));
                        this.skipUntil([TokenType.IDENTIFIER, TokenType.VARARG]);
                        this.skipUntil(SKIP_UNTIL_GROUP.PARAM_LIST);
                        const commaExpected = this.lookAhead();
                        if (commaExpected !== TokenType.SEP_COMMA) {
                            this.skipIf([TokenType.SEP_RPAREN]);
                            return func;
                        }
                    }

                    const maybeAssign = this.lookAhead();
                    if (maybeAssign === TokenType.OP_ASSIGN) {
                        if (parNode.parType !== undefined) {
                            parNode.parType = Node.FunctionParameterNode.FunctionParameterType.WithInitializer;
                        }
                        this.next();
                        const init = this.parseExpression(LexerMode.TJS);
                        parNode.initExpr = init;
                        init.parent = parNode;
                        if (!init.completed) {
                            this.skipUntil(SKIP_UNTIL_GROUP.PARAM_LIST);
                            if (this.lookAhead() !== TokenType.SEP_COMMA) {
                                this.skipIf([TokenType.SEP_RPAREN]);
                                return func;
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
        
        const body = this.statBlock();
        func.stat = body;
        body.parent = func;
        func.completed = true;
        return func;

    }
    private statPropertySetter(): Node.PropertySetterNode {
        const stat = new Node.PropertySetterNode();
        this.next();
        if (!this.assertAndTake(TokenType.SEP_LPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.PAREN_EXP_EXPECTED);
            if (this.lookAhead() !== TokenType.SEP_LCURLY) {
                return stat;
            }
        }
        else {
            const id = this.exprIdentifier(LexerMode.TJS);
            stat.arg = id;
            id.parent = stat;
            if (!id.completed) {
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

        const setterBody = this.statBlock();
        stat.block = setterBody;
        setterBody.parent = stat.block;
        stat.completed = true;
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

        const getterBody = this.statBlock();
        stat.block = getterBody;
        getterBody.parent = stat;
        stat.completed = true;
        return stat;
    }
    private statProperty(): Node.PropertyNode {
        const stat = new Node.PropertyNode();
        this.next();
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
                const setter = this.statPropertySetter();
                stat.getterAndSetter.push(setter);
                setter.parent = stat;
            }
            else if (setterOrGetter === TokenType.KW_GETTER) {
                if (getterDefined) {
                    this.errorStack.push(IDiagnostic.create(this.posAhead(), "duplicated getter"));
                }
                getterDefined = true;
                const getter = this.statPropertyGetter();
                stat.getterAndSetter.push(getter);
                getter.parent = stat;
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
        stat.completed = true;
        return stat;
    }
    private statVarEntry(): Node.VarEntryNode {
        const stat = new Node.VarEntryNode();
        const id = this.exprIdentifier(LexerMode.TJS);
        stat.name = id;
        id.parent = stat;
        if (!id.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        if (this.lookAhead() === TokenType.OP_ASSIGN) {
            this.next();
            const expr = this.parseExpression(LexerMode.TJS);
            stat.hasInitializer = true;
            stat.initializer = expr;
            expr.parent = stat;
            if (!expr.completed) {
                this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
                return stat;
            }
        }
        stat.completed = true;
        return stat;
    }
    private statVar(): Node.VarNode {
        const stat = new Node.VarNode();
        this.next(); // var
        while (true) {
            const var0 = this.statVarEntry();
            stat.entries.push(var0);
            var0.parent = stat;

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
        const id = this.exprIdentifier(LexerMode.TJS);
        stat.name = id;
        id.parent = stat;
        if (!id.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return stat;
        }
        if (this.lookAhead() === TokenType.KW_EXTENDS) {
            this.next();
            while (true) {
                const base = this.parseExpression(LexerMode.TJS);
                stat.extendList.push(base);
                base.parent = stat;
                if (!base.completed) {
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
            if (this.lookAhead() === TokenType.KW_VAR) {
                const statVar = this.statVar();
                stat.fields.push(statVar);
                statVar.parent = stat;
            }
            else if (this.lookAhead() === TokenType.KW_PROPERTY) {
                const statProperty = this.statProperty();
                stat.properties.push(statProperty);
                statProperty.parent = stat;
            }
            else if (this.lookAhead() === TokenType.KW_FUNCTION) {
                const statFunction = this.statFunction();
                stat.methods.push(statFunction);
                statFunction.parent = stat;
            }
            else if (this.lookAhead() === TokenType.SEP_RCURLY || this.lookAhead() === TokenType.EOF) {
                break;
            }
            else {
                this.errorStack.push(IDiagnostic.create(this.posAhead(), "'var', 'property', 'function' expected"));
                this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            }
        }

        if (!this.assertAndTake(TokenType.SEP_RCURLY)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RCURLY_EXPECTED);
            this.skipIf([TokenType.SEP_RCURLY]);
            return stat;
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
        const expr = this.parseExpression(LexerMode.TJS);
        if (!expr.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.expr = expr;
        expr.parent = stat;
        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        const withBody = this.parseStatement();
        stat.stat = withBody;
        withBody.parent = stat;
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
        const expr0 = this.parseExpression(LexerMode.TJS);
        if (!expr0.completed) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        stat.pred = expr0;
        expr0.parent = stat;

        if (!this.assertAndTake(TokenType.SEP_RPAREN)) {
            this.skipUntil(SKIP_UNTIL_GROUP.RPAREN_EXPECTED);
            this.skipIf([TokenType.SEP_RPAREN]);
            return stat;
        }
        const trueStat = this.parseStatement();
        stat.trueStat = trueStat;
        trueStat.parent = stat;

        if (this.lookAhead() !== TokenType.KW_ELSE) {
            stat.completed = true;
            return stat;
        }

        this.next();
        const falseStat = this.parseStatement();
        stat.falseStat = falseStat;
        falseStat.parent = stat;

        stat.completed = true;
        return stat;
    }

    private statBlock(): Node.BlockNode {
        const chunk = new Node.BlockNode(false);

        if (!this.assertAndTake(TokenType.SEP_LCURLY)) {
            this.skipUntil(SKIP_UNTIL_GROUP.STAT_END);
            return chunk;
        }
        for (let ahead = this.lookAhead(); ahead !== TokenType.EOF; ahead = this.lookAhead()) {
            if (ahead === TokenType.SEP_RCURLY) {
                this.next();
                chunk.completed = true;
                return chunk;
            }
            const stat = this.parseStatement();
            chunk.stats.push(stat);
            stat.parent = chunk;
        }

        // 总会产生一个错误
        this.assertAndTake(TokenType.SEP_RCURLY);

        chunk.completed = true;
        return chunk;
    }
    private statGlobal(): Node.BlockNode {
        const chunk = new Node.BlockNode(true);
        for (let ahead = this.lookAhead(); ahead !== TokenType.EOF; ahead = this.lookAhead()) {
            const stat = this.parseStatement();
            chunk.stats.push(stat);
            stat.parent = chunk;
        }
        chunk.completed = true;
        return chunk;
    }
}

