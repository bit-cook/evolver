#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// AI Integration: Robust Loading
let GoogleGenerativeAI;
const POSSIBLE_PATHS = [
    '@google/generative-ai', // Global/Local standard
    path.resolve(__dirname, '../sticker-analyzer/node_modules/@google/generative-ai'), // Cross-skill fallback
    path.resolve(__dirname, '../../node_modules/@google/generative-ai') // Root fallback
];

for (const p of POSSIBLE_PATHS) {
    try {
        GoogleGenerativeAI = require(p).GoogleGenerativeAI;
        break;
    } catch (e) {}
}

program
    .option('-i, --input <file>', 'Input JSON file (from fetch.js history)')
    .option('-o, --output <file>', 'Output Markdown file')
    .option('-p, --persona <text>', 'AI Persona/Perspective for summary', 'a neutral observer')
    .option('-v, --verbose', 'Enable verbose logging')
    .parse(process.argv);

const options = program.opts();

function log(msg) {
    if (options.verbose) console.error(`[INFO] ${msg}`);
}

async function getAiSummary(messages, persona) {
    if (!GoogleGenerativeAI || !process.env.GEMINI_API_KEY) return null;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Format messages for prompt (Compact)
        // Sort by time first to ensure chronological order
        const sortedMsgs = [...messages].sort((a, b) => (a.time || 0) - (b.time || 0));
        
        const transcript = sortedMsgs.map(m => {
            const sender = (m.sender || 'unknown').replace(/^ou_/, '').slice(0, 6);
            let text = m.content;
            if (typeof text === 'object') text = JSON.stringify(text);
            return `${sender}: ${text}`;
        }).slice(-150).join('\n'); // Increased context to 150

        const prompt = `
You are analyzing a group chat log.
**Your Persona**: ${persona}

**Task**:
Generate a concise Intelligence Report in Markdown.
1. **🔍 Executive Summary**: What is happening? (2-3 sentences)
2. **🔥 Hot Topics**: Bullet points of key discussions.
3. **💡 Intel/Gossip**: Any drama, secrets, or strong opinions expressed?
4. **🎭 Vibe Check**: The emotional atmosphere.

**Transcript**:
${transcript}`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (e) {
        console.error(`[Intel] AI Summary failed: ${e.message}`);
        return `_AI Analysis Failed: ${e.message}_`;
    }
}

async function main() {
    // Read Input
    let messages = [];
    try {
        let inputData;
        if (options.input) {
            log(`Reading from file: ${options.input}`);
            inputData = fs.readFileSync(options.input, 'utf8');
        } else {
            // Try reading from stdin
            try {
                // Check if stdin has data
                inputData = fs.readFileSync(0, 'utf8');
            } catch (e) {
                // If interactive and no input, fail gracefully
                if (!options.input) {
                    console.error('Error: No input file specified and no stdin provided.');
                    process.exit(1);
                }
            }
        }
        
        if (inputData) {
            messages = JSON.parse(inputData);
        }
    } catch (e) {
        console.error('Error reading input:', e.message);
        process.exit(1);
    }

    if (!Array.isArray(messages)) {
        console.error('Error: Input is not an array.');
        process.exit(1);
    }

    const totalMessages = messages.length;
    if (totalMessages === 0) {
        console.log("No messages to report.");
        process.exit(0);
    }

    // --- Statistics Generation ---
    const users = {};
    const msgTypes = {};
    const hourlyActivity = new Array(24).fill(0);

    // Ensure sorted by time
    messages.sort((a, b) => {
        const tA = a.time ? new Date(a.time).getTime() : 0;
        const tB = b.time ? new Date(b.time).getTime() : 0;
        return tA - tB;
    });

    const timeStart = messages[0]?.time ? new Date(messages[0].time).toLocaleString() : 'Unknown';
    const timeEnd = messages[messages.length - 1]?.time ? new Date(messages[messages.length - 1].time).toLocaleString() : 'Unknown';

    messages.forEach(msg => {
        const sender = msg.sender || 'unknown_user';
        users[sender] = (users[sender] || 0) + 1;

        // Type Analysis
        const type = msg.type || 'text';
        msgTypes[type] = (msgTypes[type] || 0) + 1;

        // Hourly Analysis
        if (msg.time) {
            try {
                const hour = new Date(msg.time).getHours();
                if (hour >= 0 && hour < 24) hourlyActivity[hour]++;
            } catch (e) {}
        }
    });

    const sortedUsers = Object.entries(users).sort((a, b) => b[1] - a[1]);
    const topUser = sortedUsers.length > 0 ? sortedUsers[0] : null;

    // Helper: ASCII Bar
    function generateBar(count, max, width = 15) {
        if (!max) return '';
        const len = Math.round((count / max) * width);
        return '█'.repeat(len) + '░'.repeat(width - len);
    }

    // --- Markdown Assembly ---
    let md = `# 🕵️‍♀️ Group Intel Report\n\n`;
    md += `> **Persona**: ${options.persona}\n\n`;
    md += `**📅 Range**: ${timeStart} - ${timeEnd}\n`;
    md += `**💬 Total Msgs**: ${totalMessages}\n`;
    if (topUser) {
        md += `**🏆 MVP**: ${topUser[0].replace(/^ou_/, '').substring(0, 6)} (${topUser[1]} msgs)\n`;
    }
    md += `\n`;

    // 1. AI Summary (Async Injection)
    log('Generating AI Summary...');
    const aiSummary = await getAiSummary(messages, options.persona);
    if (aiSummary) {
        md += `## 🧠 Intelligence Analysis\n${aiSummary}\n\n`;
    }

    // 2. Stats
    md += `## 📊 Activity Metrics\n`;
    md += `| User | Count | Activity |\n|---|---|---|\n`;
    const maxMsgs = topUser ? topUser[1] : 0;
    sortedUsers.slice(0, 8).forEach(([user, count]) => {
        const name = user.replace(/^ou_/, '').substring(0, 6);
        md += `| ${name} | ${count} | ${generateBar(count, maxMsgs)} |\n`;
    });
    md += `\n`;

    // 3. Temporal
    md += `## 🕒 Peak Hours\n\`\`\`\n`;
    const maxHourly = Math.max(...hourlyActivity);
    for (let i = 0; i < 24; i++) {
        if (hourlyActivity[i] > 0) {
            const h = i.toString().padStart(2, '0') + ':00';
            md += `${h} | ${generateBar(hourlyActivity[i], maxHourly, 20)} (${hourlyActivity[i]})\n`;
        }
    }
    md += `\`\`\`\n\n`;

    // 4. Raw Log (Tail)
    md += `## 📝 Latest Logs (Last 20)\n`;
    let lastSender = null;
    messages.slice(-20).forEach(msg => {
        let content = msg.content;
        if (typeof content === 'object') {
            if (content.text) content = content.text;
            else if (content.image_key) content = '[Image]';
            else content = JSON.stringify(content);
        }
        
        const sender = (msg.sender || 'unknown').replace(/^ou_/, '').substring(0, 6);
        const time = msg.time ? new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '??:??';
        
        if (sender === lastSender) {
             md += `> ↳ ${content}\n`;
        } else {
             md += `> **${sender}** [${time}]: ${content}\n`;
        }
        lastSender = sender;
    });

    // Output
    if (options.output) {
        fs.writeFileSync(options.output, md);
        log(`Report saved to ${options.output}`);
    } else {
        console.log(md);
    }
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
