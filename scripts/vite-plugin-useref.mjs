import fs from "node:fs";
import path from "node:path";

/*
Concatenates the classic <script> tags inside the useref-style blocks that both
index.html files already carry:

	<!-- build:js opensystemdynamics.min.js -->
	...script tags...
	<!-- endbuild -->

Those files are plain scripts sharing global scope and depending on load order,
so concatenating them in order is equivalent to loading them in order. Vite
itself only bundles type="module" scripts and leaves classic ones alone, which
is why this plugin exists — it does what gulp-useref used to do.

CSS is not handled here: Vite already bundles <link rel="stylesheet"> tags and
rewrites their url() references correctly, which is more than useref did.

Build only. The dev server keeps the original tags so you debug real files.
*/

const BLOCK = /([ \t]*)<!--\s*build:js\s+(\S+)\s*-->([\s\S]*?)<!--\s*endbuild\s*-->/g;
const TAG_SRC = /src\s*=\s*["']([^"']+)["']/g;

const isExternal = (url) => /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("data:");

export function useref({ minify = false } = {}) {
	let config;

	return {
		name: "stochsd:useref",
		apply: "build",
		configResolved(resolved) {
			config = resolved;
		},
		transformIndexHtml: {
			order: "post",
			async handler(html, ctx) {
				const root = config.root;
				const htmlDir = path.dirname(ctx.filename);
				// Where this page lives relative to the build root, e.g. "OpenSystemDynamics/src".
				const htmlOutDir = path.relative(root, htmlDir).split(path.sep).join("/");

				let out = html;

				for (const [full, indent, outName, body] of html.matchAll(BLOCK)) {
					const sources = [...body.matchAll(TAG_SRC)]
						.map((m) => m[1])
						.filter((url) => !isExternal(url));

					if (sources.length === 0) continue;

					const chunks = [];
					for (const src of sources) {
						const abs = path.resolve(htmlDir, src.split("?")[0].split("#")[0]);
						if (!fs.existsSync(abs)) {
							this.warn(`useref: missing ${src} referenced by ${path.relative(root, ctx.filename)}`);
							continue;
						}
						const rel = path.relative(root, abs).split(path.sep).join("/");
						chunks.push(`/* ${rel} */\n${fs.readFileSync(abs, "utf8")}`);
					}

					// Semicolons between files: several of these end in an expression
					// without a terminator, which is safe as separate <script> tags but
					// not once concatenated.
					let source = chunks.join("\n;\n");

					if (minify) {
						const esbuild = await import("esbuild");
						source = (
							await esbuild.transform(source, {
								loader: "js",
								minify: true,
								// Globals-in-script-scope code: never rename anything.
								keepNames: true,
							})
						).code;
					}

					this.emitFile({
						type: "asset",
						fileName: htmlOutDir ? `${htmlOutDir}/${outName}` : outName,
						source,
					});

					out = out.replace(full, `${indent}<script type="text/javascript" src="${outName}"></script>`);
				}

				return out;
			},
		},
	};
}
