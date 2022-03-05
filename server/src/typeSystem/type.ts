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

export enum FunctionParameterProperty {
    Normal,
    Params,
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
}

function fullfillBasicType() {
    const basicString = basicType.string;
    // append string.length
    const propStringLength = new Property();
    const propStringLengthGetter = new Function();
    propStringLengthGetter.returnType = basicType.integer;
    propStringLength.getter = propStringLengthGetter;
    basicString.fields["length"] = propStringLength;

    // append string.[]
    const funcStringIndexer = new Function();
    funcStringIndexer.appendParam("@0", basicType.integer);
    basicString.fields["@indexer"] = funcStringIndexer;

    const basicOctet = basicType.octet;
    // append octet.length
    const propOctetLength = new Property();
    const propOctetLengthGetter = new Function();
    propOctetLengthGetter.returnType = basicType.integer;
    propOctetLength.getter = propOctetLengthGetter;
    basicOctet.fields["length"] = propOctetLength;
}

fullfillBasicType();

Type.basic = basicType;
