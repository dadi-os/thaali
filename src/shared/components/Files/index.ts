/**
 * Files on the box and in messages: the file modal (message attachments, or the explorer opened at a box path), the
 * inline link to a box file, and the one list of actions on files.
 *
 * Owns: how a file is previewed, and how a `box://` link looks and opens.
 *
 * Does not own: the Nas calls (shared/api/nas) or which path is open (contexts/files).
 */

export { FileLink, type FileLinkProps } from "./FileLink";
export { FileModal, type FileModalProps } from "./FileModal";
export { FileModalHost } from "./FileModalHost";
export { fileActions, type FileActionDeps } from "./fileActions";
