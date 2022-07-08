import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class PathManager {

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	get installationPath() {
		return path.dirname(require.main!.filename);
	}

	get bootstrapPath() {
		return path.join(this.installationPath, "bootstrap-amd.js");
	}

	get bootstrapBackupPath() {
		return path.join(this.installationPath, "bootstrap-amd.js.monkey-patch.backup");
	}

	get workbenchHtmlPath() {
		let res = path.join(this.installationPath, "vs/code/electron-browser/workbench/workbench.html");
		if (fs.existsSync(res)) {
			return res;
		} else { // vscode 1.70
			return path.join(this.installationPath, "vs/code/electron-sandbox/workbench/workbench.html")
		}
	}

	get workbenchHtmlReplacementPath() {
		let res = this.workbenchHtmlPath;
		res = res.replace("workbench.html", "workbench-monkey-patch.html");
		return res;
	}

	get extensionDataPath() {
		return path.join(this.context.extensionPath, "data");
	}

	get generatedScriptsPath() {
		return path.join(this.context.globalStoragePath, "modules");
	}

	get mainProcessEntrypointPath() {
		return path.join(this.generatedScriptsPath, "main.js");
	}

	get browserEntrypointPath() {
		return path.join(this.generatedScriptsPath, "browser-entrypoint.js");
	}

	private context: vscode.ExtensionContext;
}