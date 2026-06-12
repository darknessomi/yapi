import test from 'ava';
import easyJsonSchema from '../../common/easyJsonSchema';

test('primitive field', t => {
  const schema = easyJsonSchema({ name: 'string', count: 'number' });
  t.deepEqual(schema, {
    type: 'object',
    required: [],
    properties: {
      name: { type: 'string' },
      count: { type: 'number' }
    }
  });
});

test('required field with asterisk prefix', t => {
  const schema = easyJsonSchema({ '*id': 'number', token: 'string' });
  t.deepEqual(schema.required, ['id']);
  t.deepEqual(schema.properties.id, { type: 'number' });
  t.deepEqual(schema.properties.token, { type: 'string' });
});

test('array template', t => {
  const schema = easyJsonSchema({
    req_query: [{ name: 'string', required: 'string' }]
  });
  t.is(schema.properties.req_query.type, 'array');
  t.deepEqual(schema.properties.req_query.items, {
    type: 'object',
    required: [],
    properties: {
      name: { type: 'string' },
      required: { type: 'string' }
    }
  });
});

test('json schema fragment', t => {
  const schema = easyJsonSchema({
    '*path': { type: 'string', minLength: 1 },
    mode: { type: 'string', default: 'html' }
  });
  t.deepEqual(schema.required, ['path']);
  t.deepEqual(schema.properties.path, { type: 'string', minLength: 1 });
  t.deepEqual(schema.properties.mode, { type: 'string', default: 'html' });
});

test('validateParams integration shape', t => {
  const schema = easyJsonSchema({
    '*type': 'string',
    merge: { type: 'string', default: 'normal' }
  });
  t.deepEqual(schema, {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string' },
      merge: { type: 'string', default: 'normal' }
    }
  });
});
