const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// MAX RETRIES for file lock contention
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 200;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalize(text) {
    // Normalize line endings to LF and strip trailing whitespace per line
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(line => line.trimEnd()).join('\n');
}

async function safeUpdate(filePath, options) {
    const absPath = path.resolve(filePath);
    
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
        attempts++;
        try {
            // 1. Read fresh content
            if (!fs.existsSync(absPath)) {
                if (options.operation === 'create') {
                    fs.writeFileSync(absPath, '', 'utf8');
                } else {
                    console.error(`File not found: ${absPath}`);
                    process.exit(1);
                }
            }
            
            let content = fs.readFileSync(absPath, 'utf8');
            let originalContent = content;

            // 2. Normalize
            content = normalize(content);

            // 3. Apply changes
            let modified = false;

            if (options.operation === 'replace') {
                const search = (options.old !== undefined) ? options.old : options.search;
                const replace = (options.new !== undefined) ? options.new : options.replace;
                
                if (search === undefined || replace === undefined) {
                    console.error("Replace operation requires --old/--search and --new/--replace");
                    process.exit(1);
                }

                // Try exact match first
                if (content.includes(search)) {
                    content = content.replace(search, replace);
                    modified = true;
                    console.log("Status: Exact match successful.");
                } else {
                    // Try normalized match
                    const normSearch = normalize(search);
                    if (content.includes(normSearch)) {
                        content = content.replace(normSearch, replace);
                        modified = true;
                        console.log("Status: Normalized match successful.");
                    } else {
                        console.error("Error: Could not find target text even after normalization.");
                        console.log("Diagnostics - Target text start:", search.substring(0, 50));
                        process.exit(1);
                    }
                }
            } else if (options.operation === 'append') {
                if (!options.content) {
                    console.error("Append requires --content");
                    process.exit(1);
                }
                if (!content.endsWith('\n') && content.length > 0) content += '\n';
                content += options.content + '\n';
                modified = true;
                console.log("Status: Append successful.");
            }

            // 4. Write back with Retry Logic
            if (modified) {
                // Check if file changed on disk while we were processing (Race Condition Check)
                const currentFileContent = fs.readFileSync(absPath, 'utf8');
                if (normalize(currentFileContent) !== normalize(originalContent)) {
                    throw new Error("File changed on disk during processing (Race Condition). Retrying...");
                }

                fs.writeFileSync(absPath, content, 'utf8');
                console.log("Success: Memory file updated safely.");
                return; // Success
            } else {
                console.log("No changes needed.");
                return;
            }

        } catch (e) {
            console.error(`Attempt ${attempts} failed: ${e.message}`);
            if (attempts < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * attempts + Math.floor(Math.random() * 100);
                console.log(`Retrying in ${delay}ms...`);
                await sleep(delay);
            } else {
                console.error("Max retries exceeded. Aborting update.");
                process.exit(1);
            }
        }
    }
}

program
  .requiredOption('-f, --file <path>', 'Target file path', 'MEMORY.md')
  .requiredOption('-o, --operation <type>', 'Operation: replace | append | create')
  .option('--old <text>', 'Text to replace')
  .option('--new <text>', 'Replacement text')
  .option('--search <text>', 'Alias for --old')
  .option('--replace <text>', 'Alias for --new')
  .option('--content <text>', 'Content to append')
  .option('--content-file <path>', 'Read content from file')
  .option('--old-file <path>', 'Read old text from file')
  .option('--new-file <path>', 'Read new text from file')
  .parse(process.argv);

const options = program.opts();

// Handle file inputs
if (options.contentFile) options.content = fs.readFileSync(options.contentFile, 'utf8').trim();
if (options.oldFile) options.old = fs.readFileSync(options.oldFile, 'utf8').trim();
if (options.newFile) options.new = fs.readFileSync(options.newFile, 'utf8').trim();

safeUpdate(options.file, options);
