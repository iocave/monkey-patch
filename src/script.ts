import * as sudo from 'sudo-prompt';
import { exec } from 'child_process';
import { rimrafUnlink } from "./fs";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 } from './uuid';

export class Script {

    constructor() {
        this.folder = path.join(os.tmpdir(), v4().asHex());
        this.script = "";
    }

    private get isWindows() {
        return os.platform() === "win32";
    }

    begin() {
        fs.mkdirSync(this.folder);
        this.command(`cd "${this.folder}"`);
    }

    copy(pathFrom: string, pathTo: string) {
        if (this.isWindows) {
            this.command(`copy /Y "${this.folder}\\${pathFrom}" "${pathTo}"`);
        }
        else {
            this.command(`cp "${this.folder}\\${pathFrom}" "${pathTo}"`);
        }
    }

    move(pathFrom: string, pathTo: string) {
        if (this.isWindows) {
            this.command(`move "${this.folder}\\${pathFrom}" "${pathTo}"`);
        }
        else {
            this.command(`mv "${this.folder}\\${pathFrom}" "${pathTo}"`);
        }
    }

    rm(path: string) {
        if (this.isWindows) {
            this.command(`del "${path}"`);
        }
        else {
            this.command(`rm "${path}"`);
        }
    }

    template(pathFrom: string, pathTo: string, values: Map<string, string>) {
        let template = fs.readFileSync(pathFrom, "utf8");
        values.forEach((value: string, key: string) => {
            template = template.replace(`${key}`, value);
        });
        const tmpName = path.basename(pathFrom) + "---" + v4().asHex();
        fs.writeFileSync(path.join(this.folder, tmpName), template, "utf8");
        this.copy(tmpName, pathTo);
    }

    commit(asRoot: boolean) {
        return new Promise<void>((resolve, reject) => {
            let name = this.isWindows ? "script.cmd" : "script.sh";
            let script = path.join(this.folder, name);
            fs.writeFileSync(script, this.script);
            const callback = (error: any, stdout: string, stderr: string) => {
                this.cleanup();
                if (error) {
                    console.error(error);
                    reject(error);
                } else {
                    if (stdout) {
                        console.log(stdout);
                    }
                    if (stderr) {
                        console.log(stderr);
                    }
                    resolve();
                }
            };

            if (!this.isWindows) {
                script = "/bin/sh " + script;
            }

            console.log(`** Executing "${script}", asRoot: ${asRoot}`);

            if (asRoot) {
                let options = { name: 'VSCode Monkey Patch' };
                sudo.exec(script, options, callback);
            } else {
                exec(script, callback);
            }
        });
    }

    private cleanup() {
        rimrafUnlink(this.folder);
    }

    command(line: string) {
        this.script += line;
        this.script += "\n";
    }

    private folder: string;
    private script: string;
}
