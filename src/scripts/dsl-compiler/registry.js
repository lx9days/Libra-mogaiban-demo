import helperCompiler from "./compilers/helperCompiler";
import lensCompiler from "./compilers/lensCompiler";
import navigationCompiler from "./compilers/navigationCompiler";
import reorderCompiler from "./compilers/reorderCompiler";
import selectionCompiler from "./compilers/selectionCompiler";
import transformCompiler from "./compilers/transformCompiler";

export function createCompilerRegistry(extraCompilers = []) {
  return [
    selectionCompiler,
    navigationCompiler,
    transformCompiler,
    lensCompiler,
    reorderCompiler,
    helperCompiler,
    ...extraCompilers,
  ];
}

export function findCompilerById(compilerRegistry = [], compilerId = "") {
  return compilerRegistry.find((compiler) => compiler.id === compilerId) || null;
}
