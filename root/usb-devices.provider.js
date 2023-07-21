const vscode = require('vscode')
const fs  = require('fs')
const path = require('path');
const { SerialPort } = require('serialport')

class UsbDevicesProvider {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot
    this._onDidChangeTreeData = new vscode.EventEmitter()
  }


  get onDidChangeTreeData () {
    return this._onDidChangeTreeData.event
  }

  refresh() {
		this._onDidChangeTreeData.fire();
	}

  getTreeItem(element) {
    return element;
  }
  
  getChildren(element) {
    // element is the parent tree item
    // workspaceRoot is falsey if not currently in a workspace, otherwise it's the path
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      // get device files
      const boot = new UsbDevice('boot.py', '1', vscode.TreeItemCollapsibleState.None)
      const main = new UsbDevice('main.py', '1', vscode.TreeItemCollapsibleState.None)

      main.command = {
        command: 'usbDevices.openDeviceFile',
        arguments: [main, element]
      }
      return Promise.resolve([
        boot,
        main
      ])
    } else {
      return SerialPort.list().then((ports) => {
        // get devices
        console.log('ports', ports)

        const portItems = []
        ports.forEach((port) => {
          let portItem = new UsbDevice(port.path, port.manufacturer, vscode.TreeItemCollapsibleState.Collapsed, 'circuit-board')
          portItems.push(portItem )
        })
        return Promise.resolve(portItems)
      })
      // } else {
    //   vscode.window.showInformationMessage('Workspace has no package.json');
    //   return Promise.resolve([]);
    }
  }

  pathExists(p) {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

class UsbDevice extends vscode.TreeItem {
  constructor(
    label,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    manufacturer,
    collapsibleState,
    command,
      ) {
    label = label
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.description = this.manufacturer || 'Unknown';
    this.command = command;
    // this.iconPath = iconPath;
    // this.children = children;

  }

  get iconPath() {
    return {
      light: path.join(__filename, '..', '..', 'resources', 'light', 'usb-device.svg'),
      dark: path.join(__filename, '..', '..', 'resources', 'dark', 'usb-device.svg')
    }
  }

}

module.exports = UsbDevicesProvider;