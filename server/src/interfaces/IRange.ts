import { IPosition } from "./IPosition";

export interface IRange {
    start: IPosition;
    end: IPosition;
}

export namespace IRange {
    export function comparePosition(range: IRange, pos: IPosition) {
        const startComp = IPosition.compare(range.start, pos);
        const endComp = IPosition.compare(range.end, pos);

        if (startComp > 0) {
            return 1;
        }
        else if (endComp < 0) {
            return -1;
        }
        else {
            return 0;
        }
    }



    export function binarySearchPosition(rangeProvider: (index: number) => IRange, length: number, pos: IPosition) {
        return binarySearchInside(rangeProvider, pos, 0, length - 1);
    }

    function binarySearchInside(rangeProvider: (index: number) => IRange, pos: IPosition, low: number, high: number): number {
        if (low === high) {
            const comp = comparePosition(rangeProvider(low), pos);
            if (comp === 0) {
                return low;
            }
            else {
                return -1;
            }
        }
        const mid = Math.floor(high - low);
        const midRes = comparePosition(rangeProvider(mid), pos);
        if (midRes < 0) {
            return binarySearchInside(rangeProvider, pos, mid + 1, high);
        }
        else if (midRes > 0) {
            return binarySearchInside(rangeProvider, pos, low, mid - 1);
        }
        else {
            return mid;
        }
    }
}
