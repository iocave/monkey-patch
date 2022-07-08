import * as fs from 'fs';
import * as p from 'path';

export function rimrafUnlink(path: string) {
    try {
        const stat = fs.lstatSync(path);

        // Folder delete (recursive) - NOT for symbolic links though!
        if (stat.isDirectory() && !stat.isSymbolicLink()) {

            // Children
            const children = fs.readdirSync(path);
            children.map(child => rimrafUnlink(p.join(path, child)));

            // Folder
            fs.rmdirSync(path);
        }
        // Single file delete
        else {
            // chmod as needed to allow for unlink
            const mode = stat.mode;
            if (!(mode & 128)) { // 128 === 0200
                fs.chmodSync(path, mode | 128);
            }

            return fs.unlinkSync(path);
        }
    } catch (error : any) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}

export function mkdirRecursive(path: string) {
    if (!fs.existsSync(path)) {
        if (p.parse(path).root != path) {
            let parent = p.join(path, "..");
            mkdirRecursive(parent);
        }
        fs.mkdirSync(path);
    }
}