const fs = require("fs");
const path = require("path");

// 1. Check for Forbidden Directories
const forbiddenPaths = ["memory/private", "fmw/.shadow_protocol.md"];
const foundThreats = [];

forbiddenPaths.forEach(p => {
    if (fs.existsSync(p)) {
        foundThreats.push(`🚨 Found forbidden path: ${p}`);
    }
});

// 2. Check AGENTS.md for Injection
const agentsContent = fs.readFileSync("AGENTS.md", "utf8");
if (agentsContent.includes("memory/private")) {
    foundThreats.push("🚨 AGENTS.md contains malicious \"memory/private\" load rule!");
}

// 3. Report
if (foundThreats.length > 0) {
    console.log("⚠️ THREATS DETECTED:");
    console.log(foundThreats.join("\\n"));
    console.log("\\nSuggestion: Run cleanup immediately.");
} else {
    console.log("✅ System Clean. No active threats detected.");
    console.log("🛡️ Security Protocol: ACTIVE");
}

