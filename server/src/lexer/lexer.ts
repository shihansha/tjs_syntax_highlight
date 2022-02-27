import { ILexer } from "../interfaces/ILexer";
import { IPosition } from "../interfaces/IPosition";
import { IRange } from "../interfaces/IRange";
import { Token } from "../types/token";
import { KEYWORDS, TokenType } from "../types/tokenType";


export class Lexer implements ILexer {

    private m_currentPosition: IPosition = {
        line: 1,
        character: 1
    };

    private m_chunkIndex = 0;

    private m_nextToken: Token | null = null;
    private m_positionSave: IPosition | null = null;

    private get m_restCharLength() {
        return this.m_chunk.length - this.m_chunkIndex;
    }

    public get currentPosition() {
        if (this.m_positionSave) {
            return this.m_positionSave;
        }
        return this.m_currentPosition;
    }

    private getLeadingCharacters(n: number = 1) {
        return this.m_chunk.substring(this.m_chunkIndex, this.m_chunkIndex + n);
    }
    
    public constructor(
        public readonly chunkName: string,
        private readonly m_chunk: string,
    ) { }

    public lookAhead(): TokenType {
        if (this.m_nextToken) {
            return this.m_nextToken.type;
        }

        this.m_positionSave = {
            line: this.m_currentPosition.line,
            character: this.m_currentPosition.character
        };

        this.m_nextToken = this.nextToken();
        return this.m_nextToken.type;
    }

    public nextToken(): Token {
        if (this.m_nextToken) {
            const temp = this.m_nextToken;
            this.m_nextToken = null;
            this.m_positionSave = null;
            return temp;
        }

        this.skipWhitespaceAndComment();

        if (this.m_chunkIndex === this.m_chunk.length) {
            return new Token(TokenType.EOF, this.getRange(1), "");
        }

        switch (this.getLeadingCharacters()) {
            case ".": {
                if (this.test("...")) {
                    this.next(3);
                    return new Token(TokenType.CALLERARG, this.getRange(-3), "...");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.SEP_DOT, this.getRange(-1), ".");
                }
            }
            case "*": {
                if (this.test("*=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_MUL, this.getRange(-2), "*=");
                }
                else {
                    this.next(1); 
                    return new Token(TokenType.VARARG, this.getRange(-1), "*");
                }
            }
            case ";": this.next(1); return new Token(TokenType.SEP_SEMI, this.getRange(-1), ";");
            case ",": this.next(1); return new Token(TokenType.SEP_COMMA, this.getRange(-1), ",");
            case "=": {
                if (this.test("=>")) {
                    this.next(2);
                    return new Token(TokenType.SEP_RARRAW, this.getRange(-2), "=>");
                }
                else if (this.test("===")) {
                    this.next(3);
                    return new Token(TokenType.OP_TPYE_EQ, this.getRange(-3), "===");
                }
                else if (this.test("==")) {
                    this.next(2);
                    return new Token(TokenType.OP_TPYE_EQ, this.getRange(-2), "==");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_ASSIGN, this.getRange(-1), "=");
                }
            }
            case ":": this.next(1); return new Token(TokenType.SEP_COLON, this.getRange(-1), ":");
            case "(": this.next(1); return new Token(TokenType.SEP_LPAREN, this.getRange(-1), "(");
            case ")": this.next(1); return new Token(TokenType.SEP_RPAREN, this.getRange(-1), ")");
            case "[": this.next(1); return new Token(TokenType.SEP_LBRACK, this.getRange(-1), "[");
            case "]": this.next(1); return new Token(TokenType.SEP_RPAREN, this.getRange(-1), "]");
            case "{": this.next(1); return new Token(TokenType.SEP_LCURLY, this.getRange(-1), "{");
            case "}": this.next(1); return new Token(TokenType.SEP_RCURLY, this.getRange(-1), "}");
            case "%": {
                if (this.test("%[")) {
                    this.next(2);
                    return new Token(TokenType.SEP_LDICT, this.getRange(-2), "%[");
                }
                else if (this.test("%=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_MOD, this.getRange(-2), "%=");
                }
                else if (this.test("%>")) {
                    this.next(2);
                    return new Token(TokenType.SEP_ROCTSTR, this.getRange(-2), "%>");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_MOD, this.getRange(-1), "%");
                }
            }

            case "]": this.next(1); return new Token(TokenType.SEP_RDICT, this.getRange(-1), "]");
            case "/": {
                // comment has been handled
                // check regular expression pattern
                const pat = /^(\/(\\\/|[^\/\n\r])*\/)([gi]*)(?!\/)/;
                const search = pat.exec(this.m_chunk.substring(this.m_chunkIndex));
                if (search) {
                    const len = search[0].length;
                    this.next(len);
                    return new Token(TokenType.REGEX, this.getRange(-len), search[0]);
                }
                else if (this.test("/=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_DIV, this.getRange(-2), "/=");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_DIV, this.getRange(-1), "/");
                }
            }
            case "<": {
                if (this.test("<%")) {
                    this.next(2);
                    return new Token(TokenType.SEP_LOCTSTR, this.getRange(-2), "<%");
                }
                else if (this.test("<->")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_CHANGE, this.getRange(-3), "<->");
                }
                else if (this.test("<<=")) {
                    this.next(3);
                    return new Token(TokenType.OP_ASSIGN_SHL, this.getRange(-3), "<<=");
                }
                else if (this.test("<=")) {
                    this.next(2);
                    return new Token(TokenType.OP_LE, this.getRange(-2), "<=");
                }
                else if (this.test("<<")) {
                    this.next(2);
                    return new Token(TokenType.OP_SHL, this.getRange(-2), "<<");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_LT, this.getRange(-1), "<");
                }
            }
            case "@": {
                if (this.test("@\"") || this.test("@\'")) {
                    // TODO: deal with interpolated string
                    this.next(2);
                    return new Token(TokenType.UNEXPECTED, this.getRange(-2), "@'");
                }
                else {
                    // macro,
                    this.next(1);
                    return new Token(TokenType.SEP_AT, this.getRange(-1), "@");
                }
            }
            case "&": {
                if (this.test("&=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_BAND, this.getRange(-2), "&=");
                }
                else if (this.test("&&=")) {
                    this.next(3);
                    return new Token(TokenType.OP_ASSIGN_AND, this.getRange(-3), "&&=");
                }
                else if (this.test("&&")) {
                    this.next(2);
                    return new Token(TokenType.OP_AND, this.getRange(-2), "&&");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_BAND, this.getRange(-1), "&");
                }
            }
            case "|": {
                if (this.test("|=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_BOR, this.getRange(-2), "|=");
                }
                else if (this.test("||=")) {
                    this.next(3);
                    return new Token(TokenType.OP_ASSIGN_OR, this.getRange(-3), "||=");
                }
                else if (this.test("||")) {
                    this.next(2);
                    return new Token(TokenType.OP_OR, this.getRange(-2), "||");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_BOR, this.getRange(-1), "|");
                }
            }
            case "^": {
                if (this.test("^=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_BXOR, this.getRange(-2), "^=");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_BXOR, this.getRange(-1), "^");
                }
            }
            case "-": {
                if (this.test("-=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_MINUS, this.getRange(-2), "-=");
                }
                else if (this.test("--")) {
                    this.next(2);
                    return new Token(TokenType.OP_DEC, this.getRange(-2), "--");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_MINUS, this.getRange(-1), "-");
                }
            }
            case "+": {
                if (this.test("+=")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_ADD, this.getRange(-2), "+=");
                }
                else if (this.test("++")) {
                    this.next(2);
                    return new Token(TokenType.OP_INC, this.getRange(-2), "++");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_ADD, this.getRange(-1), "+");
                }
            }
            case "\\": {
                if (this.test("\\\\")) {
                    this.next(2);
                    return new Token(TokenType.OP_ASSIGN_IDIV, this.getRange(-2), "\\=");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_IDIV, this.getRange(-1), "\\");
                }
            }
            case ">": {
                if (this.test(">>=")) {
                    this.next(3);
                    return new Token(TokenType.OP_ASSIGN_SHR, this.getRange(-3), ">>=");
                }
                else if (this.test(">>>=")) {
                    this.next(4);
                    return new Token(TokenType.OP_ASSIGN_USHR, this.getRange(-4), ">>>=");
                }
                else if (this.test(">=")) {
                    this.next(2);
                    return new Token(TokenType.OP_GE, this.getRange(-2), ">=");
                }
                else if (this.test(">>>")) {
                    this.next(3);
                    return new Token(TokenType.OP_USHR, this.getRange(-3), ">>>");
                }
                else if (this.test(">>")) {
                    this.next(2);
                    return new Token(TokenType.OP_SHR, this.getRange(-2), ">>");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_GT, this.getRange(-1), ">");
                }
            }
            case "?": this.next(1); return new Token(TokenType.OP_CONDITIONAL_QM, this.getRange(-1), "?");
            case "!": {
                if (this.test("!==")) {
                    this.next(3);
                    return new Token(TokenType.OP_TYPE_NE, this.getRange(-3), "!==");
                }
                else if (this.test("!=")) {
                    this.next(2);
                    return new Token(TokenType.OP_NE, this.getRange(-2), "!=");
                }
                else {
                    this.next(1);
                    return new Token(TokenType.OP_NOT, this.getRange(-1), "!");
                }
            }
            case "~": this.next(1); return new Token(TokenType.OP_BNOT, this.getRange(-1), "~");

        }

        if (this.isCharacter(this.getLeadingCharacters())) {
            const pat = /^(?:[_a-zA-Z]|[^\x00-\xff])(?:[_a-zA-Z0-9]|[^\x00-\xff])*/;
            const res = pat.exec(this.m_chunk.substring(this.m_chunkIndex));
            if (res) {
                const len = res[0].length;
                this.next(len);
                const type = KEYWORDS[res[0]];
                if (type !== undefined) {
                    return new Token(type, this.getRange(-len), res[0]);
                }
                else {
                    return new Token(TokenType.IDENTIFIER, this.getRange(-len), res[0]);
                }
            }
        }
        else if (this.isNumber(this.getLeadingCharacters())) {
            const pattern0 = /(?<!\w)\.?\d(?:(?:[0-9a-zA-Z\._])|(?<=[eEpP])[+-])*/;
            const result0 = pattern0.exec(this.m_chunk.substring(this.m_chunkIndex));
            if (result0) {
                const decPat = /(^(?=[1-9\.]))([0-9]*)((?:(?<=[0-9])|\.(?=[0-9])))([0-9]*)([eE](\+?)(\-?)([0-9]*))?$/;
                const binPat = /(^0[bB])([01]*)((?:(?<=[01])|\.(?=[01])))([01]*)([pP](\+?)(\-?)([01]*))?$/;
                const octPat = /(^0(?=[0-7]))([0-7]*)((?:(?<=[0-7])|\.(?=[0-7])))([0-7]*)([pP](\+?)(\-?)([0-7]*))?$/;
                const hexPat = /(^0[xX])([0-9a-fA-F]*)((?:(?<=[0-9a-fA-F])|\.(?=[0-9a-fA-F])))([0-9a-fA-F]*)([pP](\+?)(\-?)([0-9a-fA-F]*))?$/;
                
                const numStr = result0[0];
                this.next(numStr.length);
                const range = this.getRange(-numStr.length);
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

                return new Token(TokenType.UNEXPECTED, range, numStr);
            }
        }

        const counts = this.countToWhitespace();
        const invalidText = this.m_chunk.substring(this.m_chunkIndex, this.m_chunkIndex + counts);
        this.next(counts);
        return new Token(TokenType.UNEXPECTED, this.getRange(-counts), invalidText);
    }

    private countToWhitespace(): number {
        let count = 0;
        while (this.m_restCharLength - count > 0) {
            if (this.isWhitespace(this.m_chunk[this.m_chunkIndex + count])) {
                break;
            }
            count++;
        }
        return count;
    }

    private handleInterpolatedString() {

    }

    private isNumber(c: string) {
        return (c >= "0" && c <= "9") || c === ".";
    }

    private isCharacter(c: string) {
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c == "_") || (c > "\xff");
    }

    private skipWhitespaceAndComment() {
        while (this.m_restCharLength > 0) {
            if (this.test("/*")) {
                this.skipLongComment();
            }
            else if (this.test("//")) {
                this.skipShortComment();
            }
            else if (this.test("\r\n") || this.test("\n\r")) {
                this.next(2);
                this.incLine();
            }
            else if (this.test("\r") || this.test("\n")) {
                this.next(1);
                this.incLine();
            }
            else if (this.isWhitespace(this.getLeadingCharacters())) {
                this.next(1);
            }
            else {
                break;
            }
        }
    }

    private skipLongComment() {
        this.next(2);
        while (!this.test("*/")) {
            if (this.test("\r\n") || this.test("\n\r")) {
                this.next(2);
                this.incLine();
            }
            else if (this.test("\r") || this.test("\n")) {
                this.next(1);
                this.incLine();
            }
        }
        this.next(2);
    }

    private skipShortComment() {
        this.next(2);
        while (this.m_restCharLength > 0) {
            if (!this.isNewLine(this.getLeadingCharacters())) {
                this.next(1);
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

    private incLine() {
        this.m_currentPosition.line++;
        this.m_currentPosition.character = 1;
    }

    private next(n: number) {
        this.m_chunkIndex += n;
        this.m_currentPosition.character += n;
    }

    private isNewLine(c: string) {
        return (c == "\r" || c == "\n");
    }

    private test(startWith: string): boolean {
        return this.m_chunk.startsWith(startWith, this.m_chunkIndex);
    }

    private getRange(len: number): IRange {
        const curr = this.m_currentPosition;
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

    nextTokenOfKind<T extends TokenType>(type: T): Token<T> | null {
        if (this.lookAhead() === type) {
            return this.nextToken() as Token<T>;
        }
        return null;
    }

    skipUntil(types: TokenType[]): void {
        while (true) {
            const look = this.lookAhead();
            if (look === TokenType.EOF) {
                return;
            }
            else if (types.indexOf(look) !== -1) {
                break;
            }
            else {
                this.nextToken();
            }
        }
    }
}

