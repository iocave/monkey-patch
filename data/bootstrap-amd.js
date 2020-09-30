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

	onLoad = onLoad || function () { };
	onError = onError || function (err) { console.error(err); };

	loader([entrypoint], function () {
		if (entrypoint === "vs/code/electron-main/main")
			loader(["monkey/main"], onLoad, onError);
		else
			onLoad(); // extension host
	}, onError);
};
