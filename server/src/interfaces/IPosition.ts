export interface IPosition {
    line: number;
    character: number;
}

export namespace IPosition {
    export function compare(a: IPosition, b: IPosition): number {
        const lineDiff = a.line - b.line;
        if (lineDiff < 0) {
            return -1;
        }
        else if (lineDiff > 0) {
            return 1;
        }
        else {
            const charDiff = a.character - b.character;
            if (charDiff < 0) {
                return -1;
            }
            else if (charDiff > 0) {
                return 1;
            }
            else {
                return 0;
            }
        }
    }
    export function clone(o: IPosition): IPosition {
        return {
            line: o.line,
            character: o.character
        };
    }
}
