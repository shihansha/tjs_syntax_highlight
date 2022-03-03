import { open, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { MacroParser } from "../preprocessor/macroParser";
import { Preprocessor } from "../preprocessor/preprocessor";

console.log("#test 1: single macro x4");
const test0 = new MacroParser("test", "(1+1)", 0, { line: 0, character: 0 }, {}).parse();
console.log(JSON.stringify(test0));

const test1 = new MacroParser("test", "(1+(2-3)*4)", 0, { line: 0, character: 0 }, {}).parse();
console.log(JSON.stringify(test1));

const test2 = new MacroParser("test", "(1+(a=3)*4)", 0, { line: 0, character: 0 }, {}).parse();
console.log(JSON.stringify(test2));

const test3 = new MacroParser("test", "(b=1+(a=2-3)*4)", 0, { line: 0, character: 0 }, {}).parse();
console.log(JSON.stringify(test3));


console.log("#test2: file test");
const file = "macrotest.krkr";
const inputFolder = "../../../test";
const outputFolder = "../../../out";
const content = readFileSync(join(inputFolder, file), "utf8");


const pre = new Preprocessor(file, content, {});
const res = pre.run();
console.log("defines: ");
console.log(JSON.stringify(res.defines));
console.log("inactiveRegions: ");
console.log(JSON.stringify(res.disabledArea));

writeFileSync(join(outputFolder, file), res.chunk, "utf8");


