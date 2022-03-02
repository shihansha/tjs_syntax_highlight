import { IDefineList } from "../interfaces/IDefineList";
import { IDiagnostic } from "../interfaces/IDiagnostic";
import { IPosition } from "../interfaces/IPosition";
import { IPreprocessorOutput } from "../interfaces/IPreprocessorOutput";
import { IRange } from "../interfaces/IRange";
import { MacroParser } from "./macroParser";

export class Preprocessor {

    public constructor(
        public readonly chunkName: string,
        private readonly m_chunk: string,
        private m_def: IDefineList
    ) { }

    private m_head = 0;
    private m_output = "";
    private m_position: IPosition = {
        line: 0,
        character: 0
    };
    private readonly m_ifStack: boolean[] = [];
    public readonly diagnostics: IDiagnostic[] = [];
    private ifStackPeek() {
        if (this.m_ifStack.length === 0) {
            return true;
        }
        return this.m_ifStack[this.m_ifStack.length - 1];
    }
    private readonly m_disabledBlockPosStack: IPosition[] = [];
    private readonly m_disabledArea: IRange[] = [];

    private test(str: string): boolean {
        return this.m_chunk.startsWith(str, this.m_head);
    }
    private rest() {
        return this.m_chunk.substring(this.m_head);
    }

    private emitIdentity(len: number) {
        if (!this.ifStackPeek()) {
            return this.emitEmpty(len);
        }
        let toAppend = "";
        for (let i = 0; i < len; i++) {
            if (this.m_head >= this.m_chunk.length) {
                break;
            }
            toAppend += this.m_chunk[this.m_head];

            if (this.m_chunk[this.m_head] === "\n") {
                this.m_position.line++;
                this.m_position.character = 0;
            }
            else if (this.m_chunk[this.m_head] === "\r") {

            }
            else {
                this.m_position.character++;
            }

            this.m_head++;
        }
        this.m_output += toAppend;
    }
    private emitEmpty(len: number) {
        let toAppend = "";
        for (let i = 0; i < len; i++) {
            if (this.m_head >= this.m_chunk.length) {
                break;
            }
            if (this.m_chunk[this.m_head] === "\r" || this.m_chunk[this.m_head] === "\n") {
                toAppend += this.m_chunk[this.m_head];
            }
            else {
                toAppend += " ";
            }

            if (this.m_chunk[this.m_head] === "\n") {
                this.m_position.line++;
                this.m_position.character = 0;
            }
            else if (this.m_chunk[this.m_head] === "\r") {

            }
            else {
                this.m_position.character++;
            }
            this.m_head++;
        }
        this.m_output += toAppend;
    }
    private emitUntilEOL() {
        while (this.m_head < this.m_chunk.length) {
            const c = this.m_chunk[this.m_head];
            this.emitIdentity(1);
            this.m_head++;
            if (c === "\n") {
                break;
            }
        }
    }

    public run(): IPreprocessorOutput {
        while (this.m_head < this.m_chunk.length) {
            const current = this.m_chunk[this.m_head];
            if (current === "@") {
                const forward = this.m_chunk[this.m_head + 1];
                if (forward === "'" || forward === "\"") {
                    this.emitIdentity(2);
                    // interpolated string
                    // In preprocessing stage, we don't have information
                    // about our parser. So, we have to ignore the whole line
                    // when meet interpolated-string.
                    this.emitUntilEOL();
                }
                else {
                    // macro
                    this.handleMacro(this.m_def);
                }

            }
            else if (current === "\"" || current === "'") {
                // string
                this.handleString(current);
            }
            else {
                this.emitIdentity(1);
            }
        }
        if (this.m_ifStack.length !== 0) {
            this.diagnostics.push(IDiagnostic.create(this.getRange(1), "'endif' expected"));
        }
        return {
            chunk: this.m_output,
            defines: this.m_def,
            disabledArea: this.m_disabledArea
        };
    }

    private getRange(len: number): IRange {
        const curr = this.m_position;
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

    private handleMacro(def: IDefineList) {
        const posSave = IPosition.clone(this.m_position);
        const pat = /@((?:[a-zA-Z]|[^\x00-\xff])(?:[a-zA-Z0-9]|[^\x00-\xff])*)[\s\r\n]*/;
        const res = pat.exec(this.m_chunk.substring(this.m_head));
        if (res) {
            const macroName = res[1];
            this.emitEmpty(res[0].length ); // '@' [macroName] [optinal_spaces]
            if (this.test("(")) {
                // parse expression
                const macroParser = new MacroParser(this.chunkName, this.m_chunk, this.m_head, this.m_position, def);
                const macroParserResult = macroParser.parse();
                const macroRange: IRange = {
                    start: posSave,
                    end: IPosition.clone(this.m_position)
                };
                this.m_def = def;
                this.emitEmpty(macroParserResult.chunkIndex - this.m_head); // '(' [macro_expr] ')'
                if (macroParserResult.success) {
                    const macroValue = macroParserResult.value;
                    if (macroName === "set") {
                        // do nothing
                    }
                    else if (macroName === "if") {
                        if (macroValue === 0) {
                            this.m_disabledBlockPosStack.push(IPosition.clone(this.m_position));
                            this.m_ifStack.push(false);
                        }
                        else {
                            this.m_ifStack.push(true);
                        }
                    }
                    else if (macroName === "endif") {
                        this.diagnostics.push(IDiagnostic.create(macroRange, "'endif' should not have parameters."));
                        if (this.m_ifStack.length === 0) {
                            this.diagnostics.push(IDiagnostic.create(macroRange, "unmatched 'endif'."));
                        }
                        else {
                            const isDisabled = this.m_ifStack.pop();
                            if (isDisabled) {
                                const disabledBlockStart = this.m_disabledBlockPosStack.pop()!;
                                this.m_disabledArea.push({
                                    start: disabledBlockStart,
                                    end: IPosition.clone(posSave)
                                });
                            }
                        }
                    }
                    else {
                        this.diagnostics.push(IDiagnostic.create(macroRange, `unsupported macro: '${macroName}'`));
                    }
                }
                else {
                    this.diagnostics.push(macroParserResult.diagnostic);
                }
            }
            else {
                const macroRange: IRange = {
                    start: posSave,
                    end: IPosition.clone(this.m_position)
                };
                if (macroName === "set") {
                    this.diagnostics.push(IDiagnostic.create(macroRange, "'set' should have parameters."));
                }
                else if (macroName === "if") {
                    this.diagnostics.push(IDiagnostic.create(macroRange, "'set' should have parameters."));
                    this.m_ifStack.push(true);
                }
                else if (macroName === "endif") {
                    if (this.m_ifStack.length === 0) {
                        this.diagnostics.push(IDiagnostic.create(macroRange, "unmatched 'endif'."));
                    }
                    else {
                        this.m_ifStack.pop();
                    }
                }
                else {
                    this.diagnostics.push(IDiagnostic.create(macroRange, `unsupported macro: '${macroName}'`));
                }
            }
        }
        else {
            // illegal macro/macro name
            this.emitUntilEOL();
        }
    }

    private handleString(quoteType: "\"" | "'") {
        let pat: RegExp;
        if (quoteType === "\"") {
            pat = /^"((?:\\"|[^\r\n])*)"/;
        }
        else { // quoteType === "\'"
            pat = /^'((?:\\'|[^\r\n])*)'/;
        }
        const res = pat.exec(this.m_chunk.substring(this.m_head));
        if (res) {
            this.emitIdentity(res[0].length);
        }
        else {
            this.emitUntilEOL();
        }
    }
}

