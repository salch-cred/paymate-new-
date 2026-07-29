// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YieldEscrow
 * @dev An escrow contract that stakes deposited USDC into a GOAT Network yield protocol
 * while the invoice is pending (e.g. Net-30). Upon resolution, the principal is paid
 * to the freelancer, and any REAL yield actually returned by the router is split
 * 50/50 between client and freelancer.
 *
 * SECURITY FIXES (2026-07-29 audit, findings C-3):
 *  1. Removed the fabricated "simulate a 5% yield" logic. The previous version
 *     unconditionally paid out 105% of every deposited principal with no real
 *     yield source, which is structurally insolvent — it can only work by
 *     spending other clients' deposited principal, and will eventually make
 *     resolveEscrow() revert (or worse) once volume increases.
 *  2. Replaced `safeApprove` (which OpenZeppelin deprecated specifically
 *     because it reverts on a non-zero -> non-zero allowance change) with the
 *     zero-then-set pattern, so a second fundEscrow() call no longer reverts.
 *  3. fundEscrow() now requires the caller to pre-register as the expected
 *     client for that invoiceId (via registerInvoice, restricted to the
 *     contract owner / trusted backend), closing the invoiceId-squatting /
 *     front-running griefing vector.
 *  4. resolveEscrow() now requires a real maturity timestamp to have passed,
 *     rather than being callable by the owner at an arbitrary time.
 *  5. Yield payout is capped by the contract's *actual* token balance, so it
 *     can never promise more than it has, even if a future integration bug
 *     reintroduces bad accounting.
 */
contract YieldEscrow is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public usdcToken;
    // Dummy GOAT Yield router placeholder — wire up a real integration before
    // using this in production. Until then, no funds are approved/staked.
    address public goatYieldRouter = 0x0000000000000000000000000000000000000001;

    struct InvoiceEscrow {
        address client;
        address freelancer;
        uint256 principalAmount;
        uint256 maturesAt;
        bool funded;
        bool isResolved;
    }

    mapping(string => InvoiceEscrow) public escrows;

    event InvoiceRegistered(string invoiceId, address client, address freelancer, uint256 maturesAt);
    event EscrowFunded(string invoiceId, address client, uint256 amount);
    event EscrowResolved(string invoiceId, address freelancer, uint256 principal, uint256 yieldSplit);

    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
    }

    /// @notice Trusted backend registers the expected parties for an invoice
    /// BEFORE the client funds it, so an attacker cannot squat an invoiceId.
    function registerInvoice(string memory invoiceId, address client, address freelancer, uint256 maturesAt) external onlyOwner {
        require(escrows[invoiceId].client == address(0), "Already registered");
        require(client != address(0) && freelancer != address(0), "Invalid parties");
        escrows[invoiceId] = InvoiceEscrow({
            client: client,
            freelancer: freelancer,
            principalAmount: 0,
            maturesAt: maturesAt,
            funded: false,
            isResolved: false
        });
        emit InvoiceRegistered(invoiceId, client, freelancer, maturesAt);
    }

    function fundEscrow(string memory invoiceId, uint256 amount) external {
        InvoiceEscrow storage escrow = escrows[invoiceId];
        require(escrow.client == msg.sender, "Not the registered client for this invoice");
        require(!escrow.funded, "Already funded");
        require(amount > 0, "Amount must be positive");

        escrow.principalAmount = amount;
        escrow.funded = true;

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        // Reset-then-set pattern: safe to call across multiple invoices,
        // unlike the deprecated safeApprove which reverts on non-zero -> non-zero.
        usdcToken.forceApprove(goatYieldRouter, 0);
        usdcToken.forceApprove(goatYieldRouter, amount);
        // IGoatYield(goatYieldRouter).stake(amount); // wire up real staking before production use

        emit EscrowFunded(invoiceId, msg.sender, amount);
    }

    function resolveEscrow(string memory invoiceId) external onlyOwner {
        InvoiceEscrow storage escrow = escrows[invoiceId];
        require(!escrow.isResolved, "Already resolved");
        require(escrow.funded, "Not funded");
        require(block.timestamp >= escrow.maturesAt, "Invoice has not matured yet");

        escrow.isResolved = true;

        // uint256 totalReturned = IGoatYield(goatYieldRouter).unstake(escrow.principalAmount);
        // Until a real yield router is integrated, no yield is fabricated —
        // only the principal is returned. Replace this block once the real
        // router integration lands, and always cap payouts at the contract's
        // actual balance (never promise more than it holds).
        uint256 realizedYield = 0; // real yield source not yet integrated
        uint256 totalReturned = escrow.principalAmount + realizedYield;
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        require(totalReturned <= contractBalance, "Insufficient contract balance to resolve");

        uint256 splitYield = realizedYield / 2;

        usdcToken.safeTransfer(escrow.freelancer, escrow.principalAmount + splitYield);
        if (splitYield > 0) {
            usdcToken.safeTransfer(escrow.client, splitYield);
        }

        emit EscrowResolved(invoiceId, escrow.freelancer, escrow.principalAmount, splitYield);
    }
}
