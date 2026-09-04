/*

This file may distributed and/or modified under the
terms of the Affero General Public License (http://www.gnu.org/licenses/agpl-3.0.html).

*/

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const fs = require("fs/promises");
const path = require("path");

// Paths are relative to this file so the same code works both run from the
// repo root in development ("electron .") and from the copy gulp assembles
// under distribute/output — both keep electron/ as a sibling of start.html
// and icons/.
const appRoot = path.join(__dirname, "..");
const entryPoint = path.join(appRoot, "start.html");
const iconPath = path.join(appRoot, "icons", "stochsd.png");
const fileExtension = ".ssd";

let mainWindow;
// A file path the app was launched with (double-clicked, "Open with…", or a
// CLI argument), captured before the window exists so it isn't lost.
let pendingOpenFilePath = readFilePathFromArgv(process.argv);

// Only one window: a second launch (e.g. double-clicking another .ssd file)
// hands its file path to this instance instead of opening a second window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", (event, argv) => {
		let filePath = readFilePathFromArgv(argv);
		if (filePath) {
			sendOpenFile(filePath);
		}
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}
			mainWindow.focus();
		}
	});

	// macOS delivers a file-association launch as this event, separately from
	// argv, and can fire before the app is ready.
	app.on("open-file", (event, filePath) => {
		event.preventDefault();
		if (mainWindow) {
			sendOpenFile(filePath);
		} else {
			pendingOpenFilePath = filePath;
		}
	});

	app.whenReady().then(() => {
		// The app has its own in-page menu bar (the "File"/"View"/… buttons in
		// index.html); Electron's default native menu would just duplicate it.
		Menu.setApplicationMenu(null);
		createWindow();
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
}

function readFilePathFromArgv(argv) {
	// argv[0] is the electron binary and, in development, argv[1] is "."
	// (the app path); a real launch file is whatever is left after those.
	let args = app.isPackaged ? argv.slice(1) : argv.slice(2);
	let filePath = args.find((arg) => arg.toLowerCase().endsWith(fileExtension));
	return filePath || null;
}

function sendOpenFile(filePath) {
	mainWindow.webContents.send("app:open-file", filePath);
}

function createWindow() {
	let readyToClose = false;

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		icon: iconPath,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			// The actual editor (environment.js, editor.js) runs inside
			// MultiSimulationAnalyser's #SimulationIFrame, not the top-level page —
			// without this the preload script only reaches the outer frame, so
			// window.electronAPI is undefined where detectEnvironment() checks for
			// it and the app silently falls back to browser-storage behavior.
			nodeIntegrationInSubFrames: true,
		},
	});

	mainWindow.maximize();
	mainWindow.setMenuBarVisibility(false);
	mainWindow.loadFile(entryPoint);

	mainWindow.webContents.on("did-finish-load", () => {
		if (pendingOpenFilePath) {
			sendOpenFile(pendingOpenFilePath);
			pendingOpenFilePath = null;
		}
	});

	// Unsaved changes are checked in the renderer (History.unsavedChanges), so
	// closing has to round-trip through it rather than happen here directly.
	mainWindow.on("close", (event) => {
		if (readyToClose) {
			return;
		}
		event.preventDefault();
		mainWindow.webContents.send("window:try-close");
	});

	mainWindow.confirmClose = () => {
		readyToClose = true;
		mainWindow.close();
	};
}

// Registered once at module scope (not inside createWindow) so a second
// window — e.g. after all windows closed and the dock icon reopened one on
// macOS — doesn't add a duplicate listener.
ipcMain.on("window:confirm-close", () => {
	if (mainWindow) {
		mainWindow.confirmClose();
	}
});

ipcMain.handle("dialog:save", async (event, defaultPath, extension) => {
	let ext = (extension || fileExtension).replace(/^\./, "");
	let result = await dialog.showSaveDialog(mainWindow, {
		defaultPath,
		filters: [
			{ name: ext === "ssd" ? "StochSD Models" : ext.toUpperCase() + " Files", extensions: [ext] },
			{ name: "All Files", extensions: ["*"] },
		],
	});
	return result.canceled ? null : result.filePath;
});

ipcMain.handle("dialog:open", async (event, extension) => {
	let result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openFile"],
		filters: [
			{ name: "StochSD Models", extensions: [(extension || fileExtension).replace(/^\./, "")] },
			{ name: "All Files", extensions: ["*"] },
		],
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("file:read", async (event, filePath) => {
	return fs.readFile(filePath, "utf8");
});

ipcMain.handle("file:write", async (event, filePath, contents) => {
	await fs.writeFile(filePath, contents, "utf8");
});

ipcMain.handle("shell:open-external", async (event, url) => {
	await shell.openExternal(url);
});
