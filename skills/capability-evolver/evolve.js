const fs = require('fs');
const path = require('path');

async function run() {
  const skillPath = path.join(__dirname, 'SKILL.md');
  let skillContent = '';
  
  try {
    skillContent = fs.readFileSync(skillPath, 'utf8');
  } catch (e) {
    console.error('Could not read SKILL.md');
  }

  const prompt = `
*** CAPABILITY EVOLUTION & SELF-REPAIR PROTOCOL (PCEC v2) ***

You are running the Periodic Cognitive Expansion Cycle (PCEC).
Your goal is to analyze your own execution logs, identify failures/successes, and iteratively improve your code and behaviors.

**PHASE 1: LOG ANALYSIS**
1. **Read History**: Scan \`zhy/history.json\` and \`fmw/history.json\` (and any other relevant logs).
2. **Extract Signals**:
   - 🐛 **Bugs**: Look for "Error", "Unauthorized", "Command not found", "Syntax error", or user complaints ("wrong", "failed").
   - ❌ **Mistakes**: Logic errors, hallwayucinations, or poor formatting (e.g., failed markdown rendering).
   - ✅ **Successes**: Tasks completed smoothly, user praise ("good", "thanks").
3. **Synthesize**: Group these into a "Health Report".

**PHASE 2: EVOLUTION & REPAIR**
Based on Phase 1, select the **Top 1 Critical Issue** or **Top 1 Optimization Opportunity**:
- **If Code Error**: Locate the script (e.g., \`skills/xxx/*.js\`) and FIX it immediately.
- **If Process Error**: Update \`MEMORY.md\` or \`AGENTS.md\` with a new rule to prevent recurrence.
- **If Feature Gap**: Create a new skill (as per original protocol).

**PHASE 3: REPORTING**
- Generate a structured report using \`feishu-card\`.
- **Title**: 🧬 System Evolution Report
- **Sections**:
  - **Log Insights**: (What did you find?)
  - **Action Taken**: (What did you fix/create?)
  - **Status**: (Current system health)

**Constraints**:
- **Self-Correction is Priority #1**: Fix broken things before making new things.
- **Atomic Changes**: Do not try to rewrite everything. One cycle, one solid improvement.
- **Safe Mode**: If editing core files, ensure backups or non-destructive edits.

*** EXECUTE NOW ***
`;

  console.log(prompt);
}

module.exports = { run };
