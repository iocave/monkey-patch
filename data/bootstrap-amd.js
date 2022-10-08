/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

const loader = require('./vs/loader');
const bootstrap = require('./bootstrap');

// Bootstrap: NLS
const nlsConfig = bootstrap.setupNLS();

// Resolve for code or code-insiders
const baseUrl = bootstrap.fileUriFromPath
    // Code - Insiders
    ? bootstrap.fileUriFromPath(__dirname, {
        isWindows: "win32" === process.platform,
    })
    // Code
    : bootstrap.uriFromPath(__dirname);

// Bootstrap: Loader
loader.config({
	baseUrl,
	catchError: true,
	nodeRequire: require,
	nodeMain: __filename,
	'vs/nls': nlsConfig,
	paths : {
		"monkey": "[[MONKEY_PATCH_ROOT]]",
	}
});


// Running in Electron
if (process.env['ELECTRON_RUN_AS_NODE'] || process.versions['electron']) {
	loader.define('fs', ['original-fs'], function (originalFS) {
		return originalFS;  // replace the patched electron fs with the original node fs for all AMD code
	});
}

// Pseudo NLS support
if (nlsConfig.pseudo) {
	loader(['vs/nls'], function (nlsPlugin) {
		nlsPlugin.setPseudoTranslation(nlsConfig.pseudo);
	});
}

exports.load = function (entrypoint, onLoad, onError) {
	if (!entrypoint) {
		return;
	}

	// cached data config
	if (process.env['VSCODE_NODE_CACHED_DATA_DIR']) {
		loader.config({
			nodeCachedData: {
				path: process.env['VSCODE_NODE_CACHED_DATA_DIR'],
				seed: entrypoint
			}
		});
	}

	// It's  bit difficult to determine what's the correct time to load
	// monkey-patch. If loaded before main, startup will fail because AMD
	// loader won't find modules from main.js, if too late, monkey patch won't
	// be able to overrride main window URL.
	// The best approach for now seem to be to load monkey patch immediately
	// after the main.js file is read.
	if (entrypoint === "vs/code/electron-main/main") {
		let fs = require('fs');
		let p = require('path');
		let readFile = fs.readFile;
		fs.readFile = function (path, options, callback) {
			readFile(path, options, function () {
				if (path.endsWith(p.join('electron-main', 'main.js'))) {
					console.log('Loading monkey-patch');
					loader(["monkey/main"], function() {}, function(err) { console.log(err); });
				}
				callback.apply(this, arguments);
			});
		}
	}

	loader([entrypoint], onLoad, onError);
};

// checked by extension.ts, update if boostrap changes
// [MonkeyPatchBootstrapToken2]
