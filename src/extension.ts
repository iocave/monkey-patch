// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirRecursive } from './fs';
import { Script } from './script';
import { PathManager } from './path-manager';
import { Configuration } from './configuration';

class Extension {

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.pathManager = new PathManager(context);
		this.register();
		this._regenerate();
		if (this.active) {
			this.checkState();
		}
	}

	private async checkState() {
		try {
			if (!fs.existsSync(this.pathManager.bootstrapBackupPath) ||
				!fs.existsSync(this.pathManager.workbenchHtmlReplacementPath) ||
				!this.contains(this.pathManager.bootstrapPath, '"monkey"')) {

				let r = await vscode.window.showInformationMessage("MonkeyPatch changes seem to have been overwritten.", "Re-apply", "Ignore");
				if (r === "Re-apply") {
					this.install();
				} else {
					this.context.globalState.update("active", false);
				}
			} else {
				console.log("MonkeyPatch is active.");
			}
		} catch (e) {
			console.log("Check state failed", e);
			return false;
		}
	}

	private contains(filePath: string, searchFor: string) {
		let content = fs.readFileSync(filePath, "utf8");
		return content.indexOf(searchFor) !== -1;
	}

	private register() {
		let disposable = vscode.commands.registerCommand('extension.enable', async () => {
			this.enable();
		});
		this.context.subscriptions.push(disposable);

		disposable = vscode.commands.registerCommand('extension.disable', async () => {
			this.disable();
		});
		this.context.subscriptions.push(disposable);
	}

	get active() {
		return this.context.globalState.get("active");
	}

	private async enable() {
		if (!this.active) {
			let res = await vscode.window.showInformationMessage("MonkeyPatch will modify certain files within your VSCode installation. In case something goes wrong, you can use the 'Disable MonkeyPatch' command or simply reinstall VSCode.", "Proceed", "Cancel");
			if (res !== "Proceed") {
				return;
			}
		}
		this.install();
	}

	private async disable() {
		try {
			await this.uninstall();
			this.context.globalState.update("active", false);
			await vscode.window.showInformationMessage("MonkeyPatch disabled. Please RESTART (not just reload) your VSCode instance!", "Okay");
		} catch (e) {
			vscode.window.showErrorMessage(`MonkeyPatch failed: ${e}`);
		}
	}

	updateConfiguration() {
		this.configuration.updateFolderMap(new Map(Object.entries({
			"monkey-static": path.join(this.pathManager.extensionDataPath, "modules"),
			"def": "path2"
		})));

		this.configuration.updateMainProcessModules(new Set(["monkey-static/entrypoint-main"]));
		this.configuration.updateBrowserModules(new Set(["monkey-static/entrypoint-browser"]));
	}

	updateGeneratedFiles() {
		this.updateConfiguration();
		this.configuration.writeMainProcessEntrypoint(this.pathManager.mainProcessEntrypointPath);
		this.configuration.writeBrowserEntrypoint(this.pathManager.browserEntrypointPath);
	}

	private async install() {
		try {
			this._regenerate();
			await this._install();
			this.context.globalState.update("active", true);
			await vscode.window.showInformationMessage("MonkeyPatch enabled. Please RESTART (not just reload) your VSCode instance!", "Okay");

		} catch (e) {
			vscode.window.showErrorMessage(`MonkeyPatch failed: ${e}`);
		}
	}

	private _regenerate() {
		mkdirRecursive(this.pathManager.generatedScriptsPath);
		this.updateConfiguration();
		this.updateGeneratedFiles();
	}

	private async _install() {

		let script = new Script();
		script.begin();

		if (!fs.existsSync(this.pathManager.bootstrapBackupPath)) {
			script.copy(this.pathManager.bootstrapPath, this.pathManager.bootstrapBackupPath);
		}

		script.template(path.join(this.pathManager.extensionDataPath, "bootstrap-amd.js"),
			this.pathManager.bootstrapPath, new Map(Object.entries({
				"[[MONKEY_PATCH_ROOT]]": this.pathManager.generatedScriptsPath,
			})));

		const browserEntryPoint = this.toFileUri(this.pathManager.browserEntrypointPath);

		script.template(this.pathManager.workbenchHtmlPath,
			this.pathManager.workbenchHtmlReplacementPath,
			new Map(Object.entries({
				"<script src=\"workbench.js\"></script>":
					`<script src=\"${browserEntryPoint}\"></script>` +
					"\n\t<script src=\"workbench.js\"></script>",
			})));

		return script.commit(this.needRoot());
	}

	private toFileUri(filePath: string): string {
		const match = filePath.match(/^([a-z])\:(.*)$/i);

		if (match) {
			filePath = '/' + match[1].toUpperCase() + ':' + match[2];
		}

		return 'file://' + filePath.replace(/\\/g, '/');
	}

	private async uninstall() {
		if (fs.existsSync(this.pathManager.bootstrapBackupPath)) {
			let script = new Script();
			script.begin();
			script.rm(this.pathManager.bootstrapPath);
			script.move(this.pathManager.bootstrapBackupPath, this.pathManager.bootstrapPath);
			script.rm(this.pathManager.workbenchHtmlReplacementPath);
			return script.commit(this.needRoot());
		}
	}

	private needRoot() {
		let needRoot = false;
		try {
			const testFile = path.join(this.pathManager.installationPath, ".testFile");
			fs.writeFileSync(testFile, "");
			fs.unlinkSync(testFile);
		} catch (e) {
			needRoot = true;
		}
		return needRoot;
	}

	private configuration = new Configuration();
	private context: vscode.ExtensionContext;
	private pathManager: PathManager;
}


let extension : Extension;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	extension = new Extension(context);
}

// this method is called when your extension is deactivated
export function deactivate() { }
