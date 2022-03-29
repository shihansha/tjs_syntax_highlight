import { Node } from "../ast/node";
import { IPosition } from "../interfaces/IPosition";
import { IRange } from "../interfaces/IRange";
import { Token } from "../types/token";

export class AstWalker {
    private readonly entries: Map<string, { token: Token[], ast: Node }> = new Map();

    public updateEntry(fileName: string, token: Token[], ast: Node): void {
        this.entries.set(fileName, { token, ast });
    }

    public queryToken(fileName: string, pos: IPosition): Token | null {
        const entry = this.entries.get(fileName)!;
        const tokenArr = entry.token;
        const result = IRange.binarySearchPosition(i => tokenArr[i].range, tokenArr.length, pos);
        if (result === -1) {
            return null;
        }
        return tokenArr[result];
    }

    public walkAst(token: Token): Node[] {
        const ownerRoute: Node[] = [];
        let parent = token.owner;
        while (parent !== undefined) {
            ownerRoute.push(parent);
            parent = parent.parent;
        }
        return ownerRoute;
    }
}
