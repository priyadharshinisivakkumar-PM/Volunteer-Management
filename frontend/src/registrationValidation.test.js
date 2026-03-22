import { describe, expect, test } from "vitest";
import {
  calculateAgeFromDateOfBirth,
  validateDateOfBirth,
  validateIsoCalendarDate,
  validateVisitDate
} from "../../shared/registrationValidation.js";

describe("validateIsoCalendarDate", () => {
  test("accepts a valid ISO calendar date", () => {
    const result = validateIsoCalendarDate("2026-04-17");

    expect(result).toMatchObject({
      isValid: true,
      normalized: "2026-04-17"
    });
  });

  test("rejects impossible calendar dates", () => {
    const result = validateIsoCalendarDate("2026-02-30");

    expect(result).toMatchObject({
      isValid: false,
      reason: "calendar"
    });
  });
});

describe("validateVisitDate", () => {
  test("accepts today or a future visit date", () => {
    const result = validateVisitDate("2026-04-17", {
      todayIsoDate: "2026-03-21"
    });

    expect(result).toMatchObject({
      isValid: true,
      normalized: "2026-04-17"
    });
  });

  test("rejects past visit dates", () => {
    const result = validateVisitDate("2026-03-20", {
      todayIsoDate: "2026-03-21"
    });

    expect(result).toMatchObject({
      isValid: false,
      reason: "past"
    });
  });
});

describe("validateDateOfBirth", () => {
  test("accepts a valid past date", () => {
    const result = validateDateOfBirth("2000-10-10", {
      todayIsoDate: "2026-03-20"
    });

    expect(result).toMatchObject({
      isValid: true,
      normalized: "2000-10-10"
    });
  });

  test("rejects future dates", () => {
    const result = validateDateOfBirth("2026-03-21", {
      todayIsoDate: "2026-03-20"
    });

    expect(result).toMatchObject({
      isValid: false,
      reason: "future"
    });
  });

  test("rejects years longer than four digits", () => {
    const result = validateDateOfBirth("19999-10-10", {
      todayIsoDate: "2026-03-20"
    });

    expect(result).toMatchObject({
      isValid: false,
      reason: "format"
    });
  });

  test("rejects impossible calendar dates", () => {
    const result = validateDateOfBirth("2026-02-30", {
      todayIsoDate: "2026-03-20"
    });

    expect(result).toMatchObject({
      isValid: false,
      reason: "calendar"
    });
  });
});

describe("calculateAgeFromDateOfBirth", () => {
  test("calculates age from a valid date of birth", () => {
    expect(
      calculateAgeFromDateOfBirth("2000-10-10", {
        todayIsoDate: "2026-03-20"
      })
    ).toBe(25);
  });
});
