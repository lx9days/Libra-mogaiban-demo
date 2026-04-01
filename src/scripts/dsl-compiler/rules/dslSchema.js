export const dslSchema = {
  type: "object",
  required: ["instrument", "trigger", "target", "feedback"],
  optional: ["name", "customFeedbackFlow"],
};

export const feedbackDirectFields = ["redrawFunc", "service", "feedforward", "context"];

export function getRequiredDslFields(schema = dslSchema) {
  return Array.isArray(schema.required) ? schema.required : [];
}

export function isKnownDslField(fieldName, schema = dslSchema) {
  const required = Array.isArray(schema.required) ? schema.required : [];
  const optional = Array.isArray(schema.optional) ? schema.optional : [];
  return required.includes(fieldName) || optional.includes(fieldName);
}

export function isKnownFeedbackField(fieldName) {
  return feedbackDirectFields.includes(fieldName);
}
