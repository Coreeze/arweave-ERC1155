export async function handle(state, action) {
  // PROBLEM: it appears that the state is not being updated gloablly.
  //  When calling "transfer" and checking the state locally, the state us modified,
  // but not updated globally. No idea why.
  const COLORS = [
    "green",
    "red",
    "yellow",
    "blue",
    "black",
    "brown",
    "pink",
    "orange",
    "purple",
    "gray",
  ];
  const MATERIALS = [
    "gold",
    "wood",
    "silver",
    "fire",
    "diamond",
    "platinum",
    "palladium",
    "bronze",
    "lithium",
    "titanium",
  ];
  const ITEMS = [
    "sword",
    "shield",
    "robe",
    "stone",
    "crown",
    "katana",
    "dragon",
    "ring",
    "axe",
    "hammer",
  ];

  function bigIntFromBytes(byteArr) {
    let hexString = "";
    for (const byte of byteArr) {
      hexString += byte.toString(16).padStart(2, "0");
    }
    return BigInt("0x" + hexString);
  }

  async function getRandomIntNumber(max, uniqueValue = "") {
    const pseudoRandomData = SmartWeave.arweave.utils.stringToBuffer(
      SmartWeave.block.height +
        SmartWeave.block.timestamp +
        SmartWeave.transaction.id +
        action.caller +
        uniqueValue
    );
    const hashBytes = await SmartWeave.arweave.crypto.hash(pseudoRandomData);
    const randomBigInt = bigIntFromBytes(hashBytes);
    return Number(randomBigInt % BigInt(max));
  }

  switch (action.input.function) {
    case "name": {
      return { result: state.name };
    }
    case "getOwner": {
      const asset = action.input.data.asset;
      if (state.assets[asset]) {
        return { result: state.assets[asset].currentOwner };
      } else {
        return { result: `The asset "${asset}" doesn't exist yet` };
      }
    }
    case "getOwners": {
      console.log("getOwners: ", state.owners);
      return { result: state.owners };
    }
    case "transfer": {
      console.log("TRANSFER");

      const fromAddress = action.input.data.from;
      const toAddress = action.input.data.to;
      const assetName = action.input.data.assetName;
      const quantity = action.input.data.quantity;

      console.log("ASSET TO TRANSFER: ", assetName);

      state.assets[assetName].owners.find(function (owner, index) {
        owner.address == fromAddress && (owner.quantity -= quantity);
        if (owner.address == toAddress) {
          owner.quantity += quantity;
        } else {
          const newOwner = { address: toAddress, quantity };
          state.assets[assetName].owners.push(newOwner);
          state.owners.push(toAddress);
        }
        state.currentOwner = toAddress;
      });
      console.log("TRANSFER Owners: ", state.owners);
      if (state.assets[assetName] !== action.caller) {
        throw new ContractError(
          "Can not transfer asset that doesn't belong to sender"
        );
      }
    }
    case "generate": {
      if (action.input.function === "generate") {
        // console.log("GENERATE: ", action);
        const colorIndex = await getRandomIntNumber(COLORS.length, "color");
        const materialIndex = await getRandomIntNumber(
          MATERIALS.length,
          "material"
        );
        const itemIndex = await getRandomIntNumber(ITEMS.length, "item");

        const asset =
          COLORS[colorIndex] +
          " " +
          MATERIALS[materialIndex] +
          " " +
          ITEMS[itemIndex];

        if (!state.assets[asset]) {
          state.assets[asset] = {
            currentOwner: action.input.data.owner,
            owners: [
              {
                address: action.input.data.owner,
                quantity: action.input.data.quantity,
              },
            ],
          };
          !state.owners.includes(action.input.data.owner) &&
            state.owners.push(action.input.data.owner);
          !state.generatedAssets.includes(asset) &&
            state.generatedAssets.push(asset);
        } else {
          throw new ContractError(
            `Generated item (${asset}) is already owned by: ${state.assets[asset]}`
          );
        }
        return { state };
      }
    }
    case "generatedAssets": {
      return { result: Object.keys(state.assets) };
    }

    case "assetsLeft": {
      const allAssetsCount = COLORS.length * MATERIALS.length * ITEMS.length;
      const generatedAssetsCount = Object.keys(state.assets).length;
      const assetsLeftCount = allAssetsCount - generatedAssetsCount;
      return { result: assetsLeftCount };
    }
    default: {
      throw new ContractError(`Unsupported contract function: ${functionName}`);
    }
  }
}
