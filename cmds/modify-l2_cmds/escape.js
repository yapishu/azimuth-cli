const ob = require("urbit-ob");
const Accounts = require("web3-eth-accounts");
const { files, eth, findPoints, rollerApi, validate } = require("../../utils");

const command = "escape";
const desc = "Escape from a sponsor to a new sponsor (L2).";

const builder = (yargs) => {
  yargs.option("return-object", {
    describe: "Return the result object instead of writing to disk.",
    default: false,
    type: "boolean",
  });
  yargs.option("sponsor", {
    describe: "New sponsor @p.",
    type: "string",
  });
};

const handler = async function (args) {
  try {
    const result = await l2Escape(args);
    if (args.returnObject) {
      return result;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

async function l2Escape(args) {
  const rollerClient = rollerApi.createClient(args);
  const workDir = files.ensureWorkDir(args.workDir || ".");

  const wallets = args.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(args, workDir, wallets);

  console.log(`Escaping ${points.length} point(s) to ${args.sponsor}`);
  const results = [];

  for (const p of points) {
    const patp = ob.patp(p);
    const spo = validate.point(args.sponsor);
    console.log(`Trying to escape ${patp} to ${ob.patp(spo)} (${spo}).`);

    const pointInfo = await rollerApi.getPoint(rollerClient, patp);
    if (pointInfo.dominion !== "l2") {
      console.log(`This point is not on L2, please use the L1 modify command.`);
      continue;
    }

    const privateKey = await eth.getPrivateKey(args);
    const account = new Accounts().privateKeyToAccount(privateKey);
    const signingAddress = account.address;

    if (!(await rollerApi.canEscape(rollerClient, patp, signingAddress))) {
      console.log(`Cannot escape ${patp}.`);
      continue;
    }

    const receipt = await rollerApi.escape(
      rollerClient,
      patp,
      spo,
      signingAddress,
      privateKey,
    );

    if (args.returnObject) {
      results.push({ patp, receipt });
    } else {
      files.writeFile(workDir, `${patp}-escape-receipt-L2.json`, receipt);
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
  l2Escape,
};
