// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PayMateReputation
/// @notice Minimal ERC-8004-style reputation registry. Each completed + paid
/// job records feedback for a freelancer, building a portable on-chain score.
contract PayMateReputation {
    struct Rep {
        uint256 jobsCompleted;
        uint256 totalEarnedUsd;   // cumulative paid volume
        uint256 score;            // simple reputation score
    }

    mapping(address => Rep) public reputation;
    address public issuer;        // PayMate agent allowed to record jobs

    event JobRecorded(address indexed freelancer, uint256 amountUsd, uint256 newScore);

    constructor() { issuer = msg.sender; }

    modifier onlyIssuer() { require(msg.sender == issuer, "not issuer"); _; }

    function recordJob(address freelancer, uint256 amountUsd) external onlyIssuer {
        Rep storage r = reputation[freelancer];
        r.jobsCompleted += 1;
        r.totalEarnedUsd += amountUsd;
        r.score += 10 + (amountUsd / 100);   // simple scoring rule
        emit JobRecorded(freelancer, amountUsd, r.score);
    }

    function getReputation(address freelancer) external view returns (Rep memory) {
        return reputation[freelancer];
    }
}
