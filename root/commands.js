const vscode = require('vscode');
const locale = require('../i18n')();
const fs = require('fs');
const open = require('child_process');

let attrOptions = {
	baudRate: [115200, 57600, 38400, 19200, 9600, 4800, 2400, 1800, 1200, 600, 300, 200, 150, 134, 110, 75, 50, 'DIY'],
	dataBits: [8, 7, 6, 5],
	stopBits: [1, 2],
	parity: ['none', 'even', 'mark', 'odd', 'space']
};

let usetimes = 0;

let ports = {};

async function getSendData(data, path) {
	if (!data) return data;
	// send file
	if (data.startsWith('@file')) {
		let filepath = data.replace(/^@file:/, '');
		if(!fs.existsSync(filepath)) {
			filepath = await vscode.window.showOpenDialog({ canSelectMany: false });
			if (filepath.length == 0) return null;
			filepath = filepath[0].fsPath;
		}

		return fs.readFileSync(filepath);
	}

	// send hex
	if (data.startsWith('@hex')) {
		data = data.replace(/^@hex:/, '');
		if (data.match(/^\s*([0-9A-Fa-f]{2}\s+)*[0-9A-Fa-f]{2}\s*$/g) == null) {
			data = await vscode.window.showInputBox({ prompt: locale['send_hex_title'].replace(/{{path}}/, path) });
			if (!data) return data;
			if (data.match(/^\s*([0-9A-Fa-f]{2}\s+)*[0-9A-Fa-f]{2}\s*$/g) == null) {
				vscode.window.showErrorMessage(locale['not_invalid_hex']);
				return null;
			}
		}
		data = data.match(/[0-9A-Fa-f]{2}\s*/g).map(d => parseInt(d.trim(), 16));
		return Buffer.from(data);
	}

	if (vscode.workspace.getConfiguration().get('serialPort.enableEscapeCharacte')) {
		try { data = JSON.parse(`\"${data.replace(/"/g, `\\"`)}\"`); } catch(ex) {}
	}

	return data;
}

function getExecCommand() {
    let cmd = 'start';
    if (process.platform == 'win32') {
        cmd = 'start';
    } else if (process.platform == 'linux') {
        cmd = 'xdg-open';
    } else if (process.platform == 'darwin') {
        cmd = 'open';
    }
    
    return `${cmd} https://marketplace.visualstudio.com/items?itemName=hancel.serialport-helper`
}

function confirm(message, options) {
    return new Promise((resolve, reject) => {
        return vscode.window.showInformationMessage(message, ...options).then(resolve);
    });
}

function noticeComment() {
    let notice = context.globalState.get('notice');
    if (!notice && usetimes > 80) {
        confirm(locale['like.extension'], [locale['like.ok'], locale['like.no'], locale['like.later']])
            .then((option) => {
                switch(option) {
                    case locale['like.ok']:
                        open.exec(getExecCommand());
                        context.globalState.update('notice', true);
                        break;
                    case locale['like.no']:
                        context.globalState.update('notice', true);
                        break;
                    case locale['like.later']:
                        usetimes = 50;
                        context.globalState.update('usetimes', usetimes);
                        context.globalState.update('notice', false);
                        break;
                }
            })
            .catch(e => console.log(e));
    } else if(!notice) {
        context.globalState.update('usetimes', ++usetimes);
    }
}

module.exports = {
	init(cxt) {
		usetimes = cxt.globalState.get('usetimes') || 0;
	},
  async connectOrDisconect(port) {
		let ret = false, isOpen = port.isOpen;
		if (isOpen) ret = await port.close();
		else{
			ret = await port.open();
			ports[port.path] = port;
			noticeComment()
		}

		if (!ret) vscode.window.showErrorMessage(port.lasterror);
  },
	async updateEntry(port, attr) {
		if (attr == 'view_mode') {
			port.options[attr] = !port.options[attr]
			await port.setting({ [attr]: port.options[attr] });
			return;
		}
		let data = port.options[attr];
		data = await vscode.window.showQuickPick(attrOptions[attr].map(a => ({ label: a.toString() })), 
			{ title: locale['update_title'].replace(/{{path}}/, port.path).replace(/{{attr}}/, locale[attr]) });
		if (!data) return;
		if (data.label == 'DIY') data.label = await vscode.window.showInputBox({ 
			prompt: locale['update_title'].replace(/{{path}}/, port.path).replace(/{{attr}}/, locale[attr]),
			validateInput(value) {
				return !isNaN(value) ? null : `${value} ${locale['is_not_number']}`;
			}
		});
		data = attr != 'parity' ? parseInt(data.label) : data.label;
		let ret = true;
		await port.setting({ [attr]: data });
		if (ret) {
			port.options[attr] = data;
		} else vscode.window.showErrorMessage(`Update ${attr} of ${port.path} was failed. Error Message: ${port.lasterror}`);
	},
	async sendEntry(port) {
		if (typeof port == 'string') {
			if (ports[port] === undefined) {
				vscode.window.showWarningMessage(`${port} was not found or not connected yet.`);
				return;
			}
			port = ports[port];
		}
		let data = await vscode.window.showInputBox({ prompt: locale['send_title'].replace(/{{path}}/, port.path) });
		data = await getSendData(data, port.path);
		if (!data) return;
		let ret = await port.port.send(data);
		if (ret) vscode.window.showInformationMessage(locale['send_success'].replace(/{{path}}/, port.path));
		else vscode.window.showErrorMessage(`Send Data to ${port.path} was failed. Error Message: ${port.lasterror}`);
	}
}