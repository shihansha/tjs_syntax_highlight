import { Position } from "vscode-languageserver-textdocument";
import { IPosition } from "../interfaces/IPosition";
import { IRange } from "../interfaces/IRange";
import { Lexer } from "../lexer/lexer";
import { LexerMode } from "../types/lexerMode";
import { Token } from "../types/token";
import { TokenType } from "../types/tokenType";

export class LexerTester {

    tokenRepo: Map<string, Token[]> = new Map();

    lexDocument(docUri: string, content: string) {
        const lexer = new Lexer(docUri, content);
        const tokenArr: Token[] = [];
        while (true) {
            const tok = lexer.nextToken(LexerMode.TJS);
            if (tok.type === TokenType.EOF) {
                break;
            }
            tokenArr.push(tok);
        }
        this.tokenRepo.set(docUri, tokenArr);
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