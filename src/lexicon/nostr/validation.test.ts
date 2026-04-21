import { describe, it, expect } from 'vitest';
import {
  getCommentTargetType,
  isHex32,
  isKnownReaction,
  isValidCommentEvent,
  isValidContractRef,
  isValidLineRange,
  isValidNostrEvent,
  isValidReactionEvent,
  validateLineTargeting,
} from './validation';
import { buildCommentEventTemplate, buildReactionEventTemplate } from './conversion';
import { KIND_COMMENT, type NostrEvent } from './types';

const TX_ID = '0x' + '1'.repeat(64);
const PUBKEY = 'a'.repeat(64);
const EVENT_ID = 'b'.repeat(64);
const SIG = 'c'.repeat(128);
const REF = {
  principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
  contractName: 'alex-vault',
  txId: TX_ID,
};

function sign(tpl: ReturnType<typeof buildCommentEventTemplate>, overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: EVENT_ID,
    pubkey: PUBKEY,
    created_at: tpl.created_at,
    kind: tpl.kind,
    tags: tpl.tags,
    content: tpl.content,
    sig: SIG,
    ...overrides,
  };
}

describe('isHex32', () => {
  it('accepts 64-char lowercase hex', () => {
    expect(isHex32('a'.repeat(64))).toBe(true);
  });
  it('rejects wrong length or casing', () => {
    expect(isHex32('a'.repeat(63))).toBe(false);
    expect(isHex32('A'.repeat(64))).toBe(false);
    expect(isHex32('')).toBe(false);
    expect(isHex32(null)).toBe(false);
  });
});

describe('isValidContractRef', () => {
  it('accepts a well-formed ref', () => {
    expect(isValidContractRef(REF)).toBe(true);
  });
  it('rejects missing fields', () => {
    expect(isValidContractRef(null)).toBe(false);
    expect(isValidContractRef({})).toBe(false);
    expect(isValidContractRef({ principal: 'SP', contractName: '', txId: TX_ID })).toBe(false);
    expect(isValidContractRef({ principal: 'SP', contractName: 'x', txId: '' })).toBe(false);
  });
});

describe('isValidLineRange', () => {
  it('rejects invalid ranges', () => {
    expect(isValidLineRange({ start: 0, end: 5 })).toBe(false);
    expect(isValidLineRange({ start: 10, end: 5 })).toBe(false);
    expect(isValidLineRange({ start: 1.5, end: 5 })).toBe(false);
    expect(isValidLineRange(null)).toBe(false);
  });
});

describe('isValidNostrEvent', () => {
  it('accepts a structurally valid event', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi');
    expect(isValidNostrEvent(sign(tpl))).toBe(true);
  });
  it('rejects events with malformed id', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi');
    expect(isValidNostrEvent(sign(tpl, { id: 'z'.repeat(64) }))).toBe(false);
  });
  it('rejects events with malformed sig', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi');
    expect(isValidNostrEvent(sign(tpl, { sig: 'c'.repeat(127) }))).toBe(false);
  });
});

describe('isValidCommentEvent', () => {
  it('accepts a comment event with a Stacks root', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi');
    expect(isValidCommentEvent(sign(tpl))).toBe(true);
  });
  it('rejects events of other kinds', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi');
    expect(isValidCommentEvent(sign(tpl, { kind: 1 }))).toBe(false);
  });
  it('rejects empty or oversize content', () => {
    const empty = buildCommentEventTemplate(REF, '');
    expect(isValidCommentEvent(sign(empty))).toBe(false);
    const big = buildCommentEventTemplate(REF, 'x'.repeat(10001));
    expect(isValidCommentEvent(sign(big))).toBe(false);
  });
});

describe('isValidReactionEvent', () => {
  it('accepts a NIP-25 reaction', () => {
    const tpl = buildReactionEventTemplate({ id: EVENT_ID, pubkey: PUBKEY }, '👍');
    const event: NostrEvent = { id: 'd'.repeat(64), pubkey: PUBKEY, sig: SIG, ...tpl };
    expect(isValidReactionEvent(event)).toBe(true);
  });
  it('rejects reactions with no e tag', () => {
    const event: NostrEvent = {
      id: 'd'.repeat(64),
      pubkey: PUBKEY,
      created_at: 0,
      kind: 7,
      tags: [['p', PUBKEY]],
      content: '👍',
      sig: SIG,
    };
    expect(isValidReactionEvent(event)).toBe(false);
  });
});

describe('isKnownReaction', () => {
  it.each(['👍', '❤️', '🔥', '👀', '🚀', '⚠️'])('accepts %s', (emoji) => {
    expect(isKnownReaction(emoji)).toBe(true);
  });
  it('rejects other emoji', () => {
    expect(isKnownReaction('💩')).toBe(false);
  });
});

describe('validateLineTargeting', () => {
  it('accepts no line tags', () => {
    expect(validateLineTargeting([])).toEqual({ valid: true });
  });
  it('accepts only a line tag', () => {
    expect(validateLineTargeting([['line', '5']])).toEqual({ valid: true });
  });
  it('accepts only a lines tag', () => {
    expect(validateLineTargeting([['lines', '1', '5']])).toEqual({ valid: true });
  });
  it('rejects both line and lines', () => {
    const result = validateLineTargeting([['line', '5'], ['lines', '1', '5']]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mutually exclusive');
  });
});

describe('getCommentTargetType', () => {
  it('returns contract for no line tags', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi');
    expect(getCommentTargetType(tpl.tags)).toBe('contract');
  });
  it('returns line for a single-line comment', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi', { lineNumber: 5 });
    expect(getCommentTargetType(tpl.tags)).toBe('line');
  });
  it('returns range for a range comment', () => {
    const tpl = buildCommentEventTemplate(REF, 'hi', { lineRange: { start: 1, end: 5 } });
    expect(getCommentTargetType(tpl.tags)).toBe('range');
  });
});

describe('consistency: event kind constant', () => {
  it('KIND_COMMENT is 1111 (NIP-22)', () => {
    expect(KIND_COMMENT).toBe(1111);
  });
});
