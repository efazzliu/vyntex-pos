const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isElectron: true,
  printHtmlSilent: (payload) => ipcRenderer.invoke("print-html-silent", payload),
  getSystemPrinters: () => ipcRenderer.invoke("get-system-printers"),
  checkForAppUpdate: () => ipcRenderer.invoke("app-update-check"),
  downloadAppUpdate: () => ipcRenderer.invoke("app-update-download"),
  installAppUpdate: () => ipcRenderer.invoke("app-update-install"),
  appSystemInfo: () => ipcRenderer.invoke("app-system-info"),
  customerDisplayStatus: () => ipcRenderer.invoke("customer-display-status"),
  customerDisplayOpen: () => ipcRenderer.invoke("customer-display-open"),
  customerDisplayClose: () => ipcRenderer.invoke("customer-display-close"),
  onAppUpdateProgress: (callback) => {
    const listener = (_event, percent) => {
      if (typeof callback === "function") callback(percent);
    };
    ipcRenderer.on("app-update-progress", listener);
    return () => ipcRenderer.removeListener("app-update-progress", listener);
  },
});
