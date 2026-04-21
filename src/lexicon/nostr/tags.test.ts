import { describe, it, expect } from 'vitest';
import {
  buildLineTags,
  buildParentTags,
  buildStacksRootTags,
  findTag,
  findTagValue,
  findTagValues,
  parseLineTags,
  parseReplyRef,
  parseStacksTxExternalId,
  readRootStacksTxId,
} from './tags';
import { EXTERNAL_ID_STACKS_TX, KIND_COMMENT, stacksTxExternalId } from './types';

const TX_ID = '0xdeadbeef';
const REF = { principal: 'SP1', contractName: 'c', txId: TX_ID };

describe('tag lookup helpers', () => {
  const tags = [
    ['I', 'stacks:tx:0x1'],
    ['K', 'stacks:tx'],
    ['p', 'p1'],
    ['p', 'p2'],
  ];

  it('findTagValue returns the first match', () => {
    expect(findTagValue(tags, 'I')).toBe('stacks:tx:0x1');
    expect(findTagValue(tags, 'p')).toBe('p1');
    expect(findTagValue(tags, 'missing')).toBeUndefined();
  });

  it('findTagValues returns all values', () => {
    expect(findTagValues(tags, 'p')).toEqual(['p1', 'p2']);
  });

  it('findTag returns the whole tag array', () => {
    expect(findTag(tags, 'K')).toEqual(['K', 'stacks:tx']);
  });
});

describe('buildStacksRootTags', () => {
  it('emits I and K root tags with the NIP-73 scheme', () => {
    const tags = buildStacksRootTags(REF);
    expect(tags).toEqual([
      ['I', stacksTxExternalId(TX_ID)],
      ['K', EXTERNAL_ID_STACKS_TX],
    ]);
  });
});

describe('buildParentTags', () => {
  it('mirrors root scope for a top-level comment', () => {
    const tags = buildParentTags(REF);
    expect(tags).toEqual([
      ['i', stacksTxExternalId(TX_ID)],
      ['k', EXTERNAL_ID_STACKS_TX],
    ]);
  });

  it('emits e/k/p for a reply to a sibling event', () => {
    const parentId = 'd'.repeat(64);
    const tags = buildParentTags(REF, {
      root: { id: parentId, pubkey: 'a'.repeat(64) },
      parent: { id: parentId, pubkey: 'a'.repeat(64) },
    });
    expect(findTag(tags, 'e')?.[1]).toBe(parentId);
    expect(findTagValue(tags, 'k')).toBe(String(KIND_COMMENT));
    expect(findTagValue(tags, 'p')).toBe('a'.repeat(64));
    // No E/P when root and parent are the same
    expect(findTag(tags, 'E')).toBeUndefined();
    expect(findTag(tags, 'P')).toBeUndefined();
  });

  it('emits E/P when root differs from parent', () => {
    const rootId = 'r'.repeat(64);
    const parentId = 'p'.repeat(64);
    const tags = buildParentTags(REF, {
      root: { id: rootId, pubkey: 'root-pk' },
      parent: { id: parentId, pubkey: 'parent-pk' },
    });
    expect(findTag(tags, 'E')?.[1]).toBe(rootId);
    expect(findTagValue(tags, 'P')).toBe('root-pk');
    expect(findTag(tags, 'e')?.[1]).toBe(parentId);
  });
});

describe('line tag helpers', () => {
  it('round-trips a single line', () => {
    const tags = buildLineTags({ lineNumber: 42 });
    expect(parseLineTags(tags)).toEqual({ lineNumber: 42 });
  });

  it('round-trips a line range', () => {
    const tags = buildLineTags({ lineRange: { start: 10, end: 20 } });
    expect(parseLineTags(tags)).toEqual({ lineRange: { start: 10, end: 20 } });
  });

  it('emits nothing when neither is set', () => {
    expect(buildLineTags({})).toEqual([]);
    expect(parseLineTags([])).toEqual({});
  });

  it('rejects malformed line tags on parse', () => {
    expect(parseLineTags([['line', 'abc']])).toEqual({});
    expect(parseLineTags([['lines', '5', '1']])).toEqual({}); // end < start
  });
});

describe('stacks external id parsing', () => {
  it('extracts the tx id', () => {
    expect(parseStacksTxExternalId(stacksTxExternalId(TX_ID))).toBe(TX_ID);
  });

  it('returns undefined for other schemes', () => {
    expect(parseStacksTxExternalId('bitcoin:txid:abc')).toBeUndefined();
    expect(parseStacksTxExternalId('stacks:tx:')).toBeUndefined();
  });

  it('reads root tx id from event tags', () => {
    const tags = buildStacksRootTags(REF);
    expect(readRootStacksTxId(tags)).toBe(TX_ID);
  });
});

describe('parseReplyRef', () => {
  it('returns undefined when there is no parent e tag', () => {
    expect(parseReplyRef([['I', 'stacks:tx:0x1']])).toBeUndefined();
  });

  it('returns parent-only when E is absent', () => {
    const parentId = 'p'.repeat(64);
    const ref = parseReplyRef([['e', parentId, '', 'pk1']]);
    expect(ref?.parent.id).toBe(parentId);
    expect(ref?.parent.pubkey).toBe('pk1');
    expect(ref?.root.id).toBe(parentId);
  });

  it('returns distinct root and parent when both present', () => {
    const rootId = 'r'.repeat(64);
    const parentId = 'p'.repeat(64);
    const ref = parseReplyRef([
      ['E', rootId, '', 'root-pk'],
      ['e', parentId, '', 'parent-pk'],
    ]);
    expect(ref?.root.id).toBe(rootId);
    expect(ref?.root.pubkey).toBe('root-pk');
    expect(ref?.parent.id).toBe(parentId);
    expect(ref?.parent.pubkey).toBe('parent-pk');
  });
});
