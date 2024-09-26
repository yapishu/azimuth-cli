exports.command = "get <command>";
exports.desc =
  "Retrieve information about Urbit points, L2 rollers, and Ethereum gas prices.";
exports.builder = function (yargs) {
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
  return yargs.commandDir("get_cmds");
};
exports.handler = function (argv) {};
