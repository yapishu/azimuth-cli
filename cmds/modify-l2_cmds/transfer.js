const ob = require('urbit-ob')
const _ = require('lodash')
const ajsUtils = require('azimuth-js').utils;
const {files, validate, eth, findPoints, rollerApi} = require('../../utils')

exports.command = 'transfer'
exports.desc = 'Transfer one or more L2 points, either to the wallet address or to the provided target addess.'

exports.builder = function(yargs) {
  yargs.option('reset',{
    describe: 'If the network keys and proxies should be reset in the process of the transfer. Do not set to true when moving to a HD wallet address.',
    default: false,
    type: 'boolean',
  });
}

exports.handler = async function (argv)
{
  const rollerClient = rollerApi.createClient(argv);
  const workDir = files.ensureWorkDir(argv.workDir);
  const privateKey = await eth.getPrivateKey(argv);
  const account = new Accounts().privateKeyToAccount(privateKey);
  const signingAddress = account.address;

  const wallets = argv.useWalletFiles ? findPoints.getWallets(workDir) : null;
  const points = findPoints.getPoints(argv, workDir, wallets);

  console.log(`Will transfer ${points.length} points`);
  for (const p of points) 
  {
    let patp = ob.patp(p);
    console.log(`Trying to transfer ${patp} (${p}).`);
    
    let wallet = argv.useWalletFiles ? wallets[patp] : null;
    let targetAddress = 
      argv.address != undefined
      ? argv.address 
      : argv.useWalletFiles 
      ? wallet.ownership.keys.address :
      null; //fail
    targetAddress = validate.address(targetAddress, true);

    let pointInfo = rollerApi.getPoint(rollerClient, patp);
    if(ajsUtils.addressEquals(pointInfo.ownership.owner.address, targetAddress)){
      console.log(`Target address ${targetAddress} is already owner of ${patp}.`);
      continue;
    }

    //use the transfer proxy check to see if the singing address is either owner or transfer proxy
    if(!(await rollerApi.getTransferProxy(rollerClient, patp, signingAddress))){
      console.log(`Signing address ${signingAddress} must be owner or transfer proxy.`);
      continue;
    }

    //create and send tx
    var transactioHash = await rollerApi.transferPoint(rollerClient, patp, argv.reset, targetAddress, signingAddress, privateKey);
    console.log("tx hash: "+transactioHash);

  } //end for each point
  
  process.exit(0);
};








