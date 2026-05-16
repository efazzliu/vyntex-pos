const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isElectron: true,
  printHtmlSilent: (payload) => ipcRenderer.invoke("print-html-silent", payload),
  getSystemPrinters: () => ipcRenderer.invoke("get-system-printers"),
});
