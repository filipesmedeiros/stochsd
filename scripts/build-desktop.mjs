/*
Builds distribute/output/package.nw — the nw.js desktop payload.

Unlike the web build this is a verbatim copy: the desktop app loads the source
files as they are, so stack traces point at real files and the code stays
debuggable. That was true of the old gulp build too, and the packaging scripts
under distribute/package-for-* consume this directory unchanged.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "distribute/output");
const packageDir = path.join(outputDir, "package.nw");

const EXCLUDE = new Set(["node_modules", ".git", ".DS_Store", "build", "dist", "package-lock.json"]);

const filter = (src) => !EXCLUDE.has(path.basename(src));

const copyDir = (rel) => {
	const from = path.join(root, rel);
	if (!fs.existsSync(from)) throw new Error(`Missing directory: ${rel}`);
	fs.cpSync(from, path.join(packageDir, rel), { recursive: true, filter });
};

const copyFile = (rel, destDir = packageDir) => {
	const from = path.join(root, rel);
	if (!fs.existsSync(from)) throw new Error(`Missing file: ${rel}`);
	fs.mkdirSync(destDir, { recursive: true });
	fs.copyFileSync(from, path.join(destDir, path.basename(rel)));
};

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });

// package.json makes `nw .` runnable straight out of the output folder.
for (const file of ["LICENSE.txt", "start.html", "package.json"]) copyFile(file);
for (const dir of ["OpenSystemDynamics", "icons", "MultiSimulationAnalyser"]) copyDir(dir);

// The packaging scripts pick these up next to package.nw, not inside it.
copyFile("OpenSystemDynamics/src/license.html", outputDir);
copyFile("OpenSystemDynamics/src/third-party-licenses.html", outputDir);

console.log(`Built ${path.relative(root, packageDir)}`);
