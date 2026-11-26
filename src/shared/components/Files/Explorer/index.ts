/**
 * The file explorer over the box: a folder tree, a sortable list of the open folder, and the actions on files.
 *
 * Owns: listing, selecting, renaming, moving, trashing and uploading files through the Nas client, and the states
 * (loading, offline, error, empty) a listing can be in.
 *
 * Does not own: what a selected file looks like (the surface passes a preview as children) or where the explorer opens.
 */

export { Explorer, type ExplorerProps } from "./Explorer";
export { iconFor } from "./listing";
export { resolveBoxPath, statKey, type BoxTarget } from "./useFolder";
