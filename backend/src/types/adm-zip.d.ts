declare module 'adm-zip' {
  interface IZipEntry {
    entryName: string;
    name: string;
    isDirectory: boolean;
    compressedSize: number;
    size: number;
    getData(): Buffer;
    getText(): string;
  }

  class AdmZip {
    constructor(inputFilePath?: string | Buffer);
    getEntries(): IZipEntry[];
    extractAllTo(targetPath: string, overwrite?: boolean): void;
    writeZip(targetFilePath: string): void;
  }

  export default AdmZip;
}

