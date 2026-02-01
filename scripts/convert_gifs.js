const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const stickersDir = path.resolve('/home/crishaocredits/.openclaw/media/stickers');
// inbound doesn't exist, but let's check media root just in case
const mediaDir = path.resolve('/home/crishaocredits/.openclaw/media');

function convertDir(dir) {
    if (!fs.existsSync(dir)) return;
    console.log(`Scanning ${dir} for GIFs...`);
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        if (file.toLowerCase().endsWith('.gif')) {
            const inputPath = path.join(dir, file);
            const outputPath = path.join(dir, file.replace(/\.gif$/i, '.webp'));
            
            console.log(`Converting ${file} -> ${path.basename(outputPath)}`);
            try {
                // ffmpeg -i input.gif -c:v libwebp -lossless 0 -q:v 75 -loop 0 -an -vsync 0 output.webp
                // -loop 0 preserves looping. -an removes audio (gifs usually don't have it but good practice).
                execSync(`${ffmpegPath} -i "${inputPath}" -c:v libwebp -lossless 0 -q:v 75 -loop 0 -an -vsync 0 -y "${outputPath}"`, { stdio: 'inherit' });
                
                if (fs.existsSync(outputPath)) {
                    console.log(`Deleted original: ${file}`);
                    fs.unlinkSync(inputPath);
                }
            } catch (e) {
                console.error(`Failed to convert ${file}:`, e.message);
            }
        }
    });
}

convertDir(stickersDir);
// convertDir(path.join(mediaDir, 'inbound')); // Inbound doesn't exist yet
