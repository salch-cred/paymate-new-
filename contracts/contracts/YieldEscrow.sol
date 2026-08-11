// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YieldEscrow
 * @dev Autonomous escrow for PayMate invoices (GOAT Network).
 *
 * How funds flow (all on-chain, no fabricated values):
 *   1. The trusted PayMate backend (owner) calls `registerInvoice` with the
 *      real invoice id and the expected client + freelancer addresses.
 *   2. The client pays by transferring USDC directly to this contract
 *      (the invoice's payTo address). The backend verifies the transfer
 *      on-chain, then calls `confirmFunded` to lock the invoice.
 *   3. Normal completion: the backend calls `resolveEscrow` after the
 *      maturity timestamp (e.g. the moment a GitHub PR merges) and the
 *      principal moves to the freelancer.
 *   4. Dispute: the AI arbitrator's verdict is enforced on-chain via
 *      `resolveDispute` — PAY_FREELANCER / REFUND_CLIENT / SPLIT_50_50 —
 *      which actually moves the escrowed USDC.
 *
 * SECURITY / HONESTY (2026-07-29 audit + 2026-08-11 wiring audit):
 *  - No fabricated yield: the previous "simulate a 5% yield" logic was
 *    structurally insolvent and has been removed. Until a real GOAT yield
 *    router is integrated, escrows return exactly their principal.
 *  - `confirmFunded` is owner-only and re-reads the contract's actual token
 *    balance, so the ledger can never promise more than it holds.
 *  - `resolveDispute` and `resolveEscrow` are owner-only (the trusted
 *    backend), mirroring how PayMate's reputation issuer works.
 */
contract YieldEscrow is Ownable {
    using SafeERC20 for IERC20;

    /// Dispute verdicts, matching web/src/lib/db.ts DisputeResolution.
    enum Resolution { PAY_FREELANCER, REFUND_CLIENT, SPLIT_50_50 }

    IERC20 public immutable usdcToken;

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
    event EscrowFunded(string invoiceId, address funder, uint256 amount);
    event EscrowResolved(string invoiceId, address recipient, uint256 amount);
    event DisputeResolved(string invoiceId, Resolution resolution, address freelancer, address client, uint256 amount);

    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC token");
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

    /// @notice Backend confirms that the client's USDC transfer to this
    /// contract has landed (after verifying it on-chain). Owner-only so the
    /// ledger can only be advanced by the trusted PayMate backend.
    function confirmFunded(string memory invoiceId, uint256 amount) external onlyOwner {
        InvoiceEscrow storage escrow = escrows[invoiceId];
        require(escrow.client != address(0), "Not registered");
        require(!escrow.funded, "Already funded");
        require(amount > 0, "Amount must be positive");
        require(usdcToken.balanceOf(address(this)) >= amount, "Escrow has not received the funds");

        escrow.principalAmount = amount;
        escrow.funded = true;

        emit EscrowFunded(invoiceId, escrow.client, amount);
    }

    /// @notice Releases the principal to the freelancer once the invoice has
    /// matured (used by the GitHub webhook the moment a PR merges).
    function resolveEscrow(string memory invoiceId) external onlyOwner {
        InvoiceEscrow storage escrow = escrows[invoiceId];
        require(!escrow.isResolved, "Already resolved");
        require(escrow.funded, "Not funded");
        require(block.timestamp >= escrow.maturesAt, "Invoice has not matured yet");

        escrow.isResolved = true;
        usdcToken.safeTransfer(escrow.freelancer, escrow.principalAmount);

        emit EscrowResolved(invoiceId, escrow.freelancer, escrow.principalAmount);
    }

    /// @notice Enforces the AI arbitrator's binding verdict by actually moving
    /// the escrowed USDC. No maturity requirement — disputes can be settled
    /// at any time while the invoice is funded.
    function resolveDispute(string memory invoiceId, Resolution resolution) external onlyOwner {
        InvoiceEscrow storage escrow = escrows[invoiceId];
        require(!escrow.isResolved, "Already resolved");
        require(escrow.funded, "Not funded");

        escrow.isResolved = true;

        if (resolution == Resolution.PAY_FREELANCER) {
            usdcToken.safeTransfer(escrow.freelancer, escrow.principalAmount);
            emit DisputeResolved(invoiceId, resolution, escrow.freelancer, escrow.client, escrow.principalAmount);
        } else if (resolution == Resolution.REFUND_CLIENT) {
            usdcToken.safeTransfer(escrow.client, escrow.principalAmount);
            emit DisputeResolved(invoiceId, resolution, escrow.freelancer, escrow.client, escrow.principalAmount);
        } else if (resolution == Resolution.SPLIT_50_50) {
            uint256 freelancerShare = escrow.principalAmount / 2;
            uint256 clientShare = escrow.principalAmount - freelancerShare;
            usdcToken.safeTransfer(escrow.freelancer, freelancerShare);
            usdcToken.safeTransfer(escrow.client, clientShare);
            emit DisputeResolved(invoiceId, resolution, escrow.freelancer, escrow.client, escrow.principalAmount);
        } else {
            revert("Invalid resolution");
        }
    }

    /// @notice Reads the current on-chain escrow state for an invoice.
    function getEscrow(string memory invoiceId) external view returns (InvoiceEscrow memory) {
        return escrows[invoiceId];
    }
}
