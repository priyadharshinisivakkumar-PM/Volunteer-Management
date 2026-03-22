import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";

function createJsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(async (input) => {
    const url = String(input);

    if (url.includes("/api/event-settings")) {
      return createJsonResponse({ normalSlots: 999, specialSlots: 999 });
    }

    if (url.includes("/api/events/") && url.includes("/registrations")) {
      return createJsonResponse({ registrations: 0 });
    }

    if (url.includes("/api/volunteers/identity-document")) {
      return createJsonResponse({
        volunteerFound: true,
        aadhaarOnFile: true,
        aadhaar: {
          last4: "1234",
          isMasked: true,
          uploadedAt: "2026-03-01T09:30:00.000Z",
          fileName: "masked-aadhaar.pdf",
          status: "pending"
        }
      });
    }

    if (url.includes("/api/admin/login")) {
      return createJsonResponse({ token: "admin-token" });
    }

    if (url.includes("/api/admin/events-summary")) {
      return createJsonResponse({ events: [] });
    }

    if (url.includes("/api/admin/attendance-dates")) {
      return createJsonResponse({
        dates: [{ date: "2026-04-17", registrations: 1 }],
        totals: { registrations: 1 }
      });
    }

    if (url.includes("/api/admin/attendance-by-date/2026-04-17")) {
      return createJsonResponse({
        date: "2026-04-17",
        registrations: [
          {
            id: 1,
            full_name: "Priyadharshini Sivakkumar",
            phone: "9876165678",
            city: "Madurai",
            email: "priya@example.com",
            registration_type: "team",
            team_name: "Annadhanam Squad",
            team_lead_name: "Murugan Vel",
            volunteer_id: "SPST0001",
            pincode: "600041",
            attendance_status: "pending",
            created_at: "2026-03-01T09:30:00.000Z",
            kyc: {
              status: "pending",
              hasDocument: true,
              last4: "1234",
              uploadedAt: "2026-03-01T09:30:00.000Z",
              fileName: "masked-aadhaar.pdf"
            }
          }
        ]
      });
    }

    if (url.includes("/api/admin/attendance/1/kyc-document")) {
      return createJsonResponse({
        url: "https://example.com/doc.pdf",
        fileName: "masked-aadhaar.pdf"
      });
    }

    if (url.includes("/api/events/") && url.includes("/register")) {
      return createJsonResponse(
        {
          id: 1,
          eventId: 1,
          fullName: "Priyadharshini Sivakkumar",
          signedPhotoUrl: null
        },
        201
      );
    }

    if (url.includes("/api/admin/visitor-passes")) {
      return createJsonResponse({
        registrations: [],
        totals: { registrations: 0, visitDates: 0 },
        filters: { date: null }
      });
    }

    if (url.includes("/api/visitor-passes/register")) {
      return createJsonResponse(
        {
          id: 1,
          visitorPassId: "VSPT0001",
          fullName: "Priyadharshini Sivakkumar",
          phone: "9876165678",
          dateOfVisit: "2099-04-17T10:30:00.000Z",
          city: "Madurai",
          pincode: "600041"
        },
        201
      );
    }

    return createJsonResponse([]);
  });

  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("shows the registration form after selecting a moon date", async () => {
  render(<App />);
  const user = userEvent.setup();
  const dateButtons = screen
    .getAllByRole("button")
    .filter((button) => /full moon|new moon/i.test(button.textContent || ""));

  const enabledButton = dateButtons.find((button) => !button.disabled);
  expect(enabledButton).toBeDefined();
  await user.click(enabledButton);

  expect(await screen.findByText(/registration for:/i)).toBeInTheDocument();
  expect(screen.getByText(/registration type/i)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /submit registration/i })
  ).toBeInTheDocument();
});

test("shows saved Aadhaar details for a returning volunteer", async () => {
  render(<App />);
  const user = userEvent.setup();
  const dateButtons = screen
    .getAllByRole("button")
    .filter((button) => /full moon|new moon/i.test(button.textContent || ""));

  const enabledButton = dateButtons.find((button) => !button.disabled);
  expect(enabledButton).toBeDefined();
  await user.click(enabledButton);

  const phoneInput = await screen.findByPlaceholderText(/phone/i);
  await user.type(phoneInput, "9876165678");
  fireEvent.blur(phoneInput);

  expect(
    await screen.findByText(/aadhaar already on file ending 1234/i)
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", { name: /use saved aadhaar/i })
  ).toBeChecked();
  expect(
    screen.getByRole("radio", { name: /update aadhaar/i })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /upload aadhaar/i })
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole("radio", { name: /update aadhaar/i }));

  expect(
    screen.getByRole("button", { name: /upload aadhaar/i })
  ).toBeInTheDocument();
});

test("switches the home page to Tamil labels", async () => {
  render(<App />);
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" }));

  expect(
    await screen.findByRole("button", { name: "\u0BA8\u0BBF\u0BB0\u0BCD\u0BB5\u0BBE\u0B95 \u0B89\u0BB3\u0BCD\u0BA8\u0BC1\u0BB4\u0BC8\u0BB5\u0BC1" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "\u0BAA\u0BBE\u0BB0\u0BCD\u0BB5\u0BC8\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD \u0B85\u0BA9\u0BC1\u0BAE\u0BA4\u0BBF" })
  ).toBeInTheDocument();
  expect(
    screen.getAllByText("\u0B95\u0BA3\u0B95\u0BCD\u0B95\u0BA9\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BBF \u0B93\u0BAE\u0BCD \u0BB8\u0BCD\u0BB0\u0BC0 \u0B9A\u0BB0\u0BCD\u0B95\u0BC1\u0BB0\u0BC1 \u0BAA\u0BB4\u0BA9\u0BBF \u0B9A\u0BC1\u0BB5\u0BBE\u0BAE\u0BBF\u0B95\u0BB3\u0BCD \u0B9A\u0BC1\u0BB5\u0BBE\u0BAE\u0BBF \u0B95\u0BCB\u0BB5\u0BBF\u0BB2\u0BCD").length
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByText("\u0B8E\u0BB0\u0BCD\u0BB0\u0BAE\u0BA8\u0BBE\u0BAF\u0B95\u0BCD\u0B95\u0BA9\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BBF, \u0BA4\u0BBF\u0BA3\u0BCD\u0B9F\u0BC1\u0B95\u0BCD\u0B95\u0BB2\u0BCD-624613, \u0BA4\u0BAE\u0BBF\u0BB4\u0BCD\u0BA8\u0BBE\u0B9F\u0BC1").length
  ).toBeGreaterThan(0);
  expect(document.documentElement.lang).toBe("ta");
});

test("shows KYC status and preview actions in the admin attendance table", async () => {
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  render(<App />);
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: /admin login/i }));
  await user.type(screen.getByPlaceholderText(/username/i), "admin");
  await user.type(screen.getByPlaceholderText(/password/i), "secret");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  await user.click(await screen.findByText("2026-04-17"));

  expect(await screen.findByText(/pending review/i)).toBeInTheDocument();
  expect(screen.getByText(/last 4: 1234/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /preview/i }));

  await waitFor(() =>
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/doc.pdf",
      "_blank",
      "noopener,noreferrer"
    )
  );

  openSpy.mockRestore();
});

test("shows team name on volunteer ID cards for team registrations", async () => {
  render(<App />);
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: /admin login/i }));
  await user.type(screen.getByPlaceholderText(/username/i), "admin");
  await user.type(screen.getByPlaceholderText(/password/i), "secret");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  await user.click(await screen.findByText("2026-04-17"));
  await user.click(await screen.findByTitle(/select this volunteer for id card/i));
  await user.click(screen.getByRole("button", { name: /print id card/i }));

  expect(await screen.findByText(/team name/i)).toBeInTheDocument();
  expect(await screen.findByText(/team lead name/i)).toBeInTheDocument();
  expect(screen.getByText(/service date/i)).toBeInTheDocument();
  expect(screen.getByText(/17[- ]Apr[- ]2026/i)).toBeInTheDocument();
  expect(screen.getAllByText(/annadhanam squad/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/murugan vel/i).length).toBeGreaterThan(0);
});

test("opens the visitor pass form from the home page", async () => {
  render(<App />);
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: /^visitor pass$/i }));

  expect(await screen.findByText(/register visitor pass/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/phone/i)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /submit visitor pass/i })
  ).toBeInTheDocument();
});

test("submits a visitor pass with a valid future visit date", async () => {
  render(<App />);
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: /^visitor pass$/i }));

  await user.type(screen.getByPlaceholderText(/full name/i), "Priyadharshini Sivakkumar");
  await user.type(screen.getByPlaceholderText(/phone/i), "9876165678");
  fireEvent.change(screen.getByLabelText(/date of visit/i), {
    target: { value: "2099-04-17" }
  });
  await user.type(screen.getByPlaceholderText(/city/i), "Madurai");
  await user.type(screen.getByPlaceholderText(/pincode/i), "600041");

  await user.click(screen.getByRole("button", { name: /submit visitor pass/i }));

  expect(await screen.findByText(/visitor pass confirmed/i)).toBeInTheDocument();
  expect(screen.getByText(/17 Apr.*2099/i)).toBeInTheDocument();
  expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();

  const registerCall = fetchMock.mock.calls.find(([input]) =>
    String(input).includes("/api/visitor-passes/register")
  );

  expect(registerCall).toBeTruthy();
  expect(JSON.parse(registerCall[1].body)).toMatchObject({
    fullName: "Priyadharshini Sivakkumar",
    phone: "9876165678",
    dateOfVisit: "2099-04-17",
    city: "Madurai",
    pincode: "600041"
  });
  expect(screen.queryByText(/enter a valid visit date/i)).not.toBeInTheDocument();
});

