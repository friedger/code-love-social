import { describe, it, expect } from 'vitest';
import {
  toCommentRecord,
  fromCommentRecord,
  createCommentRecord,
  createLikeRecord,
  type LegacyComment,
} from './conversion';
import { isValidCommentRecord, isValidLikeRecord } from './validation';
import type { CommentRecord } from './types';

describe('Conversion helpers', () => {
  describe('toCommentRecord', () => {
    it('should convert a legacy contract-level comment', () => {
      const legacy: LegacyComment = {
        id: 'comment-1',
        uri: 'at://did:plc:user1/com.source-of-clarity.comment/abc123',
        cid: 'bafyrei123',
        contractId: 'alex-vault',
        contract: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        authorDid: 'did:plc:user1',
        content: 'Great contract architecture!',
        createdAt: '2026-01-21T15:30:00.000Z',
        likes: 5,
        likedBy: ['did:plc:user2'],
        replyCount: 0,
      };

      const record = toCommentRecord(legacy);

      expect(record.$type).toBe('com.source-of-clarity.comment');
      expect(record.subject.principal).toBe('SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9');
      expect(record.subject.contractName).toBe('alex-vault');
      expect(record.text).toBe('Great contract architecture!');
      expect(record.lineNumber).toBeUndefined();
      expect(record.lineRange).toBeUndefined();
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should convert a legacy line-level comment', () => {
      const legacy: LegacyComment = {
        id: 'comment-2',
        uri: 'at://did:plc:user1/com.source-of-clarity.comment/def456',
        cid: 'bafyrei456',
        contractId: 'alex-vault',
        contract: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineNumber: 42,
        authorDid: 'did:plc:user1',
        content: 'This line needs attention.',
        createdAt: '2026-01-21T15:30:00.000Z',
        likes: 2,
        likedBy: [],
        replyCount: 1,
      };

      const record = toCommentRecord(legacy);

      expect(record.lineNumber).toBe(42);
      expect(record.lineRange).toBeUndefined();
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should convert a legacy range comment', () => {
      const legacy: LegacyComment = {
        id: 'comment-3',
        uri: 'at://did:plc:user1/com.source-of-clarity.comment/ghi789',
        cid: 'bafyrei789',
        contractId: 'alex-vault',
        contract: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineRange: { start: 10, end: 20 },
        authorDid: 'did:plc:user1',
        content: 'This section handles swaps.',
        createdAt: '2026-01-21T15:30:00.000Z',
        likes: 0,
        likedBy: [],
        replyCount: 0,
      };

      const record = toCommentRecord(legacy);

      expect(record.lineNumber).toBeUndefined();
      expect(record.lineRange).toEqual({ start: 10, end: 20 });
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should convert a legacy reply comment', () => {
      const legacy: LegacyComment = {
        id: 'comment-4',
        uri: 'at://did:plc:user2/com.source-of-clarity.comment/reply1',
        cid: 'bafyreireply1',
        contractId: 'alex-vault',
        contract: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineNumber: 42,
        authorDid: 'did:plc:user2',
        content: 'I agree with this observation.',
        createdAt: '2026-01-21T16:00:00.000Z',
        likes: 1,
        likedBy: ['did:plc:user1'],
        parentId: 'comment-2',
        reply: {
          root: {
            uri: 'at://did:plc:user1/com.source-of-clarity.comment/def456',
            cid: 'bafyrei456',
          },
          parent: {
            uri: 'at://did:plc:user1/com.source-of-clarity.comment/def456',
            cid: 'bafyrei456',
          },
        },
        replyCount: 0,
      };

      const record = toCommentRecord(legacy);

      expect(record.reply).toBeDefined();
      expect(record.reply?.root.uri).toBe('at://did:plc:user1/com.source-of-clarity.comment/def456');
      expect(record.reply?.parent.cid).toBe('bafyrei456');
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should fall back to contractId when contract ref is missing', () => {
      const legacy: LegacyComment = {
        id: 'comment-5',
        uri: 'at://did:plc:user1/com.source-of-clarity.comment/abc',
        cid: 'bafyrei',
        contractId: 'my-contract',
        // No contract field
        authorDid: 'did:plc:user1',
        content: 'Test comment',
        createdAt: '2026-01-21T15:30:00.000Z',
        likes: 0,
        likedBy: [],
        replyCount: 0,
      };

      const record = toCommentRecord(legacy);

      expect(record.subject.contractName).toBe('my-contract');
      // Falls back to placeholder principal
      expect(record.subject.principal).toBe('SP000000000000000000000000000000');
    });
  });

  describe('fromCommentRecord', () => {
    it('should convert a CommentRecord to LegacyComment', () => {
      const record: CommentRecord = {
        $type: 'com.source-of-clarity.comment',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineNumber: 35,
        text: 'The asserts! check here is critical for security.',
        createdAt: '2026-01-21T15:30:00.000Z',
      };

      const legacy = fromCommentRecord(record, {
        id: 'local-id-123',
        authorDid: 'did:plc:author1',
        uri: 'at://did:plc:author1/com.source-of-clarity.comment/abc',
        cid: 'bafyrei123',
        contractId: 'alex-vault',
        likes: 10,
        likedBy: ['did:plc:user1', 'did:plc:user2'],
        replyCount: 3,
      });

      expect(legacy.id).toBe('local-id-123');
      expect(legacy.authorDid).toBe('did:plc:author1');
      expect(legacy.content).toBe('The asserts! check here is critical for security.');
      expect(legacy.lineNumber).toBe(35);
      expect(legacy.contract).toEqual(record.subject);
      expect(legacy.likes).toBe(10);
      expect(legacy.likedBy).toHaveLength(2);
      expect(legacy.replyCount).toBe(3);
    });

    it('should convert a reply CommentRecord with parentId', () => {
      const record: CommentRecord = {
        $type: 'com.source-of-clarity.comment',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        text: 'This is a reply.',
        reply: {
          root: {
            uri: 'at://did:plc:author1/com.source-of-clarity.comment/root',
            cid: 'bafyreiroot',
          },
          parent: {
            uri: 'at://did:plc:author1/com.source-of-clarity.comment/parent',
            cid: 'bafyreiparent',
          },
        },
        createdAt: '2026-01-21T16:00:00.000Z',
      };

      const legacy = fromCommentRecord(record, {
        id: 'reply-id',
        authorDid: 'did:plc:replier',
        uri: 'at://did:plc:replier/com.source-of-clarity.comment/reply',
        cid: 'bafyreireply',
        contractId: 'alex-vault',
        parentId: 'parent-local-id',
      });

      expect(legacy.reply).toBeDefined();
      expect(legacy.parentId).toBe('parent-local-id');
      expect(legacy.reply?.root.uri).toContain('root');
    });

    it('should use defaults for optional fields', () => {
      const record: CommentRecord = {
        $type: 'com.source-of-clarity.comment',
        subject: {
          principal: 'SP123',
          contractName: 'test',
        },
        text: 'Simple comment',
        createdAt: '2026-01-21T15:30:00.000Z',
      };

      const legacy = fromCommentRecord(record, {
        id: 'id',
        authorDid: 'did:plc:test',
        uri: 'at://did:plc:test/com.source-of-clarity.comment/x',
        cid: 'cid',
        contractId: 'test',
      });

      expect(legacy.likes).toBe(0);
      expect(legacy.likedBy).toEqual([]);
      expect(legacy.replyCount).toBe(0);
      expect(legacy.lineNumber).toBeUndefined();
      expect(legacy.lineRange).toBeUndefined();
    });
  });

  describe('createCommentRecord', () => {
    it('should create a contract-level comment', () => {
      const record = createCommentRecord(
        { principal: 'SP123', contractName: 'test-contract' },
        'This is a new comment.'
      );

      expect(record.$type).toBe('com.source-of-clarity.comment');
      expect(record.subject.principal).toBe('SP123');
      expect(record.text).toBe('This is a new comment.');
      expect(record.lineNumber).toBeUndefined();
      expect(record.lineRange).toBeUndefined();
      expect(record.createdAt).toBeDefined();
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should create a line-specific comment', () => {
      const record = createCommentRecord(
        { principal: 'SP123', contractName: 'test-contract' },
        'Line comment.',
        { lineNumber: 50 }
      );

      expect(record.lineNumber).toBe(50);
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should create a range comment', () => {
      const record = createCommentRecord(
        { principal: 'SP123', contractName: 'test-contract' },
        'Range comment.',
        { lineRange: { start: 10, end: 20 } }
      );

      expect(record.lineRange).toEqual({ start: 10, end: 20 });
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should create a reply comment', () => {
      const record = createCommentRecord(
        { principal: 'SP123', contractName: 'test-contract' },
        'Reply comment.',
        {
          lineNumber: 42,
          reply: {
            root: { uri: 'at://did:plc:x/com.source-of-clarity.comment/r', cid: 'cid1' },
            parent: { uri: 'at://did:plc:x/com.source-of-clarity.comment/p', cid: 'cid2' },
          },
        }
      );

      expect(record.reply).toBeDefined();
      expect(record.reply?.root.uri).toContain('at://');
      expect(isValidCommentRecord(record)).toBe(true);
    });
  });

  describe('createLikeRecord', () => {
    it('should create a valid like record', () => {
      const record = createLikeRecord({
        uri: 'at://did:plc:abc123/com.source-of-clarity.comment/xyz',
        cid: 'bafyreiabc123xyz',
      });

      expect(record.$type).toBe('com.source-of-clarity.like');
      expect(record.subject.uri).toBe('at://did:plc:abc123/com.source-of-clarity.comment/xyz');
      expect(record.subject.cid).toBe('bafyreiabc123xyz');
      expect(record.createdAt).toBeDefined();
      expect(isValidLikeRecord(record)).toBe(true);
    });
  });
});
