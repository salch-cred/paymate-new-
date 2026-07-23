// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YieldEscrow
 * @dev An escrow contract that stakes deposited USDC into a GOAT Network yield protocol
 * while the invoice is pending (e.g. Net-30). Upon resolution, the principal is paid 
 * to the freelancer, and the generated yield is split 50/50 between client and freelancer.
 */
contract YieldEscrow is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public usdcToken;
    // Dummy GOAT Yield router for the hackathon demo
    address public goatYieldRouter = 0x0000000000000000000000000000000000000001; 

    struct InvoiceEscrow {
        address client;
        address freelancer;
        uint256 principalAmount;
        bool isResolved;
    }

    mapping(string => InvoiceEscrow) public escrows;

    event EscrowFunded(string invoiceId, address client, uint256 amount);
    event EscrowResolved(string invoiceId, address freelancer, uint256 principal, uint256 yieldSplit);

    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
    }

    function fundEscrow(string memory invoiceId, address freelancer, uint256 amount) external {
        require(escrows[invoiceId].principalAmount == 0, "Already funded");
        
        // Transfer USDC from client to this contract
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        escrows[invoiceId] = InvoiceEscrow({
            client: msg.sender,
            freelancer: freelancer,
            principalAmount: amount,
            isResolved: false
        });

        // Simulate staking into GOAT Yield Router
        usdcToken.safeApprove(goatYieldRouter, amount);
        // IGoatYield(goatYieldRouter).stake(amount);

        emit EscrowFunded(invoiceId, msg.sender, amount);
    }

    function resolveEscrow(string memory invoiceId) external onlyOwner {
        InvoiceEscrow storage escrow = escrows[invoiceId];
        require(!escrow.isResolved, "Already resolved");
        require(escrow.principalAmount > 0, "Not funded");

        escrow.isResolved = true;

        // Simulate unstaking from GOAT Yield Router
        // uint256 totalReturned = IGoatYield(goatYieldRouter).unstake(escrow.principalAmount);
        
        // For the demo, let's simulate a 5% yield generation over the 30 days
        uint256 simulatedYield = (escrow.principalAmount * 5) / 100;
        uint256 totalReturned = escrow.principalAmount + simulatedYield;

        // Ensure we actually have the funds (in a real scenario, the router sends it back)
        // Since it's a demo, we assume the contract is adequately funded to cover the simulated yield.

        uint256 splitYield = simulatedYield / 2;

        // Pay freelancer (Principal + 50% Yield)
        usdcToken.safeTransfer(escrow.freelancer, escrow.principalAmount + splitYield);

        // Refund client (50% Yield)
        usdcToken.safeTransfer(escrow.client, splitYield);

        emit EscrowResolved(invoiceId, escrow.freelancer, escrow.principalAmount, splitYield);
    }
}
