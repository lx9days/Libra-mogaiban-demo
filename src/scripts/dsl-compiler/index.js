import { addDiagnostic, createCompilerContext } from "./context";
import { dispatchCompiler } from "./dispatch";
import { normalizeSpecList } from "./normalize";
import { createCompilerRegistry } from "./registry";
import { createRuntimeBuilderRegistry, runBuildPlans } from "./runtime/builderRegistry";
import { dslSchema } from "./rules/dslSchema";
import { createInstrumentRules } from "./rules/instrumentRules";
import { hasBlockingDiagnostics, validateNormalizedSpec } from "./validate";

export function compileDSL(specList = [], rawContext = {}, options = {}) {
  const instrumentRules = createInstrumentRules(options.instrumentRules);
  const compilerRegistry = createCompilerRegistry(options.compilerRegistry || []);
  const runtimeBuilders = createRuntimeBuilderRegistry(options.runtimeBuilders || {});
  const context = createCompilerContext(rawContext, {
    instrumentRules,
    compilerRegistry,
    runtimeBuilders,
    schema: options.schema || dslSchema,
    options,
  });

  const normalizedSpecs = normalizeSpecList(specList, context);
  context.normalizedSpecs = normalizedSpecs;

  const validSpecs = [];
  normalizedSpecs.forEach((spec) => {
    const diagnostics = validateNormalizedSpec(spec, context);
    if (!hasBlockingDiagnostics(diagnostics)) {
      validSpecs.push(spec);
    }
  });

  const compilePlans = [];
  validSpecs.forEach((spec) => {
    const compiler = dispatchCompiler(spec, context);
    if (!compiler || typeof compiler.compile !== "function") return;
    const nextPlans = compiler.compile(spec, context);
    if (Array.isArray(nextPlans)) {
      compilePlans.push(...nextPlans);
    } else if (nextPlans) {
      compilePlans.push(nextPlans);
    }
  });

  context.compilePlans = compilePlans;

  let executions = [];
  if (options.execute === true) {
    executions = runBuildPlans(compilePlans, context);
  } else {
    addDiagnostic(context, {
      level: "info",
      code: "compiler/dry-run",
      message: "当前使用骨架编译器 dry-run 模式，尚未执行 runtime builder",
    });
  }

  context.executions = executions;

  return {
    normalizedSpecs,
    compilePlans,
    diagnostics: context.diagnostics,
    registry: context.registry,
    executions,
    context,
  };
}

export {
  createCompilerContext,
  createCompilerRegistry,
  createInstrumentRules,
  createRuntimeBuilderRegistry,
  dispatchCompiler,
  normalizeSpecList,
  validateNormalizedSpec,
};
