const ob = require("urbit-ob");
const ajs = require("azimuth-js");
const _ = require("lodash");
const { files, eth, findPoints, rollerApi } = require("../../utils");

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
  try {
    const results = await setNetworkKeys(argv);
    if (argv.returnObject) {
      return results;
    }
    process.exit(0);
  } catch (error) {
    console.error("Error setting network keys:", error);
    process.exit(1);
  }
};

async function setNetworkKeys(argv) {
  const workDir = files.ensureWorkDir(argv.workDir);
  const privateKey = await eth.getPrivateKey(argv);
  const ctx = await eth.createContext(argv);
  const ethAccount = eth.getAccount(ctx.web3, privateKey);

  const wallets = argv.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(argv, workDir, wallets);

  console.log(`Will set network keys for ${points.length} points`);
  const results = [];

  for (const p of points) {
    try {
      const result = await setNetworkKeyForPoint(
        p,
        argv,
        ctx,
        ethAccount,
        workDir,
        wallets,
      );
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Error setting network key for ${ob.patp(p)}:`, error);
    }
  }

  return results;
}

async function setNetworkKeyForPoint(
  p,
  argv,
  ctx,
  ethAccount,
  workDir,
  wallets,
) {
  const patp = ob.patp(p);
  console.log(`Trying to set network key for ${patp} (${p}).`);

  const pointInfo = await rollerApi.getPoint(
    rollerApi.createClient(argv),
    patp,
  );
  const currentKeys = pointInfo.network.keys;
  const revision = currentKeys.life;
  argv.revision = revision;

  const networkKeyPair = await getNetworkKeyPair(patp, argv, workDir, wallets);
  if (!networkKeyPair) {
    console.error(`Could not find network keys for ${patp}.`);
    return null;
  }

  const canConfigure = await ajs.check.canConfigureKeys(
    ctx.contracts,
    p,
    ethAccount.address,
  );
  if (!canConfigure.result) {
    console.log(`Cannot set network key for ${patp}: ${canConfigure.reason}`);
    return null;
  }

  const publicCrypt = ajs.utils.addHexPrefix(networkKeyPair.crypt.public);
  const publicAuth = ajs.utils.addHexPrefix(networkKeyPair.auth.public);

  if (
    currentKeys.crypt === publicCrypt &&
    currentKeys.auth === publicAuth &&
    !argv.breach
  ) {
    console.log(`The network key is already set for ${patp}`);
    return null;
  }

  const gasPrice = argv.gas === 30000 ? await eth.fetchGasGwei() : argv.gas;
  const tx = ajs.ecliptic.configureKeys(
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
    eth.getPrivateKey(argv),
    { ...argv, gas: gasPrice },
    workDir,
    patp,
    "networkkey",
  );

  if (argv.returnObject) {
    return {
      patp,
      receipt,
      keyfile: networkKeyPair,
      life: pointInfo.network.rift,
      rift: revision,
      dominion: pointInfo.dominion,
    };
  } else {
    files.writeFile(workDir, `${patp}-receipt-L1.json`, receipt);
    return null;
  }
}

async function getNetworkKeyPair(patp, argv, workDir, wallets) {
  if (wallets && wallets[patp]) {
    return wallets[patp].network.keys;
  } else if (argv.networkKeyData) {
    return argv.networkKeyData.networkKeyPair;
  } else {
    const keysFileName = `${patp.substring(1)}-networkkeys-${argv.revision}.json`;
    if (files.fileExists(workDir, keysFileName)) {
      return files.readJsonObject(workDir, keysFileName);
    }
  }
  return null;
}

const CRYPTO_SUITE_VERSION = 1;
