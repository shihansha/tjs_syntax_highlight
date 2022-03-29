import { Type } from "./type";

export enum UnderstandingDegree {
    Literal,
    ExactType,
    // Complex, // unimplemented
    Unknown
}

export interface IAnalysisType {
    canAccept(analysisType: IAnalysisType): boolean;
    prettyString(): string;
}

export class LiteralAnalysisType implements IAnalysisType {
    public constructor(
        public readonly value: any,
        public readonly type: Type
    ) { }

    public prettyString(): string {
        if (this.type === Type.basic.integer) {
            return (this.value as number).toString();
        }
        else if (this.type === Type.basic.real) {
            return (this.value as number).toString();
        }
        else if (this.type === Type.basic.string) {
            return "\"" + (this.value as string) + "\"";
        }
        else if (this.type === Type.basic.octet) {
            let sb = "";
            sb += "<% ";
            const octet = this.value as number[];
            for (const o of octet) {
                sb += o.toString(16) + " ";
            }
            sb += "%>";
            return sb;
        }
        else if (this.type === Type.basic.void) {
            return "void";
        }

        return "unknown";
    }

    public canAccept(_: IAnalysisType): boolean {
        // literal is a r-value
        return false;
    }
}

// easy implemention
export class ExactTypeAnalysisType implements IAnalysisType {
    public constructor(
        public readonly type: Type
    ) { }

    canAccept(analysisType: IAnalysisType): boolean {
        if (analysisType instanceof UnknownAnalysisType) {
            return true;
        }
        else if (analysisType instanceof LiteralAnalysisType) {
            return analysisType.type.derivesFrom(this.type.typeShownUp());
        }
        else if (analysisType instanceof ExactTypeAnalysisType) {
            return analysisType.type.typeShownUp().derivesFrom(this.type.typeShownUp());
        }
        throw new Error("unexpected analysis type");
    }
    prettyString(): string {
        const shownUp = this.type.typeShownUp();
        return shownUp.name;
    }

}

export class UnknownAnalysisType implements IAnalysisType {
    private constructor() {}

    canAccept(_: IAnalysisType): boolean {
        return true;
    }
    prettyString(): string {
        return "any";
    }
    
    public static readonly Instance = new UnknownAnalysisType();
}
