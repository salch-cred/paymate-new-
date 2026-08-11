import { expect } from "chai";
import { network } from "hardhat";

// Hardhat 3 pattern: each test file creates its own network connection
// and uses networkHelpers.loadFixture for snapshot-based setup.
const { ethers, networkHelpers } = await network.create();
const { loadFixture } = networkHelpers;

describe("YieldEscrow", function () {
  async function deployEscrowFixture() {
    const [owner, client, freelancer, attacker] = await ethers.getSigners();

    const TestUSDC = await ethers.getContractFactory("TestUSDC");
    const usdc = await TestUSDC.deploy(1_000_000_000n * 10n ** 6n);

    // Fund the client with USDC for escrow deposits
    await usdc.transfer(client.address, 100_000n * 10n ** 6n);

    const YieldEscrow = await ethers.getContractFactory("YieldEscrow");
    const escrow = await YieldEscrow.deploy(await usdc.getAddress());

    return { escrow, usdc, owner, client, freelancer, attacker };
  }

  const INVOICE = "inv-escrow-123";
  const AMOUNT = 2_480n * 10n ** 6n; // $2,480 USDC

  async function fundEscrowAsClient(escrow: any, usdc: any, client: any, invoiceId: string, amount: bigint) {
    // Client transfers USDC directly to the escrow contract, then the backend confirms
    await usdc.connect(client).transfer(await escrow.getAddress(), amount);
    await escrow.confirmFunded(invoiceId, amount);
  }

  it("registers an invoice (owner only) and funds it via client transfer + backend confirm", async function () {
    const { escrow, usdc, client, freelancer } = await loadFixture(deployEscrowFixture);

    await expect(escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0))
      .to.emit(escrow, "InvoiceRegistered")
      .withArgs(INVOICE, client.address, freelancer.address, 0);

    await usdc.connect(client).transfer(await escrow.getAddress(), AMOUNT);
    await expect(escrow.confirmFunded(INVOICE, AMOUNT))
      .to.emit(escrow, "EscrowFunded")
      .withArgs(INVOICE, client.address, AMOUNT);

    const state = await escrow.getEscrow(INVOICE);
    expect(state.client).to.equal(client.address);
    expect(state.freelancer).to.equal(freelancer.address);
    expect(state.principalAmount).to.equal(AMOUNT);
    expect(state.funded).to.equal(true);
  });

  it("rejects invoice squatting: a second registration reverts", async function () {
    const { escrow, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await expect(
      escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0)
    ).to.be.revertedWith("Already registered");
  });

  it("only the owner can register, confirm, and resolve", async function () {
    const { escrow, client, freelancer, attacker } = await loadFixture(deployEscrowFixture);

    await expect(
      escrow.connect(attacker).registerInvoice(INVOICE, client.address, freelancer.address, 0)
    ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");

    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await expect(escrow.connect(attacker).confirmFunded(INVOICE, AMOUNT))
      .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    await expect(escrow.connect(attacker).resolveEscrow(INVOICE))
      .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    await expect(escrow.connect(attacker).resolveDispute(INVOICE, 0))
      .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
  });

  it("cannot confirm funds that never arrived at the contract", async function () {
    const { escrow, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    // No transfer made
    await expect(escrow.confirmFunded(INVOICE, AMOUNT))
      .to.be.revertedWith("Escrow has not received the funds");
  });

  it("cannot double-fund an escrow", async function () {
    const { escrow, usdc, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await fundEscrowAsClient(escrow, usdc, client, INVOICE, AMOUNT);
    await expect(escrow.confirmFunded(INVOICE, AMOUNT))
      .to.be.revertedWith("Already funded");
  });

  it("resolves to the freelancer after maturity", async function () {
    const { escrow, usdc, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await fundEscrowAsClient(escrow, usdc, client, INVOICE, AMOUNT);

    const before = await usdc.balanceOf(freelancer.address);
    await expect(escrow.resolveEscrow(INVOICE))
      .to.emit(escrow, "EscrowResolved")
      .withArgs(INVOICE, freelancer.address, AMOUNT);

    expect(await usdc.balanceOf(freelancer.address)).to.equal(before + AMOUNT);
    const state = await escrow.getEscrow(INVOICE);
    expect(state.isResolved).to.equal(true);
  });

  it("dispute verdict PAY_FREELANCER moves the full principal to the freelancer", async function () {
    const { escrow, usdc, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await fundEscrowAsClient(escrow, usdc, client, INVOICE, AMOUNT);

    const before = await usdc.balanceOf(freelancer.address);
    await escrow.resolveDispute(INVOICE, 0); // PAY_FREELANCER
    expect(await usdc.balanceOf(freelancer.address)).to.equal(before + AMOUNT);
  });

  it("dispute verdict REFUND_CLIENT returns the full principal to the client", async function () {
    const { escrow, usdc, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await fundEscrowAsClient(escrow, usdc, client, INVOICE, AMOUNT);

    const before = await usdc.balanceOf(client.address);
    await escrow.resolveDispute(INVOICE, 1); // REFUND_CLIENT
    expect(await usdc.balanceOf(client.address)).to.equal(before + AMOUNT);
  });

  it("dispute verdict SPLIT_50_50 moves half to each party", async function () {
    const { escrow, usdc, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await fundEscrowAsClient(escrow, usdc, client, INVOICE, AMOUNT);

    const clientBefore = await usdc.balanceOf(client.address);
    const flBefore = await usdc.balanceOf(freelancer.address);

    await escrow.resolveDispute(INVOICE, 2); // SPLIT_50_50

    const half = AMOUNT / 2n;
    expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + (AMOUNT - half));
    expect(await usdc.balanceOf(freelancer.address)).to.equal(flBefore + half);
    expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0n);
  });

  it("cannot resolve twice (resolveEscrow or resolveDispute double-spend guard)", async function () {
    const { escrow, usdc, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await fundEscrowAsClient(escrow, usdc, client, INVOICE, AMOUNT);

    await escrow.resolveDispute(INVOICE, 0);
    await expect(escrow.resolveEscrow(INVOICE)).to.be.revertedWith("Already resolved");
    await expect(escrow.resolveDispute(INVOICE, 1)).to.be.revertedWith("Already resolved");
  });

  it("cannot resolve an unfunded escrow", async function () {
    const { escrow, client, freelancer } = await loadFixture(deployEscrowFixture);
    await escrow.registerInvoice(INVOICE, client.address, freelancer.address, 0);
    await expect(escrow.resolveEscrow(INVOICE)).to.be.revertedWith("Not funded");
    await expect(escrow.resolveDispute(INVOICE, 0)).to.be.revertedWith("Not funded");
  });
});
