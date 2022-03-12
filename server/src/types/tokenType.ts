import { Token } from "./token";

export enum TokenType {
    // special
    UNEXPECTED = "$UNEXPECTED",
    EOF = "$EOF",

    // arg
    CALLERARG = "...",
    VARARG = "*",

    // seperators
    SEP_SEMI = ";",
    SEP_COMMA = ",",
    SEP_RARRAW = "=>",
    SEP_DOT = ".",
    SEP_COLON = ":",
    SEP_LPAREN = "(",
    SEP_RPAREN = ")",
    SEP_LBRACK = "[",
    SEP_RBRACK = "]",
    SEP_LCURLY = "{",
    SEP_RCURLY = "}",
    SEP_LDICT = "%[",
    SEP_RDICT = "]",
    SEP_REGEXP = "/",
    SEP_LOCTSTR = "<%",
    SEP_ROCTSTR = "%>",
    SEP_AT = "@",
    SEP_QUOTE_DOUBLE = "\"",
    SEP_QUOTE_SINGLE = "'",
    SEP_LINTER_DOLLAR = "${",
    SEP_RINTER_DOLLAR = "}",
    SEP_LINTER_AND = "&",
    SEP_RINTER_AND = ";",

    // operators
    OP_IF = "if",
    OP_SEQ = ",",
    OP_ASSIGN = "=",
    OP_ASSIGN_CHANGE = "<->",
    OP_ASSIGN_BAND = "&=",
    OP_ASSIGN_BOR = "|=",
    OP_ASSIGN_BXOR = "^=",
    OP_ASSIGN_MINUS = "-=",
    OP_ASSIGN_ADD = "+=",
    OP_ASSIGN_MOD = "%=",
    OP_ASSIGN_DIV = "/=",
    OP_ASSIGN_IDIV = "\\=",
    OP_ASSIGN_MUL = "*=",
    OP_ASSIGN_OR = "||=",
    OP_ASSIGN_AND = "&&=",
    OP_ASSIGN_SHR = ">>=",
    OP_ASSIGN_SHL = "<<=",
    OP_ASSIGN_USHR = ">>>=",
    OP_CONDITIONAL_QM = "?",
    OP_CONDITIONAL_COLON = ":",
    OP_OR = "||",
    OP_AND = "&&",
    OP_BOR = "|",
    OP_BXOR = "^",
    OP_BAND = "&",
    OP_EQ = "==",
    OP_NE = "!=",
    OP_TPYE_EQ = "===",
    OP_TYPE_NE = "!==",
    OP_LT = "<",
    OP_LE = "<=",
    OP_GT = ">",
    OP_GE = ">=",
    OP_SHR = ">>",
    OP_SHL = "<<",
    OP_USHR = ">>>",
    OP_ADD = "+",
    OP_MINUS = "-",
    OP_MOD = "%",
    OP_DIV = "/",
    OP_IDIV = "\\",
    OP_MUL = "*",
    OP_NOT = "!",
    OP_BNOT = "~",
    OP_DEC = "--",
    OP_INC = "++",
    OP_NEW = "new",
    OP_INVALIDATE = "invalidate",
    OP_ISVALID = "isvalid",
    OP_DELETE = "delete",
    OP_TYPEOF = "typeof",
    OP_CHAR_ENCODE = "#",
    OP_CHAR_DECODE = "$",
    OP_UNARY_PLUS = "+",
    OP_UNARY_MINUS = "-",
    OP_PROPERTY_GETOBJ = "&",
    OP_PROPERTY_CALLOBJ = "*",
    OP_INSTANCEOF = "instanceof",
    OP_INCONTEXTOF = "incontextof",
    OP_INT = "int",
    OP_REAL = "real",
    OP_STRING = "string",

    // keywords
    KW_BREAK = "break",
    KW_CONTINUE = "continue",
    KW_DO = "do",
    KW_CASE = "case",
    KW_CLASS = "class",
    KW_ELSE = "else",
    KW_FALSE = "false",
    KW_FOR = "for",
    KW_FUNCTION = "function",
    KW_GETTER = "getter",
    KW_IF = "if",
    KW_PROPERTY = "property",
    KW_RETURN = "return",
    KW_SETTER = "setter",
    KW_SWITCH = "switch",
    KW_TRUE = "true",
    KW_WHILE = "while",
    KW_WITH = "with",
    KW_DEFAULT = "default",
    KW_VAR = "var",
    IDENTIFIER = "$IDENTIFIER",
    NUMBER_DECIMAL = "$NUMBER_DECIMAL",
    NUMBER_BINARY = "$NUMBER_BINARY",
    NUMBER_OCTAL = "$NUMBER_OCTAL",
    NUMBER_HEXIMAL = "$NUMBER_HEXIMAL",
    STRING = "$STRING",
    STRING_INTERPOLATED = "$STRING_INTERPOLATED",
    REGEX = "$REGEX",
}

export const KEYWORDS: {[key: string]: TokenType | undefined} = {
    "break": TokenType.KW_BREAK,
    "continue": TokenType.KW_CONTINUE,
    "do": TokenType.KW_DO,
    "case": TokenType.KW_CASE,
    "class": TokenType.KW_CLASS,
    "else": TokenType.KW_ELSE,
    "false": TokenType.KW_FALSE,
    "for": TokenType.KW_FOR,
    "getter": TokenType.KW_GETTER,
    "function": TokenType.KW_FUNCTION,
    "if": TokenType.KW_IF,
    "property": TokenType.KW_PROPERTY,
    "return": TokenType.KW_RETURN,
    "setter": TokenType.KW_SETTER,
    "switch": TokenType.KW_SWITCH,
    "true": TokenType.KW_TRUE,
    "while": TokenType.KW_WHILE,
    "with": TokenType.KW_WITH,
    "default": TokenType.KW_DEFAULT,
    "var": TokenType.KW_VAR
};
