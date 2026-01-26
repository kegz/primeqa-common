const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const distEsmDir = path.join(__dirname, 'dist-esm');
const distCjsDir = path.join(__dirname, 'dist-cjs');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

// Copy ESM build and rename to .mjs
const esmIndexJs = path.join(distEsmDir, 'index.js');
const esmIndexDts = path.join(distEsmDir, 'index.d.ts');

if (fs.existsSync(esmIndexJs)) {
	fs.copyFileSync(esmIndexJs, path.join(distDir, 'index.mjs'));
	console.log('✓ Created index.mjs (ESM)');
}

if (fs.existsSync(esmIndexDts)) {
	fs.copyFileSync(esmIndexDts, path.join(distDir, 'index.d.ts'));
	console.log('✓ Created index.d.ts');
}

// Copy ESM directory structure
const copyDirRecursive = (src, dest) => {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}
	const files = fs.readdirSync(src);
	files.forEach(file => {
		const srcPath = path.join(src, file);
		const destPath = path.join(dest, file);
		if (fs.statSync(srcPath).isDirectory()) {
			copyDirRecursive(srcPath, destPath);
		} else if (!fs.existsSync(destPath)) {
			fs.copyFileSync(srcPath, destPath);
		}
	});
};

copyDirRecursive(distEsmDir, distDir);

// Copy CJS build and rename to .cjs
const cjsIndexJs = path.join(distCjsDir, 'index.js');
if (fs.existsSync(cjsIndexJs)) {
	fs.copyFileSync(cjsIndexJs, path.join(distDir, 'index.cjs'));
	console.log('✓ Created index.cjs (CommonJS)');
}

// Clean up temporary directories
const removeDir = (dir) => {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
		console.log(`✓ Removed ${path.basename(dir)}`);
	}
};

removeDir(distEsmDir);
removeDir(distCjsDir);
