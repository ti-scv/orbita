import { describe, expect, it } from "vitest";
import { readRoute, routePath } from "./routes";
import {
  groupInputTime,
  groupInputToIso,
} from "./components/AppointmentGroups";
describe("group navigation and schedule", () => {
  it("opens the overview by default and preserves the overview route", () => {
    expect(readRoute("/").page).toBe("overview");
    expect(readRoute("/unknown").page).toBe("appointments");
    expect(routePath("appointments")).toBe("/agendamentos");
    expect(routePath("overview")).toBe("/visao-geral");
    expect(readRoute(routePath("overview")).page).toBe("overview");
  });
  it("preserves group detail URL", () => {
    const id = "b6dee523-2618-494d-8cfb-4d11e1c8db5b";
    expect(readRoute("/grupos")).toEqual({ page: "groups", groupId: null, notFound: false });
    expect(readRoute(routePath("groups", id))).toEqual({
      page: "groups",
      groupId: id,
      notFound: false,
    });
    expect(readRoute("/responses").page).toBe("groups");
  });
  it("converts Brasilia time without depending on browser timezone", () => {
    expect(groupInputTime("2026-10-15T10:15:00Z")).toBe("2026-10-15T07:15");
    expect(groupInputToIso("2026-10-15T07:15")).toBe(
      "2026-10-15T10:15:00.000Z",
    );
  });
});
