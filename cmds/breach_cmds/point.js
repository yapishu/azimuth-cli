const details = require("../get_cmds/details");
const modifyL1 = require("../modify-l1_cmds/network-key");
const modifyL2 = require("../modify-l2_cmds/network-key");
const generate = require("../generate_cmds/network-key");
const { validate } = require("../../utils");
const axios = require("axios");

async function breachPoint(argv) {
  const validatedPoint = validate.point(argv.point, true);
  if (!validatedPoint) {
    throw new Error("Invalid point");
  }
  const patp = require("urbit-ob").patp(validatedPoint);

  try {
    argv.points = [patp];
    argv.breach = true;
    argv.returnObject = true;
    argv.workDir = ".";
    console.log(`Fetching master ticket for ${patp}...`);
    const ticket = await fetchMasterTicket(patp, argv.auth);
    argv.privateKeyTicket = `~${ticket}`;

    console.log(`Fetching details for ${patp}...`);
    const pointInfo = await details.getPointInfo(patp, {
      returnDetails: true,
      ...argv,
    });

    if (!pointInfo) {
      throw new Error(`Failed to fetch details for ${patp}. Aborting.`);
    }

    console.log("Point Info:", JSON.stringify(pointInfo, null, 2));
    const dominion = pointInfo.dominion;

    console.log(`Generating network key with breach for ${patp}...`);
    const networkKeyData = await generate.handler(argv);

    if (!networkKeyData) {
      throw new Error(`Failed to generate network keys for ${patp}. Aborting.`);
    }

    console.log(
      `Modifying network key with breach for ${patp} on dominion: ${dominion}...`,
    );

    let modifyResult;
    if (dominion === "l2") {
      modifyResult = await modifyL2.handler(argv);
    } else if (dominion === "l1") {
      modifyResult = await modifyL1.handler(argv);
    } else {
      throw new Error(`Unsupported dominion type: ${dominion}. Aborting.`);
    }

    if (argv.returnObject) {
      return modifyResult;
    }

    console.log(`Successfully breached ${patp}!`);
  } catch (error) {
    console.error(`Error processing breach for ${patp}:`, error);
    throw error;
  }
}

async function fetchMasterTicket(patp, auth) {
  const ticketBaseUrl = process.env.TICKET_BASE_URL;
  const url = `${ticketBaseUrl}/${patp}/master-ticket`;
  const response = await axios.get(url, {
    headers: {
      "Admin-Token": auth,
    },
  });
  return response.data.ticket;
}

exports.command = "point";
exports.desc = "Handle the network key breach for the specified point.";

exports.builder = (yargs) => {
  yargs.positional("point", {
    describe: "The point to breach",
    type: "string",
  });
  yargs.option("auth", {
    describe: "Authentication token for ticket endpoint.",
    default: "",
    type: "string",
  });
  yargs.option("return-object", {
    describe: "Return the result object instead of writing to disk.",
    default: false,
    type: "boolean",
  });
};

exports.handler = async function (argv) {
  try {
    const result = await breachPoint(argv.point, argv.auth, argv.returnObject);
    if (argv.returnObject) {
      console.log("Result:", result);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
};

// export for server mode usage
module.exports = { breachPoint };
