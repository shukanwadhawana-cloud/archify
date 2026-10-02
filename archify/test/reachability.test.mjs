import assert from 'node:assert/strict';
import test from 'node:test';

// The computeReachability function from viewer/focus.js
// This is a copy of the pure logic for testing purposes.
// TODO: Extract to a shared module and import in both places.
function computeReachability(originId, direction, relationships) {
  if (typeof originId !== 'string' || !originId ||
      (direction !== 'upstream' && direction !== 'downstream') ||
      !Array.isArray(relationships)) return null;
  var records = [];
  var seenKeys = Object.create(null);
  relationships.forEach(function (relationship, index) {
    if (!relationship || typeof relationship.from !== 'string' || !relationship.from ||
        typeof relationship.to !== 'string' || !relationship.to) return;
    var key = typeof relationship.key === 'string' && relationship.key
      ? relationship.key : String(index);
    if (seenKeys[key]) return;
    seenKeys[key] = true;
    records.push({ key: key, from: relationship.from, to: relationship.to });
  });

  var depths = Object.create(null);
  var order = [];
  var queue = [originId];
  depths[originId] = 0;
  for (var cursor = 0; cursor < queue.length; cursor += 1) {
    var current = queue[cursor];
    records.forEach(function (relationship) {
      var next = null;
      if (direction === 'downstream' && relationship.from === current) next = relationship.to;
      else if (direction === 'upstream' && relationship.to === current) next = relationship.from;
      if (next == null || Object.prototype.hasOwnProperty.call(depths, next)) return;
      depths[next] = depths[current] + 1;
      queue.push(next);
    });
  }
  queue.forEach(function (id) { order.push(id); });

  var edgeKeys = [];
  records.forEach(function (relationship) {
    if (Object.prototype.hasOwnProperty.call(depths, relationship.from) &&
        Object.prototype.hasOwnProperty.call(depths, relationship.to)) edgeKeys.push(relationship.key);
  });
  var maxDepth = order.reduce(function (maximum, id) {
    return Math.max(maximum, depths[id]);
  }, 0);
  return {
    direction: direction,
    originId: originId,
    nodeIds: order,
    edgeKeys: edgeKeys,
    depths: depths,
    maxDepth: maxDepth
  };
}

test('downstream traversal follows edges from origin', () => {
  const relationships = [
    { key: 'e1', from: 'A', to: 'B' },
    { key: 'e2', from: 'B', to: 'C' },
    { key: 'e3', from: 'C', to: 'D' },
  ];
  const result = computeReachability('A', 'downstream', relationships);
  assert.deepEqual(result.nodeIds, ['A', 'B', 'C', 'D']);
  assert.deepEqual(result.edgeKeys, ['e1', 'e2', 'e3']);
  assert.equal(result.maxDepth, 3);
});

test('upstream traversal follows edges toward origin', () => {
  const relationships = [
    { key: 'e1', from: 'A', to: 'B' },
    { key: 'e2', from: 'B', to: 'C' },
    { key: 'e3', from: 'C', to: 'D' },
  ];
  const result = computeReachability('D', 'upstream', relationships);
  assert.deepEqual(result.nodeIds, ['D', 'C', 'B', 'A']);
  assert.deepEqual(result.edgeKeys, ['e3', 'e2', 'e1']);
  assert.equal(result.maxDepth, 3);
});

test('cyclic relationships terminate without infinite traversal', () => {
  const relationships = [
    { key: 'e1', from: 'A', to: 'B' },
    { key: 'e2', from: 'B', to: 'C' },
    { key: 'e3', from: 'C', to: 'A' }, // cycle back to A
  ];
  const result = computeReachability('A', 'downstream', relationships);
  // Should visit A, B, C and stop (A already visited)
  assert.deepEqual(result.nodeIds, ['A', 'B', 'C']);
  assert.deepEqual(result.edgeKeys, ['e1', 'e2', 'e3']);
  assert.equal(result.maxDepth, 2);
  
  // Also test upstream with cycle
  const result2 = computeReachability('A', 'upstream', relationships);
  assert.deepEqual(result2.nodeIds, ['A', 'C', 'B']);
  assert.deepEqual(result2.edgeKeys, ['e3', 'e2', 'e1']);
});

test('duplicate relationship keys do not create duplicate reachable nodes or edges', () => {
  const relationships = [
    { key: 'e1', from: 'A', to: 'B' },
    { key: 'e1', from: 'A', to: 'B' }, // duplicate key
    { key: 'e2', from: 'B', to: 'C' },
  ];
  const result = computeReachability('A', 'downstream', relationships);
  assert.deepEqual(result.nodeIds, ['A', 'B', 'C']);
  assert.deepEqual(result.edgeKeys, ['e1', 'e2']);
  assert.equal(result.maxDepth, 2);
});

test('traversal results are deterministic', () => {
  const relationships = [
    { key: 'e1', from: 'A', to: 'B' },
    { key: 'e2', from: 'A', to: 'C' },
    { key: 'e3', from: 'B', to: 'D' },
    { key: 'e4', from: 'C', to: 'D' },
  ];
  const result1 = computeReachability('A', 'downstream', relationships);
  const result2 = computeReachability('A', 'downstream', relationships);
  assert.deepEqual(result1, result2);
  
  // Also test with different input orders (should still be deterministic given same input)
  const reversed = [...relationships].reverse();
  const result3 = computeReachability('A', 'downstream', reversed);
  // Note: order may differ because BFS processes in input order, but the set of nodes/edges should be same
  assert.deepEqual(result3.nodeIds.sort(), result1.nodeIds.sort());
  assert.deepEqual(result3.edgeKeys.sort(), result1.edgeKeys.sort());
});

test('empty relationships returns only origin', () => {
  const result = computeReachability('A', 'downstream', []);
  assert.deepEqual(result.nodeIds, ['A']);
  assert.deepEqual(result.edgeKeys, []);
  assert.equal(result.maxDepth, 0);
});

test('invalid inputs return null', () => {
  assert.equal(computeReachability(null, 'downstream', []), null);
  assert.equal(computeReachability('', 'downstream', []), null);
  assert.equal(computeReachability('A', 'sideways', []), null);
  assert.equal(computeReachability('A', 'downstream', null), null);
});

test('origin not in any relationship returns only origin', () => {
  const relationships = [
    { key: 'e1', from: 'X', to: 'Y' },
  ];
  const result = computeReachability('A', 'downstream', relationships);
  assert.deepEqual(result.nodeIds, ['A']);
  assert.deepEqual(result.edgeKeys, []);
  assert.equal(result.maxDepth, 0);
});

test('disconnected graph visits only reachable nodes', () => {
  const relationships = [
    { key: 'e1', from: 'A', to: 'B' },
    { key: 'e2', from: 'X', to: 'Y' },
  ];
  const result = computeReachability('A', 'downstream', relationships);
  assert.deepEqual(result.nodeIds, ['A', 'B']);
  assert.deepEqual(result.edgeKeys, ['e1']);
});
