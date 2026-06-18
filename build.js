import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = ['index.html', 'style.css', 'app.js', 'manifest.json', 'sw.js', 'icon.png'];
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)){
    fs.mkdirSync(distDir, { recursive: true });
}

files.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file} to dist/`);
    } else {
        console.warn(`Warning: ${file} not found!`);
    }
});
console.log("Build completed successfully.");
