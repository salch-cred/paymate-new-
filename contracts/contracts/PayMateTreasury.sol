// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PayMateTreasury
 * @dev Self-Sustaining Autonomous Organization (SSAO) Treasury for PayMate.
 * Holds the 1% protocol fee and allows an authorized on-chain AI Agent to autonomously
 * route funds to Gitcoin Grants for public goods funding.
 */
contract PayMateTreasury is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant AI_AGENT_ROLE = keccak256("AI_AGENT_ROLE");

    event FundsReceived(address indexed sender, uint256 amount, address token);
    event GitcoinGrantDonated(address indexed grantAddress, uint256 amount, address token);

    constructor(address _admin, address _aiAgent) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(AI_AGENT_ROLE, _aiAgent);
    }

    /**
     * @dev Fallback to receive native tokens directly
     */
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value, address(0));
    }

    /**
     * @dev Autonomously invoked by the AI Agent to route funds to Gitcoin Grants
     * @param grantAddress The Gitcoin Grant recipient
     * @param amount The amount to donate
     * @param tokenAddress The ERC20 token to donate (address(0) for native)
     */
    function donateToGitcoin(address grantAddress, uint256 amount, address tokenAddress) external onlyRole(AI_AGENT_ROLE) {
        require(grantAddress != address(0), "Invalid grant address");
        require(amount > 0, "Amount must be greater than zero");

        if (tokenAddress == address(0)) {
            require(address(this).balance >= amount, "Insufficient native balance");
            (bool success, ) = grantAddress.call{value: amount}("");
            require(success, "Native token transfer failed");
        } else {
            IERC20 token = IERC20(tokenAddress);
            require(token.balanceOf(address(this)) >= amount, "Insufficient ERC20 balance");
            token.safeTransfer(grantAddress, amount);
        }

        emit GitcoinGrantDonated(grantAddress, amount, tokenAddress);
    }

    /**
     * @dev Admin function to withdraw funds in emergencies
     * @param to Destination address
     * @param amount The amount to withdraw
     * @param tokenAddress The ERC20 token (address(0) for native)
     */
    function emergencyWithdraw(address to, uint256 amount, address tokenAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid destination address");
        
        if (tokenAddress == address(0)) {
            require(address(this).balance >= amount, "Insufficient native balance");
            (bool success, ) = to.call{value: amount}("");
            require(success, "Native token transfer failed");
        } else {
            IERC20 token = IERC20(tokenAddress);
            require(token.balanceOf(address(this)) >= amount, "Insufficient ERC20 balance");
            token.safeTransfer(to, amount);
        }
    }
}
