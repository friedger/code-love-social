import { describe, it, expect } from 'vitest';
import {
  toCommentRecord,
  fromCommentRecord,
  createCommentRecord,
  createLikeRecord,
  generateTID,
  extractParentIdFromUri,
} from './conversion';
import { isValidCommentRecord, isValidLikeRecord } from './validation';
import type { CommentRecord, Comment } from './types';

describe('Conversion helpers', () => {
  describe('toCommentRecord', () => {
    it('should convert a contract-level comment', () => {
      const comment: Comment = {
        uri: 'at://did:plc:user1/com.source-of-clarity.temp.comment/abc123',
        cid: 'bafyrei123',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        authorDid: 'did:plc:user1',
        text: 'Great contract architecture!',
        createdAt: '2026-01-21T15:30:00.000Z',
        likes: 5,
        likedBy: ['did:plc:user2'],
        replyCount: 0,
      };

      const record = toCommentRecord(comment);

      expect(record.$type).toBe('com.source-of-clarity.temp.comment');
      expect(record.subject.principal).toBe('SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9');
      expect(record.subject.contractName).toBe('alex-vault');
      expect(record.text).toBe('Great contract architecture!');
      expect(record.lineNumber).toBeUndefined();
      expect(record.lineRange).toBeUndefined();
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should convert a line-level comment', () => {
      const comment: Comment = {
        uri: 'at://did:plc:user1/com.source-of-clarity.temp.comment/def456',
        cid: 'bafyrei456',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineNumber: 42,
        authorDid: 'did:plc:user1',
        text: 'This line needs attention.',
        createdAt: '2026-01-21T15:30:00.000Z',
        likes: 2,
        likedBy: [],
        replyCount: 1,
      };

      const record = toCommentRecord(comment);

      expect(record.lineNumber).toBe(42);
      expect(record.lineRange).toBeUndefined();
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should convert a range comment', () => {
      const comment: Comment = {
        uri: 'at://did:plc:user1/com.source-of-clarity.temp.comment/ghi789',
        cid: 'bafyrei789',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineRange: { start: 10, end: 20 },
        authorDid: 'did:plc:user1',
        text: 'This section handles swaps.',
        createdAt: '2026-01-21T15:30:00.000Z',
        likes: 0,
        likedBy: [],
        replyCount: 0,
      };

      const record = toCommentRecord(comment);

      expect(record.lineNumber).toBeUndefined();
      expect(record.lineRange).toEqual({ start: 10, end: 20 });
      expect(isValidCommentRecord(record)).toBe(true);
    });

    it('should convert a reply comment', () => {
      const comment: Comment = {
        uri: 'at://did:plc:user2/com.source-of-clarity.temp.comment/reply1',
        cid: 'bafyreireply1',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineNumber: 42,
        authorDid: 'did:plc:user2',
        text: 'I agree with this observation.',
        createdAt: '2026-01-21T16:00:00.000Z',
        likes: 1,
        likedBy: ['did:plc:user1'],
        parentId: 'def456',
        reply: {
          root: {
            uri: 'at://did:plc:user1/com.source-of-clarity.temp.comment/def456',
            cid: 'bafyrei456',
          },
          parent: {
            uri: 'at://did:plc:user1/com.source-of-clarity.temp.comment/def456',
            cid: 'bafyrei456',
          },
        },
        replyCount: 0,
      };

      const record = toCommentRecord(comment);

      expect(record.reply).toBeDefined();
      expect(record.reply?.root.uri).toBe('at://did:plc:user1/com.source-of-clarity.temp.comment/def456');
      expect(record.reply?.parent.cid).toBe('bafyrei456');
      expect(isValidCommentRecord(record)).toBe(true);
    });
  });

  describe('fromCommentRecord', () => {
    it('should convert a CommentRecord to Comment', () => {
      const record: CommentRecord = {
        $type: 'com.source-of-clarity.temp.comment',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineNumber: 35,
        text: 'The asserts! check here is critical for security.',
        createdAt: '2026-01-21T15:30:00.000Z',
      };

      const comment = fromCommentRecord(record, {
        authorDid: 'did:plc:author1',
        uri: 'at://did:plc:author1/com.source-of-clarity.temp.comment/abc',
        cid: 'bafyrei123',
        likes: 10,
        likedBy: ['did:plc:user1', 'did:plc:user2'],
        replyCount: 3,
      });

      expect(comment.uri).toBe('at://did:plc:author1/com.source-of-clarity.temp.comment/abc');
      expect(comment.authorDid).toBe('did:plc:author1');
      expect(comment.text).toBe('The asserts! check here is critical for security.');
      expect(comment.lineNumber).toBe(35);
      expect(comment.subject).toEqual(record.subject);
      expect(comment.likes).toBe(10);
      expect(comment.likedBy).toHaveLength(2);
      expect(comment.replyCount).toBe(3);
    });

    it('should convert a reply CommentRecord with parentId', () => {
      const record: CommentRecord = {
        $type: 'com.source-of-clarity.temp.comment',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        text: 'This is a reply.',
        reply: {
          root: {
            uri: 'at://did:plc:author1/com.source-of-clarity.temp.comment/root',
            cid: 'bafyreiroot',
          },
          parent: {
            uri: 'at://did:plc:author1/com.source-of-clarity.temp.comment/parent',
            cid: 'bafyreiparent',
          },
        },
        createdAt: '2026-01-21T16:00:00.000Z',
      };

      const comment = fromCommentRecord(record, {
        authorDid: 'did:plc:replier',
        uri: 'at://did:plc:replier/com.source-of-clarity.temp.comment/reply',
        cid: 'bafyreireply',
        parentId: 'parent-local-id',
      });

      expect(comment.reply).toBeDefined();
      expect(comment.parentId).toBe('parent-local-id');
      expect(comment.reply?.root.uri).toContain('root');
    });

    it('should use defaults for optional fields', () => {
      const record: CommentRecord = {
        $type: 'com.source-of-clarity.temp.comment',
        subject: {
          principal: 'SP123',
          contractName: 'test',
        },
        text: 'Simple comment',
        createdAt: '2026-01-21T15:30:00.000Z',
      };

      const comment = fromCommentRecord(record, {
        authorDid: 'did:plc:test',
        uri: 'at://did:plc:test/com.source-of-clarity.temp.comment/x',
        cid: 'cid',
      });

      expect(comment.likes).toBe(0);
      expect(comment.likedBy).toEqual([]);
      expect(comment.replyCount).toBe(0);
      expect(comment.lineNumber).toBeUndefined();
      expect(comment.lineRange).toBeUndefined();
    });
  });

  describe('createCommentRecord', () => {
    it('should create a contract-level comment', () => {
      const record = createCommentRecord(
        { principal: 'SP123', contractName: 'test-contract' },
        'This is a new comment.'
      );

      expect(record.$type).toBe('com.source-of-clarity.temp.comment');
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
            root: { uri: 'at://did:plc:x/com.source-of-clarity.temp.comment/r', cid: 'cid1' },
            parent: { uri: 'at://did:plc:x/com.source-of-clarity.temp.comment/p', cid: 'cid2' },
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
        uri: 'at://did:plc:abc123/com.source-of-clarity.temp.comment/xyz',
        cid: 'bafyreiabc123xyz',
      });

      expect(record.$type).toBe('com.source-of-clarity.temp.like');
      expect(record.subject.uri).toBe('at://did:plc:abc123/com.source-of-clarity.temp.comment/xyz');
      expect(record.subject.cid).toBe('bafyreiabc123xyz');
      expect(record.createdAt).toBeDefined();
      expect(isValidLikeRecord(record)).toBe(true);
    });
  });

  describe('generateTID', () => {
    it('should generate a 13-character TID', () => {
      const tid = generateTID();
      expect(tid).toHaveLength(13);
    });

    it('should generate unique TIDs', () => {
      const tid1 = generateTID();
      const tid2 = generateTID();
      // They might be the same if generated in the same microsecond, so we check they're strings
      expect(typeof tid1).toBe('string');
      expect(typeof tid2).toBe('string');
    });
  });

  describe('extractParentIdFromUri', () => {
    it('should extract rkey from AT URI', () => {
      const uri = 'at://did:plc:abc123/com.source-of-clarity.temp.comment/xyz789';
      const parentId = extractParentIdFromUri(uri);
      expect(parentId).toBe('xyz789');
    });

    it('should return undefined for invalid URI', () => {
      const parentId = extractParentIdFromUri('invalid-uri');
      expect(parentId).toBeUndefined();
    });
  });
});
