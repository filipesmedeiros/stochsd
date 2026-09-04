/*

This file may distributed and/or modified under the
terms of the Affero General Public License (http://www.gnu.org/licenses/agpl-3.0.html).

*/

// Runs in an isolated context with access to Node APIs, before the page's own
// scripts. This is the only bridge between the renderer (editor.js,
// environment.js — no Node access, contextIsolation is on) and the main
// process (real file/dialog access). Everything the desktop app can do to the
// filesystem or OS has to be listed here explicitly.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	// A plain marker property, not a function: lets environment.js detect it is
	// running inside this shell without needing Node globals like `process`.
	isElectron: true,

	showSaveDialog: (defaultPath, extension) => ipcRenderer.invoke("dialog:save", defaultPath, extension),
	showOpenDialog: (extension) => ipcRenderer.invoke("dialog:open", extension),
	readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
	writeFile: (filePath, contents) => ipcRenderer.invoke("file:write", filePath, contents),
	openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),

	// The main process intercepts the window's close button so unsaved changes
	// can be checked first; this is how it asks, and how the renderer replies
	// once it has decided (or the user confirmed) it is safe to actually quit.
	onTryToClose: (callback) => ipcRenderer.on("window:try-close", () => callback()),
	confirmClose: () => ipcRenderer.send("window:confirm-close"),

	// Fires when the app was launched with a model file — double-clicked in the
	// Finder/Explorer, or "Open with StochSD".
	onOpenFile: (callback) => ipcRenderer.on("app:open-file", (event, filePath) => callback(filePath)),
});
