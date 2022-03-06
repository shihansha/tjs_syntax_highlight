import assert = require("assert");
import { Function, FunctionParameterEntry, FunctionParameterProperty, Property, Type } from "./type";

type MaybeGeneric = string | Type | GenericType;

export class GenericType {

    protected m_mapTable: MaybeGeneric[] = [];
    public constructor(
        public readonly genericName: string,
        protected m_base: null | MaybeGeneric | MaybeGeneric[],
        public readonly typeParameters: ReadonlyArray<string>
    ) { 
        typeParameters.forEach(t => this.m_mapTable.push(t));
    }

    public get name() {
        let sb = this.genTypeParStr();
        return sb;
    }

    protected m_fields: { [key: string]: MaybeGeneric } = {};
    protected genTypeParStr() {
        let sb = this.genericName + "<";
        sb += this.m_mapTable.map(element => {
            if (typeof element === "string") {
                return element;
            }
            else if (element instanceof Type) {
                return element.name;
            }
            else {
                return element.name;
            }
        }).join(", ");
        sb += ">";
        return sb;
    }

    public get fields() {
        return this.m_fields;
    }

    protected fieldCanCastToType(field: MaybeGeneric): boolean {
        if (field instanceof GenericType) {
            return field.canCastToType();
        }
        else if (typeof field === "string") {
            return false;
        }
        return true;
    }

    public canCastToType(): boolean {
        if (this.m_base) {
            if (this.m_base instanceof Array) {
                for (const b of this.m_base) {
                    if (!this.fieldCanCastToType(b)) {
                        return false;
                    }
                }
            }
            else {
                if (this.m_base instanceof GenericType) {
                    if (!this.fieldCanCastToType(this.m_base)) {
                        return false;
                    }
                }
            }
        }

        for (const fieldName in this.fields) {
            if (Object.prototype.hasOwnProperty.call(this.fields, fieldName)) {
                const field = this.fields[fieldName];
                if (!this.fieldCanCastToType(field)) {
                    return false;
                }
            }
        }

        return true;
    }

    protected fieldCastToType(field: MaybeGeneric): Type {
        assert(this.fieldCanCastToType(field), "field in generic type has not been resolved");
        if (field instanceof GenericType) {
            return field.castToType();
        }
        else if (typeof field === "string") {
            throw new Error("no touch");
        }
        else {
            return field;
        }
    }

    public castToType(): Type {
        assert(this.canCastToType(), "generic type has not been resolved");
        let typeBase: null | Type | Type[] = null;
        let typeFields: { [key: string]: Type } = {};
        if (this.m_base) {
            if (this.m_base instanceof Array) {
                typeBase = [];
                for (let i = 0; i < this.m_base.length; i++) {
                    const b = this.m_base[i];
                    typeBase.push(this.fieldCastToType(b));
                }
            }
            else {
                typeBase = this.fieldCastToType(this.m_base);
            }
        }
        for (const fieldName in this.fields) {
            if (Object.prototype.hasOwnProperty.call(this.fields, fieldName)) {
                const field = this.fields[fieldName];
                typeFields[fieldName] = this.fieldCastToType(field);
            }
        }

        const newType = new Type(this.name, typeBase);
        for (const fieldName in typeFields) {
            if (Object.prototype.hasOwnProperty.call(typeFields, fieldName)) {
                const element = typeFields[fieldName];
                newType.fields[fieldName] = element;
            }
        }
        return newType;
    }

    protected resolveField(field: MaybeGeneric, key: string, value: MaybeGeneric): MaybeGeneric {
        if (typeof field === "string") {
            if (field === key) {
                return value;
            }
            else {
                return field;
            }
        }
        else if (field instanceof Type) {
            return field;
        }
        else {
            return field.resolve(key, value);
        }
    }

    public clone(): GenericType {
        const cloned = new GenericType(this.genericName, this.m_base, this.typeParameters);
        cloned.m_mapTable = this.m_mapTable;
        cloned.m_fields = this.m_fields;
        return cloned;
    }

    public resolve(key: string, value: MaybeGeneric): GenericType {
        return this.clone().resolveOnSelf(key, value);
    }

    protected resolveOnSelf(key: string, value: MaybeGeneric): this {
        if (this.m_mapTable.includes(key)) {
            this.m_mapTable[this.m_mapTable.indexOf(key)] = value;
        }
        if (this.m_base) {
            if (this.m_base instanceof Array) {
                for (let i = 0; i < this.m_base.length; i++) {
                    const b = this.m_base[i];
                    this.m_base[i] = this.resolveField(b, key, value);
                }
            }
            else {
                this.m_base = this.resolveField(this.m_base, key, value);
            }
        }
        for (const fieldName in this.m_fields) {
            if (Object.prototype.hasOwnProperty.call(this.m_fields, fieldName)) {
                const element = this.m_fields[fieldName];
                this.m_fields[fieldName] = this.resolveField(element, key, value);
            }
        }
        return this;
    }
}

export interface GenericFunctionParameterEntry {
    name: string,
    type: MaybeGeneric,
    paramProperty: FunctionParameterProperty
}


export class GenericFunctionType extends GenericType {
    public constructor(
        typeParameters: ReadonlyArray<string>
    ) { 
        super("Function", Type.basic.object, typeParameters);
    }

    private m_params: GenericFunctionParameterEntry[] = [];
    public get params() {
        return this.m_params;
    }
    public returnType: MaybeGeneric = Type.basic.void;

    public override get name(): string {
        let sb = this.genTypeParStr();
        sb += "(";
        sb += this.m_params.map(p => {
            let ret = p.name + ": ";
            if (typeof p.type === "string") {
                ret += p.type;
            }
            else if (p.type instanceof Type) {
                ret += p.type.name;
            }
            else {
                ret += p.type.name;
            }
            return ret;
        }).join(", ");
        sb += " => ";
        if (typeof this.returnType === "string") {
            sb += this.returnType;
        }
        else if (this.returnType instanceof Type) {
            sb += this.returnType.name;
        }
        else {
            sb += this.returnType.name;
        }
        return sb;
    }
    
    public override canCastToType(): boolean {
        const baseResult = super.canCastToType();
        if (!baseResult) {
            return false;
        }

        for (const p of this.m_params) {
            if (!this.fieldCanCastToType(p.type)) {
                return false;
            }
        }
        if (!this.fieldCanCastToType(this.returnType)) {
            return false;
        }

        return true;
    }

    public override castToType(): Function {
        assert(this.canCastToType(), "generic type has not been resolved");
        let typeBase: null | Type | Type[] = null;
        let typeFields: { [key: string]: Type } = {};
        let typeParams: FunctionParameterEntry[] = [];
        let typeRet: Type = Type.basic.void;
        if (this.m_base) {
            if (this.m_base instanceof Array) {
                typeBase = [];
                for (let i = 0; i < this.m_base.length; i++) {
                    const b = this.m_base[i];
                    typeBase.push(this.fieldCastToType(b));
                }
            }
            else {
                typeBase = this.fieldCastToType(this.m_base);
            }
        }
        for (const fieldName in this.fields) {
            if (Object.prototype.hasOwnProperty.call(this.fields, fieldName)) {
                const field = this.fields[fieldName];
                typeFields[fieldName] = this.fieldCastToType(field);
            }
        }
        for (const p of this.m_params) {
            typeParams.push({
                type: this.fieldCastToType(p.type),
                name: p.name,
                paramProperty: p.paramProperty
            });
        }
        typeRet = this.fieldCastToType(this.returnType);

        const newType = new Function();
        for (const fieldName in typeFields) {
            if (Object.prototype.hasOwnProperty.call(typeFields, fieldName)) {
                const element = typeFields[fieldName];
                newType.fields[fieldName] = element;
            }
        }
        for (const p of typeParams) {
            newType.appendParam(p.name, p.type, p.paramProperty);
        }
        newType.returnType = typeRet;
        return newType;
    }

    public override clone(): GenericFunctionType {
        const cloned = new GenericFunctionType(this.typeParameters);
        cloned.m_mapTable = this.m_mapTable;
        cloned.m_fields = this.m_fields;
        cloned.m_params = this.m_params;
        cloned.returnType = this.returnType;
        return cloned;
    }

    public override resolve(key: string, value: MaybeGeneric): GenericFunctionType {
        return this.clone().resolveOnSelf(key, value);
    }

    protected override resolveOnSelf(key: string, value: MaybeGeneric): this {
        super.resolveOnSelf(key, value);
        for (const p of this.m_params) {
            p.type = this.resolveField(p.type, key, value);
        }
        this.returnType = this.resolveField(this.returnType, key, value);
        return this;
    }
}


export class GenericPropertyType extends GenericType {
    public constructor(
        typeParameters: ReadonlyArray<string>
    ) { 
        super("Property", Type.basic.object, typeParameters);
    }

    public getter?: GenericFunctionType;
    public setter?: GenericFunctionType;
    
    public override canCastToType(): boolean {
        const baseResult = super.canCastToType();
        if (!baseResult) {
            return false;
        }

        if (this.getter) {
            if (!this.getter.canCastToType()) {
                return false;
            }
        }
        if (this.setter) {
            if (!this.setter.canCastToType()) {
                return false;
            }
        }

        return true;
    }

    public override castToType(): Type {
        assert(this.canCastToType(), "generic type has not been resolved");
        let typeBase: null | Type | Type[] = null;
        let typeFields: { [key: string]: Type } = {};
        let typeGetter: Function | undefined = undefined;
        let typeSetter: Function | undefined = undefined;
        if (this.m_base) {
            if (this.m_base instanceof Array) {
                typeBase = [];
                for (let i = 0; i < this.m_base.length; i++) {
                    const b = this.m_base[i];
                    typeBase.push(this.fieldCastToType(b));
                }
            }
            else {
                typeBase = this.fieldCastToType(this.m_base);
            }
        }
        for (const fieldName in this.fields) {
            if (Object.prototype.hasOwnProperty.call(this.fields, fieldName)) {
                const field = this.fields[fieldName];
                typeFields[fieldName] = this.fieldCastToType(field);
            }
        }
        if (this.getter) {
            typeGetter = this.getter.castToType();
        }
        if (this.setter) {
            typeSetter = this.setter.castToType();
        }

        const newType = new Property();
        for (const fieldName in typeFields) {
            if (Object.prototype.hasOwnProperty.call(typeFields, fieldName)) {
                const element = typeFields[fieldName];
                newType.fields[fieldName] = element;
            }
        }
        newType.getter = typeGetter;
        newType.setter = typeSetter;
        return newType;
    }

    public override clone(): GenericPropertyType {
        const cloned = new GenericPropertyType(this.typeParameters);
        cloned.m_mapTable = this.m_mapTable;
        cloned.m_fields = this.m_fields;
        cloned.getter = this.getter;
        cloned.setter = this.setter;
        return cloned;
    }

    public override resolve(key: string, value: MaybeGeneric): GenericPropertyType {
        return this.clone().resolveOnSelf(key, value);
    }

    protected override resolveOnSelf(key: string, value: MaybeGeneric): this {
        super.resolveOnSelf(key, value);
        this.getter = this.getter?.resolve(key, value);
        this.setter = this.setter?.resolve(key, value);
        return this;
    }
}


