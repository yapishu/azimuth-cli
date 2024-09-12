// cli.js
const express = require("express");
const { breachPoint } = require("./cmds/breach_cmds/point");
const { files } = require("./utils");

const argv = require("yargs")
  .options(getUniversalOptions())
  .help()
  .option("server", {
    describe: "Start in server mode to handle actions via REST",
    type: "boolean",
    default: false,
  })
  .config("config-file", (configFile) =>
    files.readJsonObject("", configFile),
  ).argv;

if (argv.server) {
  startServer();
} else {
  require("yargs")
    .scriptName("azimuth-cli")
    .commandDir("cmds")
    .demandCommand()
    .options(getUniversalOptions())
    .config("config-file", (configFile) => files.readJsonObject("", configFile))
    .help().argv;
}

function startServer() {
  const app = express();
  app.use(express.json());

  app.post("/api/breach", async (req, res) => {
    const { point, auth } = req.body;
    try {
      const result = await breachPoint(point, auth, true); // return result in server mode
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

function getUniversalOptions() {
  return {
    d: {
      alias: "work-dir",
      describe:
        "The work directory for the current command, mandatory for some commands. If it does not exist, it will be created.",
      default: ".",
      type: "string",
    },
    "eth-provider": {
      describe: "What Ethereum provider to use.",
      default: "mainnet",
      choices: ["ganache", "ropsten", "mainnet"],
      type: "string",
    },
    "roller-provider": {
      describe: "What L2 roller provider to use.",
      default: "urbit",
      choices: ["local", "urbit"],
      type: "string",
    },
    "config-file": {
      describe: "What config file to use.",
      default: files.ensureDefaultConfigFilePath(),
      type: "string",
    },
  };
}
