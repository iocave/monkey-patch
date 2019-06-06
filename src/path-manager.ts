import * as vscode from 'vscode';
import * as path from 'path';

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
		return path.join(this.installationPath, "vs/code/electron-browser/workbench/workbench.html");
	}

	get workbenchHtmlReplacementPath() {
		return path.join(this.installationPath, "vs/code/electron-browser/workbench/workbench-monkey-patch.html");
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

	get browserModulesPath() {
		return path.join(this.generatedScriptsPath, "browser-modules.js");
	}

	private context: vscode.ExtensionContext;
}