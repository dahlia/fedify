import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

/**
 * Recursively read a directory, yielding the paths of all files.  File paths
 * are relative to the directory, and directories are not yielded.
 * @param dir The directory to read.
 * @returns An async iterable of file paths.
 */
export async function* readDirRecursive(dir: string): AsyncIterable<string> {
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isDirectory) {
      const path = join(dir, entry.name);
      for await (const subentry of readDirRecursive(path)) {
        yield join(entry.name, subentry);
      }
    } else {
      yield entry.name;
    }
  }
}
