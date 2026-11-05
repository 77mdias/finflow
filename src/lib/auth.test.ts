import { describe, expect, it } from "vitest";

import { discordProfileToUser } from "./auth";

// O Better Auth monta o usuário como { email: profile.email, ...mapProfileToUser(profile) }.
const emailAfterMapping = (verified: boolean) =>
  ({ email: "ana@example.com", ...discordProfileToUser({ verified }) }).email;

describe("discordProfileToUser", () => {
  it("descarta o e-mail não verificado, e o login é recusado", () => {
    expect(emailAfterMapping(false)).toBeUndefined();
  });

  it("mantém o e-mail verificado", () => {
    expect(emailAfterMapping(true)).toBe("ana@example.com");
  });
});
