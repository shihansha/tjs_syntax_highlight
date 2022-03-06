export enum Opcode
{
    /** the operator used by global chunk only */
    CHUNK_WITHOUT_CLOSURE,
    /** {} */
    CHUNK,
    /** ; */
    STATEMENT,
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
    /** + */
    ADD,
    /** 前置+ */
    PRE_ADD,
    /** - */
    SUB,
    /** 前置- */
    PRE_SUB,
    
}