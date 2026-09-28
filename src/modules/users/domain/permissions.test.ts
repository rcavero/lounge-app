import { describe, expect, it } from "vitest";

import { userPermissions, type UserRef } from "./permissions";

const me: UserRef = { id: "yo", role: "ADMIN" };
const otherAdmin: UserRef = { id: "otro-admin", role: "ADMIN" };
const worker: UserRef = { id: "worker", role: "WORKER" };

const NOTHING = {
  canEdit: false,
  canChangeRole: false,
  canChangePassword: false,
  canDelete: false,
};

describe("userPermissions: la matriz de P12", () => {
  it("sobre un WORKER, el ADMIN lo puede todo", () => {
    expect(userPermissions(me, worker, 1)).toEqual({
      isSelf: false,
      isLastAdmin: false,
      canEdit: true,
      canChangeRole: true,
      canChangePassword: true,
      canDelete: true,
    });
  });

  it("sobre otro ADMIN, nada: solo lectura", () => {
    expect(userPermissions(me, otherAdmin, 2)).toEqual({
      isSelf: false,
      isLastAdmin: false,
      ...NOTHING,
    });
  });

  it("sobre sí mismo, habiendo más admins, todo", () => {
    expect(userPermissions(me, me, 2)).toEqual({
      isSelf: true,
      isLastAdmin: false,
      canEdit: true,
      canChangeRole: true,
      canChangePassword: true,
      canDelete: true,
    });
  });

  it("el último ADMIN se edita y se cambia la contraseña, pero no se baja el rol ni se borra", () => {
    expect(userPermissions(me, me, 1)).toEqual({
      isSelf: true,
      isLastAdmin: true,
      canEdit: true,
      canChangeRole: false,
      canChangePassword: true,
      canDelete: false,
    });
  });

  it("un WORKER no puede nada, ni sobre sí mismo (el módulo es del ADMIN)", () => {
    expect(userPermissions(worker, worker, 1)).toMatchObject(NOTHING);
    expect(userPermissions(worker, me, 1)).toMatchObject(NOTHING);
  });
});
