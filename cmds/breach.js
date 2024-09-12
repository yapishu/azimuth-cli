exports.command = "breach <command>";
exports.desc = "Breach a point.";
exports.builder = function (yargs) {
  return yargs.commandDir("breach_cmds");
};
exports.handler = function (argv) {};
