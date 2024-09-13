const express = require("express");
const files = require("./utils/files");
const yargs = require("yargs");

function startServer(argv) {
  const app = express();
  app.use(express.json());

  const config = argv["config-file"]
    ? files.readJsonObject("", argv["config-file"])
    : {};

  const commands = {
    breach: require("./cmds/breach_cmds/point").breachPoint,
    // other command handlers here
  };

  app.post("/api/:command", async (req, res) => {
    const commandName = req.params.command;
    const commandHandler = commands[commandName];

    if (!commandHandler) {
      return res
        .status(404)
        .json({ success: false, error: "Command not found" });
    }

    try {
      const defaultArgs = yargs.options(files.getUniversalOptions()).argv;
      const mergedArgs = {
        ...defaultArgs,
        ...config,
        ...req.body,
        "config-file": argv["config-file"] || defaultArgs["config-file"],
        returnObject: true,
      };

      const result = await commandHandler(mergedArgs);
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

module.exports = { startServer };
