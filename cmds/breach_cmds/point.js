const axios = require("axios");
const details = require("../get_cmds/details");
const modifyL1 = require("../modify-l1_cmds/network-key");
const modifyL2 = require("../modify-l2_cmds/network-key");
const { validate } = require("../../utils");

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
  const point = validate.point(argv.point, true);
  if (point === null) {
    console.error("Invalid point. Aborting.");
    return;
  }
  const patp = require("urbit-ob").patp(point);

  try {
    // fetch the master ticket
    console.log(`Fetching master ticket for ${patp}...`);
    const ticket = await fetchMasterTicket(patp, argv.auth);

    // get point details
    console.log(`Fetching details for ${patp}...`);
    const pointInfo = await details.getPointInfo(patp, {
      returnDetails: true,
    });

    if (!pointInfo) {
      console.log(`Failed to fetch details for ${patp}. Aborting.`);
      return;
    }
    const { dominion } = pointInfo.dominion;
    console.log(`Generating network key with breach for ${patp}...`);
    const networkKeyData = await generateNetworkKeyForBreach(patp, ticket);

    if (!networkKeyData) {
      console.log(`Failed to generate network keys for ${patp}. Aborting.`);
      return;
    }

    console.log(`Generated network key:`, networkKeyData.networkKeyPair);
    console.log(
      `Modifying network key with breach for ${patp} on dominion: ${dominion}...`,
    );

    let modifyResult;
    const argv = {
      points: [patp],
      privateKeyTicket: `~${ticket}`,
      breach: true,
      returnObject: true,
      workDir: ".",
      rollerProvider: "urbit",
    };
    if (dominion === "l2") {
      modifyResult = await modifyL2.handler(argv);
    } else if (dominion === "l1") {
      modifyResult = await modifyL1.handler(argv);
    } else {
      console.error(`Unsupported dominion type: ${dominion}. Aborting.`);
      return;
    }

    if (argv.returnObject) {
      console.log("result:", modifyResult);
      return modifyResult;
    } else {
      console.log(`Successfully breached ${patp}!`);
    }
  } catch (error) {
    console.error(`Error processing breach for ${patp}:`, error);
  }
};

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

// server mode
async function generateNetworkKeyForBreach(patp, ticket) {
  return await generateNetworkKey.handler({
    points: [patp],
    privateKeyTicket: `~${ticket}`,
    breach: true,
    returnObject: true,
    workDir: ".",
  });
}
