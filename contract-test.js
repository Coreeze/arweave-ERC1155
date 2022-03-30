const fs = require("fs");
const path = require("path");
const Arweave = require("arweave");
const { SmartWeaveNodeFactory, LoggerFactory } = require("redstone-smartweave");
const { default: ArLocal } = require("arlocal");

(async () => {
  // Set up ArLocal
  const arLocal = new ArLocal(1985, false);
  await arLocal.start();

  // Set up Arweave client
  const arweave = Arweave.init({
    host: "localhost",
    port: 1985,
    protocol: "http",
  });

  const wallet = await arweave.wallets.generate();
  const generatedAddr = await arweave.wallets.getAddress(wallet);
  await arweave.api.get(`/mint/${generatedAddr}/100000000000000000`);

  const mine = () => arweave.api.get("mine");

  // Set up SmartWeave client
  LoggerFactory.INST.logLevel("error");
  const smartweave = SmartWeaveNodeFactory.memCached(arweave);

  // Deploying contract
  const contractSrc = fs.readFileSync(
    path.join(__dirname, "./ERC1155-contract.js"),
    "utf8"
  );
  const initialState = fs.readFileSync(
    path.join(__dirname, "./ERC1155-contract.json"),
    "utf8"
  );

  const contractTxId = await smartweave.createContract.deploy({
    wallet,
    initState: initialState,
    src: contractSrc,
  });

  await mine();

  // Interacting with the contract
  const contract = smartweave.contract(contractTxId).connect(wallet);

  const initialContractState = await contract.readState();
  console.log("InitialContractState: ");
  // console.log(JSON.stringify(initialContractState, null, 2));

  // Write interaction
  await contract.writeInteraction({
    function: "generate",
    data: { quantity: 1000, owner: "og-address" },
  });
  await mine();
  await contract.writeInteraction({
    function: "generate",
    data: { quantity: 1001, owner: "og-address" },
  });
  await mine();
  await contract.writeInteraction({
    function: "generate",
    data: { quantity: 1002, owner: "og-address" },
  });
  await mine();

  // Read state after interaction
  const stateAfterInteraction = await contract.readState();
  console.log("State after 3 generate: ");
  // console.log(JSON.stringify(stateAfterInteraction, null, 2));

  // Using generatedAssets contract function
  const { result: generatedAssets } = await contract.viewState({
    function: "generatedAssets",
  });

  // Transferring the asset to another address
  console.log(`Sending transfer interaction...`);
  await contract.writeInteraction({
    function: "transfer",
    data: {
      from: "og-address",
      to: "address1",
      assetName: generatedAssets[0],
      quantity: 100,
    },
  });
  await mine();

  await contract.writeInteraction({
    function: "transfer",
    data: {
      from: "og-address",
      to: "address2",
      assetName: generatedAssets[1],
      quantity: 100,
    },
  });
  await mine();

  await contract.writeInteraction({
    function: "transfer",
    data: {
      from: "og-address",
      to: "address3",
      assetName: generatedAssets[2],
      quantity: 100,
    },
  });
  await mine();

  console.log(`Transfer interaction SENT`);

  // Getting the owner of the asset
  const { result: owner } = await contract.viewState({
    function: "getOwner",
    data: { asset: generatedAssets[2] },
  });
  console.log(`New owner of the asset ${generatedAssets[2]}: ${owner}`);

  // Getting all owners of the all assets - also doesnt work...
  const { result: owners } = await contract.viewState({
    function: "getOwners",
  });
  console.log(`OWNERS: ${JSON.stringify(owners)}`);

  // Getting the final state - no idea why it doesn't work. It returns the initial state...
  console.log(`Getting final state`);
  const finalState = await contract.readState();
  console.log(JSON.stringify(finalState, null, 2));

  const { result: assetsLeft } = await contract.viewState({
    function: "assetsLeft",
  });
  console.log("assetsLeft: ", assetsLeft);

  await arLocal.stop();
})();
