import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { useref } from "./scripts/vite-plugin-useref.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

export function stochsdVersion() {
	const content = fs.readFileSync(path.join(root, "OpenSystemDynamics/src/version.js"), "utf8");
	const match = content.match(/version:\s*["']([^"']+)["']/);
	if (!match) throw new Error("Could not read version from OpenSystemDynamics/src/version.js");
	return match[1];
}

// Assets referenced only from JavaScript strings (tool icons, plot glyphs, PWA
// files). Vite cannot see these, so copy the trees verbatim.
const STATIC_DIRS = [
	"icons",
	"OpenSystemDynamics/src/graphics",
	"MultiSimulationAnalyser/img",
	"MultiSimulationAnalyser/images",
	"MultiSimulationAnalyser/icons",
	"MultiSimulationAnalyser/im_img",
];

const STATIC_FILES = [
	"MultiSimulationAnalyser/multisimulationanalyser-manifest.json",
	"MultiSimulationAnalyser/multisimulationanalyser-serviceworker.js",
	"MultiSimulationAnalyser/stochsd-128.png",
	"MultiSimulationAnalyser/stochsd-256.png",
];

function copyStatic(outDir) {
	return {
		name: "stochsd:copy-static",
		apply: "build",
		closeBundle() {
			for (const dir of STATIC_DIRS) {
				const from = path.join(root, dir);
				if (!fs.existsSync(from)) continue;
				fs.cpSync(from, path.join(outDir, dir), { recursive: true });
			}
			for (const file of STATIC_FILES) {
				const from = path.join(root, file);
				if (!fs.existsSync(from)) continue;
				fs.mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
				fs.copyFileSync(from, path.join(outDir, file));
			}
			// start.html is the launcher; on the web it is the landing page.
			fs.copyFileSync(path.join(root, "start.html"), path.join(outDir, "index.html"));

			// The PWA manifest's start_url points at standalone.html, which is just
			// the built analyser page under another name.
			const msa = path.join(outDir, "MultiSimulationAnalyser");
			fs.copyFileSync(path.join(msa, "index.html"), path.join(msa, "standalone.html"));
		},
	};
}

// Vite fingerprints every asset it finds in HTML. That is right for images and
// stylesheets but wrong for the PWA manifest, whose own contents use relative
// paths ("./standalone.html", "stochsd-256.png") that only resolve while it
// sits in its original directory — which copyStatic keeps it in.
function htmlFixups() {
	return {
		name: "stochsd:html-fixups",
		apply: "build",
		transformIndexHtml: {
			order: "post",
			handler(html) {
				return html
					.replace(
						/(<link[^>]*rel=["']manifest["'][^>]*href=)["'][^"']*["']/gi,
						'$1"multisimulationanalyser-manifest.json"',
					)
					// crossorigin on a stylesheet blocks it over file:// in nw.js.
					.replace(/(<link[^>]*rel=["']stylesheet["'][^>]*)\scrossorigin(?=[\s>])/gi, "$1");
			},
		},
	};
}

export default defineConfig(() => {
	const outDir = path.join(root, "distribute/output/web", stochsdVersion());

	return {
		root,
		// Relative URLs so the output also works over file:// (nw.js / Electron).
		base: "./",
		appType: "mpa",
		build: {
			outDir,
			emptyOutDir: true,
			// The concatenated legacy bundles are emitted by the useref plugin and
			// must keep their exact filenames; nothing else is big enough to matter.
			assetsInlineLimit: 0,
			rollupOptions: {
				input: {
					msa: path.join(root, "MultiSimulationAnalyser/index.html"),
					editor: path.join(root, "OpenSystemDynamics/src/index.html"),
					license: path.join(root, "OpenSystemDynamics/src/license.html"),
					thirdParty: path.join(root, "OpenSystemDynamics/src/third-party-licenses.html"),
				},
			},
		},
		plugins: [useref({ minify: process.env.MINIFY === "1" }), htmlFixups(), copyStatic(outDir)],
	};
});
