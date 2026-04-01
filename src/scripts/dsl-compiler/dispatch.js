import { addDiagnostic } from "./context";
import { findCompilerById } from "./registry";
import { findInstrumentRule } from "./rules/instrumentRules";

export function dispatchCompiler(spec, context = {}) {
  const rule = spec.rule || findInstrumentRule(context.instrumentRules || {}, spec.instrument);

  if (rule?.compiler) {
    const compiler = findCompilerById(context.compilerRegistry || [], rule.compiler);
    if (compiler) return compiler;
  }

  const matchedCompiler =
    (context.compilerRegistry || []).find((compiler) => typeof compiler.match === "function" && compiler.match(spec, context)) ||
    null;

  if (matchedCompiler) return matchedCompiler;

  addDiagnostic(context, {
    level: "warning",
    code: "dispatch/no-compiler",
    message: `未找到可处理 ${spec.instrument || "unknown"} 的 compiler`,
    specIndex: spec.specIndex,
    instrument: spec.instrument || null,
  });
  return null;
}
