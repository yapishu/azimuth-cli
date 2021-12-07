exports.command = 'modify <command>'
exports.desc = 'Make changes to the on-chain state on Azimuth.'
exports.builder = function (yargs) {
  yargs.option('address',{
    alias: 'a',
    describe: 'The target address of the operation (spawn to, transfer to, etc.).',
    type: 'string',
  });

  yargs.option('wallet',{
    alias: 'w',
    describe: 'A wallet JSON file containing the private key that signs the transaction. Must be the key of the owner or proxy address.',
    type: 'string',
    conflicts: ['ticket', 'private-key']
  });
  yargs.option('ticket',{
    alias: 't',
    describe: 'A UP8 ticket to derrive the private key that signs the transaction. Must be the key of the owner or proxy address.',
    type: 'string',
    conflicts: ['wallet', 'private-key']
  });
  yargs.option('private-key',{
    alias: 'k',
    describe: 'The private key that signs the transaction. Must be the key of the owner or proxy address.',
    type: 'string',
    conflicts: ['wallet', 'ticket']
  });

  yargs.check(argv => {
    if (!argv.wallet && !argv.ticket && !argv.privateKey) throw new Error('You must provide either --wallet, --ticket, or private-key that signs the transaction.')
    return true
  });

  return yargs.commandDir('modify_cmds')
}
exports.handler = function (argv) {}