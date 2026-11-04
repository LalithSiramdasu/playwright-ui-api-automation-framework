/** Supported deliberately limited subset of JSON Schema, not the full standard. */
export type JsonContract =
  | { type: 'object'; required?: readonly string[]; properties?: Readonly<Record<string, JsonContract>>; additionalProperties?: boolean }
  | { type: 'array'; items: JsonContract; minItems?: number; maxItems?: number }
  | { type: 'string'; enum?: readonly string[]; minLength?: number; maxLength?: number }
  | { type: 'integer' | 'number'; minimum?: number; maximum?: number; enum?: readonly number[] }
  | { type: 'boolean'; enum?: readonly boolean[] }
  | { type: 'null' };
export function validateJsonContract(value: unknown, schema: JsonContract): string[];
