import { users } from './dummyUsers';
import type { Comment, ContractRef, StrongRef } from '@/lexicon/types';

// Re-export Comment type for backward compatibility
export type { Comment } from '@/lexicon/types';

// Dummy txIds for test data
const DUMMY_TX_IDS = {
  'alex-vault': '0xabc123def456789alex',
  'wrapped-stx': '0xabc123def456789wstx',
  'stx-bridge': '0xabc123def456789bridge',
  'mega-nft': '0xabc123def456789nft',
  'clarity-dao': '0xabc123def456789dao',
  'micro-stx': '0xabc123def456789micro',
  'stx-lottery': '0xabc123def456789lottery',
  'defi-aggregator': '0xabc123def456789defi',
} as const;

export const comments: Comment[] = [
  // Contract 1: alex-vault - Comments on various lines
  {
    uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf4abc123',
    cid: 'bafyreialice1',
    subject: {
      principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
      contractName: 'alex-vault',
      txId: DUMMY_TX_IDS['alex-vault'],
    },
    lineNumber: 3,
    authorDid: users[0].did,
    text: 'Consider using a more descriptive constant name here for better readability.',
    createdAt: '2026-01-20T10:30:00Z',
    reactions: { '👍': 3, '🔥': 2 },
    replyCount: 1,
  },
  {
    uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/com.source-of-clarity.comment/3kf4def456',
    cid: 'bafyreibob1',
    subject: {
      principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
      contractName: 'alex-vault',
      txId: DUMMY_TX_IDS['alex-vault'],
    },
    lineNumber: 3,
    authorDid: users[1].did,
    text: 'Agreed! Something like MAX_DEPOSIT_AMOUNT would be clearer.',
    createdAt: '2026-01-20T11:15:00Z',
    reactions: { '👍': 3 },
    parentId: '3kf4abc123',
    reply: {
      root: {
        uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf4abc123',
        cid: 'bafyreialice1',
      },
      parent: {
        uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf4abc123',
        cid: 'bafyreialice1',
      },
    },
    replyCount: 0,
  },
  {
    uri: 'at://did:plc:k5zb6qvl5fwqdu4l6wh4v7yi/com.source-of-clarity.comment/3kf4ghi789',
    cid: 'bafyreicarol1',
    subject: {
      principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
      contractName: 'alex-vault',
      txId: DUMMY_TX_IDS['alex-vault'],
    },
    lineNumber: 8,
    authorDid: users[2].did,
    text: 'This error handling pattern is excellent for DeFi security.',
    createdAt: '2026-01-20T14:00:00Z',
    reactions: { '👍': 5, '❤️': 3 },
    replyCount: 0,
  },

  // Contract 2: wrapped-stx - More line comments
  {
    uri: 'at://did:plc:ragtjsm2j2vknwkz3zp4oxrd/com.source-of-clarity.comment/3kf4jkl012',
    cid: 'bafyreidave1',
    subject: {
      principal: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
      contractName: 'wrapped-stx',
      txId: DUMMY_TX_IDS['wrapped-stx'],
    },
    lineNumber: 5,
    authorDid: users[3].did,
    text: 'Nice use of the SIP-010 trait here.',
    createdAt: '2026-01-19T09:00:00Z',
    reactions: { '👍': 2 },
    replyCount: 0,
  },
  {
    uri: 'at://did:plc:uu5axsmbm2or2dngy4gwchec/com.source-of-clarity.comment/3kf4mno345',
    cid: 'bafyreimaeve1',
    subject: {
      principal: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
      contractName: 'wrapped-stx',
      txId: DUMMY_TX_IDS['wrapped-stx'],
    },
    lineNumber: 12,
    authorDid: users[4].did,
    text: 'The wrap function should validate minimum amounts.',
    createdAt: '2026-01-19T10:30:00Z',
    reactions: { '⚠️': 4 },
    replyCount: 2,
  },
  {
    uri: 'at://did:plc:4hqjfn7m6n5hno4at373b2ts/com.source-of-clarity.comment/3kf4pqr678',
    cid: 'bafyreifrank1',
    subject: {
      principal: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
      contractName: 'wrapped-stx',
      txId: DUMMY_TX_IDS['wrapped-stx'],
    },
    lineNumber: 12,
    authorDid: users[5].did,
    text: 'Good catch! What minimum would you suggest?',
    createdAt: '2026-01-19T11:00:00Z',
    reactions: { '👀': 1 },
    parentId: '3kf4mno345',
    reply: {
      root: {
        uri: 'at://did:plc:uu5axsmbm2or2dngy4gwchec/com.source-of-clarity.comment/3kf4mno345',
        cid: 'bafyreimaeve1',
      },
      parent: {
        uri: 'at://did:plc:uu5axsmbm2or2dngy4gwchec/com.source-of-clarity.comment/3kf4mno345',
        cid: 'bafyreimaeve1',
      },
    },
    replyCount: 1,
  },
  {
    uri: 'at://did:plc:uu5axsmbm2or2dngy4gwchec/com.source-of-clarity.comment/3kf4stu901',
    cid: 'bafyreimaeve2',
    subject: {
      principal: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
      contractName: 'wrapped-stx',
      txId: DUMMY_TX_IDS['wrapped-stx'],
    },
    lineNumber: 12,
    authorDid: users[4].did,
    text: 'At least 1000 microSTX to prevent dust attacks.',
    createdAt: '2026-01-19T11:30:00Z',
    reactions: { '👍': 4, '🔥': 2 },
    parentId: '3kf4pqr678',
    reply: {
      root: {
        uri: 'at://did:plc:uu5axsmbm2or2dngy4gwchec/com.source-of-clarity.comment/3kf4mno345',
        cid: 'bafyreimaeve1',
      },
      parent: {
        uri: 'at://did:plc:4hqjfn7m6n5hno4at373b2ts/com.source-of-clarity.comment/3kf4pqr678',
        cid: 'bafyreifrank1',
      },
    },
    replyCount: 0,
  },

  // Contract 3: stx-bridge - Line comments
  {
    uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf4vwx234',
    cid: 'bafyreialice2',
    subject: {
      principal: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
      contractName: 'stx-bridge',
      txId: DUMMY_TX_IDS['stx-bridge'],
    },
    lineNumber: 7,
    authorDid: users[0].did,
    text: 'This bridge implementation needs additional security audits before mainnet.',
    createdAt: '2026-01-18T16:00:00Z',
    reactions: { '⚠️': 8, '👍': 4 },
    replyCount: 0,
  },

  // Contract 5: mega-nft - NFT contract comments
  {
    uri: 'at://did:plc:ragtjsm2j2vknwkz3zp4oxrd/com.source-of-clarity.comment/3kf4yza567',
    cid: 'bafyreidave2',
    subject: {
      principal: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
      contractName: 'mega-nft',
      txId: DUMMY_TX_IDS['mega-nft'],
    },
    lineNumber: 4,
    authorDid: users[3].did,
    text: 'Good implementation of SIP-009 standard.',
    createdAt: '2026-01-17T10:00:00Z',
    reactions: { '👍': 3 },
    replyCount: 0,
  },
  {
    uri: 'at://did:plc:k5zb6qvl5fwqdu4l6wh4v7yi/com.source-of-clarity.comment/3kf5abc890',
    cid: 'bafyreicarol2',
    subject: {
      principal: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
      contractName: 'mega-nft',
      txId: DUMMY_TX_IDS['mega-nft'],
    },
    lineNumber: 15,
    authorDid: users[2].did,
    text: 'Consider adding royalty support for secondary sales.',
    createdAt: '2026-01-17T11:00:00Z',
    reactions: { '🚀': 5, '👍': 2 },
    replyCount: 0,
  },

  // Contract 6: clarity-dao - DAO governance comments
  {
    uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/com.source-of-clarity.comment/3kf5def123',
    cid: 'bafyreibob2',
    subject: {
      principal: 'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335',
      contractName: 'clarity-dao',
      txId: DUMMY_TX_IDS['clarity-dao'],
    },
    lineNumber: 10,
    authorDid: users[1].did,
    text: 'The voting mechanism could benefit from quadratic voting.',
    createdAt: '2026-01-16T14:00:00Z',
    reactions: { '👍': 6, '🔥': 3 },
    replyCount: 1,
  },
  {
    uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf5ghi456',
    cid: 'bafyreialice3',
    subject: {
      principal: 'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335',
      contractName: 'clarity-dao',
      txId: DUMMY_TX_IDS['clarity-dao'],
    },
    lineNumber: 10,
    authorDid: users[0].did,
    text: 'Quadratic voting would be great but adds complexity. Maybe in v2?',
    createdAt: '2026-01-16T15:00:00Z',
    reactions: { '👍': 4 },
    parentId: '3kf5def123',
    reply: {
      root: {
        uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/com.source-of-clarity.comment/3kf5def123',
        cid: 'bafyreibob2',
      },
      parent: {
        uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/com.source-of-clarity.comment/3kf5def123',
        cid: 'bafyreibob2',
      },
    },
    replyCount: 0,
  },

  // Contract 8: micro-stx - Micropayments
  {
    uri: 'at://did:plc:4hqjfn7m6n5hno4at373b2ts/com.source-of-clarity.comment/3kf5jkl789',
    cid: 'bafyreifrank2',
    subject: {
      principal: 'SP2507VNQZC9VBXM7X7KB4SF4QJDJRSWHG4V39WPY',
      contractName: 'micro-stx',
      txId: DUMMY_TX_IDS['micro-stx'],
    },
    lineNumber: 6,
    authorDid: users[5].did,
    text: 'Payment channels would reduce transaction costs significantly.',
    createdAt: '2026-01-15T09:00:00Z',
    reactions: { '🚀': 3, '👍': 2 },
    replyCount: 0,
  },

  // Contract 9: stx-lottery - Lottery contract
  {
    uri: 'at://did:plc:uu5axsmbm2or2dngy4gwchec/com.source-of-clarity.comment/3kf5mno012',
    cid: 'bafyreimaeve3',
    subject: {
      principal: 'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60',
      contractName: 'stx-lottery',
      txId: DUMMY_TX_IDS['stx-lottery'],
    },
    lineNumber: 8,
    authorDid: users[4].did,
    text: 'VRF would make the randomness more secure.',
    createdAt: '2026-01-14T12:00:00Z',
    reactions: { '⚠️': 4, '👍': 2 },
    replyCount: 0,
  },

  // Contract 10: defi-aggregator - Aggregator with multi-line comments
  {
    uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf5pqr345',
    cid: 'bafyreialice4',
    subject: {
      principal: 'SP3QSAJQ4EA8WXEDSRRKMZZ29NH91VZ6C5X88FGZQ',
      contractName: 'defi-aggregator',
      txId: DUMMY_TX_IDS['defi-aggregator'],
    },
    lineRange: { start: 5, end: 12 },
    authorDid: users[0].did,
    text: 'This routing logic is well-designed but could use more documentation on the algorithm.',
    createdAt: '2026-01-13T10:00:00Z',
    reactions: { '👍': 8, '❤️': 3 },
    replyCount: 1,
  },
  {
    uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/com.source-of-clarity.comment/3kf5stu678',
    cid: 'bafyreibob3',
    subject: {
      principal: 'SP3QSAJQ4EA8WXEDSRRKMZZ29NH91VZ6C5X88FGZQ',
      contractName: 'defi-aggregator',
      txId: DUMMY_TX_IDS['defi-aggregator'],
    },
    lineRange: { start: 5, end: 12 },
    authorDid: users[1].did,
    text: 'I can help with documentation! The routing uses a modified Bellman-Ford approach.',
    createdAt: '2026-01-13T11:00:00Z',
    reactions: { '🔥': 5, '👍': 3 },
    parentId: '3kf5pqr345',
    reply: {
      root: {
        uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf5pqr345',
        cid: 'bafyreialice4',
      },
      parent: {
        uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf5pqr345',
        cid: 'bafyreialice4',
      },
    },
    replyCount: 0,
  },
  {
    uri: 'at://did:plc:k5zb6qvl5fwqdu4l6wh4v7yi/com.source-of-clarity.comment/3kf5vwx901',
    cid: 'bafyreicarol3',
    subject: {
      principal: 'SP3QSAJQ4EA8WXEDSRRKMZZ29NH91VZ6C5X88FGZQ',
      contractName: 'defi-aggregator',
      txId: DUMMY_TX_IDS['defi-aggregator'],
    },
    lineNumber: 20,
    authorDid: users[2].did,
    text: 'The slippage calculation here needs more precision.',
    createdAt: '2026-01-13T14:00:00Z',
    reactions: { '👀': 4 },
    replyCount: 0,
  },

  // Contract-level comments (no lineNumber or lineRange)
  {
    uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.source-of-clarity.comment/3kf6abc234',
    cid: 'bafyreialice5',
    subject: {
      principal: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
      contractName: 'alex-vault',
      txId: DUMMY_TX_IDS['alex-vault'],
    },
    authorDid: users[0].did,
    text: 'This is a well-architected AMM contract. The constant product formula is correctly implemented and the security checks are comprehensive.',
    createdAt: '2026-01-21T15:30:00Z',
    reactions: { '❤️': 10, '🔥': 5 },
    replyCount: 0,
  },
  {
    uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/com.source-of-clarity.comment/3kf6def567',
    cid: 'bafyreibob4',
    subject: {
      principal: 'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335',
      contractName: 'clarity-dao',
      txId: DUMMY_TX_IDS['clarity-dao'],
    },
    authorDid: users[1].did,
    text: 'Great governance contract! Would love to see time-locked proposals added.',
    createdAt: '2026-01-16T10:00:00Z',
    reactions: { '👍': 5, '🚀': 2 },
    replyCount: 0,
  },
];

/**
 * Get all comments for a specific contract by name
 */
export function getCommentsForContract(contractName: string): Comment[] {
  return comments.filter(c => c.subject.contractName === contractName);
}

/**
 * Get comments for a specific line of a contract
 */
export function getCommentsForLine(contractName: string, lineNumber: number): Comment[] {
  return comments.filter(c => 
    c.subject.contractName === contractName && 
    !c.parentId && // Exclude replies
    (c.lineNumber === lineNumber || 
      (c.lineRange && lineNumber >= c.lineRange.start && lineNumber <= c.lineRange.end))
  );
}

/**
 * Get replies to a specific comment by parent rkey
 */
export function getReplies(parentRkey: string): Comment[] {
  return comments.filter(c => c.parentId === parentRkey);
}

/**
 * Get a comment by its URI
 */
export function getCommentByUri(uri: string): Comment | undefined {
  return comments.find(c => c.uri === uri);
}

/**
 * Get contract-level comments (no line targeting)
 */
export function getContractLevelComments(contractName: string): Comment[] {
  return comments.filter(c => 
    c.subject.contractName === contractName && 
    c.lineNumber === undefined && 
    c.lineRange === undefined &&
    !c.parentId
  );
}

/**
 * Extract rkey from AT URI
 */
export function extractRkeyFromUri(uri: string): string | undefined {
  const match = uri.match(/at:\/\/[^/]+\/[^/]+\/([^/]+)/);
  return match?.[1];
}