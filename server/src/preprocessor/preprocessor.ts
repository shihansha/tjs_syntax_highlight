import { IDefineList } from "../interfaces/IDefineList";
import { IPosition } from "../interfaces/IPosition";
import { IPreprocessorOutput } from "../interfaces/IPreprocessorOutput";

export class Preprocessor {

    public constructor(
        public readonly chunkName: string,
        private readonly m_chunk: string,
    ) { }

    private m_head = 0;
    private m_output = "";
    private m_position: IPosition = {
        line: 0,
        character: 0
    };

    private test(str: string): boolean {
        return this.chunkName.startsWith(str, this.m_head);
    }
    private rest() {
        return this.m_chunk.substring(this.m_head);
    }

    private emitIdentity(len: number) {
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

    private runInside(def: IDefineList): IPreprocessorOutput {
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
                    this.handleMacro();
                }

            }
            else if (current === "\"" || current === "'") {
                // string
                this.handleString(current);
            }
        }

        throw new Error("unimplemented");
    }

    private handleMacro() {
        const pat = /((?:[a-zA-Z]|[^\x00-\xff])(?:[a-zA-Z0-9]|[^\x00-\xff])*)(?=\()/;
        const res = pat.exec(this.m_chunk.substring(this.m_head));
        if (res) {
            const macroName = res[1];
            // parse expression
            while (this.m_head < this.m_chunk.length) {
                const c = this.m_chunk[this.m_head];
                
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

