// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirRecursive } from './fs';
import { Script } from './script';
import { PathManager } from './path-manager';
import { Configuration } from './configuration';
import { Contribution, FolderMap, API } from './api';

interface Contributions { [key : string] : Contribution; }

interface RegenerateResult {
	browserModulesChanged : boolean;
	mainProcessModulesChanged : boolean;
}

class Extension {

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.pathManager = new PathManager(context);
		this.register();

		this.loadContributions();
		this.configurationChanged();

		if (this.active) {
			this.checkState();
		}
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('monkeyPatch.')) {
				this.configurationChanged();
			}
		}));

		let firstRun = this.context.globalState.get("firstRun");
		if (firstRun === undefined) {
			firstRun = true;
		}
		if (firstRun && !this.active) {
			this.enable();
		}
		this.context.globalState.update("firstRun", false);
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

	get active() : boolean {
		return this.context.globalState.get("active") as boolean;
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

		let cfg = vscode.workspace.getConfiguration("monkeyPatch");

		let folderMap: FolderMap = {
			"monkey-static": path.join(this.pathManager.extensionDataPath, "modules"),
		};

		let map = cfg.get("folderMap");
		if (map instanceof Object) {
			Object.entries(map).forEach(entry => {
				folderMap[`${entry[0]}`] = `${entry[1]}`;
			});
		}

		Object.entries(this.contributions).forEach(([id, contribution]) => {
			Object.entries(contribution.folderMap).map(([key, value]) => {
				folderMap[key] = value;
			});
		});

		this.configuration.updateFolderMap(folderMap);

		let modules = cfg.get("mainProcessModules");

		let mainProcessModules = ["monkey-static/entrypoint-main"];
		if (modules instanceof Array) {
			modules.forEach(element => {
				mainProcessModules.push(element);
			});
		}
		Object.entries(this.contributions).forEach(([id, contribution]) => {
			contribution.mainProcessModules.forEach((module) => {
				mainProcessModules.push(module);
			});
		});

		this.configuration.updateMainProcessModules(mainProcessModules);

		//

		modules = cfg.get("browserModules");

		let browserModules : string[] = [];
		if (modules instanceof Array) {
			modules.forEach(element => {
				browserModules.push(element);
			});
		}

		Object.entries(this.contributions).forEach(([id, contribution]) => {
			contribution.browserModules.forEach((module) => {
				browserModules.push(module);
			});
		});

		this.configuration.updateBrowserModules(browserModules);
	}


	async configurationChanged() {
		let res = this.regenerate();

		if (this.active) {
			if (res.mainProcessModulesChanged) {
				vscode.window.showInformationMessage("MonkeyPatch configuration has changed. Please RESTART (not just reload) your VSCode instance!", "Okay");
			} else if (res.browserModulesChanged) {
				let res = await vscode.window.showInformationMessage("MonkeyPatch configuration has changed. Please reload your VSCode window!", "Reload", "Later");
				if (res === "Reload") {
					vscode.commands.executeCommand("workbench.action.reloadWindow");
				}
			}
		}
	}

	private static eqSet(s1: Set<any>, s2: Set<any>): boolean {
		return s1.size === s2.size && [...s1].every(value => s2.has(value));
	}

	private async install() {
		try {
			this.regenerate();
			await this._install();
			this.context.globalState.update("active", true);
			await vscode.window.showInformationMessage("MonkeyPatch enabled. Please RESTART (not just reload) your VSCode instance!", "Okay");
		} catch (e) {
			vscode.window.showErrorMessage(`MonkeyPatch failed: ${e}`);
		}
	}

	regenerate() : RegenerateResult {
		mkdirRecursive(this.pathManager.generatedScriptsPath);
		this.updateConfiguration();
		let mainProcess = this.configuration.writeMainProcessEntrypoint(this.pathManager.mainProcessEntrypointPath);
		let browser = this.configuration.writeBrowserEntrypoint(this.pathManager.browserEntrypointPath);
		return {
			mainProcessModulesChanged: mainProcess,
			browserModulesChanged: browser,
		};
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

		return script.commit(this.needsRoot());
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
			return script.commit(this.needsRoot());
		}
	}

	private needsRoot() {
		let needsRoot = false;
		try {
			const testFile = path.join(this.pathManager.installationPath, ".testFile");
			fs.writeFileSync(testFile, "");
			fs.unlinkSync(testFile);
		} catch (e) {
			needsRoot = true;
		}
		return needsRoot;
	}

	contribute(sourceExtensionId: string, contribution: Contribution) {
		this.contributions[sourceExtensionId] = contribution;
		this.saveContributions();
		this.configurationChanged();
	}

	saveContributions() {
		this.context.globalState.update("contributions", this.contributions);
	}

	loadContributions() {
		let contributions : Contributions|undefined = this.context.globalState.get("contributions");
		if (contributions !== undefined) {
			Object.entries(contributions).forEach(([id, contribution]) => {
				if (vscode.extensions.getExtension(id) !== undefined) {
					this.contributions[id] = contribution;
				}
			});
		}
		vscode.extensions.onDidChange(() => {
			this.configurationChanged();
		}, this.context.subscriptions);
	}

	private configuration = new Configuration();
	private context: vscode.ExtensionContext;
	private pathManager: PathManager;
	private contributions : Contributions = {};
}


let extension: Extension;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	extension = new Extension(context);

  	let api : API = {
		contribute(sourceExtensionId: string, contribution: Contribution) {
			extension.contribute(sourceExtensionId, contribution);
		},
		active() : boolean {
			return extension.active;
		}
	};
	return api;
}

// this method is called when your extension is deactivated
export function deactivate() { }
