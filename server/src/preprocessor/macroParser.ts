/**
 * expression lists: 
 * 
 * E := '(' exp0 ')'
 * exp0 := exp1 ',' exp1 | exp1
 * exp1 := %IDENTIFER '=' exp2 | exp2
 * exp2 := exp3 '||' exp3 | exp3
 * exp3 := exp4 '&&' exp4 | exp4
 * exp4 := exp5 '|' exp5 | exp5
 * exp5 := exp6 '^' exp6 | exp6
 * exp6 := exp7 '&' exp7 | exp7
 * exp7 := exp8 '==' exp8 | exp8 '!=' exp8 | exp8
 * exp8 := exp9 '<' exp9 | exp9 '>' exp9 
 *       | exp9 '<=' exp9 | exp9 '>=' exp9 | exp9
 * exp9 := exp10 '+' exp10 | exp10 '-' exp10 | exp10
 * exp10 := exp11 '%' exp11 | exp11 '/' exp11 | exp11 '*' exp11 | exp11
 * exp11 := '!' exp12 | '+' exp12 | '-' exp12 | exp12
 * exp12 := '(' exp0 ')' | literal
 * literal := %NUMBER | %IDENTIFER
 */

import { IDefineList } from "../interfaces/IDefineList";
import { IDiagnostic } from "../interfaces/IDiagnostic";
import { ILexer } from "../interfaces/ILexer";
import { IPosition } from "../interfaces/IPosition";
import { Lexer } from "../lexer/lexer";
import { LexerMode } from "../types/lexerMode";
import { TokenType } from "../types/tokenType";

type MacroParserResult = MacroParserResultSuccess | MacroParserResultFail;

interface MacroParserResultBase {
    success: boolean,
    chunkIndex: number,
    position: IPosition,
    def: IDefineList
}

interface MacroParserResultSuccess extends MacroParserResultBase {
    success: true,
    value: number,
}

interface MacroParserResultFail extends MacroParserResultBase {
    success: false,
    diagnostic: IDiagnostic
}

abstract class MacroExpr {
    abstract eval(): number;
}

class MacroNumberExpr extends MacroExpr {
    eval(): number {
        return this.m_val;
    }
    constructor(
        private readonly m_val: number
    ) { 
        super();
    }
}

class MacroVariableExpr extends MacroExpr {
    constructor(
        private readonly m_name: string,
        private readonly m_def: IDefineList
    ) {
        super();
    }

    eval(): number {
        return this.m_def[this.m_name] ?? 0;
    }

    assign(value: number) {
        this.m_def[this.m_name] = value;
    }
}

export class MacroParser {
    private readonly m_lex: ILexer;
    private readonly m_mode = LexerMode.TJSMacro;
    public constructor(
        public readonly chunkName: string,
        m_chunk: string,
        m_chunkIndex: number,
        m_position: IPosition,
        private readonly m_defines: IDefineList,
    ) { 
        this.m_lex = new Lexer(chunkName, m_chunk, { 
            chunkIndex: m_chunkIndex, 
            position: IPosition.clone(m_position) 
        });
    }
    private m_diagnostic?: IDiagnostic;

    public parse(): MacroParserResult {
        const res = this.parseE();
        if (isNaN(res)) {
            return {
                success: false,
                diagnostic: this.m_diagnostic!,
                chunkIndex: this.m_lex.chunkIndex,
                position: this.m_lex.currentPosition,
                def: this.m_defines
            };
        }
        else {
            return {
                success: true,
                value: res,
                chunkIndex: this.m_lex.chunkIndex,
                position: this.m_lex.currentPosition,
                def: this.m_defines
            };
        }
    }

    private parseE(): number {
        try {
            this.m_lex.nextToken(this.m_mode); // '('
            const result0 = this.parseExp0();
            if (this.m_lex.lookAhead(this.m_mode) === TokenType.SEP_RPAREN) {
                this.m_lex.nextToken(this.m_mode);
                return result0.eval();
            }
            else {
                const tok = this.m_lex.nextToken(this.m_mode);
                this.m_diagnostic = IDiagnostic.create(tok.range, "')' expected");
            }
            this.m_lex.skipUntil(this.m_mode, [TokenType.SEP_RPAREN]);
            if (this.m_lex.lookAhead(this.m_mode) === TokenType.SEP_RPAREN) {
                this.m_lex.nextToken(this.m_mode);
            }
            return NaN;
        }
        catch {
            this.m_lex.skipUntil(this.m_mode, [TokenType.SEP_RPAREN]);
            if (this.m_lex.lookAhead(this.m_mode) === TokenType.SEP_RPAREN) {
                this.m_lex.nextToken(this.m_mode);
            }
            return NaN;
        }
    }

    private parseExp0(): MacroExpr {
        const par0 = this.parseExp1();
        par0.eval();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.SEP_COMMA) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp1();
            return par1;
        }
        else {
            return par0;
        }
    }
    private parseExp1(): MacroExpr {
        const par0t = this.m_lex.lookAhead(this.m_mode);
        if (par0t === TokenType.IDENTIFIER) {
            const par0 = this.parseIdentifier();
            const op = this.m_lex.lookAhead(this.m_mode);
            if (op === TokenType.OP_ASSIGN) {
                this.m_lex.nextToken(this.m_mode);
                const par1 = this.parseExp2();
                par0.assign(par1.eval());
                return par0;
            }
            else {
                return par0;
            }
        }
        const par0 = this.parseExp2();
        return par0;
    }
    private parseExp2(): MacroExpr {
        const par0 = this.parseExp3();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_OR) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp3();
            return new MacroNumberExpr(par0.eval() || par1.eval());
        }
        return par0;
    }
    private parseExp3(): MacroExpr {
        const par0 = this.parseExp4();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_AND) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp4();
            return new MacroNumberExpr(par0.eval() && par1.eval());
        }
        return par0;
    }
    private parseExp4(): MacroExpr {
        const par0 = this.parseExp5();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_BOR) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp5();
            return new MacroNumberExpr(par0.eval() | par1.eval());
        }
        return par0;
    }
    private parseExp5(): MacroExpr {
        const par0 = this.parseExp6();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_BXOR) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp6();
            return new MacroNumberExpr(par0.eval() ^ par1.eval());
        }
        return par0;
    }
    private parseExp6(): MacroExpr {
        const par0 = this.parseExp7();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_BAND) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp7();
            return new MacroNumberExpr(par0.eval() || par1.eval());
        }
        return par0;
    }
    private parseExp7(): MacroExpr {
        const par0 = this.parseExp8();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_EQ) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp8();
            return new MacroNumberExpr((par0.eval() === par1.eval()) ? 1 : 0);
        }
        else if (op === TokenType.OP_NE) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp8();
            return new MacroNumberExpr((par0.eval() !== par1.eval()) ? 1 : 0);
        }
        return par0;
    }
    private parseExp8(): MacroExpr {
        const par0 = this.parseExp9();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_LT) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp9();
            return new MacroNumberExpr((par0.eval() < par1.eval()) ? 1 : 0);
        }
        else if (op === TokenType.OP_GT) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp9();
            return new MacroNumberExpr((par0.eval() > par1.eval()) ? 1 : 0);
        }
        else if (op === TokenType.OP_LE) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp9();
            return new MacroNumberExpr((par0.eval() <= par1.eval()) ? 1 : 0);
        }
        else if (op === TokenType.OP_GE) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp9();
            return new MacroNumberExpr((par0.eval() >= par1.eval()) ? 1 : 0);
        }
        return par0;
    }
    private parseExp9(): MacroExpr {
        const par0 = this.parseExp10();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_ADD) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp10();
            return new MacroNumberExpr(par0.eval() + par1.eval());
        }
        else if (op === TokenType.OP_MINUS) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp10();
            return new MacroNumberExpr(par0.eval() - par1.eval());
        }
        return par0;
    }
    private parseExp10(): MacroExpr {
        const par0 = this.parseExp11();
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_MOD) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp11();
            return new MacroNumberExpr(par0.eval() % par1.eval());
        }
        else if (op === TokenType.OP_DIV) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp11();
            return new MacroNumberExpr(par0.eval() / par1.eval());
        }
        else if (op === TokenType.OP_MUL) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp11();
            return new MacroNumberExpr(par0.eval() * par1.eval());
        }
        return par0;
    }
    private parseExp11(): MacroExpr {
        const op = this.m_lex.lookAhead(this.m_mode);
        if (op === TokenType.OP_NOT) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp12();
            return new MacroNumberExpr(par1.eval() === 0 ? 1 : 0);
        }
        else if (op === TokenType.OP_UNARY_PLUS) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp12();
            return new MacroNumberExpr(par1.eval());
        }
        else if (op === TokenType.OP_UNARY_MINUS) {
            this.m_lex.nextToken(this.m_mode);
            const par1 = this.parseExp12();
            return new MacroNumberExpr(-par1.eval());
        }
        const par1 = this.parseExp12();
        return par1;
    }
    private parseExp12(): MacroExpr {
        const op0 = this.m_lex.lookAhead(this.m_mode);
        let par0: MacroExpr;
        if (op0 === TokenType.SEP_LPAREN) {
            this.m_lex.nextToken(this.m_mode);
            try {
                par0 = this.parseExp0();
            }
            catch (e) {
                this.m_lex.skipUntil(this.m_mode, [TokenType.SEP_RPAREN]);
                if (this.m_lex.lookAhead(this.m_mode) === TokenType.SEP_RPAREN) {
                    this.m_lex.nextToken(this.m_mode);
                }
                console.log(new Error().stack);
                throw e;
            }
            const op1 = this.m_lex.nextToken(this.m_mode);
            if (op1.type !== TokenType.SEP_RPAREN) {
                this.m_diagnostic = IDiagnostic.create(op1.range, "')' expected. " + (op1.diagnostic ?? ""));
                this.m_lex.skipUntil(this.m_mode, [TokenType.SEP_RPAREN]);
                if (this.m_lex.lookAhead(this.m_mode) === TokenType.SEP_RPAREN) {
                    this.m_lex.nextToken(this.m_mode);
                }
                console.log(new Error().stack);
                throw new Error();
            }
            return par0;
        }
        else {
            return this.parseLiteral();
        }
    }
    private parseLiteral(): MacroExpr {
        const par0 = this.m_lex.lookAhead(this.m_mode);
        if (par0 === TokenType.NUMBER_BINARY || par0 === TokenType.NUMBER_OCTAL
            || par0 === TokenType.NUMBER_DECIMAL || par0 === TokenType.NUMBER_HEXIMAL) {
            return this.parseNumber();
        }
        else if (par0 === TokenType.IDENTIFIER) {
            return this.parseIdentifier();
        }
        const par0v = this.m_lex.nextToken(this.m_mode);
        this.m_diagnostic = IDiagnostic.create(par0v.range, "number or identifier expected. " + (par0v.diagnostic ?? ""));
        console.log(new Error().stack);
        throw new Error();
}
    private parseNumber(): MacroNumberExpr {
        const par0 = this.m_lex.nextToken(this.m_mode);
        if (par0.type === TokenType.NUMBER_BINARY) {
            return new MacroNumberExpr(parseInt(par0.value.substring(2), 2));
        }
        else if (par0.type === TokenType.NUMBER_OCTAL) {
            return new MacroNumberExpr(parseInt(par0.value.substring(1), 8));
        }
        else if (par0.type === TokenType.NUMBER_DECIMAL) {
            return new MacroNumberExpr(parseInt(par0.value, 10));
        }
        else { // par0.type === TokenType.NUMBER_HEXIMAL
            return new MacroNumberExpr(parseInt(par0.value.substring(2), 16));
        }
    }
    private parseIdentifier(): MacroVariableExpr {
        const par0 = this.m_lex.nextToken(this.m_mode);
        return new MacroVariableExpr(par0.value, this.m_defines);
    }
}
