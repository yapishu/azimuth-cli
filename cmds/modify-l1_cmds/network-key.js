const ob = require("urbit-ob");
const ajs = require("azimuth-js");
const _ = require("lodash");
const { files, validate, eth, findPoints, rollerApi } = require("../../utils");

exports.command = "network-key";
exports.desc = "Set the network key for one or more points.";

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
  const workDir = files.ensureWorkDir(argv.workDir);
  const privateKey = await eth.getPrivateKey(argv);
  const ctx = await eth.createContext(argv);
  const ethAccount = eth.getAccount(ctx.web3, privateKey);

  const wallets = argv.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(argv, workDir, wallets);

  console.log(`Will set network keys for ${points.length} points`);
  const results = [];

  for (const p of points) {
    let patp = ob.patp(p);
    console.log(`Trying to set network key for ${patp} (${p}).`);

    let wallet = argv.useWalletFiles ? wallets[patp] : null;
    const pointInfo = await rollerApi.getPoint(
      rollerApi.createClient(argv),
      patp,
    );
    const currentKeys = pointInfo.network.keys;
    const revision = currentKeys.life;
    argv.revision = revision;
    const keysFileName = `${patp.substring(1)}-networkkeys-${revision}.json`;

    let networkKeyPair = null;
    if (wallet) {
      networkKeyPair = wallet.network.keys;
    } else if (argv.networkKeyData) {
      networkKeyPair = argv.networkData;
    } else if (files.fileExists(workDir, keysFileName)) {
      networkKeyPair = files.readJsonObject(workDir, keysFileName);
    } else {
      console.error(`Could not find network keys for ${patp}.`);
      process.exit(1);
    }

    let res = await ajs.check.canConfigureKeys(
      ctx.contracts,
      p,
      ethAccount.address,
    );
    if (!res.result) {
      console.log(`Cannot set network key for ${patp}: ${res.reason}`);
      continue;
    }

    var publicCrypt = ajs.utils.addHexPrefix(networkKeyPair.crypt.public);
    var publicAuth = ajs.utils.addHexPrefix(networkKeyPair.auth.public);

    if (
      currentKeys.crypt === publicCrypt &&
      currentKeys.auth === publicAuth &&
      !argv.breach
    ) {
      console.log(`The network key is already set for ${patp}`);
      continue;
    }

    if (argv.gas === 30000) {
      argv.gas = (await eth.fetchGasGwei()).proposeGasPrice;
    }

    let tx = ajs.ecliptic.configureKeys(
      ctx.contracts,
      p,
      publicCrypt,
      publicAuth,
      CRYPTO_SUITE_VERSION,
      argv.breach,
    );

    const receipt = await eth.setGasSignSendAndSaveTransaction(
      ctx,
      tx,
      privateKey,
      argv,
      workDir,
      patp,
      "networkkey",
    );

    if (argv.returnObject) {
      results.push({ patp, receipt });
    } else {
      files.writeFile(workDir, `${patp}-receipt-L1.json`, receipt);
    }
  }

  if (argv.returnObject) {
    return results;
  }

  process.exit(0);
};

const CRYPTO_SUITE_VERSION = 1;
