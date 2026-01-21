// Dummy users for the AT Protocol social features
export interface User {
  did: string; // AT Protocol DID
  handle: string;
  displayName: string;
  avatar: string;
  bio?: string;
  reputation: number; // 0-100
  badges: Badge[];
  followersCount: number;
  followingCount: number;
  commentsCount: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Relationship {
  following: boolean;
  followedBy: boolean;
  muted: boolean;
  blocked: boolean;
}

export const badges: Badge[] = [
  { id: "verified", name: "Verified Developer", icon: "✓", color: "blue" },
  { id: "contributor", name: "Top Contributor", icon: "⭐", color: "gold" },
  { id: "pioneer", name: "Pioneer", icon: "🚀", color: "purple" },
  { id: "auditor", name: "Security Auditor", icon: "🔒", color: "green" },
  { id: "educator", name: "Educator", icon: "📚", color: "orange" },
];

export const users: User[] = [
  {
    did: "did:plc:z72i7hdynmk6r22z27h6tvur",
    handle: "alice.bsky.social",
    displayName: "Alice Chen",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
    bio: "Smart contract security researcher. Building on Stacks.",
    reputation: 92,
    badges: [badges[0], badges[3]],
    followersCount: 2341,
    followingCount: 189,
    commentsCount: 156,
  },
  {
    did: "did:plc:ewvi7nxzyoun6zhxrhs64oiz",
    handle: "bob.stacks.dev",
    displayName: "Bob Martinez",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
    bio: "DeFi developer. Creator of StackSwap.",
    reputation: 87,
    badges: [badges[1], badges[2]],
    followersCount: 1892,
    followingCount: 245,
    commentsCount: 289,
  },
  {
    did: "did:plc:k5zb6qvl5fwqdu4l6wh4v7yi",
    handle: "carol.clarity.dev",
    displayName: "Carol Williams",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=carol",
    bio: "Clarity educator and documentation writer.",
    reputation: 78,
    badges: [badges[4]],
    followersCount: 967,
    followingCount: 312,
    commentsCount: 423,
  },
  {
    did: "did:plc:ragtjsm2j2vknwkz3zp4oxrd",
    handle: "dave.btc.social",
    displayName: "Dave Kumar",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=dave",
    bio: "NFT marketplace developer. Building on Bitcoin.",
    reputation: 71,
    badges: [badges[2]],
    followersCount: 534,
    followingCount: 178,
    commentsCount: 89,
  },
  {
    did: "did:plc:uu5axsmbm2or2dngy4gwchec",
    handle: "eve.crypto.social",
    displayName: "Eve Thompson",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=eve",
    bio: "Protocol researcher. Web3 enthusiast.",
    reputation: 65,
    badges: [],
    followersCount: 287,
    followingCount: 456,
    commentsCount: 67,
  },
  {
    did: "did:plc:4hqjfn7m6n5hno4at373b2ts",
    handle: "frank.dev.social",
    displayName: "Frank Lee",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=frank",
    bio: "Full-stack blockchain developer.",
    reputation: 58,
    badges: [badges[1]],
    followersCount: 412,
    followingCount: 289,
    commentsCount: 134,
  },
];

// Get relationship between current user and another user
export function getRelationship(currentUserDid: string, otherUserDid: string): Relationship {
  // Dummy relationships - in real app would come from AT Protocol
  const followingMap: Record<string, string[]> = {
    "did:plc:z72i7hdynmk6r22z27h6tvur": [
      "did:plc:ewvi7nxzyoun6zhxrhs64oiz",
      "did:plc:k5zb6qvl5fwqdu4l6wh4v7yi",
    ],
    "did:plc:ewvi7nxzyoun6zhxrhs64oiz": [
      "did:plc:z72i7hdynmk6r22z27h6tvur",
      "did:plc:ragtjsm2j2vknwkz3zp4oxrd",
    ],
    "did:plc:k5zb6qvl5fwqdu4l6wh4v7yi": [
      "did:plc:z72i7hdynmk6r22z27h6tvur",
      "did:plc:ewvi7nxzyoun6zhxrhs64oiz",
    ],
  };

  const following = followingMap[currentUserDid]?.includes(otherUserDid) ?? false;
  const followedBy = followingMap[otherUserDid]?.includes(currentUserDid) ?? false;

  return {
    following,
    followedBy,
    muted: false,
    blocked: false,
  };
}

export function getUserByDid(did: string): User | undefined {
  return users.find((u) => u.did === did);
}

export function getUserByHandle(handle: string): User | undefined {
  return users.find((u) => u.handle === handle);
}
