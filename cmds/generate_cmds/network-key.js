// cmds/generate_cmds/network-key.js

const ob = require("urbit-ob");
const kg = require("urbit-key-generation");
const ticket = require("up8-ticket");
const details = require("../get_cmds/details");
const { files, validate, findPoints } = require("../../utils");

// needs to be required explicitly for up8-ticket to work
global.crypto = require("crypto");

const command = "network-key";
const desc =
  "Generates network keys and the associated network key file, used for booting the ship.";

const builder = (yargs) => {
  yargs.demandOption("d");

  yargs.option("points-file", {
    describe:
      "A file containing the points with each point on a separate line, can be p or patp.",
    type: "string",
    conflicts: ["points", "use-wallet-files"],
  });

  yargs.option("points", {
    alias: ["p", "point"],
    describe: "One or more points to generate a wallet for, can be p or patp.",
    type: "array",
    conflicts: ["points-file", "use-wallet-files"],
  });

  yargs.option("use-wallet-files", {
    describe: `Use the wallet JSON files in the current work directory for the points and the network keys. Will only generate the network key file. The wallet must have been generated with the --generate-network-keys set to true (default).`,
    type: "boolean",
    conflicts: ["points-file", "points"],
  });

  yargs.option("breach", {
    describe: "Generate keys for the next key revision.",
    default: false,
    type: "boolean",
  });

  // for API
  yargs.option("return-object", {
    describe:
      "Return the generated network key as an object rather than writing to disk.",
    type: "boolean",
    default: false,
  });

  yargs.check((argv) => {
    if (!argv.pointsFile && !argv.points && !argv.useWalletFiles) {
      throw new Error(
        "You must provide either --points-file, --points, or --use-wallet-files",
      );
    }
    return true;
  });
};

const handler = async function (argv) {
  try {
    const result = await generateNetworkKey(argv);
    if (argv.returnObject) {
      console.log("Return:", JSON.stringify(result, null, 2));
      return result;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

async function generateNetworkKey(args) {
  const workDir = files.ensureWorkDir(args.workDir);

  const wallets = args.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(args, workDir, wallets);

  console.log(`Will generate network keys for ${points.length} points.`);

  const results = [];

  for (const p of points) {
    const patp = ob.patp(p);
    const pointArgs = { ...args, returnObject: true };

    const pinfo = await details.getPointInfo(p, pointArgs);
    if (pinfo === null) {
      console.log(`Could not get details for ${patp}, will skip.`);
      continue;
    }

    let networkKeyPair = null;
    const revision = args.breach
      ? Number(pinfo.networkKeysRevision) + 1
      : Number(pinfo.networkKeysRevision);
    const continuity = args.breach
      ? Number(pinfo.networkKeysRevision) + 1
      : Number(pinfo.networkKeysRevision);

    let wallet = args.useWalletFiles ? wallets[patp] : null;
    if (wallet) {
      if (!wallet.network?.keys?.crypt) {
        console.log(
          `The provided wallet for ${patp} does not contain the network key, will skip ${patp}.`,
        );
        continue;
      }
      networkKeyPair = wallet.network.keys;
    } else {
      const keysFileName = `${patp.substring(1)}-networkkeys-${revision}.json`;

      if (!files.fileExists(workDir, keysFileName)) {
        const tmpWallet = await kg.generateWallet({
          ticket: args.privateKeyTicket,
          ship: p,
          boot: true,
          revision: Number(revision),
        });
        console.log(
          `Generated network keys for ${patp}: ${args.privateKeyTicket}, ${revision}`,
        );
        networkKeyPair = tmpWallet.network.keys;

        if (!args.returnObject) {
          const file = files.writeFile(workDir, keysFileName, networkKeyPair);
          console.log(`Wrote network keys to: ${file}`);
        }
      } else {
        console.log(`${keysFileName} already exists, will not recreate.`);
        networkKeyPair = files.readJsonObject(workDir, keysFileName);
      }
    }

    if (!args.returnObject) {
      const networkKeyfileName = `${patp.substring(1)}-${revision}.key`;
      if (!files.fileExists(workDir, networkKeyfileName)) {
        const networkKeyfileContents = kg.generateKeyfile(
          networkKeyPair,
          p,
          Number(revision),
        );
        const file = files.writeFile(
          workDir,
          networkKeyfileName,
          networkKeyfileContents,
        );
        console.log(`Wrote network keyfile to: ${file}`);
      } else {
        console.log(`${networkKeyfileName} already exists, will not recreate.`);
      }
    } else {
      if (args.returnObject) {
        const networkKeyfileContents = kg.generateKeyfile(
          networkKeyPair,
          p,
          Number(revision),
        );
        let newNetworkInfo = networkKeyPair;
        newNetworkInfo.revision = Number(revision);
        newNetworkInfo.continuity = Number(continuity);
        results.push({
          point: p,
          networkKeyData: newNetworkInfo,
          keyfile: networkKeyfileContents,
        });
      }
    }
  }

  if (args.returnObject) {
    return results;
  }
}

module.exports = {
  handler,
  generateNetworkKey,
  command,
  builder,
  command,
  desc,
};
