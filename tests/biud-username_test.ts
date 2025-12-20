/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BiUD — Bitcoin Username Domain (.sBTC) Test Suite                       ║
 * ║  Comprehensive tests for the BiUD username registrar contract            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

// Test accounts from simnet
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const contractName = "biud-username";

// Helper to extract response values
function getResponseOk(result: any) {
  if (result.result.type === ClarityType.ResponseOk) {
    return result.result.value;
  }
  throw new Error(`Expected ResponseOk, got ${result.result.type}`);
}

function getResponseErr(result: any) {
  if (result.result.type === ClarityType.ResponseErr) {
    return result.result.value;
  }
  throw new Error(`Expected ResponseErr, got ${result.result.type}`);
}

// ════════════════════════════════════════════════════════════════════════════
// NAME REGISTRATION TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Name Registration", () => {
  it("should register a standard name successfully", () => {
    const label = "alice";
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.tuple({
      "name-id": Cl.uint(1),
      "full-name": Cl.stringUtf8("alice.sBTC"),
      "expiry-height": Cl.uint(simnet.blockHeight + 52560),
      "fee-paid": Cl.uint(10000000)
    }));
    
    // Verify the name was registered
    const nameInfo = simnet.callReadOnlyFn(
      contractName,
      "get-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    expect(nameInfo.result).toBeSome(Cl.tuple({
      "label": Cl.stringUtf8("alice"),
      "full-name": Cl.stringUtf8("alice.sBTC"),
      "owner": Cl.principal(wallet1),
      "expiry-height": Cl.uint(simnet.blockHeight + 52559), // Block advanced after registration
      "resolver": Cl.none(),
      "is-premium": Cl.bool(false),
      "name-id": Cl.uint(1),
      "created-at": Cl.uint(simnet.blockHeight - 1),
      "last-renewed": Cl.uint(simnet.blockHeight - 1)
    }));
  });

  it("should register a premium name with higher fee", () => {
    const label = "sat"; // 3 characters = premium
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    
    // Premium fee = base fee * multiplier = 10 STX * 5 = 50 STX
    expect(result.result).toBeOk(Cl.tuple({
      "name-id": Cl.uint(1),
      "full-name": Cl.stringUtf8("sat.sBTC"),
      "expiry-height": Cl.uint(simnet.blockHeight + 52560),
      "fee-paid": Cl.uint(50000000)
    }));
  });

  it("should register a 1-character premium name", () => {
    const label = "x";
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.tuple({
      "name-id": Cl.uint(1),
      "full-name": Cl.stringUtf8("x.sBTC"),
      "expiry-height": Cl.uint(simnet.blockHeight + 52560),
      "fee-paid": Cl.uint(50000000)
    }));
  });

  it("should register names with numbers and hyphens", () => {
    const label = "my-name-123";
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.tuple({
      "name-id": Cl.uint(1),
      "full-name": Cl.stringUtf8("my-name-123.sBTC"),
      "expiry-height": Cl.uint(simnet.blockHeight + 52560),
      "fee-paid": Cl.uint(10000000)
    }));
  });

  it("should prevent duplicate name registration", () => {
    const label = "alice";
    
    // First registration should succeed
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Second registration should fail
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(label)],
      wallet2
    );
    
    expect(result.result).toBeErr(Cl.uint(1001)); // ERR_NAME_TAKEN
  });

  it("should check name availability correctly", () => {
    const label = "newname";
    
    // Should be available initially
    let available = simnet.callReadOnlyFn(
      contractName,
      "is-available",
      [Cl.stringUtf8(label)],
      wallet1
    );
    expect(available.result).toBeBool(true);
    
    // Register the name
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Should not be available after registration
    available = simnet.callReadOnlyFn(
      contractName,
      "is-available",
      [Cl.stringUtf8(label)],
      wallet1
    );
    expect(available.result).toBeBool(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PREMIUM NAME TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Premium Name Logic", () => {
  it("should identify premium names by length", () => {
    // 4 characters or less = premium
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8("a")], wallet1).result
    ).toBeBool(true);
    
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8("ab")], wallet1).result
    ).toBeBool(true);
    
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8("abc")], wallet1).result
    ).toBeBool(true);
    
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8("abcd")], wallet1).result
    ).toBeBool(true);
    
    // 5+ characters = not premium
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8("abcde")], wallet1).result
    ).toBeBool(false);
  });

  it("should allow admin to set premium labels", () => {
    const label = "mybrand";
    
    // Initially not premium
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8(label)], wallet1).result
    ).toBeBool(false);
    
    // Admin sets it as premium
    const result = simnet.callPublicFn(
      contractName,
      "set-premium-label",
      [Cl.stringUtf8(label), Cl.bool(true)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    // Now it's premium
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8(label)], wallet1).result
    ).toBeBool(true);
  });

  it("should prevent non-admin from setting premium labels", () => {
    const result = simnet.callPublicFn(
      contractName,
      "set-premium-label",
      [Cl.stringUtf8("test"), Cl.bool(true)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1004)); // ERR_NOT_ADMIN
  });

  it("should calculate correct registration fee", () => {
    // Standard name (5+ chars)
    expect(
      simnet.callReadOnlyFn(
        contractName,
        "get-registration-fee",
        [Cl.stringUtf8("alice")],
        wallet1
      ).result
    ).toBeUint(10000000);
    
    // Premium name (4 or less chars)
    expect(
      simnet.callReadOnlyFn(
        contractName,
        "get-registration-fee",
        [Cl.stringUtf8("sat")],
        wallet1
      ).result
    ).toBeUint(50000000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RENEWAL TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Name Renewal", () => {
  it("should renew a name successfully", () => {
    const label = "alice";
    
    // Register first
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Get initial expiry
    const initialExpiry = simnet.callReadOnlyFn(
      contractName,
      "get-expiry",
      [Cl.stringUtf8(label)],
      wallet1
    );
    
    // Renew
    const result = simnet.callPublicFn(
      contractName,
      "renew-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.tuple({
      "new-expiry-height": Cl.uint(simnet.blockHeight + 52560 + 52559), // Original expiry + period
      "fee-paid": Cl.uint(5000000)
    }));
  });

  it("should fail to renew non-existent name", () => {
    const result = simnet.callPublicFn(
      contractName,
      "renew-name",
      [Cl.stringUtf8("doesnotexist")],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1009)); // ERR_NAME_NOT_FOUND
  });

  it("should allow gift renewal by non-owner", () => {
    const label = "alice";
    
    // Register by wallet1
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Renew by wallet2 (gift)
    const result = simnet.callPublicFn(
      contractName,
      "renew-name",
      [Cl.stringUtf8(label)],
      wallet2
    );
    
    expect(result.result).toBeOk(Cl.tuple({
      "new-expiry-height": Cl.uint(simnet.blockHeight + 52560 + 52559),
      "fee-paid": Cl.uint(5000000)
    }));
    
    // Owner should still be wallet1
    expect(
      simnet.callReadOnlyFn(contractName, "get-owner", [Cl.stringUtf8(label)], wallet1).result
    ).toBeSome(Cl.principal(wallet1));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TRANSFER TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Name Transfer", () => {
  it("should transfer name ownership", () => {
    const label = "alice";
    
    // Register
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Transfer to wallet2
    const result = simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8(label), Cl.principal(wallet2)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    // Verify new owner
    expect(
      simnet.callReadOnlyFn(contractName, "get-owner", [Cl.stringUtf8(label)], wallet1).result
    ).toBeSome(Cl.principal(wallet2));
  });

  it("should prevent non-owner from transferring", () => {
    const label = "alice";
    
    // Register by wallet1
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Try to transfer by wallet2 (not owner)
    const result = simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8(label), Cl.principal(wallet3)],
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(1003)); // ERR_NOT_OWNER
  });

  it("should prevent transfer to self", () => {
    const label = "alice";
    
    // Register
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Try to transfer to self
    const result = simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8(label), Cl.principal(wallet1)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1013)); // ERR_TRANSFER_TO_SELF
  });

  it("should fail to transfer non-existent name", () => {
    const result = simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8("doesnotexist"), Cl.principal(wallet2)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1009)); // ERR_NAME_NOT_FOUND
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RESOLVER TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Resolver Management", () => {
  it("should set resolver for a name", () => {
    const label = "alice";
    const resolverAddress = wallet3; // In real usage, this would be a contract
    
    // Register
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Set resolver
    const result = simnet.callPublicFn(
      contractName,
      "set-resolver",
      [Cl.stringUtf8(label), Cl.principal(resolverAddress)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    // Verify resolver is set
    expect(
      simnet.callReadOnlyFn(contractName, "get-resolver", [Cl.stringUtf8(label)], wallet1).result
    ).toBeSome(Cl.principal(resolverAddress));
  });

  it("should clear resolver", () => {
    const label = "alice";
    
    // Register and set resolver
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    simnet.callPublicFn(
      contractName,
      "set-resolver",
      [Cl.stringUtf8(label), Cl.principal(wallet3)],
      wallet1
    );
    
    // Clear resolver
    const result = simnet.callPublicFn(
      contractName,
      "clear-resolver",
      [Cl.stringUtf8(label)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    // Verify resolver is cleared
    expect(
      simnet.callReadOnlyFn(contractName, "get-resolver", [Cl.stringUtf8(label)], wallet1).result
    ).toBeNone();
  });

  it("should prevent non-owner from setting resolver", () => {
    const label = "alice";
    
    // Register by wallet1
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Try to set resolver by wallet2
    const result = simnet.callPublicFn(
      contractName,
      "set-resolver",
      [Cl.stringUtf8(label), Cl.principal(wallet3)],
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(1003)); // ERR_NOT_OWNER
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FEE DISTRIBUTION TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Fee Distribution", () => {
  it("should track total fees collected", () => {
    // Initial fees should be 0
    expect(
      simnet.callReadOnlyFn(contractName, "get-total-fees-collected", [], wallet1).result
    ).toBeUint(0);
    
    // Register a name
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    // Fees should be 10 STX
    expect(
      simnet.callReadOnlyFn(contractName, "get-total-fees-collected", [], wallet1).result
    ).toBeUint(10000000);
    
    // Register a premium name
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("btc")], wallet2);
    
    // Fees should be 10 + 50 = 60 STX
    expect(
      simnet.callReadOnlyFn(contractName, "get-total-fees-collected", [], wallet1).result
    ).toBeUint(60000000);
  });

  it("should return correct fee configuration", () => {
    const config = simnet.callReadOnlyFn(
      contractName,
      "get-fee-config",
      [],
      wallet1
    );
    
    expect(config.result).toBeTuple({
      "base-fee": Cl.uint(10000000),
      "renew-fee": Cl.uint(5000000),
      "premium-multiplier": Cl.uint(5),
      "fee-recipient": Cl.principal(deployer),
      "protocol-treasury": Cl.principal(deployer),
      "protocol-fee-percent": Cl.uint(10)
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN FUNCTION TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Admin Functions", () => {
  it("should update base fee (admin only)", () => {
    const result = simnet.callPublicFn(
      contractName,
      "set-base-fee",
      [Cl.uint(20000000)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    // Verify update
    const config = simnet.callReadOnlyFn(contractName, "get-fee-config", [], wallet1);
    expect((config.result as any).data["base-fee"]).toBeUint(20000000);
  });

  it("should update renewal fee (admin only)", () => {
    const result = simnet.callPublicFn(
      contractName,
      "set-renew-fee",
      [Cl.uint(7000000)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    const config = simnet.callReadOnlyFn(contractName, "get-fee-config", [], wallet1);
    expect((config.result as any).data["renew-fee"]).toBeUint(7000000);
  });

  it("should update premium multiplier (admin only)", () => {
    const result = simnet.callPublicFn(
      contractName,
      "set-premium-multiplier",
      [Cl.uint(10)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    const config = simnet.callReadOnlyFn(contractName, "get-fee-config", [], wallet1);
    expect((config.result as any).data["premium-multiplier"]).toBeUint(10);
  });

  it("should update fee recipient (admin only)", () => {
    const result = simnet.callPublicFn(
      contractName,
      "set-fee-recipient",
      [Cl.principal(wallet3)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    const config = simnet.callReadOnlyFn(contractName, "get-fee-config", [], wallet1);
    expect((config.result as any).data["fee-recipient"]).toBePrincipal(wallet3);
  });

  it("should update protocol treasury (admin only)", () => {
    const result = simnet.callPublicFn(
      contractName,
      "set-protocol-treasury",
      [Cl.principal(wallet3)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    const config = simnet.callReadOnlyFn(contractName, "get-fee-config", [], wallet1);
    expect((config.result as any).data["protocol-treasury"]).toBePrincipal(wallet3);
  });

  it("should update protocol fee percent (admin only)", () => {
    const result = simnet.callPublicFn(
      contractName,
      "set-protocol-fee-percent",
      [Cl.uint(20)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    
    const config = simnet.callReadOnlyFn(contractName, "get-fee-config", [], wallet1);
    expect((config.result as any).data["protocol-fee-percent"]).toBeUint(20);
  });

  it("should prevent non-admin from updating fees", () => {
    expect(
      simnet.callPublicFn(contractName, "set-base-fee", [Cl.uint(1)], wallet1).result
    ).toBeErr(Cl.uint(1004));
    
    expect(
      simnet.callPublicFn(contractName, "set-renew-fee", [Cl.uint(1)], wallet1).result
    ).toBeErr(Cl.uint(1004));
    
    expect(
      simnet.callPublicFn(contractName, "set-premium-multiplier", [Cl.uint(1)], wallet1).result
    ).toBeErr(Cl.uint(1004));
    
    expect(
      simnet.callPublicFn(contractName, "set-fee-recipient", [Cl.principal(wallet2)], wallet1).result
    ).toBeErr(Cl.uint(1004));
  });

  it("should identify admin correctly", () => {
    expect(
      simnet.callReadOnlyFn(contractName, "is-admin", [Cl.principal(deployer)], wallet1).result
    ).toBeBool(true);
    
    expect(
      simnet.callReadOnlyFn(contractName, "is-admin", [Cl.principal(wallet1)], wallet1).result
    ).toBeBool(false);
  });

  it("should return correct admin address", () => {
    expect(
      simnet.callReadOnlyFn(contractName, "get-admin", [], wallet1).result
    ).toBePrincipal(deployer);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// READ-ONLY QUERY TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Read-Only Queries", () => {
  it("should return none for non-existent names", () => {
    expect(
      simnet.callReadOnlyFn(contractName, "get-name", [Cl.stringUtf8("doesnotexist")], wallet1).result
    ).toBeNone();
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-owner", [Cl.stringUtf8("doesnotexist")], wallet1).result
    ).toBeNone();
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-expiry", [Cl.stringUtf8("doesnotexist")], wallet1).result
    ).toBeNone();
  });

  it("should track owner's names", () => {
    // Register multiple names
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("bob")], wallet1);
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("carol")], wallet2);
    
    // Check wallet1's names
    const wallet1Names = simnet.callReadOnlyFn(
      contractName,
      "get-names-by-owner",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect((wallet1Names.result as any).data["name-ids"].list.length).toBe(2);
    
    // Check wallet2's names
    const wallet2Names = simnet.callReadOnlyFn(
      contractName,
      "get-names-by-owner",
      [Cl.principal(wallet2)],
      wallet2
    );
    expect((wallet2Names.result as any).data["name-ids"].list.length).toBe(1);
  });

  it("should return correct reverse lookup", () => {
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-label-by-id", [Cl.uint(1)], wallet1).result
    ).toBeSome(Cl.stringUtf8("alice"));
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-label-by-id", [Cl.uint(999)], wallet1).result
    ).toBeNone();
  });

  it("should return correct total names count", () => {
    expect(
      simnet.callReadOnlyFn(contractName, "get-total-names", [], wallet1).result
    ).toBeUint(0);
    
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("bob")], wallet2);
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-total-names", [], wallet1).result
    ).toBeUint(2);
  });

  it("should return correct registration and grace periods", () => {
    expect(
      simnet.callReadOnlyFn(contractName, "get-registration-period", [], wallet1).result
    ).toBeUint(52560);
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-grace-period", [], wallet1).result
    ).toBeUint(1008);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EXPIRY AND GRACE PERIOD TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Expiry and Grace Period", () => {
  it("should detect names in grace period", () => {
    const label = "alice";
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8(label)], wallet1);
    
    // Initially not in grace period
    expect(
      simnet.callReadOnlyFn(contractName, "is-name-in-grace-period", [Cl.stringUtf8(label)], wallet1).result
    ).toBeBool(false);
    
    // Not fully expired
    expect(
      simnet.callReadOnlyFn(contractName, "is-name-fully-expired", [Cl.stringUtf8(label)], wallet1).result
    ).toBeBool(false);
  });

  it("should show availability correctly for non-existent names", () => {
    expect(
      simnet.callReadOnlyFn(contractName, "is-available", [Cl.stringUtf8("newname")], wallet1).result
    ).toBeBool(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EVENT EMISSION TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Event Emissions", () => {
  it("should emit NameRegistered event on registration", () => {
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8("alice")],
      wallet1
    );
    
    // Check events were emitted (events are in result.events)
    expect(result.events.length).toBeGreaterThan(0);
    
    // Find the print event
    const printEvents = result.events.filter((e: any) => e.event === "print_event");
    expect(printEvents.length).toBeGreaterThan(0);
  });

  it("should emit NameTransferred event on transfer", () => {
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    const result = simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8("alice"), Cl.principal(wallet2)],
      wallet1
    );
    
    const printEvents = result.events.filter((e: any) => e.event === "print_event");
    expect(printEvents.length).toBeGreaterThan(0);
  });

  it("should emit NameRenewed event on renewal", () => {
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    const result = simnet.callPublicFn(
      contractName,
      "renew-name",
      [Cl.stringUtf8("alice")],
      wallet1
    );
    
    const printEvents = result.events.filter((e: any) => e.event === "print_event");
    expect(printEvents.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SUBDOMAIN TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Subdomain Support", () => {
  it("should register a subdomain successfully", () => {
    // Register parent
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    // Register subdomain
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8("sub.alice")],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.tuple({
      "name-id": Cl.uint(2),
      "full-name": Cl.stringUtf8("sub.alice.sBTC"),
      "expiry-height": Cl.uint(simnet.blockHeight + 52560),
      "fee-paid": Cl.uint(10000000)  // Same fee, not premium
    }));
  });

  it("should fail to register subdomain if parent not owned", () => {
    // Register parent by wallet1
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    // Try to register subdomain by wallet2
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8("sub.alice")],
      wallet2
    );
    
    expect(result.result).toBeErr(Cl.uint(1003)); // ERR_NOT_OWNER
  });

  it("should treat subdomain as non-premium", () => {
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    // Check premium status
    expect(
      simnet.callReadOnlyFn(contractName, "is-premium-name", [Cl.stringUtf8("sub.alice")], wallet1).result
    ).toBeBool(false);  // Longer than 4 chars
  });

  it("should allow renewal of subdomain", () => {
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("sub.alice")], wallet1);
    
    const result = simnet.callPublicFn(
      contractName,
      "renew-name",
      [Cl.stringUtf8("sub.alice")],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.tuple({
      "new-expiry-height": Cl.uint(simnet.blockHeight + 52560 + 52559),
      "fee-paid": Cl.uint(5000000)
    }));
  });

  it("should allow transfer of subdomain", () => {
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("sub.alice")], wallet1);
    
    const result = simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8("sub.alice"), Cl.principal(wallet2)],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.bool(true));
    
    // Verify owner changed
    expect(
      simnet.callReadOnlyFn(contractName, "get-owner", [Cl.stringUtf8("sub.alice")], wallet1).result
    ).toBeSome(Cl.principal(wallet2));
  });

  it("should validate subdomain format", () => {
    // Invalid: empty subdomain
    let result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(".alice")],  // starts with dot
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1005)); // ERR_INVALID_LABEL
    
    // Invalid: empty parent
    result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8("sub.")],  // ends with dot
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1005));
    
    // Valid format but parent doesn't exist
    result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8("sub.nonexistent")],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1009)); // ERR_NAME_NOT_FOUND
  });
});

// ════════════════════════════════════════════════════════════════════════════
// BULK REGISTRATION TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Bulk Registration", () => {
  it("should register multiple names successfully", () => {
    const labels = ["bulk1", "bulk2", "bulk3"];
    const result = simnet.callPublicFn(
      contractName,
      "register-multiple-names",
      [Cl.list(labels.map(l => Cl.stringUtf8(l)))],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.list([
      Cl.tuple({
        "name-id": Cl.uint(1),
        "full-name": Cl.stringUtf8("bulk1.sBTC"),
        "expiry-height": Cl.uint(simnet.blockHeight + 52560),
        "fee-paid": Cl.uint(10000000)
      }),
      Cl.tuple({
        "name-id": Cl.uint(2),
        "full-name": Cl.stringUtf8("bulk2.sBTC"),
        "expiry-height": Cl.uint(simnet.blockHeight + 52560),
        "fee-paid": Cl.uint(10000000)
      }),
      Cl.tuple({
        "name-id": Cl.uint(3),
        "full-name": Cl.stringUtf8("bulk3.sBTC"),
        "expiry-height": Cl.uint(simnet.blockHeight + 52560),
        "fee-paid": Cl.uint(10000000)
      })
    ]));
  });

  it("should handle mixed successful and failed registrations", () => {
    // Register one name first
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("exists")], wallet1);
    
    const labels = ["newname", "exists", "another"];
    const result = simnet.callPublicFn(
      contractName,
      "register-multiple-names",
      [Cl.list(labels.map(l => Cl.stringUtf8(l)))],
      wallet1
    );
    
    // The result should contain mixed ok/err
    expect(result.result).toBeOk(Cl.list([
      Cl.tuple({ // newname succeeds
        "name-id": Cl.uint(2),
        "full-name": Cl.stringUtf8("newname.sBTC"),
        "expiry-height": Cl.uint(simnet.blockHeight + 52560),
        "fee-paid": Cl.uint(10000000)
      }),
      Cl.uint(1001), // exists fails with ERR_NAME_TAKEN
      Cl.tuple({ // another succeeds
        "name-id": Cl.uint(3),
        "full-name": Cl.stringUtf8("another.sBTC"),
        "expiry-height": Cl.uint(simnet.blockHeight + 52560),
        "fee-paid": Cl.uint(10000000)
      })
    ]));
  });

  it("should handle empty list", () => {
    const result = simnet.callPublicFn(
      contractName,
      "register-multiple-names",
      [Cl.list([])],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.list([]));
  });

  it("should register subdomains in bulk", () => {
    // Register parent
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("parent")], wallet1);
    
    const labels = ["sub1.parent", "sub2.parent"];
    const result = simnet.callPublicFn(
      contractName,
      "register-multiple-names",
      [Cl.list(labels.map(l => Cl.stringUtf8(l)))],
      wallet1
    );
    
    expect(result.result).toBeOk(Cl.list([
      Cl.tuple({
        "name-id": Cl.uint(2),
        "full-name": Cl.stringUtf8("sub1.parent.sBTC"),
        "expiry-height": Cl.uint(simnet.blockHeight + 52560),
        "fee-paid": Cl.uint(10000000)
      }),
      Cl.tuple({
        "name-id": Cl.uint(3),
        "full-name": Cl.stringUtf8("sub2.parent.sBTC"),
        "expiry-height": Cl.uint(simnet.blockHeight + 52560),
        "fee-paid": Cl.uint(10000000)
      })
    ]));
  });

  it("should fail bulk subdomain registration without parent ownership", () => {
    // Register parent by wallet1
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("parent")], wallet1);
    
    // Try to register subdomains by wallet2
    const labels = ["sub.parent"];
    const result = simnet.callPublicFn(
      contractName,
      "register-multiple-names",
      [Cl.list(labels.map(l => Cl.stringUtf8(l)))],
      wallet2
    );
    
    expect(result.result).toBeOk(Cl.list([
      Cl.uint(1003) // ERR_NOT_OWNER
    ]));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EDGE CASE TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Edge Cases", () => {
  it("should handle maximum length label (32 chars)", () => {
    const label = "abcdefghijklmnopqrstuvwxyz123456"; // 32 characters
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    
    expect(result.result.type).toBe(ClarityType.ResponseOk);
  });

  it("should handle single character label", () => {
    const result = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8("a")],
      wallet1
    );
    
    expect(result.result.type).toBe(ClarityType.ResponseOk);
  });

  it("should update owner list correctly after transfer", () => {
    // Register by wallet1
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    
    // Transfer to wallet2
    simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8("alice"), Cl.principal(wallet2)],
      wallet1
    );
    
    // wallet1's list should be empty
    const wallet1Names = simnet.callReadOnlyFn(
      contractName,
      "get-names-by-owner",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect((wallet1Names.result as any).data["name-ids"].list.length).toBe(0);
    
    // wallet2's list should have 1 name
    const wallet2Names = simnet.callReadOnlyFn(
      contractName,
      "get-names-by-owner",
      [Cl.principal(wallet2)],
      wallet2
    );
    expect((wallet2Names.result as any).data["name-ids"].list.length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Integration Scenarios", () => {
  it("should handle complete name lifecycle", () => {
    const label = "alice";
    
    // 1. Check availability
    expect(
      simnet.callReadOnlyFn(contractName, "is-available", [Cl.stringUtf8(label)], wallet1).result
    ).toBeBool(true);
    
    // 2. Register
    const regResult = simnet.callPublicFn(
      contractName,
      "register-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    expect(regResult.result.type).toBe(ClarityType.ResponseOk);
    
    // 3. Set resolver
    simnet.callPublicFn(
      contractName,
      "set-resolver",
      [Cl.stringUtf8(label), Cl.principal(wallet3)],
      wallet1
    );
    
    // 4. Renew
    simnet.callPublicFn(contractName, "renew-name", [Cl.stringUtf8(label)], wallet1);
    
    // 5. Transfer
    simnet.callPublicFn(
      contractName,
      "transfer-name",
      [Cl.stringUtf8(label), Cl.principal(wallet2)],
      wallet1
    );
    
    // Verify final state
    const nameInfo = simnet.callReadOnlyFn(
      contractName,
      "get-name",
      [Cl.stringUtf8(label)],
      wallet1
    );
    expect((nameInfo.result as any).value.data.owner).toBePrincipal(wallet2);
  });

  it("should handle multiple users registering different names", () => {
    // Multiple users register names
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("alice")], wallet1);
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("bob")], wallet2);
    simnet.callPublicFn(contractName, "register-name", [Cl.stringUtf8("carol")], wallet3);
    
    // Verify each owner
    expect(
      simnet.callReadOnlyFn(contractName, "get-owner", [Cl.stringUtf8("alice")], wallet1).result
    ).toBeSome(Cl.principal(wallet1));
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-owner", [Cl.stringUtf8("bob")], wallet1).result
    ).toBeSome(Cl.principal(wallet2));
    
    expect(
      simnet.callReadOnlyFn(contractName, "get-owner", [Cl.stringUtf8("carol")], wallet1).result
    ).toBeSome(Cl.principal(wallet3));
    
    // Verify total count
    expect(
      simnet.callReadOnlyFn(contractName, "get-total-names", [], wallet1).result
    ).toBeUint(3);
  });
});
