import { describe, it, expect } from 'vitest';
import {
  isValidCommentRecord,
  isValidLikeRecord,
  isValidContractRef,
  isValidLineRange,
  isValidStrongRef,
  validateLineTargeting,
  getCommentType,
} from './validation';
import type { CommentRecord, LikeRecord } from './types';

describe('AT Protocol Lexicon Types', () => {
  describe('Contract-level comment', () => {
    const contractLevelComment: CommentRecord = {
      $type: 'com.source-of-clarity.comment',
      subject: {
        principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
        contractName: 'alex-vault',
      },
      text: 'This is a well-architected AMM contract. The constant product formula implementation is clean and gas-efficient.',
      createdAt: '2026-01-21T15:30:00.000Z',
    };

    it('should validate as a valid CommentRecord', () => {
      expect(isValidCommentRecord(contractLevelComment)).toBe(true);
    });

    it('should identify as contract-level comment', () => {
      expect(getCommentType(contractLevelComment)).toBe('contract');
    });

    it('should pass line targeting validation', () => {
      expect(validateLineTargeting(contractLevelComment)).toEqual({ valid: true });
    });
  });

  describe('Line-specific comment', () => {
    const lineSpecificComment: CommentRecord = {
      $type: 'com.source-of-clarity.comment',
      subject: {
        principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
        contractName: 'alex-vault',
      },
      lineNumber: 35,
      text: 'The asserts! check here is critical for security.',
      createdAt: '2026-01-21T15:30:00.000Z',
    };

    it('should validate as a valid CommentRecord', () => {
      expect(isValidCommentRecord(lineSpecificComment)).toBe(true);
    });

    it('should identify as line-level comment', () => {
      expect(getCommentType(lineSpecificComment)).toBe('line');
    });

    it('should pass line targeting validation', () => {
      expect(validateLineTargeting(lineSpecificComment)).toEqual({ valid: true });
    });
  });

  describe('Multi-line range comment', () => {
    const rangeComment: CommentRecord = {
      $type: 'com.source-of-clarity.comment',
      subject: {
        principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
        contractName: 'alex-vault',
      },
      lineRange: { start: 39, end: 45 },
      text: 'This constant product formula (x * y = k) is the foundation of AMM design.',
      createdAt: '2026-01-21T15:30:00.000Z',
    };

    it('should validate as a valid CommentRecord', () => {
      expect(isValidCommentRecord(rangeComment)).toBe(true);
    });

    it('should identify as range-level comment', () => {
      expect(getCommentType(rangeComment)).toBe('range');
    });

    it('should pass line targeting validation', () => {
      expect(validateLineTargeting(rangeComment)).toEqual({ valid: true });
    });
  });

  describe('Reply comment', () => {
    const replyComment: CommentRecord = {
      $type: 'com.source-of-clarity.comment',
      subject: {
        principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
        contractName: 'alex-vault',
      },
      lineNumber: 35,
      text: 'Agreed! This prevents unauthorized token transfers.',
      reply: {
        root: {
          uri: 'at://did:plc:abc123/com.source-of-clarity.comment/3kf5',
          cid: 'bafyreiabc123',
        },
        parent: {
          uri: 'at://did:plc:abc123/com.source-of-clarity.comment/3kf5',
          cid: 'bafyreiabc123',
        },
      },
      createdAt: '2026-01-21T16:00:00.000Z',
    };

    it('should validate as a valid CommentRecord', () => {
      expect(isValidCommentRecord(replyComment)).toBe(true);
    });

    it('should have valid reply references', () => {
      expect(isValidStrongRef(replyComment.reply?.root)).toBe(true);
      expect(isValidStrongRef(replyComment.reply?.parent)).toBe(true);
    });
  });

  describe('Like record', () => {
    const likeRecord: LikeRecord = {
      $type: 'com.source-of-clarity.like',
      subject: {
        uri: 'at://did:plc:abc123/com.source-of-clarity.comment/3kf5',
        cid: 'bafyreiabc123',
      },
      createdAt: '2026-01-21T16:30:00.000Z',
    };

    it('should validate as a valid LikeRecord', () => {
      expect(isValidLikeRecord(likeRecord)).toBe(true);
    });

    it('should have valid subject reference', () => {
      expect(isValidStrongRef(likeRecord.subject)).toBe(true);
    });
  });

  describe('Validation edge cases', () => {
    it('should reject comment with both lineNumber and lineRange', () => {
      const invalidComment: CommentRecord = {
        $type: 'com.source-of-clarity.comment',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        lineNumber: 35,
        lineRange: { start: 39, end: 45 },
        text: 'This should fail validation.',
        createdAt: '2026-01-21T15:30:00.000Z',
      };

      const result = validateLineTargeting(invalidComment);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mutually exclusive');
    });

    it('should reject invalid contract reference', () => {
      expect(isValidContractRef(null)).toBe(false);
      expect(isValidContractRef({})).toBe(false);
      expect(isValidContractRef({ principal: '' })).toBe(false);
      expect(isValidContractRef({ principal: 'SP123', contractName: '' })).toBe(false);
    });

    it('should reject invalid line range', () => {
      expect(isValidLineRange(null)).toBe(false);
      expect(isValidLineRange({ start: 0, end: 5 })).toBe(false);
      expect(isValidLineRange({ start: 10, end: 5 })).toBe(false);
      expect(isValidLineRange({ start: 1.5, end: 5 })).toBe(false);
    });

    it('should reject invalid strong reference', () => {
      expect(isValidStrongRef(null)).toBe(false);
      expect(isValidStrongRef({ uri: 'invalid', cid: 'abc' })).toBe(false);
      expect(isValidStrongRef({ uri: 'at://did:plc:123', cid: '' })).toBe(false);
    });

    it('should reject comment with empty text', () => {
      const emptyTextComment = {
        $type: 'com.source-of-clarity.comment',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        text: '',
        createdAt: '2026-01-21T15:30:00.000Z',
      };

      expect(isValidCommentRecord(emptyTextComment)).toBe(false);
    });

    it('should reject comment with invalid timestamp', () => {
      const invalidTimestamp = {
        $type: 'com.source-of-clarity.comment',
        subject: {
          principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          contractName: 'alex-vault',
        },
        text: 'Valid text',
        createdAt: 'not-a-timestamp',
      };

      expect(isValidCommentRecord(invalidTimestamp)).toBe(false);
    });

    it('should reject like with wrong $type', () => {
      const wrongType = {
        $type: 'com.source-of-clarity.comment',
        subject: {
          uri: 'at://did:plc:abc123/com.source-of-clarity.comment/3kf5',
          cid: 'bafyreiabc123',
        },
        createdAt: '2026-01-21T16:30:00.000Z',
      };

      expect(isValidLikeRecord(wrongType)).toBe(false);
    });
  });
});
