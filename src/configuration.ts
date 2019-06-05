import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';

export class Configuration {

	constructor() {
		this.browserModules = new Set<string>();
		this.mainProcessModules = new Set<string>();
		this.folderMap = new Map<string, string>();
	}

	private folderMapToString(indent : String) {
		return Array.from(this.folderMap).map(([key, value]) => `${indent}"${key}" : "${this.expandHome(value)}"`).join(",\n");
	}

	private expandHome(p : String) {
		if (p.startsWith("~/")) {
			return path.join(homedir(), p.slice(2));
		} else {
			return p;
		}
	}

	private mainProcessModulesToString() {
		return Array.from(this.mainProcessModules).map((module) => `"${module}"`).join(", ");
	}


	private browserModulesToString() {
		return Array.from(this.browserModules).map((module) => `"${module}"`).join(", ");
	}

	updateFolderMap(folderMap: Map<string, string>) {
		this.folderMap = folderMap;
	}

	updateMainProcessModules(modules: Set<string>) {
		this.mainProcessModules = modules;
	}

	updateBrowserModules(modules: Set<string>) {
		this.browserModules = modules;
	}

	resolvedMainProcessModules() : Set<string> {
		return this.resolveModules(this.mainProcessModules);
	}

	resolvedBrowserModules() : Set<string> {
		return this.resolveModules(this.browserModules);
	}

	private resolveModules(modules: Set<string>) : Set<string> {
		let folderMapLC = new Map();
		this.folderMap.forEach((value, key) => {
			folderMapLC.set(key.toLowerCase(), value);
		});
		let res = new Set<string>();
		modules.forEach(module => {
			let parts = module.split("/");
			if (parts.length > 0) {
				let part = folderMapLC.get(parts[0].toLocaleLowerCase());
				if (part !== undefined) {
					parts[0] = part;
				}
			}
			res.add(parts.join("/"));
		});
		return res;
	}

	writeMainProcessEntrypoint(path: string) {
		let data = `\
require.config({
    paths: {
${this.folderMapToString('        ')}
    }
});

define([${this.mainProcessModulesToString()}], function (){});`;

		fs.writeFileSync(path, data, "utf8");
	}

	writeBrowserEntrypoint(path: string) {
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
	}

	let res = function(t, e) {
		require([${this.browserModulesToString()}], function(a) { });
		return resultCallback(t, e);
	}
	_prev(modulePaths, res, options);
};`;

		fs.writeFileSync(path, data, "utf8");
	}

	private browserModules: Set<string>;
	private mainProcessModules: Set<string>;
	private folderMap: Map<string, string>;
}
