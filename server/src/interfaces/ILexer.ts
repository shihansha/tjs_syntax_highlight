import { Token } from "../types/token";
import { TokenType } from "../types/tokenType";
import { IPosition } from "./IPosition";

export interface ILexer {
    /**
     * 当前正在解析的文件名。
     */
    get chunkName(): string;

    /**
     * 文本中尚未解析部分的起始位置。
     */
    get currentPosition(): IPosition;

    /**
     * 向前看一个字符的类型，但不消耗该字符。
     * @returns 向前看的字符类型，如果文本已经结束则返回TokenType.EOF。
     */
    lookAhead(): TokenType;

    /**
     * 消耗一个字符，并返回它。
     * @returns 消耗的字符，如果文本已经结束则类型为TokenType.EOF。
     */
    nextToken(): Token;

    /**
     * 消耗并返回一个特定的字符。
     * @param type 字符类型。
     * @returns 消耗的字符，如果文本已经结束则返回TokenType.EOF；如果字符类型与指定的不同，则返回null，并不消耗字符。
     */
    nextTokenOfKind<T extends TokenType>(type: T): Token<T> | null;

    /**
     * 跳过若干个字符，直到遇到想要类型的字符之一，想要类型的字符不会被消耗。
     * @param types 目标字符类型集合。
     */
    skipUntil(types: TokenType[]): void;
}