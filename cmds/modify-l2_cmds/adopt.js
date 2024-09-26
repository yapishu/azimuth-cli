const ob = require("urbit-ob");
const Accounts = require("web3-eth-accounts");
const { getPointsSponsoredByPoint } = require("../get_cmds/sponsored");
const { files, eth, findPoints, rollerApi, validate } = require("../../utils");

const command = "adopt";
const desc = "Claim an escape request (L2).";

const builder = (yargs) => {
  yargs.option("return-object", {
    describe: "Return the result object instead of writing to disk.",
    default: false,
    type: "boolean",
  });
  yargs.option("adoptee", {
    describe: "@p with existing escape request.",
    type: "string",
  });
};

const handler = async function (args) {
  try {
    const result = await l2Adopt(args);
    if (args.returnObject) {
      return result;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

async function l2Adopt(args) {
  const rollerClient = rollerApi.createClient(args);
  const workDir = files.ensureWorkDir(args.workDir || ".");

  const wallets = args.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(args, workDir, wallets);

  console.log(`Adopting ${points.length} point(s) to ${args.sponsor}`);
  const results = [];

  for (const p of points) {
    const patp = ob.patp(p);
    const ado = ob.patp(validate.point(args.adoptee));
    console.log(`Trying to adopt ${patp} to ${ado}.`);

    const pointInfo = await rollerApi.getPoint(rollerClient, patp);
    if (pointInfo.dominion !== "l2") {
      console.log(`This point is not on L2, please use the L1 modify command.`);
      continue;
    }

    const adoptParams = {
      adoptee: ado,
      point: patp,
      returnObject: true,
    };
    const isSponsorable = await getPointsSponsoredByPoint(adoptParams);
    if (!isSponsorable.adoptable) {
      console.log(`No open escape request submitted by ${ado} for ${patp}.`);
      continue;
    }

    const privateKey = await eth.getPrivateKey(args);
    const account = new Accounts().privateKeyToAccount(privateKey);
    const signingAddress = account.address;

    if (!(await rollerApi.canAdopt(rollerClient, patp, signingAddress))) {
      console.log(`Cannot adopt ${patp}.`);
      continue;
    }

    const receipt = await rollerApi.adopt(
      rollerClient,
      patp,
      ado,
      signingAddress,
      privateKey,
    );

    if (args.returnObject) {
      results.push({ patp, receipt });
    } else {
      files.writeFile(workDir, `${point}-adopt-receipt-L2.json`, receipt);
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
  l2Adopt,
};
