const ob = require("urbit-ob");
const { files, findPoints, rollerApi, validate } = require("../../utils");

const builder = (yargs) => {
  yargs.option("return-object", {
    describe: "Return the result object instead of writing to console.",
    default: false,
    type: "boolean",
  });
  yargs.option("points", {
    alias: ["p", "point"],
    describe: `One or more points, can be p or patp.`,
    type: "array",
    conflicts: ["points-file", "use-wallet-files"],
  });
  yargs.option("adoptee", {
    describe: `Ship to check for escape request.`,
    type: "string",
  });
};

command = "sponsored";
desc = "List of points that a point sponsors.";

const handler = async function (args) {
  try {
    const result = await getPointsSponsoredByPoint(args.point, args);
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
    console.log(`Checking sponsorship for ${p}`);
    const sponsorInfo = await rollerApi.getSponsoredPoints(rollerClient, p);
    if (args.adoptee) {
      const adoptee = validate.point(args.adoptee);
      const hasEscape = await hasOpenEscape(p, adoptee);
      if (args.adoptee && !args.returnObject) {
        console.log(`Open escape request for ${p} to ${adoptee}`);
      } else if (args.adoptee && args.returnObject) {
        results.push({ patp: p, adoptee: args.adoptee, adoptable: hasEscape });
      }
    }
    if (args.returnObject) {
      results.push({ patp, sponsorInfo });
    } else {
      console.log(`Sponsored by ${p}:`, sponsorInfo.residents);
    }
  }
}

async function hasOpenEscape(host, adoptee) {
  const point = validate.point(host);
  const sponsoredBy = await getPointsSponsoredByPoint(args);
  // check if args.adoptee is in the array of sponsored points
  return sponsoredBy.some((point) => point === adoptee);
}

module.exports = {
  command,
  desc,
  builder,
  handler,
  getPointsSponsoredByPoint,
  hasOpenEscape,
};
