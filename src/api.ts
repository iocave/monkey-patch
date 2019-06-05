export interface FolderMap { [key: string]: string; }

export interface Contribution {
	folderMap: FolderMap;
	browserModules: Array<string>;
	mainProcessModules: Array<string>;
}

export interface API {
	contribute(sourceExtensionId :string, contribution: Contribution): void;
	active() : boolean;
}
