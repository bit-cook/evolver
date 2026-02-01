const fs = require('fs');
const path = require('path');
const { detectMime } = require('./lib/magic');
const { gifToPng, toWebP, extractAudio, videoToGif } = require('./lib/convert');

const args = process.argv.slice(2);
const action = args[0];

// Parse args more robustly
function getArg(name) {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const fileArg = getArg('--file');
const dirArg = getArg('--dir');

if (!fileArg && !dirArg) {
    console.error(JSON.stringify({ error: 'Error: --file or --dir argument required' }));
    process.exit(1);
}

const MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/gzip': 'gz'
};

async function processFile(filePath) {
    try {
        if (action === 'detect') {
            const mime = detectMime(filePath);
            const ext = mime ? MIME_TO_EXT[mime] : null;
            return { file: filePath, mime: mime || 'application/octet-stream', ext };

        } else if (action === 'fix') {
            const mime = detectMime(filePath);
            if (!mime) {
                return { original: filePath, fixed: filePath, mime: 'application/octet-stream', note: 'Could not detect magic bytes' };
            }

            const correctExt = MIME_TO_EXT[mime];
            const currentExt = path.extname(filePath).replace('.', '').toLowerCase();

            if (correctExt && currentExt !== correctExt) {
                const dir = path.dirname(filePath);
                const name = path.basename(filePath, path.extname(filePath));
                let newPath = path.join(dir, `${name}.${correctExt}`);
                
                // Collision avoidance
                let counter = 1;
                while (fs.existsSync(newPath)) {
                    newPath = path.join(dir, `${name}_${counter}.${correctExt}`);
                    counter++;
                }

                try {
                    fs.renameSync(filePath, newPath);
                    return { original: filePath, fixed: newPath, mime: mime, note: `Renamed from .${currentExt} to .${correctExt}` };
                } catch (renameErr) {
                    return { error: `Failed to rename: ${renameErr.message}`, file: filePath };
                }
            } else {
                return { original: filePath, fixed: filePath, mime: mime, note: 'Extension correct' };
            }

        } else if (action === 'convert') {
            const mime = detectMime(filePath);
            const targetFormat = getArg('--format');
            
            try {
                let newPath;
                if (targetFormat === 'mp3') {
                    newPath = await extractAudio(filePath);
                } else if (targetFormat === 'gif') {
                    newPath = await videoToGif(filePath);
                } else if (targetFormat === 'webp') {
                    newPath = await toWebP(filePath);
                } else if (targetFormat === 'png' && mime === 'image/gif') {
                    newPath = await gifToPng(filePath);
                } else if (mime === 'image/gif') {
                    newPath = await gifToPng(filePath);
                } else {
                    return { path: filePath, mime: mime, converted: false, note: 'No conversion performed' };
                }

                return {
                    original: filePath,
                    path: newPath,
                    mime: targetFormat ? `application/${targetFormat}` : 'image/png',
                    converted: true
                };
            } catch(err) {
                return { error: err.message, file: filePath };
            }
        }
    } catch (err) {
        return { error: `Unexpected: ${err.message}`, file: filePath };
    }
    return { error: 'Unknown action', file: filePath };
}

(async () => {
    if (dirArg) {
        // Batch Processing
        if (!fs.existsSync(dirArg)) {
            console.error(JSON.stringify({ error: `Directory not found: ${dirArg}` }));
            process.exit(1);
        }
        
        const files = fs.readdirSync(dirArg).filter(f => fs.statSync(path.join(dirArg, f)).isFile());
        const results = [];
        
        // Process sequentially to avoid CPU overload (ffmpeg)
        for (const f of files) {
            const result = await processFile(path.join(dirArg, f));
            results.push(result);
        }
        console.log(JSON.stringify(results, null, 2));

    } else {
        // Single File
        if (!fs.existsSync(fileArg)) {
            console.error(JSON.stringify({ error: `File not found: ${fileArg}` }));
            process.exit(1);
        }
        const result = await processFile(fileArg);
        console.log(JSON.stringify(result));
    }
})();
