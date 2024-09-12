const ob = require("urbit-ob");
const _ = require("lodash");
const ajsUtils = require("azimuth-js").utils;
const Accounts = require("web3-eth-accounts");
const { files, validate, eth, findPoints, rollerApi } = require("../../utils");

exports.command = "network-key";
exports.desc = "Set the network key for one or more L2 points.";

exports.builder = function (yargs) {
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
};

exports.handler = async function (argv) {
  const rollerClient = rollerApi.createClient(argv);
  const workDir = files.ensureWorkDir(argv.workDir);

  const wallets = argv.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(argv, workDir, wallets);

  console.log(`Will set network keys for ${points.length} points`);
  const results = [];

  for (const p of points) {
    let patp = ob.patp(p);
    console.log(`Trying to set network key for ${patp} (${p}).`);

    const pointInfo = await rollerApi.getPoint(rollerClient, patp);
    if (pointInfo.dominion !== "l2") {
      console.log(`This point is not on L2, please use the L1 modify command.`);
      continue;
    }

    const currentKeys = pointInfo.network.keys;
    let wallet = argv.useWalletFiles ? wallets[patp] : null;
    const currentRevision = currentKeys.life; //network key revision number == life.
    const keysFileName = `${patp.substring(1)}-networkkeys-${currentRevision}.json`;

    let networkKeyPair = null;
    if (wallet) {
      networkKeyPair = wallet.network.keys;
    } else if (files.fileExists(workDir, keysFileName)) {
      console.log(`Reading network keys from ${keysFileName}`);
      networkKeyPair = files.readJsonObject(workDir, keysFileName);
    } else {
      console.error(`Could not find network keys for ${patp}.`);
      process.exit(1);
    }

    const privateKey = await eth.getPrivateKey(argv);
    const account = new Accounts().privateKeyToAccount(privateKey);
    const signingAddress = account.address;

    if (
      !(await rollerApi.canConfigureKeys(rollerClient, patp, signingAddress))
    ) {
      console.log(`Cannot set network keys for ${patp}.`);
      continue;
    }

    //we are using the public keys because in the contract only the public keys should be visible, the private keys are used to generate the arvo key file
    var publicCrypt = ajsUtils.addHexPrefix(networkKeyPair.crypt.public);
    var publicAuth = ajsUtils.addHexPrefix(networkKeyPair.auth.public);

    const receipt = await rollerApi.configureKeys(
      rollerClient,
      patp,
      publicCrypt,
      publicAuth,
      argv.breach,
      signingAddress,
      privateKey,
    );

    if (argv.returnObject) {
      results.push({ patp, receipt });
    } else {
      files.writeFile(workDir, `${patp}-receipt-L2.json`, receipt);
    }
  }

  if (argv.returnObject) {
    return results;
  }

  process.exit(0);
};
