const fs = require("node:fs");
const path = require("node:path");

const keptLocales = new Set(["en-US.pak", "zh-CN.pak", "zh-HK.pak", "zh-TW.pak"]);

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const localesDir = path.join(appOutDir, "locales");

  if (fs.existsSync(localesDir)) {
    for (const entry of fs.readdirSync(localesDir)) {
      if (!keptLocales.has(entry)) {
        fs.rmSync(path.join(localesDir, entry), { force: true });
      }
    }
  }

  fs.rmSync(path.join(appOutDir, "resources", "default_app.asar"), { force: true });
};
