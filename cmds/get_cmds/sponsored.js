const ob = require("urbit-ob");
const ajs = require("azimuth-js");
const { rollerApi } = require("../../utils");

const builder = (yargs) => {
  yargs.option("return-object", {
    describe: "Return the result object instead of writing to disk.",
    default: false,
    type: "boolean",
  });
};

command = "sponsored";
desc = "List points a point sponsors.";

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
  const points = findPoints.getPoints(args, workDir, wallets);
  console.log(`Adopting ${points.length} point(s) to ${args.sponsor}`);
  const results = [];
  for (const p of points) {
    const patp = ob.patp(p);
    const sponsorInfo = await rollerApi.getPointsSponsoredByPoint(
      rollerClient,
      patp,
    );
    if (args.returnObject) {
      results.push({ patp, sponsorInfo });
    } else {
      console.log(sponsorInfo);
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
