export interface IDefineList {
    [key: string]: number;
}

export namespace IDefineList {
    export function clone(origin: IDefineList): IDefineList {
        const result: IDefineList = {};
        for (const key in origin) {
            if (Object.prototype.hasOwnProperty.call(origin, key)) {
                result[key] = origin[key];
            }
        }
        return result;
    }

    export function concat(origin: IDefineList, toAppend: IDefineList): void {
        for (const key in toAppend) {
            if (Object.prototype.hasOwnProperty.call(toAppend, key)) {
                origin[key] = toAppend[key];
            }
        }
    }
}
