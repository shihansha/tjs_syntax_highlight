import { Position } from "vscode-languageserver-textdocument";
import { IDiagnostic } from "../interfaces/IDiagnostic";
import { IPosition } from "../interfaces/IPosition";
import { IRange } from "../interfaces/IRange";
import { Lexer } from "../lexer/lexer";
import { LexerMode } from "../types/lexerMode";
import { Token } from "../types/token";
import { TokenType } from "../types/tokenType";

export class LexerTester {

    tokenRepo: Map<string, Token[]> = new Map();

    parseInterpolatedString(lexer: Lexer, tokenArr: Token[], type: "\"" | "\'") {
        if (type === "\"") {
            const mode = LexerMode.TJSInterpolatedStringDoubleQuoted;
            tokenArr.push(lexer.nextToken(mode));
            while (true) {
                const tok = lexer.nextToken(mode);
                if (tok.type === TokenType.EOF) {
                    return false;
                }
                tokenArr.push(tok);
                if (tok.type === TokenType.UNEXPECTED) {
                    return false;
                }
                if (tok.type === TokenType.SEP_LINTER_DOLLAR) {
                    const result = this.easyParser(lexer, tokenArr, TokenType.SEP_RINTER_DOLLAR);
                    if (!result) {
                        return false;
                    }
                }
                else if (tok.type === TokenType.SEP_LINTER_AND) {
                    const result = this.easyParser(lexer, tokenArr, TokenType.SEP_RINTER_AND);
                    if (!result) {
                        return false;
                    }
                }
                else if (tok.type === TokenType.SEP_QUOTE_DOUBLE) {
                    return true;
                }
            }
        }
        else {
            const mode = LexerMode.TJSInterpolatedStringSingleQuoted;
            tokenArr.push(lexer.nextToken(mode));
            while (true) {
                const tok = lexer.nextToken(mode);
                if (tok.type === TokenType.EOF) {
                    return false;
                }
                tokenArr.push(tok);
                if (tok.type === TokenType.UNEXPECTED) {
                    return false;
                }
                if (tok.type === TokenType.SEP_LINTER_DOLLAR) {
                    const result = this.easyParser(lexer, tokenArr, TokenType.SEP_RINTER_DOLLAR);
                    if (!result) {
                        return false;
                    }
                }
                else if (tok.type === TokenType.SEP_LINTER_AND) {
                    const result = this.easyParser(lexer, tokenArr, TokenType.SEP_RINTER_AND);
                    if (!result) {
                        return false;
                    }
                }
                else if (tok.type === TokenType.SEP_QUOTE_SINGLE) {
                    return true;
                }
            }
        }
    }


    easyParser(lexer: Lexer, tokenArr: Token[], endTok?: TokenType.SEP_RINTER_AND | TokenType.SEP_RINTER_DOLLAR): boolean {

        while (true) {
            const tok = lexer.nextToken(LexerMode.TJS);
            if (tok.type === TokenType.EOF) {
                return false;
            }
            tokenArr.push(tok);
            if (tok.type === endTok) {
                return true;
            }
            if (tok.type === TokenType.SEP_AT) {
                const isDoubleQuote = lexer.lookAhead(LexerMode.TJSInterpolatedStringDoubleQuoted) === TokenType.SEP_QUOTE_DOUBLE;
                const isSingleQuote = lexer.lookAhead(LexerMode.TJSInterpolatedStringSingleQuoted) === TokenType.SEP_QUOTE_SINGLE;
                if (isDoubleQuote) {
                    const result = this.parseInterpolatedString(lexer, tokenArr, "\"");
                    if (!result) {
                        return false;
                    }
                }
                else if (isSingleQuote) {
                    const result = this.parseInterpolatedString(lexer, tokenArr, "'");
                    if (!result) {
                        return false;
                    }
                }
                
            }
            else if (tok.type === TokenType.UNEXPECTED) {
                return false;
            }
        }
    }

    lexDocument(docUri: string, content: string): IDiagnostic[] {
        const lexer = new Lexer(docUri, content);
        const tokenArr: Token[] = [];
        this.easyParser(lexer, tokenArr);
        const diagnostics = tokenArr.filter(t => t.diagnostic !== undefined).map(t => IDiagnostic.create(t.range, t.diagnostic!));
        this.tokenRepo.set(docUri, tokenArr);
        return diagnostics;
    }

    queryDocument(docUri: string, pos: IPosition) {
        const tokenArr = this.tokenRepo.get(docUri)!;
        const result = IRange.binarySearchPosition(i => tokenArr[i].range, tokenArr.length, pos);
        if (result === -1) {
            return null;
        }
        return tokenArr[result];
    }
}