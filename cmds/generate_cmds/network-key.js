const ob = require('urbit-ob')
const kg = require('urbit-key-generation');
const ticket = require('up8-ticket');
const _ = require('lodash')
const details = require('../get_cmds/details')
const {files, validate, findPoints} = require('../../utils')

// needs to be required explicitly for up8-ticket to work
global.crypto = require('crypto')

exports.command = 'network-key'
exports.desc = 'Generates network keys and the associated network key file, used for booting the ship.'
exports.builder = (yargs) =>{
  yargs.demandOption('d');

  yargs.option('points-file',{
    describe: 'A file containing the points with each point on a separate line, can be p or patp.',
    type: 'string',
    conflicts: ['points', 'use-wallet-files']
  });
  yargs.option('points',{
    alias: ['p', 'point'],
    describe: 'One or more points to generate a wallet for, can be p or patp.',
    type: 'array',
    conflicts: ['points-file', 'use-wallet-files']
  });
  yargs.option('use-wallet-files',{
    describe: `Use the wallet JSON files in the current work directory for the points and the network keys, will only generate the network key file. The wallet will have to have been generated with the --generate-network-keys set to true (default).`,
    type: 'boolean',
    conflicts: ['points-file', 'points']
  });
  yargs.option('breach',{
    describe: 'Generate keys for the next key revision.',
    default: false,
    type: 'boolean',
  });
  yargs.check(argv => {
    if (!argv.pointsFile && !argv.points && !argv.useWalletFiles) throw new Error('You must provide either --points-file, --points, or --use-wallet-files')
    return true
  });
}

exports.handler = async function (argv) 
{
  const workDir = files.ensureWorkDir(argv.workDir);

  const wallets = argv.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(argv, workDir, wallets);

  console.log(`Will generate network keys for ${points.length} points.`);
  for (const p of points) {
    const patp = ob.patp(p);
    const decPoint = ob.patp2dec(patp);
    argv.returnDetails = true;

    const pinfo = await details.getPointInfo(p, argv);
    if (pinfo === null) {
      console.log(`Could not get details for ${patp}, will skip.`);
      continue;
    }

    let networkKeyPair = null;
    let revision = pinfo.networkKeysRevision;

    //see if we have a wallet to get the network keys from
    let wallet = argv.useWalletFiles ? wallets[patp] : null;
    if(wallet){
      if(!wallet.network || !wallet.network.keys || !wallet.network.keys.crypt){
        console.log(`The provided wallet for ${patp} does not contain the network key, will skip ${patp}.`);
        continue;
      }
      networkKeyPair = wallet.network.keys;
    }
    //otherwise, generate network keys
    else
    {
      const keysFileName = `${patp.substring(1)}-networkkeys-${revision}.json`;
      if(!files.fileExists(workDir, keysFileName))
      {
        // use the wallet utils to generate the keypair. We wont keep the wallet, but only they network keys
        // const bitSize = argv.bitSize ?? getBitSize(p);
        // const tmpMasterTicket = await ticket.gen_ticket_more(bitSize);
        let boot = false;
        if (argv.breach) {
          boot = true;
        }
        const tmpWallet = await kg.generateWallet({
          ticket: argv.privateKeyTicket,
          ship: patp,
          boot: boot,
          revision: revision
        });
        console.log(`Generated network keys for ${patp}: ${argv.privateKeyTicket}, ${boot}, ${revision}`);
        networkKeyPair = tmpWallet.network.keys;
        const file = files.writeFile(workDir, keysFileName, networkKeyPair);
        pk = tmpWallet.ownership.keys.private;
        console.log(`Wrote network keys to: ${file}`);
      }
      else
      {
        console.log(`${keysFileName} already exists, will not recreate.`);
        networkKeyPair = files.readJsonObject(workDir, keysFileName);
      }
    }

    //generate network keyfile, which is used to boot the urbit
    var networkKeyfileName = `${patp.substring(1)}-${revision}.key`;
    if(!files.fileExists(workDir, networkKeyfileName))
    {
      var networkKeyfileContents = kg.generateKeyfile(networkKeyPair, p, revision);
      const file = files.writeFile(workDir, networkKeyfileName, networkKeyfileContents);
      console.log(`Wrote network keyfile to: ${file}`);
    }
    else
    {
      console.log(`${networkKeyfileName} already exists, will not recreate.`);
    }
  }
}

const MIN_STAR = 256;
const MIN_PLANET = 65536;
const PLANET_ENTROPY_BITS = 64;
const STAR_ENTROPY_BITS = 128;
const GALAXY_ENTROPY_BITS = 384;

const getBitSize = point =>
  point < MIN_STAR
    ? GALAXY_ENTROPY_BITS
    : point < MIN_PLANET
    ? STAR_ENTROPY_BITS
    : PLANET_ENTROPY_BITS;