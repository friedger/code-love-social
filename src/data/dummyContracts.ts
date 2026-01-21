// Dummy Clarity smart contracts data
export interface Contract {
  id: string;
  name: string;
  principal: string;
  description: string;
  code: string;
  deployedAt: string;
  category: string;
}

export const contracts: Contract[] = [
  {
    id: "1",
    name: "sip-010-trait",
    principal: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
    description: "Standard trait for fungible tokens on Stacks",
    category: "Traits",
    deployedAt: "2021-01-14",
    code: `;; SIP-010 Fungible Token Trait
(define-trait sip-010-trait
  (
    ;; Transfer from the caller to a new principal
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))

    ;; the human-readable name of the token
    (get-name () (response (string-ascii 32) uint))

    ;; the ticker symbol
    (get-symbol () (response (string-ascii 32) uint))

    ;; the number of decimals used
    (get-decimals () (response uint uint))

    ;; the balance of the passed principal
    (get-balance (principal) (response uint uint))

    ;; the total supply of tokens
    (get-total-supply () (response uint uint))

    ;; an optional URI for metadata
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)`,
  },
  {
    id: "2",
    name: "arkadiko-token",
    principal: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
    description: "DIKO governance token for Arkadiko Protocol",
    category: "Tokens",
    deployedAt: "2021-06-15",
    code: `;; Arkadiko Token (DIKO)
;; Governance token for Arkadiko Protocol

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait.sip-010-trait)

(define-fungible-token diko)

(define-data-var token-uri (optional (string-utf8 256)) 
  (some u"https://arkadiko.finance"))

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

;; Get the token balance of a principal
(define-read-only (get-balance (account principal))
  (ok (ft-get-balance diko account))
)

;; Get total supply
(define-read-only (get-total-supply)
  (ok (ft-get-supply diko))
)

;; Get token name
(define-read-only (get-name)
  (ok "Arkadiko Token")
)

;; Get token symbol
(define-read-only (get-symbol)
  (ok "DIKO")
)

;; Get decimals
(define-read-only (get-decimals)
  (ok u6)
)

;; Get token URI
(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; Transfer tokens
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (try! (ft-transfer? diko amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

;; Mint new tokens (owner only)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? diko amount recipient)
  )
)`,
  },
  {
    id: "3",
    name: "alex-vault",
    principal: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9",
    description: "ALEX DEX liquidity vault implementation",
    category: "DeFi",
    deployedAt: "2022-03-20",
    code: `;; ALEX Vault Contract
;; Manages liquidity pools and swaps

(define-constant ERR-NOT-AUTHORIZED (err u1000))
(define-constant ERR-INVALID-POOL (err u2001))
(define-constant ERR-POOL-EXISTS (err u2002))
(define-constant ERR-INVALID-LIQUIDITY (err u2003))
(define-constant ERR-SLIPPAGE-TOO-HIGH (err u2004))

(define-data-var contract-owner principal tx-sender)
(define-data-var protocol-fee uint u30) ;; 0.3%

(define-map pools
  { token-x: principal, token-y: principal }
  {
    reserve-x: uint,
    reserve-y: uint,
    total-supply: uint,
    fee: uint
  }
)

(define-map liquidity-providers
  { pool-id: (tuple (token-x principal) (token-y principal)), provider: principal }
  { shares: uint }
)

;; Read-only functions
(define-read-only (get-pool (token-x principal) (token-y principal))
  (map-get? pools { token-x: token-x, token-y: token-y })
)

(define-read-only (get-reserves (token-x principal) (token-y principal))
  (let ((pool (unwrap! (get-pool token-x token-y) ERR-INVALID-POOL)))
    (ok { reserve-x: (get reserve-x pool), reserve-y: (get reserve-y pool) })
  )
)

(define-read-only (get-lp-balance (token-x principal) (token-y principal) (provider principal))
  (default-to
    { shares: u0 }
    (map-get? liquidity-providers { pool-id: { token-x: token-x, token-y: token-y }, provider: provider })
  )
)

;; Calculate swap output using constant product formula
(define-read-only (get-swap-output (amount-in uint) (reserve-in uint) (reserve-out uint) (fee uint))
  (let (
    (amount-with-fee (* amount-in (- u10000 fee)))
    (numerator (* amount-with-fee reserve-out))
    (denominator (+ (* reserve-in u10000) amount-with-fee))
  )
    (/ numerator denominator)
  )
)

;; Create new pool
(define-public (create-pool (token-x principal) (token-y principal) (initial-x uint) (initial-y uint))
  (let ((pool-exists (get-pool token-x token-y)))
    (asserts! (is-none pool-exists) ERR-POOL-EXISTS)
    (asserts! (and (> initial-x u0) (> initial-y u0)) ERR-INVALID-LIQUIDITY)
    (map-set pools
      { token-x: token-x, token-y: token-y }
      { reserve-x: initial-x, reserve-y: initial-y, total-supply: initial-x, fee: (var-get protocol-fee) }
    )
    (ok true)
  )
)

;; Add liquidity to pool
(define-public (add-liquidity (token-x principal) (token-y principal) (amount-x uint) (amount-y uint))
  (let (
    (pool (unwrap! (get-pool token-x token-y) ERR-INVALID-POOL))
    (current-shares (get shares (get-lp-balance token-x token-y tx-sender)))
  )
    (ok true)
  )
)`,
  },
  {
    id: "4",
    name: "citycoins-core",
    principal: "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27",
    description: "CityCoins mining and stacking mechanism",
    category: "Mining",
    deployedAt: "2021-08-17",
    code: `;; CityCoins Core Contract
;; Mining and Stacking Implementation

(define-constant ERR-UNAUTHORIZED (err u1001))
(define-constant ERR-MINING-NOT-ACTIVE (err u1002))
(define-constant ERR-ALREADY-MINED (err u1003))
(define-constant ERR-NOTHING-TO-CLAIM (err u1004))
(define-constant ERR-STACKING-NOT-ACTIVE (err u1005))

(define-data-var activation-block uint u0)
(define-data-var mining-active bool false)
(define-data-var stacking-active bool false)
(define-data-var total-stacked uint u0)

(define-map miners
  { block: uint, miner: principal }
  { amount: uint, claimed: bool }
)

(define-map mining-stats
  { block: uint }
  { total-miners: uint, total-committed: uint, winner: (optional principal) }
)

(define-map stackers
  { stacker: principal, cycle: uint }
  { amount: uint, claimed: bool }
)

(define-map stacking-stats
  { cycle: uint }
  { total-stacked: uint, rewards-distributed: uint }
)

;; Read-only functions
(define-read-only (is-mining-active)
  (var-get mining-active)
)

(define-read-only (get-activation-block)
  (var-get activation-block)
)

(define-read-only (get-miner-at-block (block uint) (miner principal))
  (map-get? miners { block: block, miner: miner })
)

(define-read-only (get-mining-stats-at-block (block uint))
  (map-get? mining-stats { block: block })
)

(define-read-only (get-stacker-at-cycle (stacker principal) (cycle uint))
  (map-get? stackers { stacker: stacker, cycle: cycle })
)

;; Mine tokens
(define-public (mine (amount uint))
  (let (
    (current-block block-height)
    (miner tx-sender)
  )
    (asserts! (var-get mining-active) ERR-MINING-NOT-ACTIVE)
    (asserts! (is-none (get-miner-at-block current-block miner)) ERR-ALREADY-MINED)
    
    ;; Record mining commit
    (map-set miners
      { block: current-block, miner: miner }
      { amount: amount, claimed: false }
    )
    
    ;; Update stats
    (match (get-mining-stats-at-block current-block)
      stats (map-set mining-stats
        { block: current-block }
        { 
          total-miners: (+ (get total-miners stats) u1),
          total-committed: (+ (get total-committed stats) amount),
          winner: none
        }
      )
      (map-set mining-stats
        { block: current-block }
        { total-miners: u1, total-committed: amount, winner: none }
      )
    )
    (ok true)
  )
)

;; Stack tokens
(define-public (stack (amount uint) (cycles uint))
  (begin
    (asserts! (var-get stacking-active) ERR-STACKING-NOT-ACTIVE)
    (var-set total-stacked (+ (var-get total-stacked) amount))
    (ok true)
  )
)`,
  },
  {
    id: "5",
    name: "stacks-dao",
    principal: "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1",
    description: "Decentralized governance for Stacks ecosystem",
    category: "Governance",
    deployedAt: "2022-01-10",
    code: `;; Stacks DAO Governance Contract
;; Proposal and voting system

(define-constant ERR-NOT-MEMBER (err u3001))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u3002))
(define-constant ERR-ALREADY-VOTED (err u3003))
(define-constant ERR-VOTING-CLOSED (err u3004))
(define-constant ERR-QUORUM-NOT-MET (err u3005))
(define-constant ERR-PROPOSAL-ACTIVE (err u3006))

(define-constant VOTING-PERIOD u1440) ;; ~10 days in blocks
(define-constant QUORUM-THRESHOLD u30) ;; 30%

(define-data-var proposal-count uint u0)
(define-data-var total-voting-power uint u0)

(define-map proposals
  { id: uint }
  {
    proposer: principal,
    title: (string-ascii 64),
    description: (string-utf8 500),
    start-block: uint,
    end-block: uint,
    votes-for: uint,
    votes-against: uint,
    executed: bool,
    contract-call: (optional { contract: principal, function: (string-ascii 64) })
  }
)

(define-map votes
  { proposal-id: uint, voter: principal }
  { vote: bool, amount: uint }
)

(define-map members
  { member: principal }
  { voting-power: uint, joined-at: uint }
)

;; Read-only functions
(define-read-only (get-proposal (id uint))
  (map-get? proposals { id: id })
)

(define-read-only (get-vote (proposal-id uint) (voter principal))
  (map-get? votes { proposal-id: proposal-id, voter: voter })
)

(define-read-only (get-member (member principal))
  (map-get? members { member: member })
)

(define-read-only (is-proposal-active (id uint))
  (match (get-proposal id)
    proposal (and 
      (>= block-height (get start-block proposal))
      (<= block-height (get end-block proposal))
      (not (get executed proposal))
    )
    false
  )
)

;; Calculate if quorum is met
(define-read-only (is-quorum-met (id uint))
  (match (get-proposal id)
    proposal (let (
      (total-votes (+ (get votes-for proposal) (get votes-against proposal)))
      (required (* (var-get total-voting-power) QUORUM-THRESHOLD))
    )
      (>= (* total-votes u100) required)
    )
    false
  )
)

;; Create proposal
(define-public (create-proposal (title (string-ascii 64)) (description (string-utf8 500)))
  (let (
    (member-data (unwrap! (get-member tx-sender) ERR-NOT-MEMBER))
    (new-id (+ (var-get proposal-count) u1))
  )
    (map-set proposals
      { id: new-id }
      {
        proposer: tx-sender,
        title: title,
        description: description,
        start-block: block-height,
        end-block: (+ block-height VOTING-PERIOD),
        votes-for: u0,
        votes-against: u0,
        executed: false,
        contract-call: none
      }
    )
    (var-set proposal-count new-id)
    (ok new-id)
  )
)

;; Vote on proposal
(define-public (vote (proposal-id uint) (vote-for bool))
  (let (
    (proposal (unwrap! (get-proposal proposal-id) ERR-PROPOSAL-NOT-FOUND))
    (member-data (unwrap! (get-member tx-sender) ERR-NOT-MEMBER))
    (voting-power (get voting-power member-data))
  )
    (asserts! (is-proposal-active proposal-id) ERR-VOTING-CLOSED)
    (asserts! (is-none (get-vote proposal-id tx-sender)) ERR-ALREADY-VOTED)
    
    (map-set votes
      { proposal-id: proposal-id, voter: tx-sender }
      { vote: vote-for, amount: voting-power }
    )
    
    (map-set proposals
      { id: proposal-id }
      (merge proposal {
        votes-for: (if vote-for (+ (get votes-for proposal) voting-power) (get votes-for proposal)),
        votes-against: (if (not vote-for) (+ (get votes-against proposal) voting-power) (get votes-against proposal))
      })
    )
    (ok true)
  )
)`,
  },
  {
    id: "6",
    name: "nft-marketplace",
    principal: "SPNWZ5V2TPWGQGVDR6T7B6RQ4XMGZ4PXTEE0VQ0S",
    description: "NFT trading and auction marketplace",
    category: "NFT",
    deployedAt: "2021-12-05",
    code: `;; NFT Marketplace Contract
;; Buy, sell, and auction NFTs

(define-constant ERR-NOT-OWNER (err u4001))
(define-constant ERR-LISTING-NOT-FOUND (err u4002))
(define-constant ERR-ALREADY-LISTED (err u4003))
(define-constant ERR-PRICE-TOO-LOW (err u4004))
(define-constant ERR-AUCTION-ENDED (err u4005))
(define-constant ERR-BID-TOO-LOW (err u4006))

(define-constant MARKETPLACE-FEE u25) ;; 2.5%
(define-data-var listing-count uint u0)

(define-map listings
  { id: uint }
  {
    seller: principal,
    nft-contract: principal,
    token-id: uint,
    price: uint,
    listed-at: uint,
    is-auction: bool,
    auction-end: uint
  }
)

(define-map bids
  { listing-id: uint, bidder: principal }
  { amount: uint, placed-at: uint }
)

(define-map highest-bids
  { listing-id: uint }
  { bidder: principal, amount: uint }
)

;; Read-only functions
(define-read-only (get-listing (id uint))
  (map-get? listings { id: id })
)

(define-read-only (get-highest-bid (listing-id uint))
  (map-get? highest-bids { listing-id: listing-id })
)

(define-read-only (calculate-fee (price uint))
  (/ (* price MARKETPLACE-FEE) u1000)
)

(define-read-only (is-auction-active (listing-id uint))
  (match (get-listing listing-id)
    listing (and 
      (get is-auction listing)
      (<= block-height (get auction-end listing))
    )
    false
  )
)

;; List NFT for fixed price sale
(define-public (list-fixed-price (nft-contract principal) (token-id uint) (price uint))
  (let (
    (new-id (+ (var-get listing-count) u1))
  )
    (asserts! (> price u0) ERR-PRICE-TOO-LOW)
    
    (map-set listings
      { id: new-id }
      {
        seller: tx-sender,
        nft-contract: nft-contract,
        token-id: token-id,
        price: price,
        listed-at: block-height,
        is-auction: false,
        auction-end: u0
      }
    )
    (var-set listing-count new-id)
    (ok new-id)
  )
)

;; List NFT for auction
(define-public (list-auction (nft-contract principal) (token-id uint) (starting-price uint) (duration uint))
  (let (
    (new-id (+ (var-get listing-count) u1))
  )
    (asserts! (> starting-price u0) ERR-PRICE-TOO-LOW)
    
    (map-set listings
      { id: new-id }
      {
        seller: tx-sender,
        nft-contract: nft-contract,
        token-id: token-id,
        price: starting-price,
        listed-at: block-height,
        is-auction: true,
        auction-end: (+ block-height duration)
      }
    )
    (var-set listing-count new-id)
    (ok new-id)
  )
)

;; Place bid on auction
(define-public (place-bid (listing-id uint) (amount uint))
  (let (
    (listing (unwrap! (get-listing listing-id) ERR-LISTING-NOT-FOUND))
    (current-highest (get-highest-bid listing-id))
  )
    (asserts! (is-auction-active listing-id) ERR-AUCTION-ENDED)
    (asserts! (> amount (get price listing)) ERR-BID-TOO-LOW)
    (match current-highest
      highest (asserts! (> amount (get amount highest)) ERR-BID-TOO-LOW)
      true
    )
    
    (map-set bids
      { listing-id: listing-id, bidder: tx-sender }
      { amount: amount, placed-at: block-height }
    )
    (map-set highest-bids
      { listing-id: listing-id }
      { bidder: tx-sender, amount: amount }
    )
    (ok true)
  )
)

;; Buy NFT at fixed price
(define-public (buy (listing-id uint))
  (let (
    (listing (unwrap! (get-listing listing-id) ERR-LISTING-NOT-FOUND))
    (fee (calculate-fee (get price listing)))
    (seller-amount (- (get price listing) fee))
  )
    ;; Transfer logic would go here
    (ok true)
  )
)`,
  },
  {
    id: "7",
    name: "stx-staking",
    principal: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
    description: "STX staking with reward distribution",
    category: "Staking",
    deployedAt: "2022-05-30",
    code: `;; STX Staking Contract
;; Stake STX and earn rewards

(define-constant ERR-NOTHING-STAKED (err u5001))
(define-constant ERR-LOCKUP-NOT-EXPIRED (err u5002))
(define-constant ERR-INVALID-AMOUNT (err u5003))
(define-constant ERR-NO-REWARDS (err u5004))

(define-constant MIN-LOCKUP u144) ;; ~1 day in blocks
(define-constant MAX-LOCKUP u52560) ;; ~365 days in blocks
(define-constant REWARD-RATE u100) ;; 1% per cycle

(define-data-var total-staked uint u0)
(define-data-var reward-pool uint u0)
(define-data-var last-reward-block uint block-height)

(define-map stakes
  { staker: principal }
  {
    amount: uint,
    start-block: uint,
    lockup-end: uint,
    rewards-claimed: uint
  }
)

(define-map reward-snapshots
  { block: uint }
  { reward-per-token: uint, total-staked: uint }
)

;; Read-only functions
(define-read-only (get-stake (staker principal))
  (map-get? stakes { staker: staker })
)

(define-read-only (get-total-staked)
  (var-get total-staked)
)

(define-read-only (calculate-rewards (staker principal))
  (match (get-stake staker)
    stake (let (
      (blocks-staked (- block-height (get start-block stake)))
      (base-reward (/ (* (get amount stake) REWARD-RATE blocks-staked) u10000))
    )
      base-reward
    )
    u0
  )
)

(define-read-only (can-unstake (staker principal))
  (match (get-stake staker)
    stake (>= block-height (get lockup-end stake))
    false
  )
)

;; Stake STX
(define-public (stake (amount uint) (lockup-blocks uint))
  (let (
    (effective-lockup (min (max lockup-blocks MIN-LOCKUP) MAX-LOCKUP))
  )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Transfer STX to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    (map-set stakes
      { staker: tx-sender }
      {
        amount: amount,
        start-block: block-height,
        lockup-end: (+ block-height effective-lockup),
        rewards-claimed: u0
      }
    )
    (var-set total-staked (+ (var-get total-staked) amount))
    (ok true)
  )
)

;; Claim rewards
(define-public (claim-rewards)
  (let (
    (stake (unwrap! (get-stake tx-sender) ERR-NOTHING-STAKED))
    (rewards (calculate-rewards tx-sender))
  )
    (asserts! (> rewards u0) ERR-NO-REWARDS)
    
    (map-set stakes
      { staker: tx-sender }
      (merge stake { 
        rewards-claimed: (+ (get rewards-claimed stake) rewards),
        start-block: block-height 
      })
    )
    ;; Transfer rewards
    (as-contract (stx-transfer? rewards tx-sender tx-sender))
  )
)

;; Unstake
(define-public (unstake)
  (let (
    (stake (unwrap! (get-stake tx-sender) ERR-NOTHING-STAKED))
  )
    (asserts! (can-unstake tx-sender) ERR-LOCKUP-NOT-EXPIRED)
    
    ;; Claim any pending rewards first
    (try! (claim-rewards))
    
    (var-set total-staked (- (var-get total-staked) (get amount stake)))
    (map-delete stakes { staker: tx-sender })
    (as-contract (stx-transfer? (get amount stake) tx-sender tx-sender))
  )
)`,
  },
  {
    id: "8",
    name: "oracle-v1",
    principal: "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM",
    description: "Price oracle for DeFi applications",
    category: "Oracle",
    deployedAt: "2022-02-14",
    code: `;; Price Oracle Contract
;; Provides price feeds for DeFi protocols

(define-constant ERR-NOT-AUTHORIZED (err u6001))
(define-constant ERR-STALE-PRICE (err u6002))
(define-constant ERR-ASSET-NOT-FOUND (err u6003))
(define-constant ERR-INVALID-PRICE (err u6004))

(define-constant STALENESS-THRESHOLD u720) ;; ~5 hours in blocks
(define-constant PRICE-PRECISION u1000000) ;; 6 decimals

(define-data-var owner principal tx-sender)

(define-map authorized-updaters
  { updater: principal }
  { active: bool, added-at: uint }
)

(define-map prices
  { asset: (string-ascii 12) }
  {
    price: uint,
    updated-at: uint,
    updater: principal
  }
)

(define-map price-history
  { asset: (string-ascii 12), block: uint }
  { price: uint }
)

;; Read-only functions
(define-read-only (get-price (asset (string-ascii 12)))
  (match (map-get? prices { asset: asset })
    price-data (ok (get price price-data))
    ERR-ASSET-NOT-FOUND
  )
)

(define-read-only (get-price-info (asset (string-ascii 12)))
  (map-get? prices { asset: asset })
)

(define-read-only (is-price-fresh (asset (string-ascii 12)))
  (match (map-get? prices { asset: asset })
    price-data (<= (- block-height (get updated-at price-data)) STALENESS-THRESHOLD)
    false
  )
)

(define-read-only (get-fresh-price (asset (string-ascii 12)))
  (let (
    (price-data (unwrap! (map-get? prices { asset: asset }) ERR-ASSET-NOT-FOUND))
  )
    (asserts! (is-price-fresh asset) ERR-STALE-PRICE)
    (ok (get price price-data))
  )
)

(define-read-only (is-authorized (updater principal))
  (match (map-get? authorized-updaters { updater: updater })
    data (get active data)
    false
  )
)

;; Update price (authorized updaters only)
(define-public (update-price (asset (string-ascii 12)) (new-price uint))
  (begin
    (asserts! (is-authorized tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (> new-price u0) ERR-INVALID-PRICE)
    
    (map-set prices
      { asset: asset }
      {
        price: new-price,
        updated-at: block-height,
        updater: tx-sender
      }
    )
    (map-set price-history
      { asset: asset, block: block-height }
      { price: new-price }
    )
    (ok true)
  )
)

;; Batch update prices
(define-public (update-prices (updates (list 10 { asset: (string-ascii 12), price: uint })))
  (begin
    (asserts! (is-authorized tx-sender) ERR-NOT-AUTHORIZED)
    (ok (map update-single-price updates))
  )
)

(define-private (update-single-price (update { asset: (string-ascii 12), price: uint }))
  (begin
    (map-set prices
      { asset: (get asset update) }
      {
        price: (get price update),
        updated-at: block-height,
        updater: tx-sender
      }
    )
    true
  )
)

;; Admin functions
(define-public (add-updater (updater principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) ERR-NOT-AUTHORIZED)
    (map-set authorized-updaters
      { updater: updater }
      { active: true, added-at: block-height }
    )
    (ok true)
  )
)

(define-public (remove-updater (updater principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) ERR-NOT-AUTHORIZED)
    (map-set authorized-updaters
      { updater: updater }
      { active: false, added-at: block-height }
    )
    (ok true)
  )
)`,
  },
  {
    id: "9",
    name: "multi-sig-wallet",
    principal: "SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335",
    description: "Multi-signature wallet with threshold approvals",
    category: "Wallet",
    deployedAt: "2021-11-22",
    code: `;; Multi-Signature Wallet Contract
;; Requires multiple approvals for transactions

(define-constant ERR-NOT-OWNER (err u7001))
(define-constant ERR-TX-NOT-FOUND (err u7002))
(define-constant ERR-ALREADY-SIGNED (err u7003))
(define-constant ERR-THRESHOLD-NOT-MET (err u7004))
(define-constant ERR-ALREADY-EXECUTED (err u7005))
(define-constant ERR-INVALID-THRESHOLD (err u7006))

(define-data-var tx-count uint u0)
(define-data-var owner-count uint u0)
(define-data-var required-signatures uint u2)

(define-map owners
  { owner: principal }
  { active: bool, added-at: uint }
)

(define-map transactions
  { id: uint }
  {
    to: principal,
    amount: uint,
    memo: (optional (buff 34)),
    proposer: principal,
    signatures: uint,
    executed: bool,
    created-at: uint
  }
)

(define-map signatures
  { tx-id: uint, signer: principal }
  { signed: bool, signed-at: uint }
)

;; Read-only functions
(define-read-only (is-owner (account principal))
  (match (map-get? owners { owner: account })
    owner-data (get active owner-data)
    false
  )
)

(define-read-only (get-transaction (id uint))
  (map-get? transactions { id: id })
)

(define-read-only (get-required-signatures)
  (var-get required-signatures)
)

(define-read-only (has-signed (tx-id uint) (signer principal))
  (match (map-get? signatures { tx-id: tx-id, signer: signer })
    sig-data (get signed sig-data)
    false
  )
)

(define-read-only (can-execute (tx-id uint))
  (match (get-transaction tx-id)
    tx (and 
      (not (get executed tx))
      (>= (get signatures tx) (var-get required-signatures))
    )
    false
  )
)

;; Propose new transaction
(define-public (propose-transaction (to principal) (amount uint) (memo (optional (buff 34))))
  (let (
    (new-id (+ (var-get tx-count) u1))
  )
    (asserts! (is-owner tx-sender) ERR-NOT-OWNER)
    
    (map-set transactions
      { id: new-id }
      {
        to: to,
        amount: amount,
        memo: memo,
        proposer: tx-sender,
        signatures: u1,
        executed: false,
        created-at: block-height
      }
    )
    (map-set signatures
      { tx-id: new-id, signer: tx-sender }
      { signed: true, signed-at: block-height }
    )
    (var-set tx-count new-id)
    (ok new-id)
  )
)

;; Sign transaction
(define-public (sign-transaction (tx-id uint))
  (let (
    (tx (unwrap! (get-transaction tx-id) ERR-TX-NOT-FOUND))
  )
    (asserts! (is-owner tx-sender) ERR-NOT-OWNER)
    (asserts! (not (has-signed tx-id tx-sender)) ERR-ALREADY-SIGNED)
    (asserts! (not (get executed tx)) ERR-ALREADY-EXECUTED)
    
    (map-set signatures
      { tx-id: tx-id, signer: tx-sender }
      { signed: true, signed-at: block-height }
    )
    (map-set transactions
      { id: tx-id }
      (merge tx { signatures: (+ (get signatures tx) u1) })
    )
    (ok true)
  )
)

;; Execute transaction
(define-public (execute-transaction (tx-id uint))
  (let (
    (tx (unwrap! (get-transaction tx-id) ERR-TX-NOT-FOUND))
  )
    (asserts! (is-owner tx-sender) ERR-NOT-OWNER)
    (asserts! (can-execute tx-id) ERR-THRESHOLD-NOT-MET)
    
    (map-set transactions
      { id: tx-id }
      (merge tx { executed: true })
    )
    
    ;; Execute the transfer
    (as-contract (stx-transfer? (get amount tx) tx-sender (get to tx)))
  )
)

;; Update required signatures
(define-public (set-required-signatures (new-threshold uint))
  (begin
    (asserts! (is-owner tx-sender) ERR-NOT-OWNER)
    (asserts! (and (> new-threshold u0) (<= new-threshold (var-get owner-count))) ERR-INVALID-THRESHOLD)
    (var-set required-signatures new-threshold)
    (ok true)
  )
)`,
  },
  {
    id: "10",
    name: "escrow-service",
    principal: "SP3GWX3NE58KXHESRYE4DYQ1S31PQJTCRXB3PE9SB",
    description: "Trustless escrow for peer-to-peer trades",
    category: "Escrow",
    deployedAt: "2022-04-08",
    code: `;; Escrow Service Contract
;; Trustless escrow for P2P trading

(define-constant ERR-NOT-PARTICIPANT (err u8001))
(define-constant ERR-ESCROW-NOT-FOUND (err u8002))
(define-constant ERR-ALREADY-FUNDED (err u8003))
(define-constant ERR-NOT-FUNDED (err u8004))
(define-constant ERR-DISPUTE-ACTIVE (err u8005))
(define-constant ERR-NO-DISPUTE (err u8006))
(define-constant ERR-NOT-ARBITER (err u8007))

(define-constant ESCROW-FEE u10) ;; 0.1%
(define-data-var escrow-count uint u0)
(define-data-var arbiter principal tx-sender)

(define-map escrows
  { id: uint }
  {
    buyer: principal,
    seller: principal,
    amount: uint,
    funded: bool,
    completed: bool,
    disputed: bool,
    created-at: uint,
    description: (string-utf8 256)
  }
)

(define-map dispute-votes
  { escrow-id: uint }
  { 
    buyer-evidence: (optional (string-utf8 500)),
    seller-evidence: (optional (string-utf8 500)),
    resolution: (optional bool) ;; true = buyer wins, false = seller wins
  }
)

;; Read-only functions
(define-read-only (get-escrow (id uint))
  (map-get? escrows { id: id })
)

(define-read-only (get-dispute (escrow-id uint))
  (map-get? dispute-votes { escrow-id: escrow-id })
)

(define-read-only (is-participant (escrow-id uint) (account principal))
  (match (get-escrow escrow-id)
    escrow (or 
      (is-eq account (get buyer escrow))
      (is-eq account (get seller escrow))
    )
    false
  )
)

(define-read-only (calculate-fee (amount uint))
  (/ (* amount ESCROW-FEE) u10000)
)

;; Create new escrow
(define-public (create-escrow (seller principal) (amount uint) (description (string-utf8 256)))
  (let (
    (new-id (+ (var-get escrow-count) u1))
  )
    (map-set escrows
      { id: new-id }
      {
        buyer: tx-sender,
        seller: seller,
        amount: amount,
        funded: false,
        completed: false,
        disputed: false,
        created-at: block-height,
        description: description
      }
    )
    (var-set escrow-count new-id)
    (ok new-id)
  )
)

;; Fund escrow (buyer)
(define-public (fund-escrow (escrow-id uint))
  (let (
    (escrow (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
    (total-amount (+ (get amount escrow) (calculate-fee (get amount escrow))))
  )
    (asserts! (is-eq tx-sender (get buyer escrow)) ERR-NOT-PARTICIPANT)
    (asserts! (not (get funded escrow)) ERR-ALREADY-FUNDED)
    
    (try! (stx-transfer? total-amount tx-sender (as-contract tx-sender)))
    
    (map-set escrows
      { id: escrow-id }
      (merge escrow { funded: true })
    )
    (ok true)
  )
)

;; Release funds to seller (buyer confirms delivery)
(define-public (release-funds (escrow-id uint))
  (let (
    (escrow (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender (get buyer escrow)) ERR-NOT-PARTICIPANT)
    (asserts! (get funded escrow) ERR-NOT-FUNDED)
    (asserts! (not (get disputed escrow)) ERR-DISPUTE-ACTIVE)
    
    (map-set escrows
      { id: escrow-id }
      (merge escrow { completed: true })
    )
    
    (as-contract (stx-transfer? (get amount escrow) tx-sender (get seller escrow)))
  )
)

;; Open dispute
(define-public (open-dispute (escrow-id uint) (evidence (string-utf8 500)))
  (let (
    (escrow (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
  )
    (asserts! (is-participant escrow-id tx-sender) ERR-NOT-PARTICIPANT)
    (asserts! (get funded escrow) ERR-NOT-FUNDED)
    
    (map-set escrows
      { id: escrow-id }
      (merge escrow { disputed: true })
    )
    
    (map-set dispute-votes
      { escrow-id: escrow-id }
      {
        buyer-evidence: (if (is-eq tx-sender (get buyer escrow)) (some evidence) none),
        seller-evidence: (if (is-eq tx-sender (get seller escrow)) (some evidence) none),
        resolution: none
      }
    )
    (ok true)
  )
)

;; Resolve dispute (arbiter only)
(define-public (resolve-dispute (escrow-id uint) (buyer-wins bool))
  (let (
    (escrow (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
    (recipient (if buyer-wins (get buyer escrow) (get seller escrow)))
  )
    (asserts! (is-eq tx-sender (var-get arbiter)) ERR-NOT-ARBITER)
    (asserts! (get disputed escrow) ERR-NO-DISPUTE)
    
    (map-set escrows
      { id: escrow-id }
      (merge escrow { completed: true, disputed: false })
    )
    
    (match (get-dispute escrow-id)
      dispute (map-set dispute-votes
        { escrow-id: escrow-id }
        (merge dispute { resolution: (some buyer-wins) })
      )
      false
    )
    
    (as-contract (stx-transfer? (get amount escrow) tx-sender recipient))
  )
)`,
  },
];

export function searchContracts(query: string): Contract[] {
  const lowerQuery = query.toLowerCase();
  return contracts.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery) ||
      c.category.toLowerCase().includes(lowerQuery)
  );
}
