/**
 * Dependency-free, intentionally small JSON-contract checker for REST tests.
 * Supports object/array/string/integer/number/boolean/null, required fields,
 * additionalProperties, array bounds, string length and enum. Not full JSON Schema.
 * Error messages describe structure without copying response values or secrets.
 */
export function validateJsonContract(value, schema) {
  const issues = [];
  const isObject = (item) => item !== null && typeof item === 'object' && !Array.isArray(item);
  const walk = (item, rule, path, depth) => {
    if (depth > 32) { issues.push(`${path}: nesting limit exceeded`); return; }
    if (!isObject(rule) || !['object','array','string','integer','number','boolean','null'].includes(rule.type)) {
      issues.push(`${path}: unsupported contract rule`); return;
    }
    const valid = {
      object: isObject(item), array: Array.isArray(item), string: typeof item === 'string',
      integer: Number.isSafeInteger(item), number: typeof item === 'number' && Number.isFinite(item),
      boolean: typeof item === 'boolean', null: item === null,
    }[rule.type];
    if (!valid) { issues.push(`${path}: expected ${rule.type}`); return; }
    if (Array.isArray(rule.enum) && !rule.enum.includes(item)) issues.push(`${path}: not in allowed enum`);
    if (rule.type === 'string') {
      if (Number.isInteger(rule.minLength) && item.length < rule.minLength) issues.push(`${path}: shorter than minLength`);
      if (Number.isInteger(rule.maxLength) && item.length > rule.maxLength) issues.push(`${path}: longer than maxLength`);
    }
    if (rule.type === 'integer' || rule.type === 'number') {
      if (typeof rule.minimum === 'number' && item < rule.minimum) issues.push(`${path}: below minimum`);
      if (typeof rule.maximum === 'number' && item > rule.maximum) issues.push(`${path}: above maximum`);
    }
    if (rule.type === 'array') {
      if (Number.isInteger(rule.minItems) && item.length < rule.minItems) issues.push(`${path}: fewer items than minItems`);
      if (Number.isInteger(rule.maxItems) && item.length > rule.maxItems) issues.push(`${path}: more items than maxItems`);
      if (rule.items) item.forEach((entry, i) => walk(entry, rule.items, `${path}[${i}]`, depth+1));
    }
    if (rule.type === 'object') {
      const props = isObject(rule.properties) ? rule.properties : {};
      for (const name of rule.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(item, name)) issues.push(`${path}.${name}: required property missing`);
      }
      for (const [key, subrule] of Object.entries(props)) {
        if (Object.prototype.hasOwnProperty.call(item, key)) walk(item[key], subrule, `${path}.${key}`, depth+1);
      }
      if (rule.additionalProperties === false) {
        for (const key of Object.keys(item)) {
          if (!Object.prototype.hasOwnProperty.call(props, key)) issues.push(`${path}.${key}: unexpected property`);
        }
      }
    }
  };
  walk(value, schema, '$', 0);
  return issues;
}
