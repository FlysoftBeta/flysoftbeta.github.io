const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const operation = process.argv[2];
const sitesDir = __dirname;

let items = fs.readdirSync(sitesDir);
for (const item of items) {
    let itemPath = path.join(sitesDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    if (operation == "install")
        cp.execSync("npm install", { cwd: itemPath, stdio: "inherit" });
    else if (operation == "build")
        cp.execSync("npm run build", { cwd: itemPath, stdio: "inherit" });
}
