// Where a recording is played FROM. Pure (the calls are handed in), so it is tested without a device.
//   iOS / Android: the file of the device FIRST while it exists; when it is gone (the app was reinstalled, a post made on another device) the file in the file storage.
//   web:           the file in the file storage FIRST (a browser cannot open the file of a phone); a recording made in THIS browser and not uploaded yet plays from IndexedDB.
// A post that has no file in the storage plays from its own address, as before.
import type { DriveFileRef } from '../../../../files/common/recordingUpload';

export type PlayFrom = 'local' | 'drive';

export interface PlaySourceDeps {
  isWeb: boolean;
  /** kit8media:// -> an object url; anything else unchanged */
  resolveLocal: (uri: string) => Promise<string>;
  /** the file of the device / browser is still there */
  localExists: (uri: string) => Promise<boolean>;
  /** a link the player can open for the file row (the function signs one that works for 10 minutes and streams the file) */
  driveUrl: (fileRowGUID: string) => Promise<string>;
}

export interface PlaySource {
  uri: string;
  from: PlayFrom;
}

export async function resolvePlaySource(local: string, drive: DriveFileRef | null | undefined, deps: PlaySourceDeps, opts: { forceDrive?: boolean } = {}): Promise<PlaySource> {
  const fromLocal = async (): Promise<PlaySource> => ({ uri: await deps.resolveLocal(local), from: 'local' });
  const fromDrive = async (): Promise<PlaySource> => ({ uri: await deps.driveUrl((drive as DriveFileRef).fileRowGUID), from: 'drive' });
  if (!drive?.fileRowGUID) return fromLocal();
  if (opts.forceDrive) return fromDrive();
  if (deps.isWeb) {
    try {
      return await fromDrive();
    } catch (driveError) {
      try {
        return await fromLocal(); // not reachable / not allowed: the copy of this browser, when there is one
      } catch {
        throw driveError;
      }
    }
  }
  if (local && (await deps.localExists(local))) return fromLocal();
  return fromDrive();
}

/** the list of the Drive files of a post, one per part, in the order of the playable addresses (undefined = that part is not uploaded) */
export function driveFileOfPart(files: readonly DriveFileRef[] | undefined, index: number): DriveFileRef | undefined {
  return files && files[index] && files[index].fileRowGUID ? files[index] : undefined;
}
