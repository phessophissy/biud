;;  ╔══════════════════════════════════════════════════════════════════════════╗
;;  ║                                                                          ║
;;  ║   ██████╗ ██╗██╗   ██╗██████╗     Bitcoin Username Domain                ║
;;  ║   ██╔══██╗██║██║   ██║██╔══██╗    TLD: .sBTC                             ║
;;  ║   ██████╔╝██║██║   ██║██║  ██║    Decentralized Username Registrar       ║
;;  ║   ██╔══██╗██║██║   ██║██║  ██║    on Stacks (Bitcoin L2)                 ║
;;  ║   ██████╔╝██║╚██████╔╝██████╔╝                                           ║
;;  ║   ╚═════╝ ╚═╝ ╚═════╝ ╚═════╝     Clarity 4 Implementation               ║
;;  ║                                                                          ║
;;  ╚══════════════════════════════════════════════════════════════════════════╝

;; ════════════════════════════════════════════════════════════════════════════
;; TRAITS
;; ════════════════════════════════════════════════════════════════════════════

;; Resolver trait that external contracts can implement for custom name resolution
(define-trait resolver-trait
  (
    ;; Resolve a label to arbitrary data (e.g., wallet address, IPFS hash, metadata)
    (resolve ((string-utf8 32) principal) (response (optional (buff 64)) uint))
  )
)

;; ════════════════════════════════════════════════════════════════════════════
;; CONSTANTS
;; ════════════════════════════════════════════════════════════════════════════

;; TLD suffix for all registered names
(define-constant TLD ".sBTC")

;; Registration period in blocks (~1 year at ~10 min/block = 52560 blocks)
(define-constant REGISTRATION_PERIOD u52560)

;; Grace period after expiry where only original owner can renew (7 days = ~1008 blocks)
(define-constant GRACE_PERIOD u1008)

;; Premium name threshold (names with <= 4 characters are premium)
(define-constant PREMIUM_LENGTH_THRESHOLD u4)

;; Contract deployer (admin)
(define-constant CONTRACT_DEPLOYER tx-sender)

;; Error codes
(define-constant ERR_NAME_TAKEN (err u1001))
(define-constant ERR_NAME_EXPIRED (err u1002))
(define-constant ERR_NOT_OWNER (err u1003))
(define-constant ERR_NOT_ADMIN (err u1004))
(define-constant ERR_INVALID_LABEL (err u1005))
(define-constant ERR_PAYMENT_FAILED (err u1006))
(define-constant ERR_IN_GRACE_PERIOD (err u1007))
(define-constant ERR_RESOLVER_INVALID (err u1008))
(define-constant ERR_NAME_NOT_FOUND (err u1009))
(define-constant ERR_LABEL_TOO_LONG (err u1010))
(define-constant ERR_LABEL_EMPTY (err u1011))
(define-constant ERR_INVALID_CHARACTER (err u1012))
(define-constant ERR_TRANSFER_TO_SELF (err u1013))
(define-constant ERR_ZERO_FEE (err u1014))

;; ════════════════════════════════════════════════════════════════════════════
;; DATA VARIABLES
;; ════════════════════════════════════════════════════════════════════════════

;; Auto-incrementing name ID counter
(define-data-var name-id-counter uint u0)

;; Base registration fee in microSTX (default: 10 STX = 10,000,000 microSTX)
(define-data-var base-fee uint u10000000)

;; Renewal fee in microSTX (default: 5 STX = 5,000,000 microSTX)
(define-data-var renew-fee uint u5000000)

;; Premium multiplier (e.g., 5 = premium names cost 5x base fee)
(define-data-var premium-multiplier uint u5)

;; Fee recipient (defaults to contract deployer)
(define-data-var fee-recipient principal CONTRACT_DEPLOYER)

;; Protocol fee percentage (out of 100) - remaining goes to fee-recipient
(define-data-var protocol-fee-percent uint u10)

;; Protocol treasury address
(define-data-var protocol-treasury principal CONTRACT_DEPLOYER)

;; Total fees collected for analytics
(define-data-var total-fees-collected uint u0)

;; ════════════════════════════════════════════════════════════════════════════
;; DATA MAPS
;; ════════════════════════════════════════════════════════════════════════════

;; Main name registry: label -> name record
(define-map name-registry
  { label: (string-utf8 32) }
  {
    name-id: uint,
    full-name: (string-utf8 64),
    owner: principal,
    resolver: (optional principal),
    expiry-height: uint,
    is-premium: bool,
    created-at: uint,
    last-renewed: uint
  }
)

;; Reverse lookup: name-id -> label
(define-map name-id-to-label
  { name-id: uint }
  { label: (string-utf8 32) }
)

;; Owner lookup: principal -> list of owned name IDs (up to 100)
(define-map owner-names
  { owner: principal }
  { name-ids: (list 100 uint) }
)

;; Admin-designated premium labels (override automatic premium detection)
(define-map premium-labels
  { label: (string-utf8 32) }
  { is-premium: bool }
)

;; ════════════════════════════════════════════════════════════════════════════
;; EVENTS (Print statements for indexers)
;; ════════════════════════════════════════════════════════════════════════════

;; Event: Name registered
(define-private (emit-name-registered (label (string-utf8 32)) (full-name (string-utf8 64)) (owner principal) (name-id uint) (expiry uint) (fee uint) (is-premium bool))
  (print {
    event: "NameRegistered",
    label: label,
    full-name: full-name,
    owner: owner,
    name-id: name-id,
    expiry-height: expiry,
    fee-paid: fee,
    is-premium: is-premium,
    block-height: block-height
  })
)

;; Event: Name renewed
(define-private (emit-name-renewed (label (string-utf8 32)) (owner principal) (new-expiry uint) (fee uint))
  (print {
    event: "NameRenewed",
    label: label,
    owner: owner,
    new-expiry-height: new-expiry,
    fee-paid: fee,
    block-height: block-height
  })
)

;; Event: Name transferred
(define-private (emit-name-transferred (label (string-utf8 32)) (from-owner principal) (to-owner principal))
  (print {
    event: "NameTransferred",
    label: label,
    from: from-owner,
    to: to-owner,
    block-height: block-height
  })
)

;; Event: Resolver set
(define-private (emit-resolver-set (label (string-utf8 32)) (owner principal) (resolver principal))
  (print {
    event: "ResolverSet",
    label: label,
    owner: owner,
    resolver: resolver,
    block-height: block-height
  })
)

;; Event: Fee config updated
(define-private (emit-fee-config-updated (base uint) (renewal uint) (multiplier uint) (recipient principal))
  (print {
    event: "FeeConfigUpdated",
    base-fee: base,
    renew-fee: renewal,
    premium-multiplier: multiplier,
    fee-recipient: recipient,
    block-height: block-height
  })
)

;; Event: Protocol treasury updated
(define-private (emit-treasury-updated (treasury principal) (fee-percent uint))
  (print {
    event: "TreasuryUpdated",
    treasury: treasury,
    protocol-fee-percent: fee-percent,
    block-height: block-height
  })
)

;; ════════════════════════════════════════════════════════════════════════════
;; PRIVATE HELPER FUNCTIONS
;; ════════════════════════════════════════════════════════════════════════════

;; Check if a character is valid (lowercase a-z, 0-9, hyphen)
(define-private (is-valid-char (char (string-utf8 1)))
  (or
    ;; lowercase letters a-z
    (is-eq char u"a") (is-eq char u"b") (is-eq char u"c") (is-eq char u"d")
    (is-eq char u"e") (is-eq char u"f") (is-eq char u"g") (is-eq char u"h")
    (is-eq char u"i") (is-eq char u"j") (is-eq char u"k") (is-eq char u"l")
    (is-eq char u"m") (is-eq char u"n") (is-eq char u"o") (is-eq char u"p")
    (is-eq char u"q") (is-eq char u"r") (is-eq char u"s") (is-eq char u"t")
    (is-eq char u"u") (is-eq char u"v") (is-eq char u"w") (is-eq char u"x")
    (is-eq char u"y") (is-eq char u"z")
    ;; digits 0-9
    (is-eq char u"0") (is-eq char u"1") (is-eq char u"2") (is-eq char u"3")
    (is-eq char u"4") (is-eq char u"5") (is-eq char u"6") (is-eq char u"7")
    (is-eq char u"8") (is-eq char u"9")
    ;; hyphen (but not at start/end - checked separately)
    (is-eq char u"-")
  )
)

;; Validate label: lowercase ASCII, 1-32 chars, no leading/trailing hyphens
(define-private (validate-label (label (string-utf8 32)))
  (let
    (
      (label-len (len label))
    )
    ;; Check length bounds
    (asserts! (> label-len u0) ERR_LABEL_EMPTY)
    (asserts! (<= label-len u32) ERR_LABEL_TOO_LONG)
    (ok true)
  )
)

;; Validate subdomain label: supports sub.parent format
(define-private (validate-subdomain-label (label (string-utf8 32)))
  (let
    (
      (dot-index (index-of label "."))
    )
    (if (is-some dot-index)
      ;; It's a subdomain
      (let
        (
          (parent-end (unwrap-panic dot-index))
          (sub-len (len label))
          (parent (unwrap! (slice? label u0 parent-end) ERR_INVALID_LABEL))
          (subdomain-start (+ parent-end u1))
          (subdomain (unwrap! (slice? label subdomain-start sub-len) ERR_INVALID_LABEL))
        )
        ;; Check parent and subdomain not empty
        (asserts! (> (len parent) u0) ERR_INVALID_LABEL)
        (asserts! (> (len subdomain) u0) ERR_INVALID_LABEL)
        ;; Validate parent and subdomain as valid labels
        (try! (validate-label parent))
        (try! (validate-label subdomain))
        (ok { is-subdomain: true, parent: parent, subdomain: subdomain })
      )
      ;; Not a subdomain
      (begin
        (try! (validate-label label))
        (ok { is-subdomain: false, parent: "", subdomain: "" })
      )
    )
  )
)

;; Generate the next name ID
(define-private (get-next-name-id)
  (let
    (
      (current-id (var-get name-id-counter))
      (next-id (+ current-id u1))
    )
    (var-set name-id-counter next-id)
    next-id
  )
)

;; Check if a name is premium (either by length or admin designation)
(define-private (check-is-premium (label (string-utf8 32)))
  (let
    (
      (admin-premium (map-get? premium-labels { label: label }))
    )
    ;; If admin has explicitly set premium status, use that
    (match admin-premium
      premium-entry (get is-premium premium-entry)
      ;; Otherwise, check if length <= threshold
      (<= (len label) PREMIUM_LENGTH_THRESHOLD)
    )
  )
)

;; Calculate registration fee based on premium status
(define-private (calculate-registration-fee (is-premium bool))
  (if is-premium
    (* (var-get base-fee) (var-get premium-multiplier))
    (var-get base-fee)
  )
)

;; Calculate renewal fee (same for all names currently)
(define-private (calculate-renewal-fee)
  (var-get renew-fee)
)

;; Split and distribute fees between protocol treasury and fee recipient
(define-private (distribute-fees (total-fee uint))
  (let
    (
      (protocol-percent (var-get protocol-fee-percent))
      (protocol-share (/ (* total-fee protocol-percent) u100))
      (recipient-share (- total-fee protocol-share))
      (treasury (var-get protocol-treasury))
      (recipient (var-get fee-recipient))
    )
    ;; Transfer protocol share to treasury
    (if (> protocol-share u0)
      (try! (stx-transfer? protocol-share tx-sender treasury))
      true
    )
    ;; Transfer remainder to fee recipient
    (if (> recipient-share u0)
      (try! (stx-transfer? recipient-share tx-sender recipient))
      true
    )
    ;; Update total fees collected
    (var-set total-fees-collected (+ (var-get total-fees-collected) total-fee))
    (ok true)
  )
)

;; Check if name is expired (past expiry + grace period)
(define-private (is-name-expired (expiry-height uint))
  (> block-height (+ expiry-height GRACE_PERIOD))
)

;; Check if name is in grace period (expired but within grace period)
(define-private (is-in-grace-period (expiry-height uint))
  (and
    (> block-height expiry-height)
    (<= block-height (+ expiry-height GRACE_PERIOD))
  )
)

;; Add name ID to owner's list
(define-private (add-name-to-owner (owner principal) (name-id uint))
  (let
    (
      (current-names (default-to { name-ids: (list) } (map-get? owner-names { owner: owner })))
      (current-list (get name-ids current-names))
    )
    (map-set owner-names
      { owner: owner }
      { name-ids: (unwrap! (as-max-len? (append current-list name-id) u100) (ok false)) }
    )
    (ok true)
  )
)

;; Remove name ID from owner's list
(define-private (remove-name-from-owner (owner principal) (name-id uint))
  (let
    (
      (current-names (default-to { name-ids: (list) } (map-get? owner-names { owner: owner })))
      (current-list (get name-ids current-names))
      (filtered-list (filter not-matching-id current-list))
    )
    (var-set temp-name-id name-id)
    (map-set owner-names
      { owner: owner }
      { name-ids: filtered-list }
    )
    (ok true)
  )
)

;; Temporary variable for filter operation
(define-data-var temp-name-id uint u0)

;; Helper for filtering out a specific name ID
(define-private (not-matching-id (id uint))
  (not (is-eq id (var-get temp-name-id)))
)

;; ════════════════════════════════════════════════════════════════════════════
;; PUBLIC FUNCTIONS - CORE REGISTRATION
;; ════════════════════════════════════════════════════════════════════════════

;; Register a new username with .sBTC TLD
(define-public (register-name (label (string-utf8 32)))
  (let
    (
      ;; Validate the label format
      (validation-result (try! (validate-subdomain-label label)))
      ;; Check parent ownership if subdomain
      (is-subdomain (get is-subdomain validation-result))
    )
    ;; If subdomain, verify parent ownership
    (if is-subdomain
      (let
        (
          (parent (get parent validation-result))
          (parent-record (unwrap! (map-get? name-registry { label: parent }) ERR_NAME_NOT_FOUND))
        )
        (asserts! (is-eq (get owner parent-record) tx-sender) ERR_NOT_OWNER)
        (asserts! (<= block-height (get expiry-height parent-record)) ERR_NAME_EXPIRED)
        true
      )
      true
    )
    ;; Generate the full name with TLD
    (let
      (
        (full-name (if is-subdomain
          (let
            (
              (parent (get parent validation-result))
              (subdomain (get subdomain validation-result))
            )
            (unwrap! (as-max-len? (concat (concat subdomain ".") (concat parent ".sBTC")) u64) ERR_INVALID_LABEL)
          )
          (unwrap! (as-max-len? (concat label ".sBTC") u64) ERR_INVALID_LABEL)
        ))
        ;; Check if name is premium
        (is-premium (check-is-premium label))
        ;; Calculate the registration fee
        (reg-fee (calculate-registration-fee is-premium))
        ;; Get existing registration if any
        (existing (map-get? name-registry { label: label }))
        ;; Generate new name ID
        (new-name-id (get-next-name-id))
        ;; Calculate expiry height
        (expiry (+ block-height REGISTRATION_PERIOD))
      )
      ;; Check if name is available
      (match existing
        name-record
        ;; Name exists - check if expired
        (begin
          (asserts! (is-name-expired (get expiry-height name-record)) ERR_NAME_TAKEN)
          ;; Remove from previous owner's list
          (try! (remove-name-from-owner (get owner name-record) (get name-id name-record)))
        )
        ;; Name doesn't exist - proceed
        true
      )

      ;; Collect registration fee
      (asserts! (> reg-fee u0) ERR_ZERO_FEE)
      (try! (distribute-fees reg-fee))

      ;; Create the name record
      (map-set name-registry
        { label: label }
        {
          name-id: new-name-id,
          full-name: full-name,
          owner: tx-sender,
          resolver: none,
          expiry-height: expiry,
          is-premium: is-premium,
          created-at: block-height,
          last-renewed: block-height
        }
      )

      ;; Set reverse lookup
      (map-set name-id-to-label
        { name-id: new-name-id }
        { label: label }
      )

      ;; Add to owner's name list
      (try! (add-name-to-owner tx-sender new-name-id))

      ;; Emit registration event
      (emit-name-registered label full-name tx-sender new-name-id expiry reg-fee is-premium)

      (ok {
        name-id: new-name-id,
        full-name: full-name,
        expiry-height: expiry,
        fee-paid: reg-fee
      })
    )
  )
)

;; Register multiple names in one transaction (up to 10)
(define-private (register-name-wrapper (label (string-utf8 32)))
  (register-name label)
)

(define-public (register-multiple-names (labels (list 10 (string-utf8 32))))
  (ok (map register-name-wrapper labels))
)

;; ════════════════════════════════════════════════════════════════════════════
;; PUBLIC FUNCTIONS - RENEWAL
;; ════════════════════════════════════════════════════════════════════════════

;; Renew an existing name registration
(define-public (renew-name (label (string-utf8 32)))
  (let
    (
      ;; Get the existing name record
      (name-record (unwrap! (map-get? name-registry { label: label }) ERR_NAME_NOT_FOUND))
      (current-expiry (get expiry-height name-record))
      (owner (get owner name-record))
      ;; Calculate renewal fee
      (renewal-fee (calculate-renewal-fee))
    )
    ;; Check if name is completely expired (past grace period)
    (asserts! (not (is-name-expired current-expiry)) ERR_NAME_EXPIRED)
    
    ;; During grace period, only original owner can renew
    (if (is-in-grace-period current-expiry)
      (asserts! (is-eq tx-sender owner) ERR_IN_GRACE_PERIOD)
      true
    )
    
    ;; If not in grace period, anyone can renew for the owner (gift renewal)
    ;; This is a feature - you can renew someone else's name as a gift
    
    ;; Collect renewal fee
    (asserts! (> renewal-fee u0) ERR_ZERO_FEE)
    (try! (distribute-fees renewal-fee))
    
    ;; Calculate new expiry (extend from current expiry, not block-height)
    (let
      (
        (new-expiry (+ current-expiry REGISTRATION_PERIOD))
      )
      ;; Update the name record
      (map-set name-registry
        { label: label }
        (merge name-record {
          expiry-height: new-expiry,
          last-renewed: block-height
        })
      )
      
      ;; Emit renewal event
      (emit-name-renewed label owner new-expiry renewal-fee)
      
      (ok {
        new-expiry-height: new-expiry,
        fee-paid: renewal-fee
      })
    )
  )
)

;; ════════════════════════════════════════════════════════════════════════════
;; PUBLIC FUNCTIONS - TRANSFER
;; ════════════════════════════════════════════════════════════════════════════

;; Transfer name ownership to another principal
(define-public (transfer-name (label (string-utf8 32)) (new-owner principal))
  (let
    (
      ;; Get the existing name record
      (name-record (unwrap! (map-get? name-registry { label: label }) ERR_NAME_NOT_FOUND))
      (current-owner (get owner name-record))
      (name-id (get name-id name-record))
      (expiry (get expiry-height name-record))
    )
    ;; Only current owner can transfer
    (asserts! (is-eq tx-sender current-owner) ERR_NOT_OWNER)
    
    ;; Cannot transfer to self
    (asserts! (not (is-eq current-owner new-owner)) ERR_TRANSFER_TO_SELF)
    
    ;; Name must not be expired
    (asserts! (<= block-height expiry) ERR_NAME_EXPIRED)
    
    ;; Update ownership in registry
    (map-set name-registry
      { label: label }
      (merge name-record { owner: new-owner })
    )
    
    ;; Update owner lists
    (try! (remove-name-from-owner current-owner name-id))
    (try! (add-name-to-owner new-owner name-id))
    
    ;; Emit transfer event
    (emit-name-transferred label current-owner new-owner)
    
    (ok true)
  )
)

;; ════════════════════════════════════════════════════════════════════════════
;; PUBLIC FUNCTIONS - RESOLVER
;; ════════════════════════════════════════════════════════════════════════════

;; Set a resolver contract for a name
(define-public (set-resolver (label (string-utf8 32)) (resolver principal))
  (let
    (
      ;; Get the existing name record
      (name-record (unwrap! (map-get? name-registry { label: label }) ERR_NAME_NOT_FOUND))
      (owner (get owner name-record))
      (expiry (get expiry-height name-record))
    )
    ;; Only owner can set resolver
    (asserts! (is-eq tx-sender owner) ERR_NOT_OWNER)
    
    ;; Name must not be expired
    (asserts! (<= block-height expiry) ERR_NAME_EXPIRED)
    
    ;; Update resolver in registry
    (map-set name-registry
      { label: label }
      (merge name-record { resolver: (some resolver) })
    )
    
    ;; Emit resolver set event
    (emit-resolver-set label owner resolver)
    
    (ok true)
  )
)

;; Clear the resolver for a name
(define-public (clear-resolver (label (string-utf8 32)))
  (let
    (
      ;; Get the existing name record
      (name-record (unwrap! (map-get? name-registry { label: label }) ERR_NAME_NOT_FOUND))
      (owner (get owner name-record))
    )
    ;; Only owner can clear resolver
    (asserts! (is-eq tx-sender owner) ERR_NOT_OWNER)
    
    ;; Update resolver in registry
    (map-set name-registry
      { label: label }
      (merge name-record { resolver: none })
    )
    
    (ok true)
  )
)

;; ════════════════════════════════════════════════════════════════════════════
;; PUBLIC FUNCTIONS - ADMIN
;; ════════════════════════════════════════════════════════════════════════════

;; Set a label as premium (admin only)
(define-public (set-premium-label (label (string-utf8 32)) (is-premium bool))
  (begin
    ;; Only admin can set premium labels
    (asserts! (is-eq tx-sender CONTRACT_DEPLOYER) ERR_NOT_ADMIN)
    
    ;; Set premium status
    (map-set premium-labels
      { label: label }
      { is-premium: is-premium }
    )
    
    (print {
      event: "PremiumLabelSet",
      label: label,
      is-premium: is-premium
    })
    
    (ok true)
  )
)

;; Update base registration fee (admin only)
(define-public (set-base-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_DEPLOYER) ERR_NOT_ADMIN)
    (asserts! (> new-fee u0) ERR_ZERO_FEE)
    (var-set base-fee new-fee)
    (emit-fee-config-updated new-fee (var-get renew-fee) (var-get premium-multiplier) (var-get fee-recipient))
    (ok true)
  )
)

;; Update renewal fee (admin only)
(define-public (set-renew-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_DEPLOYER) ERR_NOT_ADMIN)
    (asserts! (> new-fee u0) ERR_ZERO_FEE)
    (var-set renew-fee new-fee)
    (emit-fee-config-updated (var-get base-fee) new-fee (var-get premium-multiplier) (var-get fee-recipient))
    (ok true)
  )
)

;; Update premium multiplier (admin only)
(define-public (set-premium-multiplier (new-multiplier uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_DEPLOYER) ERR_NOT_ADMIN)
    (asserts! (> new-multiplier u0) ERR_ZERO_FEE)
    (var-set premium-multiplier new-multiplier)
    (emit-fee-config-updated (var-get base-fee) (var-get renew-fee) new-multiplier (var-get fee-recipient))
    (ok true)
  )
)

;; Update fee recipient (admin only)
(define-public (set-fee-recipient (new-recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_DEPLOYER) ERR_NOT_ADMIN)
    (var-set fee-recipient new-recipient)
    (emit-fee-config-updated (var-get base-fee) (var-get renew-fee) (var-get premium-multiplier) new-recipient)
    (ok true)
  )
)

;; Update protocol treasury (admin only)
(define-public (set-protocol-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_DEPLOYER) ERR_NOT_ADMIN)
    (var-set protocol-treasury new-treasury)
    (emit-treasury-updated new-treasury (var-get protocol-fee-percent))
    (ok true)
  )
)

;; Update protocol fee percentage (admin only)
(define-public (set-protocol-fee-percent (new-percent uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_DEPLOYER) ERR_NOT_ADMIN)
    (asserts! (<= new-percent u100) (err u1015))
    (var-set protocol-fee-percent new-percent)
    (emit-treasury-updated (var-get protocol-treasury) new-percent)
    (ok true)
  )
)

;; ════════════════════════════════════════════════════════════════════════════
;; READ-ONLY FUNCTIONS
;; ════════════════════════════════════════════════════════════════════════════

;; Get full name record for a label
(define-read-only (get-name (label (string-utf8 32)))
  (match (map-get? name-registry { label: label })
    name-record (some {
      label: label,
      full-name: (get full-name name-record),
      owner: (get owner name-record),
      expiry-height: (get expiry-height name-record),
      resolver: (get resolver name-record),
      is-premium: (get is-premium name-record),
      name-id: (get name-id name-record),
      created-at: (get created-at name-record),
      last-renewed: (get last-renewed name-record)
    })
    none
  )
)

;; Check if a name is available for registration
(define-read-only (is-available (label (string-utf8 32)))
  (match (map-get? name-registry { label: label })
    name-record (is-name-expired (get expiry-height name-record))
    true
  )
)

;; Get owner of a name
(define-read-only (get-owner (label (string-utf8 32)))
  (match (map-get? name-registry { label: label })
    name-record (some (get owner name-record))
    none
  )
)

;; Get expiry height of a name
(define-read-only (get-expiry (label (string-utf8 32)))
  (match (map-get? name-registry { label: label })
    name-record (some (get expiry-height name-record))
    none
  )
)

;; Check if a name is premium
(define-read-only (is-premium-name (label (string-utf8 32)))
  (check-is-premium label)
)

;; Get the resolver for a name
(define-read-only (get-resolver (label (string-utf8 32)))
  (match (map-get? name-registry { label: label })
    name-record (get resolver name-record)
    none
  )
)

;; Get current fee configuration
(define-read-only (get-fee-config)
  {
    base-fee: (var-get base-fee),
    renew-fee: (var-get renew-fee),
    premium-multiplier: (var-get premium-multiplier),
    fee-recipient: (var-get fee-recipient),
    protocol-treasury: (var-get protocol-treasury),
    protocol-fee-percent: (var-get protocol-fee-percent)
  }
)

;; Calculate registration fee for a specific label
(define-read-only (get-registration-fee (label (string-utf8 32)))
  (calculate-registration-fee (check-is-premium label))
)

;; Get all names owned by a principal
(define-read-only (get-names-by-owner (owner principal))
  (default-to { name-ids: (list) } (map-get? owner-names { owner: owner }))
)

;; Get label by name ID (reverse lookup)
(define-read-only (get-label-by-id (name-id uint))
  (match (map-get? name-id-to-label { name-id: name-id })
    entry (some (get label entry))
    none
  )
)

;; Check if a name is in grace period
(define-read-only (is-name-in-grace-period (label (string-utf8 32)))
  (match (map-get? name-registry { label: label })
    name-record (is-in-grace-period (get expiry-height name-record))
    false
  )
)

;; Check if a name is completely expired (past grace period)
(define-read-only (is-name-fully-expired (label (string-utf8 32)))
  (match (map-get? name-registry { label: label })
    name-record (is-name-expired (get expiry-height name-record))
    true
  )
)

;; Get total number of registered names
(define-read-only (get-total-names)
  (var-get name-id-counter)
)

;; Get total fees collected
(define-read-only (get-total-fees-collected)
  (var-get total-fees-collected)
)

;; Get registration period constant
(define-read-only (get-registration-period)
  REGISTRATION_PERIOD
)

;; Get grace period constant
(define-read-only (get-grace-period)
  GRACE_PERIOD
)

;; Get contract admin
(define-read-only (get-admin)
  CONTRACT_DEPLOYER
)

;; Check if caller is admin
(define-read-only (is-admin (caller principal))
  (is-eq caller CONTRACT_DEPLOYER)
)

;; ════════════════════════════════════════════════════════════════════════════
;; RESOLUTION FUNCTION
;; ════════════════════════════════════════════════════════════════════════════

;; Resolve a name using its configured resolver contract
;; Note: This is a public function because it needs to call another contract
(define-public (resolve-name (label (string-utf8 32)) (resolver-contract <resolver-trait>))
  (let
    (
      (name-record (unwrap! (map-get? name-registry { label: label }) ERR_NAME_NOT_FOUND))
      (stored-resolver (get resolver name-record))
      (owner (get owner name-record))
    )
    ;; Verify the resolver contract matches what's stored
    (asserts! (is-some stored-resolver) ERR_RESOLVER_INVALID)
    (asserts! (is-eq (some (contract-of resolver-contract)) stored-resolver) ERR_RESOLVER_INVALID)
    
    ;; Call the resolver contract
    (contract-call? resolver-contract resolve label owner)
  )
)
