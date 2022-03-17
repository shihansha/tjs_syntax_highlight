export enum NodeType
{
    /** the operator used by global chunk only */
    CHUNK_WITHOUT_CLOSURE,
    /** {} */
    CHUNK,
    /** ; */
    STATEMENT,
    /** , */
    COMMA,
    /** for */
    FOR,
    /** do */
    DO,
    /** while */
    WHILE,
    /** if */
    IF,
    /** 后置if */
    POST_IF,
    /** with */
    WITH,
    TRY,
    /** + */
    ADD,
    /** 前置+ */
    PRE_ADD,
    /** - */
    SUB,
    /** 前置- */
    PRE_SUB,
    /** % */
    MOD,
    /** / */
    DIV,
    /** \ */
    INTDIV,
    MUL,
    /** && */
    AND,
    /** || */
    OR,
    BITAND,
    BITOR,
    /** ~ */
    BITNOT,
    LEFTSHIFT,
    RIGHTSHIFT,
    EQUAL,
    STRICTEQUAL,
    NOTEQUAL,
    NOTSTRICTEQUAL,
    LARGER,
    LARGEREQUAL,
    SMALLER,
    SMALLEREQUAL,
    /** ^ */
    BITXOR,
    /** = */
    SET,
    /** &= */
    SETBITAND,
    /** |= */
    SETBITOR,
    /** ^= */
    SETBITXOR,
    SETSUB,
    SETADD,
    SETMOD,
    SETDIV,
    SETINTDIV,
    SETMUL,
    /** &&= */
    SETAND, 
    /** ||= */
    SETOR,
    SETLEFTSHIFT,
    SETRIGHTSHIFT,
    /** ?: */
    QUESTION,
    NOT,
    /** -- */
    DEC,
    /** ++ */
    INC,
    NEW,
    INSTANCEOF,
    TYPEOF,
    DELETE,
    /** # */
    CHAR,
    /** $ */
    DOLLAR,
    /** () */
    PARENTHESES,
    /** [] */
    BRACKET,
    /** %[] */
    DIC,
    DOT,
    INT,
    REAL,
    STRING,
    SWITCH,
    CASE,
    DEFAULT,
    CLASS,
    FUNCTION,
    FUNCTION_PARAMETER,
    PROPERTY,
    RETURN,
    BREAK,
    CONTINUE,
    /** => */
    VALUE,
    VAR,

    CONST,
    LITERAL,
    IDENTIFIER,

    TRUE,
    FALSE,
    GLOBAL,
    THIS,
    SUPER,

    END
}