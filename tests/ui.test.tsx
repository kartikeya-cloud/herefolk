import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://herefolk.test/",
});
for (const key of [
  "window",
  "document",
  "navigator",
  "localStorage",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Node",
  "MutationObserver",
  "FormData",
  "Event",
])
  Object.defineProperty(globalThis, key, {
    value: (dom.window as any)[key],
    configurable: true,
    writable: true,
  });
window.scrollTo = () => {};
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const { render, screen, fireEvent, waitFor, cleanup, within } =
  await import("@testing-library/react");
const { default: App } = await import("../src/App");
const { STORAGE_KEY, readDemo, freshDemo } = await import("../src/demo");
beforeEach(() => {
  localStorage.clear();
  document.body.style.overflow = "";
});
afterEach(() => cleanup());
function show() {
  return render(<App />);
}
async function checkIn() {
  fireEvent.click(screen.getByRole("button", { name: /The Reading Room/ }));
  fireEvent.click(screen.getByRole("button", { name: "Check in & say hello" }));
  await screen.findByRole("heading", { name: "The Reading Room" });
}
function go(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name, exact: true })[0]);
}
test("Herefolk discover search and clear filters work", () => {
  show();
  assert.match(document.body.textContent || "", /herefolk/);
  fireEvent.change(screen.getByRole("textbox", { name: "Search places" }), {
    target: { value: "no-such-place" },
  });
  assert.ok(screen.getByRole("heading", { name: "No places found" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  assert.ok(screen.getByRole("button", { name: /The Reading Room/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Outdoors", exact: true }),
  );
  assert.equal(
    screen.queryByRole("button", { name: /The Reading Room/ }) === null,
    true,
  );
  assert.ok(screen.getByRole("button", { name: /The Green Corner/ }));
});
test("venue dialog supports Escape and restores focus", async () => {
  show();
  const card = screen.getByRole("button", { name: /The Reading Room/ });
  card.focus();
  fireEvent.click(card);
  assert.equal(document.body.style.overflow, "hidden");
  await waitFor(() =>
    assert.equal(
      document.activeElement ===
        screen.getByRole("button", { name: "Close venue" }),
      true,
    ),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(screen.queryByRole("dialog") === null, true);
  assert.equal(document.body.style.overflow, "");
  assert.equal(document.activeElement === card, true);
});
test("posting, deleting with confirmation, and leaving work end to end", async () => {
  show();
  await checkIn();
  const input = screen.getByRole("textbox", { name: "Write a venue post" });
  fireEvent.change(input, { target: { value: "   " } });
  assert.equal(
    (
      screen.getByRole("button", {
        name: /Post to the loop/,
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  fireEvent.change(input, {
    target: { value: "Hello from our interaction test" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Post to the loop/ }));
  await screen.findByText("Hello from our interaction test");
  fireEvent.click(screen.getByRole("button", { name: "Delete your post" }));
  assert.ok(screen.getByRole("dialog", { name: "Delete this post?" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
  assert.ok(screen.getByText("Hello from our interaction test"));
  fireEvent.click(screen.getByRole("button", { name: "Delete your post" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Delete post", exact: true }),
  );
  await waitFor(() =>
    assert.equal(
      screen.queryByText("Hello from our interaction test") === null,
      true,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: /Leave venue/ }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Leave venue",
      exact: true,
    }),
  );
  await screen.findByRole("heading", { name: /Find your place/ });
  go("Venue feed");
  assert.ok(
    screen.getByRole("heading", { name: "Every connection starts somewhere" }),
  );
});
test("reopening the current venue does not extend the session", async () => {
  show();
  await checkIn();
  const expiry = JSON.parse(localStorage.getItem(STORAGE_KEY)!).checkin
    .expires_at;
  go("Discover");
  fireEvent.click(screen.getByRole("button", { name: /The Reading Room/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Open venue feed", exact: true }),
  );
  await screen.findByRole("heading", { name: "The Reading Room" });
  assert.equal(
    JSON.parse(localStorage.getItem(STORAGE_KEY)!).checkin.expires_at,
    expiry,
  );
});
test("requests disable duplicates and incoming invites can be accepted", async () => {
  show();
  await checkIn();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Say hello", exact: true })[0],
  );
  await waitFor(() =>
    assert.ok(
      screen
        .getAllByRole("button", { name: "Request pending" })
        .some((b) => (b as HTMLButtonElement).disabled),
    ),
  );
  go("Connections");
  assert.ok(screen.getByRole("heading", { name: "Meera" }));
  fireEvent.click(screen.getByRole("button", { name: "Accept", exact: true }));
  await screen.findByText("Connected");
  assert.equal(
    screen.queryByRole("button", { name: "Accept", exact: true }) === null,
    true,
  );
});
test("profile saves trimmed name, permits empty bio, and reset is confirmed", async () => {
  show();
  go("Profile");
  fireEvent.change(screen.getByRole("textbox", { name: "Display name" }), {
    target: { value: "  Kartikeya Sharma  " },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "A little about you" }),
    { target: { value: "" } },
  );
  fireEvent.click(screen.getByRole("button", { name: /Save profile/ }));
  await waitFor(() =>
    assert.equal(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).profile.display_name,
      "Kartikeya Sharma",
    ),
  );
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)!).profile.bio, "");
  fireEvent.click(
    screen.getByRole("button", { name: "Reset demo", exact: true }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
  assert.equal(
    JSON.parse(localStorage.getItem(STORAGE_KEY)!).profile.display_name,
    "Kartikeya Sharma",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reset demo", exact: true }),
  );
  fireEvent.click(
    screen.getAllByRole("button", { name: "Reset demo", exact: true }).at(-1)!,
  );
  await waitFor(() =>
    assert.equal(
      (
        screen.getByRole("textbox", {
          name: "Display name",
        }) as HTMLInputElement
      ).value,
      "Kartikeya",
    ),
  );
});
test("corrupt saved data recovers and expired sessions do not show a feed", async () => {
  assert.equal(
    readDemo({ getItem: () => "{broken" }).profile.display_name,
    "Kartikeya",
  );
  assert.equal(
    readDemo({
      getItem: () =>
        JSON.stringify({
          profile: { display_name: null },
          posts: [],
          requests: [],
        }),
    }).profile.display_name,
    "Kartikeya",
  );
  const d = freshDemo();
  d.checkin = {
    id: "old",
    user_id: d.profile.id,
    venue_id: "11111111-1111-4111-8111-111111111111",
    expires_at: new Date(Date.now() - 1000).toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  show();
  go("Venue feed");
  assert.ok(
    screen.getByRole("heading", { name: "Every connection starts somewhere" }),
  );
  await waitFor(() =>
    assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)!).checkin, null),
  );
});
