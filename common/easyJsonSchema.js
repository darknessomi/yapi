/**
 * 将 YApi 简化的参数描述格式转换为 JSON Schema。
 *
 * 规则：
 * - "field": "string" → { type: "string" }
 * - "*field": "string" → required 字段
 * - [{ name: "string" }] → { type: "array", items: { ... } }
 * - { type: "string", minLength: 1 } → 已是 JSON Schema 片段，直接合并
 */

const SUPPORT_TYPES = ['string', 'number', 'array', 'object', 'boolean', 'integer'];

function isPlainObject(obj) {
  return obj ? typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype : false;
}

function getType(type) {
  if (!type) {
    return 'string';
  }
  if (SUPPORT_TYPES.indexOf(type) !== -1) {
    return type;
  }
  return typeof type;
}

function isSchema(object) {
  return SUPPORT_TYPES.indexOf(object.type) !== -1;
}

function handleSchema(json, schema) {
  Object.assign(schema, json);
  if (schema.type === 'object') {
    delete schema.properties;
    parse(json.properties, schema);
  }
  if (schema.type === 'array') {
    delete schema.items;
    schema.items = {};
    parse(json.items, schema.items);
  }
}

function handleArray(arr, schema) {
  schema.type = 'array';
  schema.items = {};
  parse(arr[0], schema.items);
}

function handleObject(json, schema) {
  if (isSchema(json)) {
    return handleSchema(json, schema);
  }
  schema.type = 'object';
  schema.required = [];
  schema.properties = {};
  for (const rawKey in json) {
    let key = rawKey;
    let item = json[key];
    if (key[0] === '*') {
      key = key.slice(1);
      schema.required.push(key);
    }
    schema.properties[key] = {};
    parse(item, schema.properties[key]);
  }
}

function parse(json, schema) {
  if (Array.isArray(json)) {
    handleArray(json, schema);
  } else if (isPlainObject(json)) {
    handleObject(json, schema);
  } else {
    schema.type = getType(json);
  }
}

function easyJsonSchema(data) {
  const jsonSchema = {};
  parse(data, jsonSchema);
  return jsonSchema;
}

module.exports = easyJsonSchema;
