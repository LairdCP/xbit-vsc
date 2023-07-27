
class UsbDeviceWebViewProvider {
	constructor(
		_extensionUri,
    viewType
	) {
    this._extensionUri = _extensionUri
    this.viewType = viewType
    this.webview = null
  }

  resolveWebviewView(
	  	webviewView,
  		context,
		  _token
	  ) {
		  this._view = webviewView;

      webviewView.webview.options = {
        // Allow scripts in the webview
        enableScripts: true,
        localResourceRoots: [
          this._extensionUri
        ]
      }

		webviewView.webview.html = this.getWebviewContent()
		webviewView.webview.onDidReceiveMessage(data => {
      console.log('webviewView received message', data)
    })
    this.webview = webviewView.webview
	}

  getWebviewContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Coding</title>
</head>
<body>
    <p>Selected:</p>
    <h3 id="lines-of-code-counter">None</h3>
    <p>Baud Rate: <input type="text" id="baudRate" /></p>
    <button>Connect</button>
    <script>
        const counter = document.getElementById('lines-of-code-counter');

        // Handle the message inside the webview
        window.addEventListener('message', event => {

            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
                case 'setPath':
                    counter.textContent = message.path;
                    break;
            }
        });
    </script>
</body>
</html>`
  }
}

module.exports = UsbDeviceWebViewProvider
