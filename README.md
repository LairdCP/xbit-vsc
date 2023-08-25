# Xbit VSCode Extension

This extension provides file management features for xbit devices.


https://github.com/pyocd/pyOCD
https://github.com/Marus/cortex-debug

https://github.com/microsoft/vscode-python-tools-extension-template
- https://github.com/microsoft/vscode-python-tools-extension-template/blob/main/noxfile.py
https://symflower.com/en/company/blog/2022/lsp-in-vscode-extension/

https://stackoverflow.com/questions/70359755/how-to-bundle-python-code-with-vsix-vscode-extension



1. Ship python command "server" with dependencies that will run
as a side process with the extension. Connect via socket and send requests
back and forth. This requires the user to install python dependencies, etc.

python/server.py
- exposes port 5000
- spawn child process python python/server.py --port 5000
- connect to port 5000

2. Create a python LSP with other non-standard APIs for our stuff. This is not recommended as 
LSP is ment to be for supporting languages in the IDE (linting, syntax checking, highlighting, etc.)

3. Create a python virtual environment and install dependencies in the extension. This is probably the best solution using nox (I think this will work?)



```
activationEvents: ["onStartupFinished"]
export const activate = (context: ExtensionContext): void => {
    const myExtension = extensions.getExtension("<my-extension-id>");
    const currentVersion = myExtension!.packageJSON.version ?? "1.0.0";

    const lastVersion = context.globalState.get("MyExtensionVersion");
    if (currentVersion !== lastVersion) {
        void context.globalState.update("MyExtensionVersion", currentVersion);
        // Do one time setup here.
    }
}

// check that venv/xbit-vsc exists
// if error
  // create virtual environment
  python -m venv /path/to/new/virtual/environment
  // activate virtual environment
  source /path/to/new/virtual/environment/bin/activate
  pip install -r requirements.txt
  // deactivate virtual environment
```


https://nox.thea.codes/en/stable/

1. Python must be installed on the system
2. We will create a venv for our dependencies

