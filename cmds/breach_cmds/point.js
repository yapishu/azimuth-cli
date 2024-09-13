// cmds/breach_cmds/point.js

const details = require("../get_cmds/details");
const modifyL1 = require("../modify-l1_cmds/network-key");
const modifyL2 = require("../modify-l2_cmds/network-key");
const generate = require("../generate_cmds/network-key");
const { validate } = require("../../utils");
const axios = require("axios");
const ob = require("urbit-ob");

async function breachPoint(args) {
  const { point, auth, returnObject } = args;

  const validatedPoint = validate.point(point, true);
  if (!validatedPoint) {
    throw new Error("Invalid point");
  }
  const patp = ob.patp(validatedPoint);

  try {
    let fullArgs = {
      ...args,
      points: [patp],
      breach: true,
      returnObject: true,
      workDir: args.workDir || ".",
    };

    console.log(`Fetching master ticket for ${patp}...`);
    const ticket = await fetchMasterTicket(patp, auth);
    fullArgs.privateKeyTicket = `~${ticket}`;

    console.log(`Fetching details for ${patp}...`);
    const pointInfo = await details.getPointInfo(patp, fullArgs);

    if (!pointInfo) {
      throw new Error(`Failed to fetch details for ${patp}. Aborting.`);
    }

    console.log("Point Info:", JSON.stringify(pointInfo, null, 2));
    const dominion = pointInfo.dominion;

    console.log(`Generating network key with breach for ${patp}...`);
    const networkKeyDataArray = await generate.generateNetworkKey(fullArgs);

    if (!networkKeyDataArray || networkKeyDataArray.length === 0) {
      throw new Error(`Failed to generate network keys for ${patp}. Aborting.`);
    }

    const networkKeyData = networkKeyDataArray[0];

    console.log(
      `Modifying network key with breach for ${patp} on dominion: ${dominion}...`,
    );

    let modifyResult;
    if (dominion === "l2") {
      modifyResult = await modifyL2.modifyL2NetworkKey({
        ...fullArgs,
        networkKeyData,
        points: [networkKeyData.point],
      });
    } else if (dominion === "l1") {
      modifyResult = await modifyL1.modifyL1NetworkKey({
        ...fullArgs,
        networkKeyData,
        points: [networkKeyData.point],
      });
    } else {
      throw new Error(`Unsupported dominion type: ${dominion}. Aborting.`);
    }

    const finalResult = {
      ...modifyResult,
      keyfile: networkKeyData.keyfile,
      pointInfo: pointInfo,
    };
    if (args.returnObject || args["return-object"]) {
      return finalResult;
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

const command = "point <point>";
const desc = "Handle the network key breach for the specified point.";

const builder = (yargs) => {
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

const handler = async function (argv) {
  try {
    const result = await breachPoint(argv);
    if (argv.returnObject) {
      console.log("Result:", result);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
};

module.exports = {
  command,
  desc,
  builder,
  handler,
  breachPoint,
};
