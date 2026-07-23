import { expect } from "chai";
import { ethers } from "hardhat";

describe("PayMateReputation", function () {
  async function deployReputationFixture() {
    const [issuer, freelancer, otherAccount] = await ethers.getSigners();

    const PayMateReputation = await ethers.getContractFactory("PayMateReputation");
    const reputation = await PayMateReputation.deploy();

    return { reputation, issuer, freelancer, otherAccount };
  }

  it("Should set the right issuer", async function () {
    const { reputation, issuer } = await deployReputationFixture();
    expect(await reputation.issuer()).to.equal(issuer.address);
  });

  it("Should allow issuer to record a job", async function () {
    const { reputation, freelancer } = await deployReputationFixture();
    
    const amountUsd = 500;
    await expect(reputation.recordJob(freelancer.address, amountUsd))
      .to.emit(reputation, "JobRecorded")
      .withArgs(freelancer.address, amountUsd, 10 + amountUsd / 100);

    const rep = await reputation.getReputation(freelancer.address);
    expect(rep.jobsCompleted).to.equal(1);
    expect(rep.totalEarnedUsd).to.equal(amountUsd);
    expect(rep.score).to.equal(10 + amountUsd / 100);
  });

  it("Should not allow non-issuer to record a job", async function () {
    const { reputation, freelancer, otherAccount } = await deployReputationFixture();
    
    await expect(
      reputation.connect(otherAccount).recordJob(freelancer.address, 500)
    ).to.be.revertedWith("not issuer");
  });

  it("Should accumulate stats correctly over multiple jobs", async function () {
    const { reputation, freelancer } = await deployReputationFixture();
    
    await reputation.recordJob(freelancer.address, 200);
    await reputation.recordJob(freelancer.address, 300);

    const rep = await reputation.getReputation(freelancer.address);
    expect(rep.jobsCompleted).to.equal(2);
    expect(rep.totalEarnedUsd).to.equal(500);
    
    // First job score: 10 + 2 = 12
    // Second job score added: + 10 + 3 = +13
    // Total score = 25
    expect(rep.score).to.equal(25);
  });
});
