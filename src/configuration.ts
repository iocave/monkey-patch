import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';
import { FolderMap } from './api';
import * as os from 'os';

export class Configuration {

	constructor() {
		this.browserModules = new Array<string>();
		this.mainProcessModules = new Array<string>();
		this.folderMap = {};
	}

	private folderMapToString(indent: string) {
		let entries = Object.entries(this.folderMap);
		entries = entries.sort((a, b) => a[0].localeCompare(b[0]));
		return entries.map(([key, value]) => `${indent}"${key}" : "${this.formatPath(this.expandHome(value))}"`).join(",\n");
	}

	private expandHome(p: string) {
		if (p.startsWith("~/")) {
			return path.join(homedir(), p.slice(2));
		} else {
			return p;
		}
	}

	 formatPath(p : string) {
		if (os.platform() === "win32") {
			// There seems to be a weird bug in how AMD loader handles window URLs
			return "file://./" + p.replace(/\\/g, "/");
		} else {
			return p;
		}
	 }

	private mainProcessModulesToString() {
		return this.filterModules(Array.from(this.mainProcessModules)).map((module) => `"${module}"`).join(", ");
	}

	private browserModulesToString() {
		return this.filterModules(Array.from(this.browserModules)).map((module) => `"${module}"`).join(", ");
	}

	// Only include files that exist
	private filterModules(modules: Array<string>) {
		return modules.filter((module: string) => {
			let segments = module.split("/");
			if (segments.length > 1) {
				if (this.folderMap[segments[0]] !== undefined) {
					segments[0] = this.expandHome(this.folderMap[segments[0]]);
				}
			}
			let path = segments.join("/");
			return fs.existsSync(path + ".js");
		});
	}

	updateFolderMap(folderMap: FolderMap) {
		this.folderMap = folderMap;
	}

	updateMainProcessModules(modules: Array<string>) {
		this.mainProcessModules = modules;
	}

	updateBrowserModules(modules: Array<string>) {
		this.browserModules = modules;
	}

	writeMainProcessEntrypoint(path: string): boolean {
		let data = `\
require.config({
    paths: {
${this.folderMapToString('        ')}
    }
});

define([${this.mainProcessModulesToString()}], function (){});`;

		return this.replaceFile(path, data);
	}

	writeBrowserEntrypoint(path: string): boolean {
		let data = `\
'use strict';

const _bootstrapWindow = require('../../../../bootstrap-window');
const _prev = _bootstrapWindow.load;

_bootstrapWindow.load = function(modulePaths, resultCallback, options) {

	let prevBeforeLoaderConfig = options.beforeLoaderConfig;
	options.beforeLoaderConfig = function(configuration, loaderConfig) {
		if (prevBeforeLoaderConfig && typeof prevBeforeLoaderConfig === 'function')
			prevBeforeLoaderConfig(configuration, loaderConfig);
		loaderConfig.paths = {
${this.folderMapToString('\t\t\t')}
		};
		require.define("monkey-patch", {
			load: function (name, req, onload, config) {
				req([name], function (value) {
					req([${this.browserModulesToString()}], function() { onload(value); });
				});
			}
		});
	}
	if (modulePaths[0] == 'vs/workbench/workbench.main') {
		modulePaths[0] = 'monkey-patch!' + modulePaths[0];
	}
	_prev(modulePaths, resultCallback, options);
};`;
		return this.replaceFile(path, data);
	}

	private replaceFile(path: string, data: string): boolean {
		if (fs.existsSync(path)) {
			let current = fs.readFileSync(path, "utf8");
			if (current === data) {
				return false;
			}
		}
		fs.writeFileSync(path, data, "utf8");
		return true;
	}

	private browserModules: Array<string>;
	private mainProcessModules: Array<string>;
	private folderMap: FolderMap;
}
