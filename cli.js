#!/usr/bin/env node

const express = require("express");
const { files } = require("./utils");
const yargs = require("yargs");

const argv = yargs
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
  yargs
    .scriptName("azimuth-cli")
    .commandDir("cmds")
    .demandCommand()
    .options(getUniversalOptions())
    .config("config-file", (configFile) => files.readJsonObject("", configFile))
    .help().argv;
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

function startServer() {
  const app = express();
  app.use(express.json());

  // parse command and subcommand from path
  app.post("/api/:command/:subcommand", async (req, res) => {
    try {
      const { command, subcommand } = req.params;
      const args = req.body || {}; // parse args from the request body

      const fullCommand = `${command} ${subcommand}`;
      console.log(`Received command: ${fullCommand} with args:`, args);

      // Simulate positional arguments for yargs
      const commandArgs = [
        command,
        subcommand,
        ...Object.entries(args).flat().map(String), // make sure arguments are strings
      ];

      // Execute the command
      const result = await handleCommand(commandArgs);
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

async function handleCommand(commandArgs) {
  return new Promise((resolve, reject) => {
    yargs
      .commandDir("cmds")
      .demandCommand()
      .parse(commandArgs, {}, (err, argv, output) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            output || `Executed command with args ${JSON.stringify(argv)}`,
          );
        }
      });
  });
}

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  process.exit(0);
});
