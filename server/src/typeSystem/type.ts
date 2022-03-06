export enum BasicTypes {
    void,
    Integer,
    Real,
    Object,
    String,
    Octet
};

type BasicTypeEntries = { [k in keyof typeof BasicTypes as Lowercase<Exclude<k, number>>]: Type };

function isBasicTypes(value: string): value is keyof typeof BasicTypes {
    return Object.keys(BasicTypes).includes(value);
}

export class Type {

    constructor(
        public readonly name: string,
        public readonly base: null | Type | Type[],
    ) { 
        
    }

    public readonly fields: { [key: string]: Type } = {};

    public typeof(): keyof typeof BasicTypes {
        if (isBasicTypes(this.name)) {
            return this.name;
        }

        return BasicTypes[BasicTypes.Object] as keyof typeof BasicTypes;
    }

    public typeShownUp(): Type {
        return this;
    }

    public derivesFrom(t: Type): boolean {
        if (this === t) {
            return true;
        }

        if (this.base) {
            if (this.base instanceof Type) {
                return this.base.derivesFrom(t);
            }
            else {
                return this.base.some(b => b.derivesFrom(t));
            }
        }
        
        return false;
    }

    public toString(): string {
        return this.name;
    }

    public static basic: BasicTypeEntries;
}

function createBasicType() {
    const basicVoid = new Type(BasicTypes[BasicTypes.void], null);
    const basicObject = new Type(BasicTypes[BasicTypes.Object], null);
    const basicInteger = new Type(BasicTypes[BasicTypes.Integer], basicObject);
    const basicReal = new Type(BasicTypes[BasicTypes.Real], basicObject);
    const basicString = new Type(BasicTypes[BasicTypes.String], basicObject);
    const basicOctet = new Type(BasicTypes[BasicTypes.Octet], basicObject);

    return {
        void: basicVoid,
        object: basicObject,
        integer: basicInteger,
        real: basicReal,
        string: basicString,
        octet: basicOctet
    };
}

const basicType = createBasicType();
Type.basic = basicType;

export enum FunctionParameterProperty {
    Normal,
    Params,
    Omittable,
}

export interface FunctionParameterEntry {
    name: string,
    type: Type,
    paramProperty: FunctionParameterProperty
}

export class Function extends Type {
    constructor() { 
        super("Function", basicType.object);
    }

    public typeof(): keyof typeof BasicTypes {
        return "Object";
    }

    public returnType: Type = basicType.void;
    public readonly params: FunctionParameterEntry[] = [];
    public appendParam(name: string, type: Type, paramProperty?: FunctionParameterProperty) {
        this.params.push({ name, type, paramProperty: paramProperty ?? FunctionParameterProperty.Normal });
    }

    public toString(): string {
        let sb = "";
        sb += "(";
        sb += this.params.map(p => {
            return p.name + ": " + p.type
        }).join(", ");
        sb += ")";
        sb += " => ";
        sb += this.returnType.toString();
        return sb;
    }
}

export class Property extends Type {
    constructor() {
        super("Property", basicType.object);
    }

    public typeof(): keyof typeof BasicTypes {
        return "Object";
    }

    public typeShownUp(): Type {
        if (this.getter) {
            return this.getter.returnType;
        }
        else if (this.setter) {
            return this.setter.params[0].type;
        }
        throw new Error("property should have either a setter or a getter");
    }

    public setter?: Function;
    public getter?: Function;

    public toString(): string {
        let sb = "property: ";
        sb += this.typeShownUp().toString();
        sb += " { ";
        if (this.getter) {
            sb += "getter; ";
        }
        if (this.setter) {
            sb += "setter: ";
        }
        sb += "}";
        return sb;
    }
}

// TODO: move to somewhere where all internal types has been all defined
function fullfillBasicType() {
    const basicString = basicType.string;
    // append string.length (property: integer { getter; })
    const propStringLength = new Property();
    const propStringLengthGetter = new Function();
    propStringLengthGetter.returnType = basicType.integer;
    propStringLength.getter = propStringLengthGetter;
    basicString.fields["length"] = propStringLength;
    // append string.[] ((@indexer: integer) => string)
    const funcStringIndexer = new Function();
    funcStringIndexer.appendParam("@0", basicType.integer);
    funcStringIndexer.returnType = basicType.string;
    basicString.fields["@indexer"] = funcStringIndexer;
    // append string.charAt ((index: number) => string)
    const funcStringCharAt = new Function();
    funcStringCharAt.appendParam("index", basicType.integer);
    funcStringCharAt.returnType = basicType.string;
    basicString.fields["charAt"] = funcStringCharAt;
    // append string.toLowerCase (() => string)
    const funcStringToLowerCase = new Function();
    funcStringToLowerCase.returnType = basicType.string;
    basicString.fields["toLowerCase"] = funcStringToLowerCase;
    // append string.toUpperCase (() => string)
    const funcStringToUpperCase = new Function();
    funcStringToUpperCase.returnType = basicType.string;
    basicString.fields["toUpperCase"] = funcStringToUpperCase;
    // append string.substring (() => string)
    const funcStringSubString = new Function();
    funcStringSubString.appendParam("start", basicType.integer);
    funcStringSubString.appendParam("length", basicType.integer, FunctionParameterProperty.Omittable);
    funcStringSubString.returnType = basicType.string;
    basicString.fields["substring"] = funcStringSubString;
    // append string.substr = string.substring
    basicString.fields["substr"] = funcStringSubString;
    // append string.sprintf ((original: string, params*: object[]) => string)
    const funcStringSprintf = new Function();
    funcStringSprintf.appendParam("original", basicType.string);
    funcStringSprintf.appendParam("params*", basicType.object, FunctionParameterProperty.Params);
    funcStringSprintf.returnType = basicType.string;
    basicString.fields["sprintf"] = funcStringSprintf;

    const basicOctet = basicType.octet;
    // append octet.length
    const propOctetLength = new Property();
    const propOctetLengthGetter = new Function();
    propOctetLengthGetter.returnType = basicType.integer;
    propOctetLength.getter = propOctetLengthGetter;
    basicOctet.fields["length"] = propOctetLength;
    // append octet.[]
    const funcOctetIndexer = new Function();
    funcOctetIndexer.appendParam("@0", basicType.integer);
    funcOctetIndexer.returnType = basicType.integer;
    basicOctet.fields["@indexer"] = funcOctetIndexer;
    
}

fullfillBasicType();
