const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const distEsmDir = path.join(__dirname, 'dist-esm');
const distCjsDir = path.join(__dirname, 'dist-cjs');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

// Copy ESM build and rename to .mjs, add .js extensions to imports
const esmIndexJs = path.join(distEsmDir, 'index.js');
const esmIndexDts = path.join(distEsmDir, 'index.d.ts');

if (fs.existsSync(esmIndexJs)) {
	let esmContent = fs.readFileSync(esmIndexJs, 'utf8');
	// Add .js extension to all export statements
	esmContent = esmContent.replace(/export \* from ["']\.\/([^"']+)(?<!\.js)["']/g, 'export * from "./$1.js"');
	fs.writeFileSync(path.join(distDir, 'index.mjs'), esmContent);
	console.log('✓ Created index.mjs (ESM with .js extensions)');
}

if (fs.existsSync(esmIndexDts)) {
	fs.copyFileSync(esmIndexDts, path.join(distDir, 'index.d.ts'));
	console.log('✓ Created index.d.ts');
}

// Copy ESM directory structure and fix imports in all .js files
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
			let content = fs.readFileSync(srcPath, 'utf8');
			// Add .js extension to all imports/exports in ESM files
			if (srcPath.endsWith('.js')) {
				content = content.replace(/from ["']\.\/([^"']+)(?<!\.js)["']/g, 'from "./$1.js"');
				content = content.replace(/from ["']\.\.\/([^"']+)(?<!\.js)["']/g, 'from "../$1.js"');
			}
			fs.writeFileSync(destPath, content);
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
