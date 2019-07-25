# Monkey Patch README

## What does it do

Monkey Patch is an extension allowing execution of arbitrary javascript in
VSCode browser and main process

It can be either used directly using configuration options, or by other extensions using API.

Monkey Patch aims to make the entire process reliable (as far as monkey-patching goes...) and user friendly, by automatically checking the patching
state after update, and prompting the user to repatch. It can also request elevated privileges if necessary.

## Enabling and Disabling

Monkey Patch contributes two VSCode commands:
* Enable Monkey Patch
* Disable Monkey Patch

## Using Monkey Patch through configuration options

While not the primary purpose, it is possible to use the Monkey Patch extension through options. For example:

```jsonc
"monkeyPatch.folderMap": {
    "my-custom-modules" : "~/custom-modules",
},
"monkeyPatch.browserModules": [
    // Will load "~/custom-modules/browser1.js" in browser process
    "my-custom-modules/browser1"
],
"monkeyPatch.mainProcessModules" : [
    // Will load "~/custom-modules/mainProcess.js" in main process
    "my-custom-modules/mainProcess1"
]
```

## Using Monkey Patch through the API

```js
let monkeyPatch = vscode.extensions.getExtension("iocave.monkey-patch");

if (monkeyPatch !== undefined) {
    monkeyPatch.exports.contribute("<publisher>.<extension_name>",
        {
            folderMap: {
                "my-custom-modules": path.join(this.context.extensionPath, "custom-modules"),
            },
            browserModules: [
                "my-custom-modules/browser1"
            ],
            mainProcessModules: [
                "my-custom-modules/mainProcess1",
            ]
        }
    );
} else {
    vscode.window.showWarningMessage("Monkey Patch extension is not installed. This extension will not work.");
}
```

For a full project that uses this, see https://github.com/iocave/customize-ui.

## If something goes wrong

Monkey Patching can get fragile at times. If VSCode is running, you can unpach VSCode by invoking the "Disable Monkey Patch" command. If VSCode does launch, you can always redownload VSCode and replace the patched instance.