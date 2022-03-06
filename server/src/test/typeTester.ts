import { GenericType } from "../typeSystem/genericType";
import { Type } from "../typeSystem/type";

console.log("test 1: basic type toString");
console.log(Type.basic.integer.toString());
console.log(Type.basic.object.toString());
console.log(Type.basic.octet.toString());
console.log(Type.basic.real.toString());
console.log(Type.basic.string.toString());
console.log(Type.basic.void.toString());

console.log("test 2: function test");
const func = Type.basic.string.fields["sprintf"];
console.log(func.toString());

console.log("test 3: property test");
const prop = Type.basic.string.fields["length"];
console.log(prop.toString());

console.log("test 4: generic type test");
const myArrayType = new GenericType("Array", Type.basic.object, ["T"]);

