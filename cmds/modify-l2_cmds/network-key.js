const ob = require("urbit-ob");
const ajsUtils = require("azimuth-js").utils;
const Accounts = require("web3-eth-accounts");
const { files, eth, findPoints, rollerApi } = require("../../utils");

const command = "network-key";
const desc = "Set the network key for one or more L2 points.";

const builder = (yargs) => {
  yargs.option("breach", {
    describe: "Do a factory reset of the ship.",
    default: false,
    type: "boolean",
  });
  yargs.option("return-object", {
    describe: "Return the result object instead of writing to disk.",
    default: false,
    type: "boolean",
  });
  yargs.option("network-key-data", {
    describe:
      "Provide the network key data generated from the generate command.",
    type: "object",
  });
  yargs.option("use-wallet-files", {
    describe: "Use wallet files to retrieve network keys.",
    type: "boolean",
  });
};

const handler = async function (args) {
  try {
    const result = await modifyL2NetworkKey(args);
    if (args.returnObject) {
      return result;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

async function modifyL2NetworkKey(args) {
  const rollerClient = rollerApi.createClient(args);
  const workDir = files.ensureWorkDir(args.workDir || ".");

  const wallets = args.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(args, workDir, wallets);

  console.log(`Will set network keys for ${points.length} points`);
  const results = [];

  for (const p of points) {
    const patp = ob.patp(p);
    console.log(`Trying to set network key for ${patp} (${p}).`);

    const pointInfo = await rollerApi.getPoint(rollerClient, patp);
    if (pointInfo.dominion !== "l2") {
      console.log(`This point is not on L2, please use the L1 modify command.`);
      continue;
    }

    const currentKeys = pointInfo.network.keys;
    const currentRevision = currentKeys.life; // network key revision number == life.
    const keysFileName = `${patp.substring(1)}-networkkeys-${currentRevision}.json`;

    let networkKeyPair = null;
    if (args.networkKeyData) {
      networkKeyPair = args.networkKeyData.networkKeyData;
    } else if (wallets && wallets[patp]) {
      networkKeyPair = wallets[patp].network.keys;
    } else if (files.fileExists(workDir, keysFileName)) {
      console.log(`Reading network keys from ${keysFileName}`);
      networkKeyPair = files.readJsonObject(workDir, keysFileName);
    } else {
      console.error(`Could not find network keys for ${patp}.`);
      throw new Error(`Network keys not found for ${patp}`);
    }
    if (!networkKeyPair) {
      throw new Error(`Network key pair is undefined for ${patp}.`);
    }

    const privateKey = await eth.getPrivateKey(args);
    const account = new Accounts().privateKeyToAccount(privateKey);
    const signingAddress = account.address;

    if (
      !(await rollerApi.canConfigureKeys(rollerClient, patp, signingAddress))
    ) {
      console.log(`Cannot set network keys for ${patp}.`);
      continue;
    }

    // Use the public keys for the contract
    const publicCrypt = ajsUtils.addHexPrefix(networkKeyPair.crypt.public);
    const publicAuth = ajsUtils.addHexPrefix(networkKeyPair.auth.public);

    const receipt = await rollerApi.configureKeys(
      rollerClient,
      patp,
      publicCrypt,
      publicAuth,
      args.breach,
      signingAddress,
      privateKey,
    );

    if (args.returnObject) {
      results.push({ patp, receipt });
    } else {
      files.writeFile(workDir, `${patp}-receipt-L2.json`, receipt);
    }
  }

  if (args.returnObject) {
    return results;
  }

  console.log("Operation completed.");
}

module.exports = {
  command,
  desc,
  builder,
  handler,
  modifyL2NetworkKey,
};
