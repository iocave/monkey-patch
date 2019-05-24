import * as fs from 'fs';

export class Configuration {

	constructor() {
		this.browserModules = new Set<string>();
		this.mainProcessModules = new Set<string>();
		this.folderMap = new Map<string, string>();
	}

	private folderMapToString() {
		return Array.from(this.folderMap).map(([key, value]) => `        "${key}" : "${value}"`).join(",\n");
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

	writeMainProcessEntrypoint(path: string) {
		let data = `\
require.config({
    paths: {
${this.folderMapToString()}
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
			${this.folderMapToString()}
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
