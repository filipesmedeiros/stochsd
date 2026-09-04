/*

This file may distributed and/or modified under the
terms of the Affero General Public License (http://www.gnu.org/licenses/agpl-3.0.html).

*/

// This file controls the things that depend on which environment the
// software is running in. There are two supported environments:
// 1. Web
// 2. Electron (https://electronjs.org)
//
// The things that depend on the environment are things such as file handling
// and window closing. The decision of which environment to use is at the
// bottom of this file.

const appName = "StochSD";

class BaseFileManager {
  constructor() {
    this._fileName = "";
    // Name this model has in browser storage, or null if it is not stored there.
    this.storedModelName = null;
    this.lastSaved = null;
    this.softwareName = appName;
  }
  // True where the environment cannot properly write files, so models live in
  // browser storage by default and files are only used for import/export.
  // Where this is false, Save and Open keep working on real files and browser
  // storage is offered as a secondary place to keep models.
  usesBrowserStorage() {
    return false;
  }
  // This is executed when the document is ready
  ready() {
    // Override this
    this.updateTitle();
  }
  newModel() {
    localStorage.removeItem("reloadPending");
    this._fileName = "";
    this.storedModelName = null;
    this.updateTitle();
    applicationReload();
  }
  newModelOld() {
    History.clearUndoHistory();
    newModel();
    // Store an empty state as first state
    History.storeUndoState();
    // There is no last state is it could not be unsaved
    History.unsavedChanges = false;
    this.fileName = null;
    this.lastSaved = null;
    this.updateTitle();
    // Optional handler for when saving is finished
    this.finishedSaveHandler = null;
    RunResults.resetSimulation();
  }
  saveModelAs() {
    let fileData = createModelFileData();
    // Only exportFile is implementation specific (differs per environment)
    this.exportFile(fileData, Settings.fileExtension, (filePath) => {
      this.fileName = filePath;
      markModelSaved();
      this.updateSaveTime();
      this.updateTitle();
      if (this.finishedSaveHandler) {
        this.finishedSaveHandler();
      }
    });
  }
  // Writing the model out to a file. Where Save already means "to a file" this
  // is the same operation, so the menu only offers it separately when browser
  // storage has taken over Save.
  exportModel() {
    this.saveModelAs();
  }
  // Reading a model in from a file, without it becoming the save target.
  // openFile comes from insightmaker/API/API.js.
  async importModel() {
    openFile({
      read: "text",
      multiple: false,
      accept: Settings.fileExtension,
      onCompleted: (model) => {
        this.fileName = model.name;
        // Imported from a file, so there is no browser-storage entry behind it
        // yet and a following Save has to ask for a name.
        this.storedModelName = null;
        do_global_log("web load file call  back");
        History.forceCustomUndoState(model.contents);
        this.updateTitle();
        preserveRestart();
      },
    });
  }
  hasSaveAs() {
    return false;
  }
  hasRecentFiles() {
    return false;
  }
  saveModel() {
    // Override this
  }
  async loadModel() {
    // Override this
  }
  async init() {
    // Override this
  }
  async clean() {
    // Override this
  }
  setTitle(newTitleRaw) {
    // None breaking space
    const nbsp = String.fromCharCode(160);
    // string.replace does not work with char(160) for some reason, so we had to make our own
    let newTitle = "";
    for (var i = 0; i < newTitleRaw.length; i++) {
      let tchar = newTitleRaw.charAt(i);
      if (tchar == " ") {
        newTitle = newTitle + nbsp;
      } else {
        newTitle = newTitle + tchar;
      }
    }
    if (window !== window.top) {
      // In iFrame
      setParentTitle(newTitle);
    } else {
      // Not in iFrame
      document.title = newTitle;
    }
  }
  loadModelData(modelData) {
    History.clearUndoHistory();
    loadModelFromXml(modelData);
    // Store an empty state as first state
    History.storeUndoState();
    RunResults.resetSimulation();
  }
  updateSaveTime() {
    this.lastSaved = new Date().toLocaleTimeString();
  }
  updateTitle() {
    let title = this.softwareName;
    const nbsp = String.fromCharCode(160);
    if (this.fileName != "") {
      title += "   |   " + this.fileName;
      if (this.lastSaved) {
        title += "   (last saved: " + this.lastSaved + ")";
      }
    }
    this.setTitle(title);
  }
  set fileName(newFileName) {
    if (newFileName == null) {
      newFileName = "";
    }
    this._fileName = newFileName;
  }
  get fileName() {
    return this._fileName;
  }
  // A reasonable filename to suggest for this model, without its extension —
  // whatever it's currently known as, falling back to a generic name.
  defaultExportBaseName() {
    if (this.storedModelName) {
      return this.storedModelName;
    }
    if (this.fileName) {
      let baseName = this.fileName.split(/[\\/]/).pop();
      return baseName.replace(new RegExp(Settings.fileExtension + "$", "i"), "");
    }
    return "model";
  }
  appendFileExtension(filename, extension) {
    var extension_position = filename.length - extension.length;
    var current_extension = filename.substring(
      extension_position,
      filename.length
    );
    if (current_extension.toLowerCase() != extension.toLowerCase()) {
      filename += extension;
    }
    return filename;
  }
  /** @param {File} file */
  async loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const contents = event.target.result;
      this.fileName = file.name;
      // Dropped in from disk, so it has no browser-storage entry behind it yet.
      this.storedModelName = null;
      console.log("load event.target", event.target);

      do_global_log("web load file call  back");
      var fileData = contents;
      History.forceCustomUndoState(fileData);
      this.updateTitle();
      preserveRestart();
    }
    reader.onerror = (error) => {
      console.error(`Error reading file ${file.name}`, error);
    }
    reader.readAsText(file);
  }
}

class WebFileManagerBasic extends BaseFileManager {
  constructor() {
    super();
    this.softwareName = appName + " Web";
  }
  download(fileName, data) {
    // Create Blob and attach it to ObjectURL
    var blob = new Blob([data], { type: "octet/stream" }),
      url = window.URL.createObjectURL(blob);

    // Create download link and click it
    var a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // The setTimeout is a fix to make it work in Firefox
    // Without it, the objectURL is removed before the click-event is triggered
    // And the download does not work
    setTimeout(function () {
      window.URL.revokeObjectURL(url);
      a.remove();
    }, 1);
  }
  // This environment can only hand the user a download, never write back to a
  // file they opened, so models are kept in browser storage instead and files
  // are reached through Import and Export.
  usesBrowserStorage() {
    return true;
  }
  hasSaveAs() {
    return true;
  }
  saveModel() {
    saveModelToBrowser();
  }
  saveModelAs() {
    browserModelsDialog.showForSaveAs();
  }
  async loadModel() {
    browserModelsDialog.show();
  }
  exportModel() {
    let fileData = createModelFileData();

    this.exportFile(fileData, Settings.fileExtension, () => {
      this.updateSaveTime();
      this.updateTitle();
      if (this.finishedSaveHandler) {
        this.finishedSaveHandler();
      }
    });
  }
  // There is no File System Access API here (that's why this file manager was
  // chosen), so a real native picker isn't available — the closest thing is
  // the browser's own download flow, which opens a native save dialog when
  // the browser is set to ask where to save each file. Either way this beats
  // a prompt() box, which never offered a location picker to begin with.
  exportFile(dataToSave, fileExtension, onSuccess) {
    if (onSuccess == undefined) {
      // On success is optoinal, so if it was not set we set it to an empty function
      onSuccess = () => { };
    }

    const exportFileName = this.appendFileExtension(this.defaultExportBaseName(), fileExtension);
    this.download(exportFileName, dataToSave);
    onSuccess(exportFileName);
  }
}

class WebFileManagerModern extends BaseFileManager {
  constructor() {
    super();
    this.softwareName = appName + " Web";
    this.fileHandle = undefined;
  }

  async init() {
    this.fileHandle = await idbKeyval.get('fileHandle');
  }

  async clean() {
    await idbKeyval.del('fileHandle');
  }

  hasSaveAs() {
    return true;
  }

  hasRecentFiles() {
    return true;
  }
  async getRecentDisplayList() {
    let recentFiles = await this.getRecentFiles();
    return recentFiles.map((fileHandle) => {
      return fileHandle.name;
    })
  }
  async getRecentFiles() {
    let recentFiles;
    try {
      recentFiles = await idbKeyval.get("recentFiles") ?? []
    } catch {
      recentFiles = [];
    }
    return recentFiles;
  }
  async setRecentFiles(recentFiles) {
    idbKeyval.set("recentFiles", recentFiles);
  }
  async clearRecent() {
    idbKeyval.set("recentFiles", []);
  }

  async removeDuplicatesFromRecent(fileHandle, recentFiles) {
    let newRecentFiles = []
    for (let i in recentFiles) {
      if (!await recentFiles[i].isSameEntry(fileHandle)) {
        newRecentFiles.push(recentFiles[i]);
      }
    }
    return newRecentFiles;
  }

  async addToRecent() {
    let limit = Settings.MaxRecentFiles;

    let recentFiles = await this.getRecentFiles();

    recentFiles = await this.removeDuplicatesFromRecent(this.fileHandle, recentFiles);

    if (recentFiles.length <= limit) {
      recentFiles.splice(limit - 1);
    }
    recentFiles.unshift(this.fileHandle);
    await this.setRecentFiles(recentFiles);
  }
  async loadRecentByIndex(recentFileIndex) {
    const recentFiles = await this.getRecentFiles();
    const fileHandle = recentFiles[recentFileIndex];
    await this.loadFromFileHandle(fileHandle);
  }

  getFilePickerOptions() {
    return {
      suggestedName: "model.ssd",
      types: [
        {
          description: "StochSD Models",
          accept: {
            "text/stochsd": [".ssd"],
          },
        },
      ],
    };
  }

  async chooseFilename() {
    // Based on Chromes new file management API
    // https://web.dev/file-system-access/
    // So far only supported by Chromium based browsers, such as Chrome, Chromium and Edge

    const options = this.getFilePickerOptions();
    this.fileHandle = await window.showSaveFilePicker(options);
    this.fileName = this.fileHandle.name;
  }
  async writeToFile(contents) {
    const writable = await this.fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
  }

  async updateUIAfterSave() {
    this.updateSaveTime();
    this.updateTitle();
    markModelSaved();
    if (this.finishedSaveHandler) {
      this.finishedSaveHandler();
    }
  }

  async saveModelAs() {
    let contents = createModelFileData();
    try {
      await this.chooseFilename();
      await this.writeToFile(contents);
      await this.addToRecent();
      await this.updateUIAfterSave();
    } catch (e) {
      // Canceld
    }
  }

  async saveModel() {
    let contents = createModelFileData();
    if (this.fileHandle == undefined) {
      await this.saveModelAs();
      return;
    }
    await this.writeToFile(contents);
    await this.addToRecent();
    await this.updateUIAfterSave();
  }
  async loadModel() {
    const options = this.getFilePickerOptions();
    const [tmpFileHandle] = await window.showOpenFilePicker(options);
    await this.loadFromFileHandle(tmpFileHandle);
  }

  async verifyPermission(fileHandle, withWrite) {
    // Re-asking for permissons needed after page reload.
    // See:
    // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
    // https://stackoverflow.com/questions/66500836/domexception-the-request-is-not-allowed-by-the-user-agent-or-the-platform-in-th
    const opts = {};
    if (withWrite) {
      opts.mode = 'readwrite';
    }

    // Check if we already have permission, if so, return true.
    if (await fileHandle.queryPermission(opts) === 'granted') {
      return true;
    }

    // Request permission to the file, if the user grants permission, return true.
    if (await fileHandle.requestPermission(opts) === 'granted') {
      return true;
    }

    // The user did not grant permission, return false.
    return false;
  }

  async loadFromFileHandle(fileHandle) {
    const allowedPermission = await this.verifyPermission(fileHandle, false);
    if (!allowedPermission) {
      return;
    }
    await idbKeyval.del('fileHandle');
    this.fileHandle = fileHandle
    await idbKeyval.set('fileHandle', this.fileHandle);
    const file = await fileHandle.getFile();
    const fileData = await file.text();
    this.fileName = file.name;
    await this.addToRecent();
    History.forceCustomUndoState(fileData);
    this.updateTitle();
    preserveRestart();
  }
}

// Talks to electron/main.js through the bridge electron/preload.js exposes —
// no direct Node or Electron access here, since the renderer runs with
// contextIsolation/sandbox on (see electron/main.js's BrowserWindow options).
class ElectronFileManager extends BaseFileManager {
  constructor() {
    super();
    this.softwareName = appName + " Desktop";
  }

  ready() {
    super.ready();
    window.electronAPI.onOpenFile((filePath) => {
      saveChangedAlert(() => {
        this.loadFromFilePath(filePath);
      });
    });
  }
  hasSaveAs() {
    return true;
  }
  hasRecentFiles() {
    return true;
  }
  async getRecentDisplayList() {
    return await this.getRecentFiles();
  }
  async getRecentFiles() {
    let recentFiles = await idbKeyval.get("recentFiles");
    return Array.isArray(recentFiles) ? recentFiles : [];
  }
  async setRecentFiles(recentFiles) {
    await idbKeyval.set("recentFiles", recentFiles);
  }
  async addToRecent(filePath) {
    let limit = Settings.MaxRecentFiles;
    let recentFiles = await this.getRecentFiles();
    let existingIndex = recentFiles.indexOf(filePath);
    if (existingIndex !== -1) {
      recentFiles.splice(existingIndex, 1);
    }
    recentFiles.unshift(filePath);
    if (recentFiles.length > limit) {
      recentFiles.splice(limit);
    }
    await this.setRecentFiles(recentFiles);
  }
  async clearRecent() {
    await this.setRecentFiles([]);
  }
  async loadRecentByIndex(recentFileIndex) {
    let recentFiles = await this.getRecentFiles();
    let filePath = recentFiles[recentFileIndex];
    if (filePath) {
      await this.loadFromFilePath(filePath);
    }
  }

  async writeFile(filePath, fileData) {
    try {
      await window.electronAPI.writeFile(filePath, fileData);
    } catch (error) {
      console.error(error);
      alert("Error in file saving " + getStackTrace());
      throw error;
    }
  }

  saveModel() {
    if (this.fileName == "") {
      this.saveModelAs();
      return;
    }
    this.doSaveModel(this.fileName);
  }
  async doSaveModel(fileName) {
    let fileData = createModelFileData();
    await this.writeFile(fileName, fileData);
    await this.addToRecent(fileName);
    markModelSaved();
    this.updateSaveTime();
    this.updateTitle();
    if (this.finishedSaveHandler) {
      this.finishedSaveHandler();
    }
  }

  saveModelAs() {
    let fileData = createModelFileData();
    this.exportFile(fileData, Settings.fileExtension, (filePath) => {
      this.fileName = filePath;
      markModelSaved();
      this.addToRecent(this.fileName);
      this.updateSaveTime();
      this.updateTitle();
      if (this.finishedSaveHandler) {
        this.finishedSaveHandler();
      }
    });
  }

  // A general file export function that can export any kind of file (also
  // used for CSV/TSV table exports, not just the model itself).
  async exportFile(dataToSave, fileExtension, onSuccess) {
    if (onSuccess == undefined) {
      onSuccess = () => { };
    }
    let suggestedName = this.appendFileExtension(this.defaultExportBaseName(), fileExtension);
    let filePath = await window.electronAPI.showSaveDialog(suggestedName, fileExtension);
    if (!filePath) {
      return;
    }
    filePath = this.appendFileExtension(filePath, fileExtension);
    await this.writeFile(filePath, dataToSave);
    onSuccess(filePath);
  }

  async loadModel() {
    let filePath = await window.electronAPI.showOpenDialog(Settings.fileExtension);
    if (filePath) {
      await this.loadFromFilePath(filePath);
    }
  }
  /** @param {string} filePath */
  async loadFromFilePath(filePath) {
    let fileData = await window.electronAPI.readFile(filePath);
    this.fileName = filePath;
    // Loaded from disk, so it has no browser-storage entry behind it.
    this.storedModelName = null;
    await this.addToRecent(filePath);
    History.forceCustomUndoState(fileData);
    this.updateTitle();
    preserveRestart();
  }
}
class BaseEnvironment {
  getName() {
    return "base";
  }
  constructor() {
    this.reloadingStarted = false;
  }
  ready() {
    // Override this
  }
  keyDown(event) {
    // Override this
  }
  getFileManager() {
    // Override this
  }
  openLink(url) {
    // Returns true or false
    // if returning true, the caller will do e.preventDefault()
    // to not trying to open the link the the browsers default way
    // Default: false
    return false;
  }
}

class WebEnvironment extends BaseEnvironment {
  getName() {
    return "web";
  }
  ready() {
    return null;
    /*
    window.onbeforeunload = (e) => {
      if (this.reloadingStarted) {
        // We never want to complain if we have initialized a reload
        // We only want to complain when the user is closing the page
        return null;
      }
      if (History.unsavedChanges) {
        return 'You have unsaved changes. Are you sure you want to quit?';
      } else {
        return null;
      }
    };
    */
  }
  getFileManager() {
    // To use modern file api we need showSaveFilePicker
    // and unfortunatly it does not work from file://, so we need a server e.g. npm install -g http-server
    if (window.showSaveFilePicker && location.protocol !== "file:") {
      // Uses modern APIs for file mangement
      return new WebFileManagerModern();
    } else {
      // Uses only file upload and download
      return new WebFileManagerBasic();
    }
  }
}

class ElectronEnvironment extends BaseEnvironment {
  getName() {
    return "electron";
  }
  ready() {
    // electron/main.js intercepts the window's close button and asks here
    // first, so unsaved changes can be checked before the app actually quits.
    window.electronAPI.onTryToClose(() => {
      quitQuestion();
    });
  }
  getFileManager() {
    return new ElectronFileManager();
  }
  closeWindow() {
    // Tells main.js it's safe to actually close the window now — see the
    // matching "window:confirm-close" handler in electron/main.js.
    window.electronAPI.confirmClose();
  }
  openLink(url) {
    // Returns true or false
    // if returning true, the caller will do e.preventDefault()
    // to not trying to open the link the the browsers default way
    // Default: false
    window.electronAPI.openExternal(url);
    // Return true, because we dont want it to Also open it the default way
    return true;
  }
}

// contextIsolation is on (see electron/main.js), so there is no Node/Electron
// global in the renderer to detect against — electron/preload.js exposes
// window.electronAPI.isElectron only when running inside that shell.
function isRunningElectron() {
  return typeof window.electronAPI !== "undefined" && window.electronAPI.isElectron === true;
}

function detectEnvironment() {
  if (isRunningElectron()) {
    return new ElectronEnvironment();
  } else {
    return new WebEnvironment();
  }
}

// Set global variable for environment and fileManager
var environment = detectEnvironment();
var fileManager = environment.getFileManager();

// Uncomment for debugging
// alert("Running in environment " + environment.getName())
