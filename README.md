# Xbit VSCode Extension

Canvas Software Suite includes a VS Code Extension called Xbit. This extension provides an easy interaction with Canvas Firmware compatible DVKs and IoT products for loading python scripts to the device, interacting with the python REPL prompt and underlying RTOS shell prompt (if supported by the device).

Works with:
| Platform | x64 | arm64 |
| :------- | :-: | :---: |
| Windows  | ✅   | ❌     |
| macOS    | ✅   | ✅     |
| Linux    | ✅   | ✅     |

## Features

1. Write firmware .hex images to supported boards.
2. Read, Write, Rename, Delete python files on supported boards.
3. Psuedo-terminal integration for interactions with the MicroPython REPL on supported boards.
4. Auto-completion and docs for supported Micro Python libraries.
5. Virtual-workspace provider for supported boards.
6. Development environment for Xbit Applets.

## Requirements

Canvas Device

Visual Studio Code extensions:
* ms-python.python | [Install](vscode://extension/ms-python.python) [Show](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
* `visualstudioexptteam.vscodeintellicode` | [\[Install\]](vscode://extension/visualstudioexptteam.vscodeintellicode) [\[Show\]](https://marketplace.visualstudio.com/items?itemName=VisualStudioExptTeam.vscodeintellicode)
* `ms-python.vscode-pylance` | [\[Install\]](vscode://extension/ms-python.vscode-pylance) [\[Show\]](https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance)

## Getting started

[confluence link](https://rfpros.atlassian.net/wiki/spaces/VA/pages/1980203021/Canvas+Tools+Getting+Started+Guide)

## Using Xbit Applets

This extension supports working with Xbit Applets. Xbit Applets are a way to develop and deploy desktop applications for Canvas Devices. Xbit Applets are written in Javascript. These applets typically provide a user interface to interact with the device. They can also be used to pipe data from the device to the applet for logging or other purposes.

1. Connect a Canvas Device to your computer.
2. Open an Xbit Applet folder in your VS Code workspace.
3. Find the xbit-applet.json file for the applet you want to runl, right click and select "Run Xbit Applet..."
4. Switch to the Xbit extension and find the device you want to use for the applet.
5. Connect to the device.
6. In the lower "selected device" panel, from the drop down "selected applet" choose the running applet to pipe device data to the applet.
7. To stop sending data, change the drop down to "none"