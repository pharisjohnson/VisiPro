// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const hooks = vi.hoisted(() => ({ info: undefined as unknown, checkIn: vi.fn(), checkInWithCode: vi.fn() }));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: () => hooks.info,
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(ref) === "kiosk:checkIn" ? hooks.checkIn : hooks.checkInWithCode,
  };
});

import { KioskApp } from "../src/kiosk/KioskApp";
import { BadgeModal } from "../src/components/Badge";

const INFO = {
  companyName: "Acme Ltd",
  hosts: [{ id: "m1", name: "Hana Host" }, { id: "m2", name: "Ann Admin" }],
  fields: [{ key: "national_id", label: "National ID", required: true }],
};

beforeEach(() => {
  hooks.info = INFO;
  hooks.checkIn.mockReset();
  hooks.checkInWithCode.mockReset();
});
afterEach(cleanup);

describe("kiosk page", () => {
  test("shows a loading state, then an inactive-link message for a bad token", () => {
    hooks.info = undefined;
    const { unmount } = render(<KioskApp token="t" />);
    expect(screen.getByText("Loading…")).toBeTruthy();
    unmount();
    hooks.info = null;
    render(<KioskApp token="t" />);
    expect(screen.getByText(/no longer active/i)).toBeTruthy();
  });

  test("greets with the company name and offers both paths", () => {
    render(<KioskApp token="t" />);
    expect(screen.getByRole("heading", { name: "Welcome to Acme Ltd" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I have an appointment" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I'm a walk-in" })).toBeTruthy();
  });

  test("a walk-in submits the chosen host id and custom fields, then thanks the visitor", async () => {
    hooks.checkIn.mockResolvedValue({ ok: true, name: "Wanda Walkin", hostName: "Hana Host" });
    const user = userEvent.setup();
    render(<KioskApp token="secret-token" />);
    await user.click(screen.getByRole("button", { name: "I'm a walk-in" }));
    await user.type(screen.getByLabelText(/your full name/i), "Wanda Walkin");
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.selectOptions(screen.getByLabelText(/who are you visiting/i), "m1");
    await user.type(screen.getByLabelText(/national id/i), "12345678");
    await user.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => expect(hooks.checkIn).toHaveBeenCalledTimes(1));
    expect(hooks.checkIn).toHaveBeenCalledWith({
      token: "secret-token", name: "Wanda Walkin", company: "Acme", purpose: "Meeting",
      extraData: { national_id: "12345678" }, hostId: "m1", hostName: undefined,
    });
    expect(await screen.findByText("Thank you, Wanda!")).toBeTruthy();
    expect(screen.getByText(/Hana Host has been told you're here/)).toBeTruthy();
  });

  test("the thank-you screen resets itself so the next visitor starts clean", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      hooks.checkInWithCode.mockResolvedValue({ ok: true, name: "Pat Prebooked", hostName: "Hana Host" });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<KioskApp token="t" />);
      await user.click(screen.getByRole("button", { name: "I have an appointment" }));
      await user.type(screen.getByLabelText(/check-in code/i), "abc234");
      await user.type(screen.getByLabelText(/national id/i), "1");
      await user.click(screen.getByRole("button", { name: "Check in" }));
      expect(await screen.findByText("Thank you, Pat!")).toBeTruthy();
      expect(hooks.checkInWithCode).toHaveBeenCalledWith({ token: "t", code: "ABC234", extraData: { national_id: "1" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(8100); });
      expect(screen.queryByText("Thank you, Pat!")).toBeNull();
      expect(screen.getByRole("button", { name: "I have an appointment" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  test.each([
    [{ ok: false, reason: "code" }, /couldn't find that code/i],
    [{ ok: false, reason: "busy" }, /too many check-ins/i],
    [{ ok: false, reason: "invalid" }, /no longer active/i],
    [{ ok: false, reason: "details", message: "National ID is required" }, /National ID is required/],
  ])("explains a refusal (%j) in plain words and keeps the form", async (result, message) => {
    hooks.checkInWithCode.mockResolvedValue(result);
    const user = userEvent.setup();
    render(<KioskApp token="t" />);
    await user.click(screen.getByRole("button", { name: "I have an appointment" }));
    await user.type(screen.getByLabelText(/check-in code/i), "ZZZZZZ");
    await user.type(screen.getByLabelText(/national id/i), "1");
    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(message);
    expect((screen.getByLabelText(/check-in code/i) as HTMLInputElement).value).toBe("ZZZZZZ");
  });

  test("a network failure is reported, not swallowed", async () => {
    hooks.checkIn.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<KioskApp token="t" />);
    await user.click(screen.getByRole("button", { name: "I'm a walk-in" }));
    await user.type(screen.getByLabelText(/your full name/i), "W");
    await user.selectOptions(screen.getByLabelText(/who are you visiting/i), "m2");
    await user.type(screen.getByLabelText(/national id/i), "1");
    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't reach the server/i);
  });

  test("with no team members listed, the visitor types the host's name instead", async () => {
    hooks.info = { ...INFO, hosts: [] };
    hooks.checkIn.mockResolvedValue({ ok: true, name: "W", hostName: "Mr Typed" });
    const user = userEvent.setup();
    render(<KioskApp token="t" />);
    await user.click(screen.getByRole("button", { name: "I'm a walk-in" }));
    await user.type(screen.getByLabelText(/your full name/i), "W");
    await user.type(screen.getByLabelText(/who are you visiting/i), "Mr Typed");
    await user.type(screen.getByLabelText(/national id/i), "1");
    await user.click(screen.getByRole("button", { name: "Check in" }));
    await waitFor(() => expect(hooks.checkIn).toHaveBeenCalled());
    expect(hooks.checkIn.mock.calls[0][0]).toMatchObject({ hostId: undefined, hostName: "Mr Typed" });
  });
});

describe("visitor badge", () => {
  const badge = { name: "Alice Johnson", company: "Innovate Corp", host: "Hana Host", purpose: "Interview", checkInTime: new Date(2026, 9, 2, 14, 30), companyName: "Acme Ltd" };

  test("shows who, where to, and offers print/skip after a check-in", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BadgeModal badge={badge} justCheckedIn onClose={onClose} />);
    expect(screen.getByText("Alice Johnson")).toBeTruthy();
    expect(screen.getByText("Innovate Corp")).toBeTruthy();
    expect(screen.getByText("Hana Host")).toBeTruthy();
    expect(screen.getByText("Acme Ltd")).toBeTruthy();
    expect(document.querySelector(".print-area.badge-print")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Print badge" }));
    expect(print).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalled();
  });

  test("'don't show again' turns the prompt off on this device", async () => {
    localStorage.clear();
    const { badgePromptEnabled } = await import("../src/components/Badge");
    expect(badgePromptEnabled()).toBe(true);
    const user = userEvent.setup();
    render(<BadgeModal badge={badge} justCheckedIn onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /don't show this after check-in/i }));
    expect(badgePromptEnabled()).toBe(false);
  });

  test("a reprint from the log has no check-in banner and a plain Close", () => {
    render(<BadgeModal badge={badge} onClose={() => {}} />);
    expect(screen.queryByText(/is checked in/)).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /don't show/i })).toBeNull();
  });
});

describe("badge text is escaped, not interpreted", () => {
  test("markup in a visitor's name renders as text", () => {
    render(<BadgeModal badge={{ name: "<img src=x onerror=alert(1)>", company: "", host: "H", purpose: "p", checkInTime: new Date(), companyName: "" }} onClose={() => {}} />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });
});
