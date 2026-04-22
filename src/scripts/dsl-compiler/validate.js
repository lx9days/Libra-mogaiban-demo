import { addDiagnostic } from "./context";
import { feedbackDirectFields, getRequiredDslFields, isKnownDslField, isKnownFeedbackField } from "./rules/dslSchema";
import { findInstrumentRule } from "./rules/instrumentRules";

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function hasOwnField(value, fieldName) {
  return !!value && Object.prototype.hasOwnProperty.call(value, fieldName);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validateNormalizedSpec(spec, context = {}) {
  const diagnostics = [];
  const schema = context.schema;
  const rawSpec = spec.rawSpec || {};
  const rule = spec.rule || findInstrumentRule(context.instrumentRules || {}, spec.instrument);
  const requiredFields = getRequiredDslFields(schema);
  const rawFeedback = rawSpec.feedback;

  requiredFields.forEach((fieldName) => {
    if (!hasValue(spec[fieldName])) {
      diagnostics.push(
        addDiagnostic(context, {
          level: "error",
          code: "dsl/missing-required-field",
          message: `缺少必填字段 ${fieldName}`,
          specIndex: spec.specIndex,
          instrument: spec.instrument || null,
        })
      );
    }
  });

  requiredFields.forEach((fieldName) => {
    if (hasOwnField(rawSpec, fieldName)) return;
    diagnostics.push(
      addDiagnostic(context, {
        level: "error",
        code: "dsl/missing-top-level-term",
        message: `新版 DSL 必须显式包含顶层词条 ${fieldName}`,
        specIndex: spec.specIndex,
        instrument: spec.instrument || null,
      })
    );
  });

  if (spec.instrument && !rule) {
    diagnostics.push(
      addDiagnostic(context, {
        level: "warning",
        code: "dsl/unknown-instrument",
        message: `未注册的 instrument: ${spec.instrument}`,
        specIndex: spec.specIndex,
        instrument: spec.instrument,
      })
    );
  }

  if (rule && Array.isArray(rule.triggers) && rule.triggers.length > 0 && spec.trigger) {
    const allowed = new Set(rule.triggers);
    if (!allowed.has(spec.trigger)) {
      diagnostics.push(
        addDiagnostic(context, {
          level: "warning",
          code: "dsl/trigger-not-in-rule",
          message: `instrument ${spec.instrument} 当前未声明 trigger ${spec.trigger}`,
          specIndex: spec.specIndex,
          instrument: spec.instrument,
        })
      );
    }
  }

  if (rule?.requiresTargetLayer && !hasValue(spec.targetLayer)) {
    diagnostics.push(
      addDiagnostic(context, {
        level: "warning",
        code: "dsl/missing-target-layer",
        message: `instrument ${spec.instrument} 的 target 中尚未声明可解析图层`,
        specIndex: spec.specIndex,
        instrument: spec.instrument,
      })
    );
  }

  if (!isPlainObject(rawFeedback)) {
    diagnostics.push(
      addDiagnostic(context, {
        level: "error",
        code: "dsl/invalid-feedback-shape",
        message: "新版 DSL 的 feedback 必须是对象，并且只包含 redrawFunc、service、feedforward、context 这些直接属性",
        specIndex: spec.specIndex,
        instrument: spec.instrument || null,
      })
    );
  } else {
    const feedbackKeys = Object.keys(rawFeedback);
    if (feedbackKeys.length === 0 && !rawSpec.customFeedbackFlow) {
      diagnostics.push(
        addDiagnostic(context, {
          level: "error",
          code: "dsl/empty-feedback",
          message: `feedback 至少需要包含 ${feedbackDirectFields.join("、")} 中的一个属性，或者提供 customFeedbackFlow`,
          specIndex: spec.specIndex,
          instrument: spec.instrument || null,
        })
      );
    }

    feedbackKeys.forEach((fieldName) => {
      if (isKnownFeedbackField(fieldName)) return;
      diagnostics.push(
        addDiagnostic(context, {
          level: "error",
          code: "dsl/invalid-feedback-field",
          message: `feedback 直接属性仅允许 ${feedbackDirectFields.join("、")}，检测到多余字段 ${fieldName}`,
          specIndex: spec.specIndex,
          instrument: spec.instrument || null,
        })
      );
    });

    if (rawFeedback.context !== undefined && !isPlainObject(rawFeedback.context)) {
      diagnostics.push(
        addDiagnostic(context, {
          level: "error",
          code: "dsl/invalid-feedback-context",
          message: "feedback.context 必须是对象格式",
          specIndex: spec.specIndex,
          instrument: spec.instrument || null,
        })
      );
    }

    if (
      isPlainObject(rawFeedback.context) &&
      rawFeedback.context.link !== undefined &&
      !isPlainObject(rawFeedback.context.link)
    ) {
      diagnostics.push(
        addDiagnostic(context, {
          level: "error",
          code: "dsl/invalid-feedback-context-link",
          message: "feedback.context.link 必须是对象格式",
          specIndex: spec.specIndex,
          instrument: spec.instrument || null,
        })
      );
    }
  }

  Object.keys(rawSpec).forEach((fieldName) => {
    if (!schema) return;
    if (isKnownDslField(fieldName, schema)) return;
    diagnostics.push(
      addDiagnostic(context, {
        level: "error",
        code: "dsl/invalid-top-level-field",
        message: `新版 DSL 顶层仅允许 instrument、trigger、target、feedback 与可选 name、customFeedbackFlow，检测到多余字段 ${fieldName}`,
        specIndex: spec.specIndex,
        instrument: spec.instrument || null,
      })
    );
  });

  return diagnostics;
}

export function hasBlockingDiagnostics(diagnostics = []) {
  return diagnostics.some((diagnostic) => diagnostic.level === "error");
}
