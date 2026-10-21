import { describe, expect, it } from "vitest";
import type { ChaaviFolder, ChaaviItem } from "../../types/chaavi";
import { createBody, draftFromItem, draftProblem, emptyDraft, inScope, itemSubtitle, retype, searchItems, updateBody } from "./draft";

const folders: ChaaviFolder[] = [{ id: "dev", name: "development/fliks-gg" }];

const login: ChaaviItem = {
  id: "l1",
  name: "GitHub",
  type: "login",
  folderId: "dev",
  favorite: true,
  hasNotes: false,
  revisionDate: null,
  fields: [
    { name: "Recovery", type: "hidden", hasValue: true },
    { name: "Org", type: "text", value: "dadi" },
  ],
  login: {
    username: "octocat",
    uris: [{ uri: "https://github.com/login", match: "default" }],
    hasPassword: true,
    hasTotp: true,
    passkeys: [],
  },
};

const card: ChaaviItem = {
  id: "c1",
  name: "Sapphire",
  type: "card",
  folderId: null,
  favorite: false,
  hasNotes: true,
  revisionDate: null,
  fields: [],
  card: { cardholderName: "Ada Lovelace", brand: "Visa", expMonth: "8", expYear: "2029", hasNumber: true, hasCode: true },
};

const bank: ChaaviItem = {
  id: "b1",
  name: "Checking",
  type: "bankAccount",
  folderId: null,
  favorite: false,
  hasNotes: false,
  revisionDate: null,
  fields: [],
  bankAccount: {
    bankName: "Acme Bank",
    nameOnAccount: "Ada Lovelace",
    accountType: "checking",
    routingNumber: "011000015",
    branchNumber: null,
    swiftCode: null,
    bankContactPhone: null,
    hasAccountNumber: true,
    hasPin: true,
    hasIban: false,
  },
};

describe("vault search and scopes", () => {
  it("searches names, usernames, sites, card holders and text fields", () => {
    expect(searchItems([login, card], "octo")).toEqual([login]);
    expect(searchItems([login, card], "lovelace")).toEqual([card]);
    expect(searchItems([login, card], "DADI")).toEqual([login]);
    expect(searchItems([login, card], "  ")).toEqual([login, card]);
  });

  it("scopes by folder, no folder and favorites", () => {
    expect(inScope(login, { kind: "folder", path: "development" }, folders)).toBe(true);
    expect(inScope(login, { kind: "folder", path: "development/fliks-gg" }, folders)).toBe(true);
    expect(inScope(login, { kind: "folder", path: "dev" }, folders)).toBe(false);
    expect(inScope(card, { kind: "none" }, folders)).toBe(true);
    expect(inScope(login, { kind: "none" }, folders)).toBe(false);
    expect(inScope(card, { kind: "favorites" }, folders)).toBe(false);
  });

  it("subtitles show public fields only", () => {
    expect(itemSubtitle(login)).toBe("octocat · github.com");
    expect(itemSubtitle(card)).toBe("Visa · 08/29");
    expect(itemSubtitle(bank)).toBe("Acme Bank · checking");
  });

  it("searches a bank account's public fields", () => {
    expect(searchItems([login, bank], "acme")).toEqual([bank]);
  });
});

describe("editor bodies", () => {
  it("sends nothing when nothing changed", () => {
    expect(updateBody(login, draftFromItem(login))).toBeNull();
  });

  it("sends only what changed, and keeps an untouched hidden field's stored value", () => {
    const draft = draftFromItem(login);
    draft.name = "GitHub Work";
    draft.folderId = null;
    draft.fields[1]!.value = { value: "fliks", dirty: false };
    expect(updateBody(login, draft)).toEqual({
      name: "GitHub Work",
      folderId: null,
      fields: [
        { name: "Recovery", type: "hidden" },
        { name: "Org", type: "text", value: "fliks" },
      ],
    });
  });

  it("sends a secret only once it is typed, and an emptied one as a clear", () => {
    const draft = draftFromItem(card);
    draft.card.code = { value: "", dirty: true };
    draft.card.number = { value: "4111 1111 1111 1111", dirty: false };
    expect(updateBody(card, draft)).toEqual({ card: { code: "" } });
  });

  it("creates a login without a password so Chaavi generates one", () => {
    const draft = emptyDraft("login", "dev");
    draft.name = " Greenhouse ";
    draft.login.username = "ada@example.com";
    draft.login.uris = [{ key: "u", uri: "https://job-boards.greenhouse.io", match: "host" }];
    expect(createBody(draft)).toEqual({
      name: "Greenhouse",
      folderId: "dev",
      favorite: false,
      type: "login",
      login: { username: "ada@example.com", uris: [{ uri: "https://job-boards.greenhouse.io", match: "host" }] },
    });
  });

  it("creates an SSH key without key material so Chaavi generates one", () => {
    const draft = emptyDraft("sshKey", null);
    draft.name = "Deploy";
    expect(createBody(draft)).toEqual({ name: "Deploy", folderId: null, favorite: false, type: "sshKey" });
  });

  it("edits a bank account's text and typed secrets only", () => {
    const draft = draftFromItem(bank);
    expect(updateBody(bank, draft)).toBeNull();
    draft.flat.bankName = "Acme Credit Union";
    draft.flatSecrets.pin = { value: "", dirty: true };
    expect(updateBody(bank, draft)).toEqual({ bankAccount: { bankName: "Acme Credit Union", pin: "" } });
  });

  it("creates a passport with only the fields given, after switching type", () => {
    const draft = retype(emptyDraft("login", null), "passport");
    draft.name = "US passport";
    draft.flat.surname = "Lovelace";
    draft.flatSecrets.passportNumber = { value: "A123", dirty: true };
    expect(createBody(draft)).toEqual({
      name: "US passport",
      folderId: null,
      favorite: false,
      type: "passport",
      passport: { surname: "Lovelace", passportNumber: "A123" },
    });
  });

  it("names what blocks a save", () => {
    const draft = draftFromItem(login);
    expect(draftProblem(draft)).toBeNull();
    draft.fields[0]!.name = "Renamed";
    expect(draftProblem(draft)).toBe("Type a value for the hidden field “Renamed”.");
    draft.fields[0]!.name = "Recovery";
    draft.fields[1]!.name = "Recovery";
    expect(draftProblem(draft)).toBe("Two custom fields are named “Recovery”.");
    const blank = emptyDraft("note", null);
    expect(draftProblem(blank)).toBe("Give the item a name.");
    const ssh = emptyDraft("sshKey", null);
    ssh.name = "k";
    ssh.sshKey.publicKey = "ssh-ed25519 AAAA";
    expect(draftProblem(ssh)).toMatch(/together/);
  });
});
