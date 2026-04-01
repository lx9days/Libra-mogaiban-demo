export function createCompilerContext(rawContext = {}, systems = {}) {
  return {
    rawContext,
    layersByName: rawContext.layersByName || {},
    scales: rawContext.scales || {},
    handlers: rawContext.handlers || {},
    refs: rawContext.refs || {},
    diagnostics: [],
    normalizedSpecs: [],
    compilePlans: [],
    executions: [],
    registry: new Map(),
    instrumentRules: systems.instrumentRules || {},
    compilerRegistry: systems.compilerRegistry || [],
    runtimeBuilders: systems.runtimeBuilders || {},
    schema: systems.schema || null,
    options: systems.options || {},
  };
}

export function addDiagnostic(context, diagnostic = {}) {
  const nextDiagnostic = {
    level: diagnostic.level || "info",
    code: diagnostic.code || "compiler/info",
    message: diagnostic.message || "",
    specIndex:
      Number.isInteger(diagnostic.specIndex) && diagnostic.specIndex >= 0
        ? diagnostic.specIndex
        : null,
    instrument: diagnostic.instrument || null,
    compiler: diagnostic.compiler || null,
  };
  context.diagnostics.push(nextDiagnostic);
  return nextDiagnostic;
}

export function registerInstrument(context, name, entry) {
  if (!name) return null;
  context.registry.set(name, entry);
  return entry;
}
