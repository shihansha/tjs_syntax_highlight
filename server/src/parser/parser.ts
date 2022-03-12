import { ILexer } from "../interfaces/ILexer";
import * as Node from "../ast/node";
import { Opcode } from "../ast/opcode";
import { Token } from "../types/token";
import { TokenType } from "../types/tokenType";
import { LexerMode } from "../types/lexerMode";
import { IRange } from "../interfaces/IRange";

export interface ErrorInfo
{
    msg: string;
    range: IRange;
}

export class Parser {
    /** 优先级 */
    private LBP:{[key: string]:number} = {};
    /** 哪些运算符可以放句首 */
    private head:{[key: string]:number} ={};

    public errorStack: ErrorInfo[] = [];

    constructor(
        public readonly chunkName: string,
        private readonly m_chunk: string,
        private readonly lexer: ILexer
    ) {
        this.head[TokenType.KW_IF] = 1;
        this.head[TokenType.KW_WHILE] = 1;
        this.head[TokenType.KW_DO] = 1;
        this.head[TokenType.KW_FOR] = 1;
        this.head[TokenType.SEP_LCURLY] = 1;
        this.head[TokenType.KW_CLASS] = 1;
        this.head[TokenType.KW_SWITCH] = 1;
        this.head[TokenType.KW_DEFAULT] = 1;
        this.head[TokenType.KW_CASE] = 1;
        this.head[TokenType.KW_BREAK] = 1;
        this.head[TokenType.KW_CONTINUE] = 1;
        this.head[TokenType.KW_RETURN] = 1;
        this.head[TokenType.KW_VAR] = 1;

        for(var t in TokenType)
        {
            this.LBP[t] = 0;
        }
        this.LBP[TokenType.SEP_COMMA] = 10;
        this.LBP[TokenType.NUMBER_DECIMAL] = 10;
        this.LBP[TokenType.NUMBER_BINARY] = 10;
        this.LBP[TokenType.NUMBER_OCTAL] = 10;
        this.LBP[TokenType.NUMBER_HEXIMAL] = 10;
        this.LBP[TokenType.STRING] = 10;
        this.LBP[TokenType.OP_ASSIGN] = 20;
        this.LBP[TokenType.OP_ASSIGN_ADD] = 20;
        this.LBP[TokenType.OP_ASSIGN_MINUS] = 20;
        this.LBP[TokenType.OP_ASSIGN_MOD] = 20;
        this.LBP[TokenType.OP_ASSIGN_MUL] = 20;
        this.LBP[TokenType.OP_ASSIGN_DIV] = 20;
        this.LBP[TokenType.OP_ASSIGN_IDIV] = 20;
        this.LBP[TokenType.OP_ASSIGN_AND] = 20;
        this.LBP[TokenType.OP_ASSIGN_OR] = 20;
        this.LBP[TokenType.OP_ASSIGN_BAND] = 20;
        this.LBP[TokenType.OP_ASSIGN_BOR] = 20;
        this.LBP[TokenType.OP_ASSIGN_BXOR] = 20;
        this.LBP[TokenType.OP_ASSIGN_SHL] = 20;
        this.LBP[TokenType.OP_ASSIGN_SHR] = 20;
        this.LBP[TokenType.OP_CONDITIONAL_QM] = 30;
        this.LBP[TokenType.OP_INSTANCEOF] = 40;
        this.LBP[TokenType.OP_INCONTEXTOF] = 40;
        this.LBP[TokenType.OP_OR] = 50;
        this.LBP[TokenType.OP_AND] = 60;
        this.LBP[TokenType.OP_BOR] = 70;
        this.LBP[TokenType.OP_BXOR] = 80;
        this.LBP[TokenType.OP_BAND] = 90;
        this.LBP[TokenType.OP_EQ] = 100;
        this.LBP[TokenType.OP_TPYE_EQ] = 100;
        this.LBP[TokenType.OP_NE] = 100;
        this.LBP[TokenType.OP_TYPE_NE] = 100;
        this.LBP[TokenType.OP_GT] = 110;
        this.LBP[TokenType.OP_GE] = 110;
        this.LBP[TokenType.OP_LT] = 110;
        this.LBP[TokenType.OP_LE] = 110;
        this.LBP[TokenType.OP_SHL] = 120;
        this.LBP[TokenType.OP_SHR] = 120;
        this.LBP[TokenType.OP_ADD] = 130;
        this.LBP[TokenType.OP_MINUS] = 130;
        this.LBP[TokenType.OP_MUL] = 140;
        this.LBP[TokenType.OP_MOD] = 140;
        this.LBP[TokenType.OP_DIV] = 140;
        this.LBP[TokenType.OP_IDIV] = 140;

        this.LBP[TokenType.OP_INC] = 190;
        this.LBP[TokenType.OP_DEC] = 190;
        this.LBP[TokenType.SEP_LBRACK] = 200;
        this.LBP[TokenType.SEP_DOT] = 200;
        this.LBP[TokenType.SEP_LPAREN] = 200;
    }

    private skipToLineEnd()
    {
        var token = this.lexer.nextToken(LexerMode.TJS);
        var blockcount = 0;
        while(token.type != TokenType.EOF)
        {
            if(blockcount == 0 && (token.type == TokenType.SEP_SEMI || token.type == TokenType.SEP_RCURLY))
                break;
            if (token.type == TokenType.SEP_LCURLY)
                blockcount++;
            if (token.type == TokenType.SEP_RCURLY)
                blockcount--;
            token = this.lexer.nextToken(LexerMode.TJS);
        }
    }

    private _parse(rbp : number, tree: Node.Node)
    {
        var token = this.lexer.nextToken(LexerMode.TJS);
        var next = this.lexer.lookAhead(LexerMode.TJS);
        if (rbp >= 5 && !(this.head[token.type] > 0))
        {
            //var e = new TJSException("this token must be at line head");
            //e.AddTrace(token.line, token.pos);
            //throw e;
            this.errorStack.push({
                msg:"this token must be at line head", 
                range:token.range
            });
            this.skipToLineEnd();
            return;
        }
        var node: Node.Node | undefined;
        switch(token.type)
        {
            case TokenType.NUMBER_BINARY:
            case TokenType.NUMBER_DECIMAL:
            case TokenType.NUMBER_HEXIMAL:
            case TokenType.NUMBER_OCTAL:
            case TokenType.STRING:
                node = new Node.ConstantNode();
                node.token = token;
                break;
        }
        while(rbp < this.LBP[next])
        {
            token = this.lexer.nextToken(LexerMode.TJS);
            next = this.lexer.lookAhead(LexerMode.TJS);
            switch(token.type)
            {
                case TokenType.OP_ADD:
                    node = node?.AddParent(new Node.AddNode());
            }
        }
    }

    public parse() : Node.Node {
        var pnode = new Node.ChunkNode(true);
        pnode.children.push(new Node.StatNode());
        this._parse(0, pnode.children[0]);
        while(this.lexer.lookAhead(LexerMode.TJS) != TokenType.EOF)
        {
            if(this.lexer.lookAhead(LexerMode.TJS) == TokenType.SEP_SEMI)
                this.lexer.nextToken(LexerMode.TJS);
            var stat = new Node.StatNode();
            this._parse(0, stat);
            pnode.children.push(stat);
        }
        return pnode;
    }
}

