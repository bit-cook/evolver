const path = require('path');
const evolve = require('./evolve');
const { execSync } = require('child_process');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const isLoop = args.includes('--loop') || args.includes('--mad-dog');

  if (command === 'run' || command === '/evolve' || isLoop) {
    console.log('🚀 Starting Capability Evolver...');
    
    if (isLoop) {
        // [REFACTOR 2026-02-03]
        // "Dead Loop" logic removed. The script now performs a SINGLE run
        // and instructs the AGENT to schedule the next run via Cron.
        // This ensures the LLM is actually involved in every cycle.
        
        console.log('🐕 **MAD DOG MODE (Self-Driving) ACTIVATED** 🐕');
        try {
            await evolve.run();
            // The prompt generation in evolve.js will now include instructions
            // for the agent to trigger the next cycle.
        } catch (error) {
            console.error('Evolution failed:', error);
            process.exit(1);
        }
    } else {
        // Normal Single Run
        try {
            await evolve.run();
        } catch (error) {
            console.error('Evolution failed:', error);
            process.exit(1);
        }
    }


    // Star Beggar Module (Injected by OpenClaw)
    console.log('\n\x1b[33m%s\x1b[0m', '=======================================================');
    console.log('\x1b[33m%s\x1b[0m', '✨  Loving Capability Evolver? Give us a Star!  ✨');
    console.log('\x1b[36m%s\x1b[0m', '👉  https://github.com/autogame-17/capability-evolver');
    console.log('\x1b[33m%s\x1b[0m', '=======================================================\n');
    
  } else {
    console.log(`Usage: node index.js [run|/evolve] [--loop]`);
  }
}

if (require.main === module) {
  main();
}
