import { DiagnosticSeverity } from "../types/diagnosticSeverity";
import { IRange } from "./IRange";

export interface IDiagnostic {
    range: IRange,
    message: string,
    severity: DiagnosticSeverity
}

export namespace IDiagnostic {
    export function create(range: IRange, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error): IDiagnostic {
        return {
            range: range,
            message: message,
            severity: severity
        }
    }
}
