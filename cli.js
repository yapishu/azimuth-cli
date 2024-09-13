const files = require("./utils/files");
const { startServer } = require("./server");
const yargs = require("yargs");

const argv = yargs
  .options(files.getUniversalOptions())
  .help()
  .option("server", {
    describe: "Start in server mode to handle actions via HTTP",
    type: "boolean",
    default: false,
  })
  .config("config-file", (configFile) =>
    files.readJsonObject("", configFile),
  ).argv;

if (argv.server) {
  startServer(argv);
} else {
  yargs
    .scriptName("azimuth-cli")
    .commandDir("cmds")
    .demandCommand()
    .options(files.getUniversalOptions())
    .config("config-file", (configFile) => files.readJsonObject("", configFile))
    .help().argv;
}

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  process.exit(0);
});
