const ob = require("urbit-ob");
const ajs = require("azimuth-js");
const { validate, eth, azimuth, rollerApi } = require("../../utils");

const command = "details <point>";
const desc =
  "Outputs various information about a <point>, such as owner and proxy addresses.";

const builder = (yargs) => {
  yargs.option("use-roller", {
    describe:
      "Enforce using the roller (L2) for all data and do not allow fallback to azimuth (L1).",
    type: "boolean",
    conflicts: "use-azimuth",
  });
  yargs.option("use-azimuth", {
    describe:
      "Enforce using azimuth (L1) for all data and do not allow fallback to the roller (L2).",
    type: "boolean",
    conflicts: "use-roller",
  });
  yargs.option("breach", {
    describe: "Generate keys for the next key revision.",
    default: false,
    type: "boolean",
  });
  yargs.option("return-details", {
    describe: "Return the point details as an object instead of printing.",
    default: false,
    type: "boolean",
  });
};

const handler = async function (argv) {
  try {
    const result = await getPointInfo(argv.point, argv);
    if (argv.returnObject) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
};

// Main function to get point information
async function getPointInfo(point, args) {
  const p = validate.point(point, true);
  const source = await rollerApi.selectDataSource(args);

  if (source === "azimuth") {
    return await getDetailsFromL1(p, args);
  } else {
    return await getDetailsFromL2(p, args);
  }
}

async function getDetailsFromL1(p, args) {
  const ctx = await eth.createContext(args);

  const sponsorP = await ajs.azimuth.getSponsor(ctx.contracts, p);
  const sponsorPatp = ob.patp(sponsorP);
  const hasSponsor = await ajs.azimuth.hasSponsor(ctx.contracts, p);
  const dominion = await azimuth.getDominion(ctx.contracts, p);
  const ownerAddress = sanitizeAddress(
    await ajs.azimuth.getOwner(ctx.contracts, p),
  );
  const spawnProxyAddress = sanitizeAddress(
    await ajs.azimuth.getSpawnProxy(ctx.contracts, p),
  );
  const networkKeysSet = await ajs.azimuth.hasBeenLinked(ctx.contracts, p);
  const networkKeysRevision = await ajs.azimuth.getKeyRevisionNumber(
    ctx.contracts,
    p,
  );
  const continuityNumber = await ajs.azimuth.getContinuityNumber(
    ctx.contracts,
    p,
  );
  const spawnedChildrenCount = await ajs.azimuth.getSpawnCount(
    ctx.contracts,
    p,
  );
  const patp = ob.patp(p);
  const shipType = ob.clan(patp);
  const parentPatp = ob.sein(patp);

  const details = {
    patp: patp,
    p: p,
    shipType: shipType,
    parent: parentPatp,
    sponsor: hasSponsor ? sponsorPatp : "null",
    dominion: dominion,
    owner: ownerAddress,
    spawnProxy: spawnProxyAddress,
    networkKeysSet: networkKeysSet,
    networkKeysRevision: networkKeysRevision,
    continuityNumber: continuityNumber,
    spawnedChildrenCount: spawnedChildrenCount,
  };

  if (args.returnObject) {
    // Server mode
    return details;
  }
  // CLI mode
  printDetailsToConsole(details);
}

async function getDetailsFromL2(p, args) {
  const rollerClient = rollerApi.createClient(args);

  let pointInfo;
  try {
    pointInfo = await rollerApi.getPoint(rollerClient, p);
  } catch (error) {
    if (error.message.includes("Resource not found")) {
      console.error(
        "Planet does not exist on L2, please try again with the --use-azimuth option.",
      );
    } else {
      console.error(error);
    }
    throw error;
  }

  const sponsorP = Number(pointInfo.network.sponsor.who);
  const sponsorPatp = ob.patp(sponsorP);
  const hasSponsor = pointInfo.network.sponsor.has;
  const spawnedChildren = await rollerApi.getSpawned(rollerClient, p);
  const patp = ob.patp(p);
  const shipType = ob.clan(patp);
  const parentPatp = ob.sein(patp);
  const networkKeysRevision = pointInfo.network.keys.life;

  const details = {
    patp: patp,
    p: p,
    shipType: shipType,
    parent: parentPatp,
    sponsor: hasSponsor ? sponsorPatp : "null",
    dominion: pointInfo.dominion,
    owner: pointInfo.ownership.owner.address,
    spawnProxy: pointInfo.ownership.spawnProxy.address,
    managementProxy: pointInfo.ownership.managementProxy.address,
    transferProxy: pointInfo.ownership.transferProxy.address,
    networkKeysSet: pointInfo.network.keys.auth ? "true" : "false",
    networkKeysRevision: networkKeysRevision,
    continuityNumber: pointInfo.network.rift,
    spawnedChildrenCount: spawnedChildren.length,
  };

  if (args.returnObject) {
    // Server mode
    return details;
  }

  // CLI mode
  printDetailsToConsole(details);
}

// Function to print details to console
function printDetailsToConsole(details) {
  console.log(`urbit ID (patp): ${details.patp}`);
  console.log(`urbit ID number (p): ${details.p}`);
  console.log(`ship type: ${details.shipType}`);
  console.log(`parent: ${details.parent}`);
  console.log(`sponsor: ${details.sponsor}`);
  console.log(`dominion: ${details.dominion}`);
  console.log(`owner address: ${details.owner}`);
  console.log(`spawn proxy address: ${details.spawnProxy}`);
  if (details.managementProxy) {
    console.log(`management proxy address: ${details.managementProxy}`);
  }
  if (details.transferProxy) {
    console.log(`transfer proxy address: ${details.transferProxy}`);
  }
  console.log(`network keys set: ${details.networkKeysSet}`);
  console.log(`network keys revision: ${details.networkKeysRevision}`);
  console.log(`continuity number: ${details.continuityNumber}`);
  console.log(`spawned children: ${details.spawnedChildrenCount}`);
}

// Helper function to sanitize addresses
function sanitizeAddress(address) {
  if (
    address &&
    !ajs.utils.addressEquals(
      "0x0000000000000000000000000000000000000000",
      address,
    )
  ) {
    return address.toLowerCase();
  }
  return null;
}

module.exports = {
  command,
  desc,
  builder,
  handler,
  getPointInfo,
};
