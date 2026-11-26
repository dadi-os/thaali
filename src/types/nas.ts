/** What an entry of the box's file tree is. */
export type NasFileKind = "file" | "folder" | "symlink";

/** One entry of Nas GET /fs/list and GET /fs/stat; `path` is absolute inside the dadi home. */
export type NasFileEntry = {
  name: string;
  path: string;
  kind: NasFileKind;
  /** Bytes; a folder's is not meaningful. */
  size: number;
  /** RFC 3339. */
  modified: string;
  /** Empty for a folder. */
  media_type: string;
};

/** Nas GET /fs/list: a folder's entries, folders first and then by name. */
export type NasFileList = {
  path: string;
  entries: NasFileEntry[];
};

/** Nas POST /fs/upload: where the file landed, which differs from the name sent when that name was taken. */
export type NasUploaded = {
  path: string;
  name: string;
  size: number;
};

/** Nas POST /fs/mkdir, /fs/move and /fs/trash: where the entry now is. */
export type NasFilePath = {
  path: string;
};
