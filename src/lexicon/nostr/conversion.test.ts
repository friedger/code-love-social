import { describe, it, expect } from 'vitest';
import {
  buildCommentEventTemplate,
  buildReactionEventTemplate,
  fromCommentEvent,
  toCommentEventTemplate,
} from './conversion';
import {
  EXTERNAL_ID_STACKS_TX,
  KIND_COMMENT,
  KIND_REACTION,
  stacksTxExternalId,
  type Comment,
  type NostrEvent,
} from './types';
import { findTag, findTagValue } from './tags';
import { isValidCommentEvent, isValidReactionEvent } from './validation';

const TX_ID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const PUBKEY = 'a'.repeat(64);
const EVENT_ID = 'b'.repeat(64);
const SIG = 'c'.repeat(128);

const REF = {
  principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
  contractName: 'alex-vault',
  txId: TX_ID,
};

function signed(template: ReturnType<typeof buildCommentEventTemplate>, overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: EVENT_ID,
    pubkey: PUBKEY,
    created_at: template.created_at,
    kind: template.kind,
    tags: template.tags,
    content: template.content,
    sig: SIG,
    ...overrides,
  };
}

describe('buildCommentEventTemplate', () => {
  it('creates a contract-level comment with root + parent scope', () => {
    const tpl = buildCommentEventTemplate(REF, 'Nice design.');
    expect(tpl.kind).toBe(KIND_COMMENT);
    expect(tpl.content).toBe('Nice design.');
    expect(findTagValue(tpl.tags, 'I')).toBe(stacksTxExternalId(TX_ID));
    expect(findTagValue(tpl.tags, 'K')).toBe(EXTERNAL_ID_STACKS_TX);
    expect(findTagValue(tpl.tags, 'i')).toBe(stacksTxExternalId(TX_ID));
    expect(findTagValue(tpl.tags, 'k')).toBe(EXTERNAL_ID_STACKS_TX);
    expect(findTag(tpl.tags, 'line')).toBeUndefined();
    expect(findTag(tpl.tags, 'lines')).toBeUndefined();
    expect(findTag(tpl.tags, 'e')).toBeUndefined();
  });

  it('emits a line tag for line-specific comments', () => {
    const tpl = buildCommentEventTemplate(REF, 'Asserts here.', { lineNumber: 42 });
    expect(findTagValue(tpl.tags, 'line')).toBe('42');
    expect(findTag(tpl.tags, 'lines')).toBeUndefined();
  });

  it('emits a lines tag for range comments', () => {
    const tpl = buildCommentEventTemplate(REF, 'This block handles swaps.', {
      lineRange: { start: 10, end: 20 },
    });
    const tag = findTag(tpl.tags, 'lines');
    expect(tag).toEqual(['lines', '10', '20']);
    expect(findTag(tpl.tags, 'line')).toBeUndefined();
  });

  it('emits parent e/k/p tags and keeps root I/K for a reply', () => {
    const tpl = buildCommentEventTemplate(REF, 'I agree.', {
      reply: {
        root: { id: 'd'.repeat(64), pubkey: 'e'.repeat(64) },
        parent: { id: 'd'.repeat(64), pubkey: 'e'.repeat(64) },
      },
    });
    expect(findTagValue(tpl.tags, 'I')).toBe(stacksTxExternalId(TX_ID));
    expect(findTagValue(tpl.tags, 'K')).toBe(EXTERNAL_ID_STACKS_TX);
    const parentE = findTag(tpl.tags, 'e');
    expect(parentE?.[1]).toBe('d'.repeat(64));
    expect(findTagValue(tpl.tags, 'k')).toBe(String(KIND_COMMENT));
    expect(findTagValue(tpl.tags, 'p')).toBe('e'.repeat(64));
  });

  it('uses E/P root tags when reply root and parent differ', () => {
    const rootId = 'd'.repeat(64);
    const parentId = 'f'.repeat(64);
    const rootAuthor = 'e'.repeat(64);
    const tpl = buildCommentEventTemplate(REF, 'Nested reply.', {
      reply: {
        root: { id: rootId, pubkey: rootAuthor },
        parent: { id: parentId, pubkey: 'a'.repeat(64) },
      },
    });
    const rootE = findTag(tpl.tags, 'E');
    expect(rootE?.[1]).toBe(rootId);
    expect(findTagValue(tpl.tags, 'P')).toBe(rootAuthor);
  });
});

describe('buildReactionEventTemplate', () => {
  it('creates a NIP-25 reaction', () => {
    const tpl = buildReactionEventTemplate({ id: EVENT_ID, pubkey: PUBKEY }, '👍');
    expect(tpl.kind).toBe(KIND_REACTION);
    expect(tpl.content).toBe('👍');
    expect(findTagValue(tpl.tags, 'e')).toBe(EVENT_ID);
    expect(findTagValue(tpl.tags, 'p')).toBe(PUBKEY);
    expect(findTagValue(tpl.tags, 'k')).toBe(String(KIND_COMMENT));
  });
});

describe('fromCommentEvent', () => {
  it('converts a top-level contract comment event to a Comment', () => {
    const tpl = buildCommentEventTemplate(REF, 'Clean code.');
    const event = signed(tpl);
    const comment = fromCommentEvent(event, { contract: REF });
    expect(comment).toBeDefined();
    expect(comment!.id).toBe(EVENT_ID);
    expect(comment!.pubkey).toBe(PUBKEY);
    expect(comment!.subject.txId).toBe(TX_ID);
    expect(comment!.subject.principal).toBe(REF.principal);
    expect(comment!.subject.contractName).toBe(REF.contractName);
    expect(comment!.text).toBe('Clean code.');
    expect(comment!.reply).toBeUndefined();
    expect(comment!.lineNumber).toBeUndefined();
    expect(comment!.lineRange).toBeUndefined();
    expect(comment!.reactions).toEqual({});
    expect(comment!.replyCount).toBe(0);
  });

  it('resurfaces line targeting', () => {
    const line = buildCommentEventTemplate(REF, 'Check this.', { lineNumber: 35 });
    expect(fromCommentEvent(signed(line))!.lineNumber).toBe(35);

    const range = buildCommentEventTemplate(REF, 'Block.', { lineRange: { start: 10, end: 20 } });
    expect(fromCommentEvent(signed(range))!.lineRange).toEqual({ start: 10, end: 20 });
  });

  it('resurfaces reply references and sets parentId', () => {
    const parentId = 'd'.repeat(64);
    const rootId = parentId;
    const tpl = buildCommentEventTemplate(REF, 'Reply.', {
      reply: {
        root: { id: rootId, pubkey: 'e'.repeat(64) },
        parent: { id: parentId, pubkey: 'e'.repeat(64) },
      },
    });
    const comment = fromCommentEvent(signed(tpl));
    expect(comment!.reply?.parent.id).toBe(parentId);
    expect(comment!.parentId).toBe(parentId);
  });

  it('returns undefined for non-kind-1111 events', () => {
    const tpl = buildCommentEventTemplate(REF, 'x');
    const event = signed(tpl, { kind: 1 });
    expect(fromCommentEvent(event)).toBeUndefined();
  });

  it('returns undefined if the event is missing a Stacks root', () => {
    const event: NostrEvent = {
      id: EVENT_ID,
      pubkey: PUBKEY,
      created_at: 1700000000,
      kind: KIND_COMMENT,
      tags: [['I', 'bitcoin:txid:abcd'], ['K', 'bitcoin:txid']],
      content: 'Not about Stacks.',
      sig: SIG,
    };
    expect(fromCommentEvent(event)).toBeUndefined();
  });
});

describe('toCommentEventTemplate round trip', () => {
  it('round-trips a comment through event → domain → event', () => {
    const comment: Comment = {
      id: EVENT_ID,
      pubkey: PUBKEY,
      subject: REF,
      lineNumber: 42,
      text: 'Round trip.',
      createdAt: 1_700_000_000,
      reactions: {},
      replyCount: 0,
    };
    const tpl = toCommentEventTemplate(comment);
    const event = signed(tpl);
    expect(isValidCommentEvent(event)).toBe(true);
    const roundTripped = fromCommentEvent(event, { contract: REF });
    expect(roundTripped!.text).toBe(comment.text);
    expect(roundTripped!.lineNumber).toBe(42);
    expect(roundTripped!.subject.txId).toBe(TX_ID);
  });
});

describe('reaction event validation', () => {
  it('accepts a well-formed reaction', () => {
    const tpl = buildReactionEventTemplate({ id: EVENT_ID, pubkey: PUBKEY }, '🔥');
    const event: NostrEvent = {
      id: 'd'.repeat(64),
      pubkey: PUBKEY,
      created_at: tpl.created_at,
      kind: tpl.kind,
      tags: tpl.tags,
      content: tpl.content,
      sig: SIG,
    };
    expect(isValidReactionEvent(event)).toBe(true);
  });
});
