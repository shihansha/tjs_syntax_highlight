import { stringify } from "querystring";
import { ILexer } from "../interfaces/ILexer";
import { IPosition } from "../interfaces/IPosition";
import { IRange } from "../interfaces/IRange";
import { LexerMode } from "../types/lexerMode";
import { Token } from "../types/token";
import { KEYWORDS, TokenType } from "../types/tokenType";

interface LexerContext {
    chunkIndex: number;
    position: IPosition;
    mode: LexerMode;
}

interface LookAheadBuf {
    context: LexerContext;
    prefetchedToken: Token;
}

export class Lexer implements ILexer {

    private m_currentContext: LexerContext = {
        chunkIndex: 0,
        position: {
            line: 0,
            character: 0
        },
        mode: LexerMode.TJS
    };

    private m_lookAheadBuf: LookAheadBuf | null = null;

    private restCharLength(context: LexerContext) {
        return this.m_chunk.length - context.chunkIndex;
    }

    public get currentPosition() {
        return this.m_currentContext.position;
    }

    private getLeadingCharacters(context: LexerContext, n: number = 1) {
        return this.m_chunk.substring(context.chunkIndex, context.chunkIndex + n);
    }
    
    public constructor(
        public readonly chunkName: string,
        private readonly m_chunk: string,
    ) { }

    public lookAhead(mode: LexerMode): TokenType {
        if (this.m_lookAheadBuf) {
            if (this.m_lookAheadBuf.context.mode === mode) {
                return this.m_lookAheadBuf.prefetchedToken.type;
            }
            else {
                this.m_lookAheadBuf = null;
            }
        }

        const lookAheadContext = JSON.parse(JSON.stringify(this.m_currentContext)) as LexerContext;

        const prefetchedToken = this.nextTokenInside(mode, lookAheadContext);
        
        this.m_lookAheadBuf = {
            context: lookAheadContext,
            prefetchedToken: prefetchedToken
        };

        return prefetchedToken.type;
    }

    public nextToken(mode: LexerMode): Token {
        if (this.m_lookAheadBuf) {
            if (this.m_lookAheadBuf.context.mode === mode) {
                this.m_currentContext = this.m_lookAheadBuf.context;
                const token = this.m_lookAheadBuf.prefetchedToken;
                this.m_lookAheadBuf = null;
                return token;    
            }
            else {
                this.m_lookAheadBuf = null;
            }
        }

        return this.nextTokenInside(mode, this.m_currentContext);
    }

    private nextTokenInside(mode: LexerMode, context: LexerContext): Token {
        if (mode === LexerMode.TJS) {
            this.skipWhitespaceAndComment(context);

            if (context.chunkIndex === this.m_chunk.length) {
                return new Token(TokenType.EOF, this.getRange(context, 1), "");
            }
    
            switch (this.getLeadingCharacters(context)) {
                case ".": {
                    if (this.test(context, "...")) {
                        this.next(context, 3);
                        return new Token(TokenType.CALLERARG, this.getRange(context, -3), "...");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.SEP_DOT, this.getRange(context, -1), ".");
                    }
                }
                case "*": {
                    if (this.test(context, "*=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_MUL, this.getRange(context, -2), "*=");
                    }
                    else {
                        this.next(context, 1); 
                        return new Token(TokenType.VARARG, this.getRange(context, -1), "*");
                    }
                }
                case ";": this.next(context, 1); return new Token(TokenType.SEP_SEMI, this.getRange(context, -1), ";");
                case ",": this.next(context, 1); return new Token(TokenType.SEP_COMMA, this.getRange(context, -1), ",");
                case "=": {
                    if (this.test(context, "=>")) {
                        this.next(context, 2);
                        return new Token(TokenType.SEP_RARRAW, this.getRange(context, -2), "=>");
                    }
                    else if (this.test(context, "===")) {
                        this.next(context, 3);
                        return new Token(TokenType.OP_TPYE_EQ, this.getRange(context, -3), "===");
                    }
                    else if (this.test(context, "==")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_TPYE_EQ, this.getRange(context, -2), "==");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_ASSIGN, this.getRange(context, -1), "=");
                    }
                }
                case ":": this.next(context, 1); return new Token(TokenType.SEP_COLON, this.getRange(context, -1), ":");
                case "(": this.next(context, 1); return new Token(TokenType.SEP_LPAREN, this.getRange(context, -1), "(");
                case ")": this.next(context, 1); return new Token(TokenType.SEP_RPAREN, this.getRange(context, -1), ")");
                case "[": this.next(context, 1); return new Token(TokenType.SEP_LBRACK, this.getRange(context, -1), "[");
                case "]": this.next(context, 1); return new Token(TokenType.SEP_RPAREN, this.getRange(context, -1), "]");
                case "{": this.next(context, 1); return new Token(TokenType.SEP_LCURLY, this.getRange(context, -1), "{");
                case "}": this.next(context, 1); return new Token(TokenType.SEP_RCURLY, this.getRange(context, -1), "}");
                case "%": {
                    if (this.test(context, "%[")) {
                        this.next(context, 2);
                        return new Token(TokenType.SEP_LDICT, this.getRange(context, -2), "%[");
                    }
                    else if (this.test(context, "%=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_MOD, this.getRange(context, -2), "%=");
                    }
                    else if (this.test(context, "%>")) {
                        this.next(context, 2);
                        return new Token(TokenType.SEP_ROCTSTR, this.getRange(context, -2), "%>");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_MOD, this.getRange(context, -1), "%");
                    }
                }
    
                case "]": this.next(context, 1); return new Token(TokenType.SEP_RDICT, this.getRange(context, -1), "]");
                case "/": {
                    // comment has been handled
                    // check regular expression pattern
                    const pat = /^(\/(\\\/|[^\/\n\r])*\/)([gi]*)(?!\/)/;
                    const search = pat.exec(this.m_chunk.substring(context.chunkIndex));
                    if (search) {
                        const len = search[0].length;
                        this.next(context, len);
                        return new Token(TokenType.REGEX, this.getRange(context, -len), search[0]);
                    }
                    else if (this.test(context, "/=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_DIV, this.getRange(context, -2), "/=");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_DIV, this.getRange(context, -1), "/");
                    }
                }
                case "<": {
                    if (this.test(context, "<%")) {
                        this.next(context, 2);
                        return new Token(TokenType.SEP_LOCTSTR, this.getRange(context, -2), "<%");
                    }
                    else if (this.test(context, "<->")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_CHANGE, this.getRange(context, -3), "<->");
                    }
                    else if (this.test(context, "<<=")) {
                        this.next(context, 3);
                        return new Token(TokenType.OP_ASSIGN_SHL, this.getRange(context, -3), "<<=");
                    }
                    else if (this.test(context, "<=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_LE, this.getRange(context, -2), "<=");
                    }
                    else if (this.test(context, "<<")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_SHL, this.getRange(context, -2), "<<");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_LT, this.getRange(context, -1), "<");
                    }
                }
                case "@": {
                    // macro,
                    this.next(context, 1);
                    return new Token(TokenType.SEP_AT, this.getRange(context, -1), "@");
                }
                case "&": {
                    if (this.test(context, "&=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_BAND, this.getRange(context, -2), "&=");
                    }
                    else if (this.test(context, "&&=")) {
                        this.next(context, 3);
                        return new Token(TokenType.OP_ASSIGN_AND, this.getRange(context, -3), "&&=");
                    }
                    else if (this.test(context, "&&")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_AND, this.getRange(context, -2), "&&");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_BAND, this.getRange(context, -1), "&");
                    }
                }
                case "|": {
                    if (this.test(context, "|=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_BOR, this.getRange(context, -2), "|=");
                    }
                    else if (this.test(context, "||=")) {
                        this.next(context, 3);
                        return new Token(TokenType.OP_ASSIGN_OR, this.getRange(context, -3), "||=");
                    }
                    else if (this.test(context, "||")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_OR, this.getRange(context, -2), "||");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_BOR, this.getRange(context, -1), "|");
                    }
                }
                case "^": {
                    if (this.test(context, "^=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_BXOR, this.getRange(context, -2), "^=");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_BXOR, this.getRange(context, -1), "^");
                    }
                }
                case "-": {
                    if (this.test(context, "-=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_MINUS, this.getRange(context, -2), "-=");
                    }
                    else if (this.test(context, "--")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_DEC, this.getRange(context, -2), "--");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_MINUS, this.getRange(context, -1), "-");
                    }
                }
                case "+": {
                    if (this.test(context, "+=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_ADD, this.getRange(context, -2), "+=");
                    }
                    else if (this.test(context, "++")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_INC, this.getRange(context, -2), "++");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_ADD, this.getRange(context, -1), "+");
                    }
                }
                case "\\": {
                    if (this.test(context, "\\\\")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_ASSIGN_IDIV, this.getRange(context, -2), "\\=");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_IDIV, this.getRange(context, -1), "\\");
                    }
                }
                case ">": {
                    if (this.test(context, ">>=")) {
                        this.next(context, 3);
                        return new Token(TokenType.OP_ASSIGN_SHR, this.getRange(context, -3), ">>=");
                    }
                    else if (this.test(context, ">>>=")) {
                        this.next(context, 4);
                        return new Token(TokenType.OP_ASSIGN_USHR, this.getRange(context, -4), ">>>=");
                    }
                    else if (this.test(context, ">=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_GE, this.getRange(context, -2), ">=");
                    }
                    else if (this.test(context, ">>>")) {
                        this.next(context, 3);
                        return new Token(TokenType.OP_USHR, this.getRange(context, -3), ">>>");
                    }
                    else if (this.test(context, ">>")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_SHR, this.getRange(context, -2), ">>");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_GT, this.getRange(context, -1), ">");
                    }
                }
                case "?": this.next(context, 1); return new Token(TokenType.OP_CONDITIONAL_QM, this.getRange(context, -1), "?");
                case "!": {
                    if (this.test(context, "!==")) {
                        this.next(context, 3);
                        return new Token(TokenType.OP_TYPE_NE, this.getRange(context, -3), "!==");
                    }
                    else if (this.test(context, "!=")) {
                        this.next(context, 2);
                        return new Token(TokenType.OP_NE, this.getRange(context, -2), "!=");
                    }
                    else {
                        this.next(context, 1);
                        return new Token(TokenType.OP_NOT, this.getRange(context, -1), "!");
                    }
                }
                case "~": this.next(context, 1); return new Token(TokenType.OP_BNOT, this.getRange(context, -1), "~");
                case "\"": return this.handleString(context, "\"");
                case "\'": return this.handleString(context, "\'");
            }
    
            if (this.isCharacter(this.getLeadingCharacters(context))) {
                const pat = /^(?:[_a-zA-Z]|[^\x00-\xff])(?:[_a-zA-Z0-9]|[^\x00-\xff])*/;
                const res = pat.exec(this.m_chunk.substring(context.chunkIndex));
                if (res) {
                    const len = res[0].length;
                    this.next(context, len);
                    const type = KEYWORDS[res[0]];
                    if (type !== undefined) {
                        return new Token(type, this.getRange(context, -len), res[0]);
                    }
                    else {
                        return new Token(TokenType.IDENTIFIER, this.getRange(context, -len), res[0]);
                    }
                }
            }
            else if (this.isNumber(this.getLeadingCharacters(context))) {
                const pattern0 = /(?<!\w)\.?\d(?:(?:[0-9a-zA-Z\._])|(?<=[eEpP])[+-])*/;
                const result0 = pattern0.exec(this.m_chunk.substring(context.chunkIndex));
                if (result0) {
                    const decPat = /(^(?=[1-9\.]))([0-9]*)((?:(?<=[0-9])|\.(?=[0-9])))([0-9]*)([eE](\+?)(\-?)([0-9]*))?$/;
                    const binPat = /(^0[bB])([01]*)((?:(?<=[01])|\.(?=[01])))([01]*)([pP](\+?)(\-?)([01]*))?$/;
                    const octPat = /(^0(?=[0-7]))([0-7]*)((?:(?<=[0-7])|\.(?=[0-7])))([0-7]*)([pP](\+?)(\-?)([0-7]*))?$/;
                    const hexPat = /(^0[xX])([0-9a-fA-F]*)((?:(?<=[0-9a-fA-F])|\.(?=[0-9a-fA-F])))([0-9a-fA-F]*)([pP](\+?)(\-?)([0-9a-fA-F]*))?$/;
                    
                    const numStr = result0[0];
                    this.next(context, numStr.length);
                    const range = this.getRange(context, -numStr.length);
                    const decRes = decPat.exec(numStr);
                    if (decRes) {
                        return new Token(TokenType.NUMBER_DECIMAL, range, numStr);
                    }
                    const hexRes = hexPat.exec(numStr);
                    if (hexRes) {
                        return new Token(TokenType.NUMBER_HEXIMAL, range, numStr);
                    }
                    const binRes = binPat.exec(numStr);
                    if (binRes) {
                        return new Token(TokenType.NUMBER_BINARY, range, numStr);
                    }
                    const octRes = octPat.exec(numStr);
                    if (octRes) {
                        return new Token(TokenType.NUMBER_OCTAL, range, numStr);
                    }
    
                    return new Token(TokenType.UNEXPECTED, range, numStr, "Illegal number");
                }
            }
    
            const counts = this.countToWhitespace(context);
            const invalidText = this.m_chunk.substring(context.chunkIndex, context.chunkIndex + counts);
            this.next(context, counts);
            return new Token(TokenType.UNEXPECTED, this.getRange(context, -counts), invalidText, "Illegal token");
    
        }
        else if (mode === LexerMode.TJSInterpolatedStringDoubleQuoted) {
            if (this.test(context, "\"")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_QUOTE_DOUBLE, this.getRange(context, -1), "\"");
            }
            else if (this.test(context, "${")) {
                this.next(context, 2);
                return new Token(TokenType.SEP_LINTER_DOLLAR, this.getRange(context, -2), "${");
            }
            else if (this.test(context, "}")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_RINTER_DOLLAR, this.getRange(context, -1), "}");
            }
            else if (this.test(context, "&")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_LINTER_AND, this.getRange(context, -1), "&");
            }
            else if (this.test(context, ";")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_RINTER_AND, this.getRange(context, -1), ";");
            }
            else {
                return this.handleInterpolatedString(context, "\"");
            }
        }
        else if (mode === LexerMode.TJSInterpolatedStringSingleQuoted) {
            if (this.test(context, "'")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_QUOTE_SINGLE, this.getRange(context, -1), "'");
            }
            else if (this.test(context, "${")) {
                this.next(context, 2);
                return new Token(TokenType.SEP_LINTER_DOLLAR, this.getRange(context, -2), "${");
            }
            else if (this.test(context, "}")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_RINTER_DOLLAR, this.getRange(context, -1), "}");
            }
            else if (this.test(context, "&")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_LINTER_AND, this.getRange(context, -1), "&");
            }
            else if (this.test(context, ";")) {
                this.next(context, 1);
                return new Token(TokenType.SEP_RINTER_AND, this.getRange(context, -1), ";");
            }
            else {
                return this.handleInterpolatedString(context, "'");
            }
        }

        throw new Error("no touch");
    }

    private handleString(context: LexerContext, leading: string) {
        let res: RegExpExecArray | null;
        if (leading === "\"") {
            const pat = /^"((?:\\"|[^\r\n])*)"/;
            res = pat.exec(this.m_chunk.substring(context.chunkIndex));
        }
        else { // leading === "\'"
            const pat = /^'((?:\\'|[^\r\n])*)'/;
            res = pat.exec(this.m_chunk.substring(context.chunkIndex));
        }

        if (res) {
            const originalStr = res[1];
            const { str, diagnostic } = this.escapeString(originalStr);
            this.next(context, res[0].length);
            if (diagnostic !== undefined) {
                return new Token(TokenType.UNEXPECTED, this.getRange(context, -res[0].length), res[0], "Illegal string: " + diagnostic);
            }
            else {
                return new Token(TokenType.STRING, this.getRange(context, -res[0].length), str);
            }
        }
        else {
            const toEOL = this.countToChangeLine(context);
            const str = this.getLeadingCharacters(context, toEOL);
            this.next(context, toEOL);
            return new Token(TokenType.UNEXPECTED, this.getRange(context, -toEOL), str, "Unfinished string");
        }
    }

    private escapeString(str: string): { str: string, diagnostic?: string } {
        let buf = "";
        while (str.length > 0) {
            if (str[0] !== "\\") {
                buf += str[0];
                str = str.substring(1);
                continue;
            }
            if (str.length === 1) {
                // unfinished string
                return { str: "", diagnostic: "unfinished string" };
            }
            switch(str[1]) {
                case "a": buf += "\a"; str = str.substring(2); continue;
                case "b": buf += "\b"; str = str.substring(2); continue;
                case "f": buf += "\f"; str = str.substring(2); continue;
                case "n": buf += "\n"; str = str.substring(2); continue;
                case "r": buf += "\r"; str = str.substring(2); continue;
                case "t": buf += "\t"; str = str.substring(2); continue;
                case "v": buf += "\v"; str = str.substring(2); continue;
                case "\"": buf += "\""; str = str.substring(2); continue;
                case "\'": buf += "\'"; str = str.substring(2); continue;
                case "\\": buf += "\\"; str = str.substring(2); continue;
                case "x":
                case "X": 
                    {
                        const pat = /^\\x([0-9a-fA-F]{1,4})/;
                        const res = pat.exec(str);
                        if (res) {
                            const d = parseInt(res[1], 16);
                            buf += String.fromCharCode(d);
                            str = str.substring(res[0].length);
                            continue;
                        }
                        else {
                            // illegal number
                            return { str: "", diagnostic: "\\x should be followed by number" };
                        }
                    }
                default: return { str: "", diagnostic: `unsupported escape: \\${str[1]}` }; // illegal escape
            }
        }
        return { str: buf };
    }

    private countToChangeLine(context: LexerContext): number {
        let count = 0;
        while (this.restCharLength(context) - count > 0) {
            if (this.m_chunk[context.chunkIndex + count] == "\n") {
                break;
            }
            count++;
        }
        return count;
    }


    private countToWhitespace(context: LexerContext): number {
        let count = 0;
        while (this.restCharLength(context) - count > 0) {
            if (this.isWhitespace(this.m_chunk[context.chunkIndex + count])) {
                break;
            }
            count++;
        }
        return count;
    }

    private handleInterpolatedString(context: LexerContext, quote: "\"" | "'") {
        const originalStr = this.m_chunk.substring(context.chunkIndex);
        let pat: RegExp;
        if (quote === "\"") {
            pat = /^((?:\\"|\\$|\\&|[^"$&\r\n])*)(?=\$\{|&|")/;
        }
        else { // quote === "'"
            pat = /^((?:\\'|\\$|\\&|[^'$&\r\n])*)(?=\$\{|&|')/;
        }
        const res = pat.exec(originalStr);
        if (res) {
            let str = res[1];
            let len = str.length;
            this.next(context, len);
            return new Token(TokenType.STRING_INTERPOLATED, this.getRange(context, -len), str);
        }
        else {
            let len = this.countToChangeLine(context);
            const str = this.m_chunk.substring(context.chunkIndex, context.chunkIndex + len);
            this.next(context, len);
            return new Token(TokenType.UNEXPECTED, this.getRange(context, -len), str, "Unfinished interpolated string");
        }
    }

    private isNumber(c: string) {
        return (c >= "0" && c <= "9") || c === ".";
    }

    private isCharacter(c: string) {
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c == "_") || (c > "\xff");
    }

    private skipWhitespaceAndComment(context: LexerContext) {
        while (this.restCharLength(context) > 0) {
            if (this.test(context, "/*")) {
                this.skipLongComment(context);
            }
            else if (this.test(context, "//")) {
                this.skipShortComment(context);
            }
            else if (this.test(context, "\r\n") || this.test(context, "\n\r")) {
                this.next(context, 2);
                this.incLine(context);
            }
            else if (this.test(context, "\r") || this.test(context, "\n")) {
                this.next(context, 1);
                this.incLine(context);
            }
            else if (this.isWhitespace(this.getLeadingCharacters(context))) {
                this.next(context, 1);
            }
            else {
                break;
            }
        }
    }

    private skipLongComment(context: LexerContext) {
        this.next(context, 2);
        while (!this.test(context, "*/")) {
            if (this.test(context, "\r\n") || this.test(context, "\n\r")) {
                this.next(context, 2);
                this.incLine(context);
            }
            else if (this.test(context, "\r") || this.test(context, "\n")) {
                this.next(context, 1);
                this.incLine(context);
            }
        }
        this.next(context, 2);
    }

    private skipShortComment(context: LexerContext) {
        this.next(context, 2);
        while (this.restCharLength(context) > 0) {
            if (!this.isNewLine(this.getLeadingCharacters(context))) {
                this.next(context, 1);
            }
            else {
                break;
            }
        }
    }

    private isWhitespace(c: string) {
        if (c == '\t' || c == '\n' || c == '\v' || c == '\f' || c == '\r' || c == ' ') {
            return true;
        }
        return false;

    }

    private incLine(context: LexerContext) {
        context.position.line++;
        context.position.character = 0;
    }

    private next(context: LexerContext, n: number) {
        context.chunkIndex += n;
        context.position.character += n;
    }

    private isNewLine(c: string) {
        return (c == "\r" || c == "\n");
    }

    private test(context: LexerContext, startWith: string): boolean {
        return this.m_chunk.startsWith(startWith, context.chunkIndex);
    }

    private getRange(context: LexerContext, len: number): IRange {
        const curr = context.position;
        return len >= 0 ? { 
            start: { 
                line: curr.line, 
                character: curr.character 
            }, 
            end: { 
                line: curr.line, 
                character: curr.character + len 
            } 
        } : {
            start: { 
                line: curr.line, 
                character: curr.character + len
            }, 
            end: { 
                line: curr.line, 
                character: curr.character
            } 
        }
    };

    public nextTokenOfKind<T extends TokenType>(mode: LexerMode, type: T): Token<T> | null {
        if (this.lookAhead(mode) === type) {
            return this.nextToken(mode) as Token<T>;
        }
        return null;
    }

    public skipUntil(mode: LexerMode, types: TokenType[]): void {
        while (true) {
            const look = this.lookAhead(mode);
            if (look === TokenType.EOF) {
                return;
            }
            else if (types.indexOf(look) !== -1) {
                break;
            }
            else {
                this.nextToken(mode);
            }
        }
    }
}

