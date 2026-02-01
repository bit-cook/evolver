const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { execSync } = require('child_process');

// Try to resolve ffmpeg-static from workspace root
let ffmpegPath;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (e) {
    try {
        ffmpegPath = require(path.resolve(__dirname, '../../node_modules/ffmpeg-static'));
    } catch (e2) {
        console.warn('Warning: ffmpeg-static not found. GIF conversion will fail.');
    }
}

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // Load workspace .env

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY not set");
    process.exit(1);
}

const STICKER_DIR = "/home/crishaocredits/.openclaw/media/stickers";
const TRASH_DIR = path.join(STICKER_DIR, "trash");
const INDEX_FILE = path.join(STICKER_DIR, 'index.json');

const genAI = new GoogleGenerativeAI(API_KEY);

// Use the specific model found via curl or fallback, allow env override
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true });

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: fs.readFileSync(path).toString("base64"),
      mimeType,
    },
  };
}

async function run() {
  // Load Index
  let index = {};
  if (fs.existsSync(INDEX_FILE)) {
      try { index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch (e) {
          console.error("Failed to parse index.json, starting fresh.");
      }
  }

  let allFiles = [];
  try {
      allFiles = fs.readdirSync(STICKER_DIR);
  } catch (e) {
      console.error(`Error reading directory ${STICKER_DIR}:`, e.message);
      return;
  }
  
  // 1. Cleanup Stale Entries
  let indexChanged = false;
  const initialIndexCount = Object.keys(index).length;
  for (const key of Object.keys(index)) {
      if (!allFiles.includes(key)) {
          console.log(`Removing stale index entry: ${key}`);
          delete index[key];
          indexChanged = true;
      }
  }
  if (indexChanged) {
      console.log(`Cleaned up ${initialIndexCount - Object.keys(index).length} stale entries.`);
  }

  // 2. Filter Files to Process
  const filesToProcess = allFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
    let isFile = false;
    try { isFile = fs.statSync(path.join(STICKER_DIR, file)).isFile(); } catch (e) { return false; }
    
    const isIndexed = index.hasOwnProperty(file);
    
    // Process if it's a valid image AND (not indexed OR it's a GIF that might need conversion)
    return isImage && isFile && (!isIndexed || ext === '.gif'); 
  });

  console.log(`Found ${filesToProcess.length} new or unindexed images to analyze.`);

  if (filesToProcess.length === 0 && !indexChanged) {
      console.log("Nothing to do.");
      // Just ensure index is saved if it changed
      if (indexChanged) fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
      return;
  }

  for (const file of filesToProcess) {
    let filePath = path.join(STICKER_DIR, file);
    let mimeType = file.endsWith(".png") ? "image/png" : (file.endsWith(".webp") ? "image/webp" : "image/jpeg");
    let currentFile = file;

    // Convert GIF to WebP if found
    if (file.toLowerCase().endsWith('.gif')) {
        if (!ffmpegPath) {
            console.log(`Skipping ${file} (ffmpeg not found for conversion)`);
            continue;
        }
        console.log(`Converting GIF ${file} to WebP...`);
        const webpPath = filePath.replace(/\.gif$/i, '.webp');
        try {
            execSync(`${ffmpegPath} -i "${filePath}" -c:v libwebp -lossless 0 -q:v 75 -loop 0 -an -vsync 0 -y "${webpPath}"`, { stdio: 'pipe' });
            if (fs.existsSync(webpPath)) {
                fs.unlinkSync(filePath); // Delete original GIF
                filePath = webpPath;
                currentFile = path.basename(webpPath);
                mimeType = "image/webp";
                console.log(`Converted to ${currentFile}`);
                
                // If the converted file is already indexed, we can skip analysis
                if (index[currentFile]) {
                    console.log(`Converted file ${currentFile} is already indexed. Skipping analysis.`);
                    continue; 
                }
            }
        } catch (e) {
            console.error(`Failed to convert ${file}, skipping:`, e.message);
            continue;
        }
    }

    console.log(`Analyzing ${currentFile}... Using ${MODEL_NAME}`);

    try {
      const prompt = `Analyze this image. 
      First, determine if it is a "sticker" or "meme" suitable for use in a chat conversation as a reaction.
      It is NOT a sticker if it is a screenshot of UI, document, real photo of papers, or complex diagram.
      It IS a sticker if it is a character, anime face, meme, or expressive icon.
      
      If it is a sticker, describe its EMOTION (e.g., happy, angry, confused, crying, smug) and KEYWORDS (e.g., cat, girl, computer, coffee).
      
      Reply with JSON ONLY: 
      {
        "is_sticker": boolean, 
        "reason": "string",
        "emotion": "string (or null if not sticker)",
        "keywords": ["tag1", "tag2"] (or empty if not sticker)
      }`;

      const imagePart = fileToGenerativePart(filePath, mimeType);
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      console.log(`Response: ${text}`);

      let analysis = {};
      try {
          const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
          analysis = JSON.parse(cleanJson);
      } catch (e) {
          console.error("JSON parse failed");
      }

      if (!analysis.is_sticker) {
        console.log(`❌ Not a sticker. Moving to trash.`);
        fs.renameSync(filePath, path.join(TRASH_DIR, currentFile));
        // Remove from index if needed
        if (index[currentFile]) delete index[currentFile]; 
      } else {
        console.log(`✅ Sticker confirmed: ${analysis.emotion} [${analysis.keywords?.join(', ')}]`);
        
        // Update index object
        index[currentFile] = {
            path: filePath,
            emotion: analysis.emotion,
            keywords: analysis.keywords,
            addedAt: Date.now()
        };
        
        // Write immediately to save progress
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
      }

    } catch (e) {
      console.error(`Error processing ${currentFile}:`, e.message);
    }
    
    // Simple sleep to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Final save
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

run();
