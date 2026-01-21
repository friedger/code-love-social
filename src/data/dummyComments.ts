import { users } from "./dummyUsers";

export interface Comment {
  id: string;
  uri: string; // AT Protocol record URI
  cid: string; // AT Protocol CID
  contractId: string;
  lineNumber: number;
  lineRange?: { start: number; end: number }; // For multi-line comments
  authorDid: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  likes: number;
  likedBy: string[]; // Array of DIDs
  parentId?: string; // For replies
  replyCount: number;
}

export const comments: Comment[] = [
  // Comments for sip-010-trait
  {
    id: "1",
    uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kf5",
    cid: "bafyreia",
    contractId: "1",
    lineNumber: 4,
    authorDid: users[0].did,
    content:
      "The transfer function here follows the standard interface. Note that the optional memo buffer allows for transaction tagging which is useful for exchanges.",
    createdAt: "2024-01-15T10:30:00Z",
    likes: 12,
    likedBy: [users[1].did, users[2].did],
    replyCount: 2,
  },
  {
    id: "2",
    uri: "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3kf6",
    cid: "bafyreib",
    contractId: "1",
    lineNumber: 4,
    parentId: "1",
    authorDid: users[1].did,
    content:
      "Great point! The 34-byte buffer is specifically sized to fit a Stacks address with some extra room for custom data.",
    createdAt: "2024-01-15T11:00:00Z",
    likes: 5,
    likedBy: [users[0].did],
    replyCount: 1,
  },
  {
    id: "3",
    uri: "at://did:plc:k5zb6qvl5fwqdu4l6wh4v7yi/app.bsky.feed.post/3kf7",
    cid: "bafyreic",
    contractId: "1",
    lineNumber: 4,
    parentId: "2",
    authorDid: users[2].did,
    content:
      "I've written a tutorial on implementing this trait. Would love your feedback on it!",
    createdAt: "2024-01-15T12:15:00Z",
    likes: 3,
    likedBy: [],
    replyCount: 0,
  },
  {
    id: "4",
    uri: "at://did:plc:ragtjsm2j2vknwkz3zp4oxrd/app.bsky.feed.post/3kf8",
    cid: "bafyreid",
    contractId: "1",
    lineNumber: 13,
    authorDid: users[3].did,
    content:
      "Using uint for the balance return type is standard, but consider that this limits precision. For some use cases you might want to track fractional amounts differently.",
    createdAt: "2024-01-16T09:00:00Z",
    likes: 8,
    likedBy: [users[0].did, users[1].did, users[4].did],
    replyCount: 0,
  },

  // Comments for arkadiko-token
  {
    id: "5",
    uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kg1",
    cid: "bafyreie",
    contractId: "2",
    lineNumber: 8,
    authorDid: users[0].did,
    content:
      "Setting the token-uri as a data variable is a good pattern - it allows for metadata updates without contract redeployment.",
    createdAt: "2024-01-17T14:00:00Z",
    likes: 15,
    likedBy: [users[1].did, users[2].did, users[3].did],
    replyCount: 1,
  },
  {
    id: "6",
    uri: "at://did:plc:4hqjfn7m6n5hno4at373b2ts/app.bsky.feed.post/3kg2",
    cid: "bafyreif",
    contractId: "2",
    lineNumber: 8,
    parentId: "5",
    authorDid: users[5].did,
    content:
      "However, this also means metadata can be changed. For truly immutable NFTs, you might want to make this constant.",
    createdAt: "2024-01-17T15:30:00Z",
    likes: 7,
    likedBy: [users[0].did],
    replyCount: 0,
  },
  {
    id: "7",
    uri: "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3kg3",
    cid: "bafyreig",
    contractId: "2",
    lineNumber: 35,
    authorDid: users[1].did,
    content:
      "The asserts! check here is critical for security. Without it, anyone could transfer tokens from any account.",
    createdAt: "2024-01-18T10:00:00Z",
    likes: 23,
    likedBy: [users[0].did, users[2].did, users[3].did, users[4].did, users[5].did],
    replyCount: 3,
  },

  // Comments for alex-vault
  {
    id: "8",
    uri: "at://did:plc:k5zb6qvl5fwqdu4l6wh4v7yi/app.bsky.feed.post/3kh1",
    cid: "bafyreih",
    contractId: "3",
    lineNumber: 39,
    lineRange: { start: 39, end: 45 },
    authorDid: users[2].did,
    content:
      "This constant product formula (x * y = k) is the foundation of AMM design. Understanding this is essential for any DeFi developer.",
    createdAt: "2024-01-19T08:00:00Z",
    likes: 31,
    likedBy: [users[0].did, users[1].did, users[3].did, users[4].did],
    replyCount: 4,
  },
  {
    id: "9",
    uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kh2",
    cid: "bafyreii",
    contractId: "3",
    lineNumber: 6,
    authorDid: users[0].did,
    content:
      "⚠️ Security Note: Error code u2004 for slippage is important for protecting users from sandwich attacks.",
    createdAt: "2024-01-19T09:30:00Z",
    likes: 18,
    likedBy: [users[1].did, users[2].did],
    replyCount: 1,
  },

  // Comments for stacks-dao
  {
    id: "10",
    uri: "at://did:plc:uu5axsmbm2or2dngy4gwchec/app.bsky.feed.post/3ki1",
    cid: "bafyreij",
    contractId: "5",
    lineNumber: 7,
    authorDid: users[4].did,
    content:
      "The 10-day voting period (1440 blocks) seems reasonable for most governance decisions. Too short and people miss votes, too long and decisions take forever.",
    createdAt: "2024-01-20T11:00:00Z",
    likes: 9,
    likedBy: [users[0].did, users[2].did],
    replyCount: 2,
  },
  {
    id: "11",
    uri: "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3ki2",
    cid: "bafyreik",
    contractId: "5",
    lineNumber: 7,
    parentId: "10",
    authorDid: users[1].did,
    content:
      "I'd argue this should be configurable. Different proposals might need different time frames.",
    createdAt: "2024-01-20T12:00:00Z",
    likes: 4,
    likedBy: [],
    replyCount: 0,
  },

  // Comments for nft-marketplace
  {
    id: "12",
    uri: "at://did:plc:ragtjsm2j2vknwkz3zp4oxrd/app.bsky.feed.post/3kj1",
    cid: "bafyreil",
    contractId: "6",
    lineNumber: 9,
    authorDid: users[3].did,
    content:
      "2.5% marketplace fee is pretty standard in the NFT space. Some platforms go as high as 5%.",
    createdAt: "2024-01-21T14:00:00Z",
    likes: 6,
    likedBy: [users[4].did],
    replyCount: 1,
  },
  {
    id: "13",
    uri: "at://did:plc:4hqjfn7m6n5hno4at373b2ts/app.bsky.feed.post/3kj2",
    cid: "bafyreim",
    contractId: "6",
    lineNumber: 56,
    lineRange: { start: 56, end: 72 },
    authorDid: users[5].did,
    content:
      "The auction mechanism here is well-implemented. Note how the highest-bids map provides O(1) lookup for the current leader.",
    createdAt: "2024-01-21T16:00:00Z",
    likes: 11,
    likedBy: [users[0].did, users[1].did, users[3].did],
    replyCount: 0,
  },

  // Comments for oracle-v1
  {
    id: "14",
    uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kk1",
    cid: "bafyrein",
    contractId: "8",
    lineNumber: 6,
    authorDid: users[0].did,
    content:
      "🔒 The staleness threshold of ~5 hours is critical for price oracle security. Stale prices can lead to arbitrage exploits.",
    createdAt: "2024-01-22T09:00:00Z",
    likes: 27,
    likedBy: [users[1].did, users[2].did, users[3].did, users[4].did, users[5].did],
    replyCount: 3,
  },
  {
    id: "15",
    uri: "at://did:plc:k5zb6qvl5fwqdu4l6wh4v7yi/app.bsky.feed.post/3kk2",
    cid: "bafyreio",
    contractId: "8",
    lineNumber: 6,
    parentId: "14",
    authorDid: users[2].did,
    content:
      "In practice, I've seen protocols use even shorter thresholds (1-2 hours) for more volatile assets.",
    createdAt: "2024-01-22T10:30:00Z",
    likes: 14,
    likedBy: [users[0].did, users[1].did],
    replyCount: 0,
  },

  // Comments for multi-sig-wallet
  {
    id: "16",
    uri: "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3kl1",
    cid: "bafyreip",
    contractId: "9",
    lineNumber: 44,
    lineRange: { start: 44, end: 66 },
    authorDid: users[1].did,
    content:
      "This propose-transaction pattern is the standard for multi-sig. The key insight is that the proposer's signature is automatically counted.",
    createdAt: "2024-01-23T11:00:00Z",
    likes: 16,
    likedBy: [users[0].did, users[2].did, users[5].did],
    replyCount: 1,
  },
  {
    id: "17",
    uri: "at://did:plc:uu5axsmbm2or2dngy4gwchec/app.bsky.feed.post/3kl2",
    cid: "bafyreiq",
    contractId: "9",
    lineNumber: 8,
    authorDid: users[4].did,
    content:
      "Default of 2 required signatures is good for small teams. For DAOs with treasury, I'd recommend at least 3-of-5.",
    createdAt: "2024-01-23T13:00:00Z",
    likes: 8,
    likedBy: [users[1].did],
    replyCount: 0,
  },

  // Comments for escrow-service
  {
    id: "18",
    uri: "at://did:plc:4hqjfn7m6n5hno4at373b2ts/app.bsky.feed.post/3km1",
    cid: "bafyreir",
    contractId: "10",
    lineNumber: 8,
    authorDid: users[5].did,
    content:
      "0.1% escrow fee is very competitive. Most centralized escrow services charge 1-5%.",
    createdAt: "2024-01-24T10:00:00Z",
    likes: 7,
    likedBy: [users[3].did],
    replyCount: 2,
  },
  {
    id: "19",
    uri: "at://did:plc:ragtjsm2j2vknwkz3zp4oxrd/app.bsky.feed.post/3km2",
    cid: "bafyreis",
    contractId: "10",
    lineNumber: 67,
    lineRange: { start: 67, end: 86 },
    authorDid: users[3].did,
    content:
      "The dispute resolution mechanism relies on a single arbiter. For high-value escrows, consider implementing a multi-arbiter system or DAO voting.",
    createdAt: "2024-01-24T14:00:00Z",
    likes: 19,
    likedBy: [users[0].did, users[1].did, users[2].did, users[5].did],
    replyCount: 2,
  },
  {
    id: "20",
    uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3km3",
    cid: "bafyreit",
    contractId: "10",
    lineNumber: 67,
    parentId: "19",
    authorDid: users[0].did,
    content:
      "Agreed. Kleros-style decentralized arbitration would be ideal here, but adds significant complexity.",
    createdAt: "2024-01-24T15:30:00Z",
    likes: 12,
    likedBy: [users[1].did, users[3].did],
    replyCount: 0,
  },
];

export function getCommentsForContract(contractId: string): Comment[] {
  return comments.filter((c) => c.contractId === contractId);
}

export function getCommentsForLine(contractId: string, lineNumber: number): Comment[] {
  return comments.filter(
    (c) =>
      c.contractId === contractId &&
      !c.parentId &&
      (c.lineNumber === lineNumber ||
        (c.lineRange && lineNumber >= c.lineRange.start && lineNumber <= c.lineRange.end))
  );
}

export function getReplies(commentId: string): Comment[] {
  return comments.filter((c) => c.parentId === commentId);
}

export function getCommentById(id: string): Comment | undefined {
  return comments.find((c) => c.id === id);
}
