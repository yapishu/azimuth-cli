const ob = require("urbit-ob");
const { files, findPoints, rollerApi, validate } = require("../../utils");

const builder = (yargs) => {
  yargs.option("return-object", {
    describe: "Return the result object instead of writing to console.",
    default: false,
    type: "boolean",
  });
};

command = "sponsored";
desc = "List of points that a point sponsors.";

const handler = async function (args) {
  try {
    const result = await getPointsSponsoredByPoint(args);
    if (args.returnObject) {
      return result;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

async function getPointsSponsoredByPoint(args) {
  const rollerClient = rollerApi.createClient(args);
  const workDir = files.ensureWorkDir(args.workDir || ".");
  const wallets = args.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(args, workDir, wallets);
  const results = [];
  for (const p of points) {
    const patp = ob.patp(validate.point(p));
    console.log(`Checking sponsorship for ${args.point} / ${patp}`);
    const sponsorInfo = await rollerApi.getSponsoredPoints(rollerClient, patp);
    if (args.returnObject) {
      results.push({ patp, sponsorInfo });
    } else {
      console.log(`Sponsored by ${patp}:`, sponsorInfo);
    }
  }
}

module.exports = {
  command,
  desc,
  builder,
  handler,
  getPointsSponsoredByPoint,
};
