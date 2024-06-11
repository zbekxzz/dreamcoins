const { expect } = require("chai");

const toWei = (num) => ethers.utils.parseEther(num.toString());
const fromWei = (num) => ethers.utils.formatEther(num);

describe("NFTMarketplace", function() {
    let deployer, address1, address2, nft, marketplace, addrs;
    const feePercent = 1;
    const URI = "Sample URI"

    beforeEach(async function() {
        // Get contract factories
        const NFT = await ethers.getContractFactory("NFT");
        const Marketplace = await ethers.getContractFactory("Marketplace");
        // Get signers
        [deployer, address1, address2, ...addrs] = await ethers.getSigners();
        // Deploy contracts
        marketplace = await Marketplace.deploy(feePercent);
        nft = await NFT.deploy();
    });

    describe("Deployment", function() {
        it("Should track name and symbol of the nft collection", async function() {
            expect(await nft.name()).to.equal("DApp NFT");
            expect(await nft.symbol()).to.equal("DAPP");
        });
        it("Should track feeAccount and feePercent of the marketplace", async function() {
            expect(await marketplace.feeAccount()).to.equal(deployer.address);
            expect(await marketplace.feePercent()).to.equal(feePercent);
        });
    });

    describe("Minting NFTs", async function() {
        it("Should track each minted NFT", async function() {
            // first address minting nft
            await nft.connect(address1).mint(URI);
            expect(await nft.tokenCount()).to.equal(1);
            expect(await nft.balanceOf(address1.address)).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(URI);
            // second address minting nft
            await nft.connect(address2).mint(URI);
            expect(await nft.tokenCount()).to.equal(2);
            expect(await nft.balanceOf(address2.address)).to.equal(1);
            expect(await nft.tokenURI(2)).to.equal(URI);
        })
    });

    describe("Making marketplace items", function() {
        let price = 1
        let result 
        
        beforeEach(async function() {
            await nft.connect(address1).mint(URI);
            await nft.connect(address1).setApprovalForAll(marketplace.address, true);
        })

        it("Should track newly created item, transfer NFT from seller to marketplace and emit Offered event", async function () {
            await expect(marketplace.connect(address1).makeItem(nft.address, 1 , toWei(price)))
                .to.emit(marketplace, "Offered")
                .withArgs(1, nft.address, 1, toWei(price), address1.address);

            expect(await nft.ownerOf(1)).to.equal(marketplace.address);
            expect(await marketplace.itemCount()).to.equal(1);

            const item = await marketplace.items(1);

            expect(item.itemId).to.equal(1);
            expect(item.nft).to.equal(nft.address);
            expect(item.tokenId).to.equal(1);
            expect(item.price).to.equal(toWei(price));
            expect(item.sold).to.equal(false);
        });
        it("Should fail if price is set to zero", async function () {
            await expect(marketplace.connect(address1).makeItem(nft.address, 1, 0)).to.be.revertedWith("Price must be greater than zero");
        })
    })

    describe("Purchasing marketplace items", function () {
        let price = 2
        let fee = (feePercent / 100) * price
        let totalPriceInWei

        beforeEach(async function () {
          await nft.connect(address1).mint(URI)
          await nft.connect(address1).setApprovalForAll(marketplace.address, true)
          await marketplace.connect(address1).makeItem(nft.address, 1 , toWei(price))
        });

        it("Should update item as sold, pay seller, transfer NFT to buyer, charge fees and emit a Bought event", async function () {
            const sellerInitalEthBal = await address1.getBalance()
            const feeAccountInitialEthBal = await deployer.getBalance()

            totalPriceInWei = await marketplace.getTotalPrice(1);

            const tx = await marketplace.connect(address2).purchaseItem(1, {value: totalPriceInWei});
            const receipt = await tx.wait();
            console.log("Transaction Receipt:", receipt);

            await expect(tx)
                .to.emit(marketplace, "Bought")
                .withArgs(1, nft.address, 1, toWei(price), address1.address, address2.address);

            const sellerFinalEthBal = await address1.getBalance()
            const feeAccountFinalEthBal = await deployer.getBalance()

            expect((await marketplace.items(1)).sold).to.equal(true)
            expect(+fromWei(sellerFinalEthBal)).to.equal(+price + +fromWei(sellerInitalEthBal))
            expect(+fromWei(feeAccountFinalEthBal)).to.equal(+fee + +fromWei(feeAccountInitialEthBal))
            expect(await nft.ownerOf(1)).to.equal(address2.address);
        })

        it("Should fail for invalid item ids, sold items and when not enough ether is paid", async function () {
          await expect(marketplace.connect(address2).purchaseItem(2, {value: totalPriceInWei})).to.be.revertedWith("item doesn't exist");
          await expect(marketplace.connect(address2).purchaseItem(0, {value: totalPriceInWei})).to.be.revertedWith("item doesn't exist");
          await expect(marketplace.connect(address2).purchaseItem(1, {value: toWei(price)})).to.be.revertedWith("not enough ether to cover item price and market fee"); 
          await marketplace.connect(address2).purchaseItem(1, {value: totalPriceInWei})

          const address3 = addrs[0]
          await expect(marketplace.connect(address3).purchaseItem(1, {value: totalPriceInWei})).to.be.revertedWith("item already sold");
        });
      })
})