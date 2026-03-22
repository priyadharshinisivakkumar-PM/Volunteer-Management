import { useEffect, useMemo, useRef, useState } from "react";
import {
  MIN_DOB_YEAR,
  getTodayIsoDate,
  validateDateOfBirth,
  validateIsoCalendarDate,
  validateVisitDate
} from "../../shared/registrationValidation.js";
import {
  createInitialVisitorPassForm,
  visitorPassUi
} from "./visitorPassUi.js";

const TEMPLE_ID = 1;
const TEMPLE_IMAGES = [
  {
    src: "https://sannidhi.net/wp-content/uploads/2023/02/Kanakkanpatti-Mootai-Swamigal-0.jpeg",
    alt: "Satguru Palani Swamy temple view from sannidhi.net"
  },
  {
    src: "https://as2.ftcdn.net/v2/jpg/03/37/98/71/1000_F_337987130_i6afiQDsNiI50yVRnwbm5lvCihLq1D5Z.jpg",
    alt: "Satguru Palani Swamy temple entrance view"
  },
  {
    src: "https://sannidhi.net/wp-content/uploads/2023/02/Kanakkanpatti-Mootai-Swamigal-1-300x241.png",
    alt: "Kanakkanpatti Mootai Swami Jeevasamadhi"
  }
];

const EVENT_IMAGES = {
  1: {
    src:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Volunteers%20helping%20at%20the%20Golden%20Temple%20langar%2C%20Sikhism%20in%20India.jpg?width=700",
    alt: "Volunteers preparing food seva"
  },
  2: {
    src:
      "https://commons.wikimedia.org/wiki/Special:FilePath/All%20devotees%20standing%20in%20a%20queue%20for%20darshan.jpg?width=700",
    alt: "Devotees waiting in darshan queue"
  },
  3: {
    src:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Tirumala%20overview.jpg?width=700",
    alt: "Temple campus and queue complex overview"
  },
  4: {
    src:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Volunteers%20of%20Sanatan%20cleaning%20Temple.jpg?width=700",
    alt: "Volunteers cleaning temple premises"
  },
  5: {
    src:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Flower%20Market%20Ancient%20Measurement%20of%20Garland.jpg?width=700",
    alt: "Flower garland preparation in market"
  }
};

const SYNODIC_MONTH_MS = 29.530588861 * 24 * 60 * 60 * 1000;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const ADMIN_TOKEN_STORAGE_KEY = "seva_admin_token";
const LANGUAGE_STORAGE_KEY = "seva_language";
const MIN_TEAM_MEMBERS = 2;
const SUPPORTED_LANGUAGES = ["en", "ta"];
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).trim().replace(/\/$/, "")
    : "") ||
  (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://127.0.0.1:5000"
    : "");

function buildApiUrl(path = "") {
  const rawPath = String(path || "");
  const normalizedPath = rawPath.startsWith("/") ? rawPath : "/" + rawPath;
  return API_BASE_URL ? API_BASE_URL + normalizedPath : normalizedPath;
}

function isHtmlResponse(text = "") {
  const normalized = String(text || "").trim().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, '&#39;');
}

function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : "en";
}

function createTeamMember() {
  return { fullName: "", phone: "", city: "", dateOfBirth: "", photo: null };
}

function createInitialRegistrationForm() {
  return {
    registrationType: "individual",
    teamName: "",
    teamLeadName: "",
    teamLeadPhone: "",
    fullName: "",
    phone: "",
    dateOfBirth: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    termsAccepted: false,
    teamMembers: [createTeamMember(), createTeamMember()]
  };
}

function createInitialAadhaarState() {
  return {
    lookupPhone: "",
    lookupStatus: "idle",
    lookupError: "",
    existingDocument: null,
    mode: "upload",
    file: null,
    last4: "",
    masked: true
  };
}
const moonUiEn = {
    title: (year) => `Full Moon & New Moon Dates - ${year}`,
    subtitle: "Select any date to register for volunteering that day.",
    fullMoon: "Full Moon",
    newMoon: "New Moon",
    clear: "Clear Selection",
    selectHint: "Select a full moon or new moon date to register for volunteering.",
    eventsOn: "Registration for",
    noEvents: "No events are planned for this selected date.",
    backToDates: "Back to Date Cards"
  }

const moonUi = {
  en: moonUiEn,
  ta: {
    ...moonUiEn,
    title: (year) => `${year} பௌர்ணமி / அமாவாசை தேதிகள்`,
    subtitle: "ஏதேனும் ஒரு தேதியை தேர்வு செய்தால் அந்த நாளுக்கான நிகழ்வுகள் காட்டப்படும்.",
    fullMoon: "பௌர்ணமி",
    newMoon: "அமாவாசை",
    clear: "தேர்வை நீக்கு",
    selectHint: "நிகழ்வுகளை பார்க்க பௌர்ணமி அல்லது அமாவாசை தேதியை தேர்வு செய்யவும்.",
    eventsOn: "இந்த தேதிக்கான நிகழ்வுகள்",
    noEvents: "இந்த தேர்ந்தெடுத்த தேதிக்கு நிகழ்வுகள் இல்லை.",
    backToDates: "தேதி கார்டுகளுக்கு திரும்பவும்"
  }
};

const adminUiEn = {
    openPortal: "Admin Login",
    loginTitle: "Admin Portal Login",
    dashboardTitle: "Admin Dashboard",
    username: "Username",
    password: "Password",
    loginButton: "Login",
    loginLoading: "Logging in...",
    backHome: "Back to Home",
    refresh: "Refresh",
    logout: "Logout",
    showPassword: "Show password",
    hidePassword: "Hide password",
    serviceUnavailable: "Admin service is not available right now.",
    summaryLoading: "Loading admin summary...",
    emptySummary: "No event summary found.",
    loginFailed: "Invalid admin username or password.",
    summaryFailed: "Failed to fetch admin summary.",
    sessionExpired: "Admin session expired. Login again.",
    credentialsRequired: "Enter admin username and password.",
    attendanceTab: "Attendance",
    attendanceDetails: "Attendance Details",
    attendanceLoading: "Loading attendance details...",
    attendanceFailed: "Failed to fetch attendance details.",
    volunteerName: "Volunteer Name",
    volunteerPhone: "Phone",
    volunteerCity: "City",
    registrationType: "Type",
    status: "Status",
    noVolunteers: "No volunteers found for this event.",
    backToAttendance: "Back to Attendance",
    statusPending: "Pending",
    statusAttended: "Attended",
    statusAbsent: "Absent",
    statusCancelled: "Cancelled",
    statusUpdateFailed: "Failed to update attendance status.",
    countsTab: "Slot Counts",
    countsTitle: "Volunteer Slot Settings",
    normalCountLabel: "Normal Event Slots",
    specialCountLabel: "Special Event Slots",
    saveCounts: "Save Counts",
    savingCounts: "Saving...",
    countsSaved: "Counts saved successfully.",
    countsRequired: "Enter both slot counts.",
    countsInvalid: "Enter valid slot counts.",
    settingsFailed: "Failed to save slot settings.",
    batchCountLabel: "Cards per batch",
    batchCountPlaceholder: "Enter count",
    batchSingleHint: "Use 1 to print one card per page.",
    batchNormalTitle: "Normal Volunteer ID Cards",
    batchSpecialTitle: "Special Event Volunteer ID Cards",
    batchItemPrefix: "Card",
    kycStatus: "KYC Status",
    kycDocument: "Aadhaar",
    kycPreview: "Preview",
    kycDownload: "Download",
    kycLast4: (last4) => `Last 4: ${last4}`,
    kycUploadedOn: (dateLabel) => `Uploaded: ${dateLabel}`,
    kycMissing: "Missing",
    kycPending: "Pending Review",
    kycVerified: "Verified",
    kycRejected: "Rejected",
    kycUnavailable: "Unavailable",
    kycAccessFailed: "Failed to access KYC document.",
    date: "Date",
    registered: "Registered",
    registrationsTotal: "Registrations",
    eventsTotal: "Events",
    location: "Location",
    totalSlots: "Total Slots",
    available: "Available"
  }

const adminUi = {
  en: adminUiEn,
  ta: {
    ...adminUiEn,
    openPortal: "நிர்வாக உள்நுழைவு",
    loginTitle: "நிர்வாக உள்நுழைவு",
    dashboardTitle: "நிர்வாக பலகை",
    username: "பயனர் பெயர்",
    password: "கடவுச்சொல்",
    loginButton: "உள்நுழை",
    loginLoading: "உள்நுழைகிறது...",
    backHome: "முகப்புக்கு திரும்பவும்",
    refresh: "புதுப்பி",
    logout: "வெளியேறு",
    eventsTotal: "நிகழ்வுகள்",
    registrationsTotal: "பதிவுகள்",
    date: "தேதி",
    location: "இடம்",
    totalSlots: "மொத்த இடங்கள்",
    registered: "பதிவு செய்யப்பட்டோர்",
    available: "காலி இடங்கள்",
    summaryLoading: "நிர்வாக சுருக்கம் ஏற்றப்படுகிறது...",
    emptySummary: "நிகழ்வு சுருக்கம் இல்லை.",
    loginFailed: "தவறான நிர்வாக பயனர் பெயர் அல்லது கடவுச்சொல்.",
    summaryFailed: "நிர்வாக சுருக்கத்தை பெற முடியவில்லை.",
    sessionExpired: "நிர்வாக அமர்வு முடிந்தது. மீண்டும் உள்நுழைக.",
    credentialsRequired: "நிர்வாக பயனர் பெயரும் கடவுச்சொல்லும் அவசியம்."
  }
};

function toIsoDateUTC(timestampMs) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function getMoonPhasesForYear(year) {
  const start = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const end = Date.UTC(year, 11, 31, 23, 59, 59, 999);
  let lunationIndex =
    Math.floor((start - REFERENCE_NEW_MOON_MS) / SYNODIC_MONTH_MS) - 2;
  const phases = [];
  const seen = new Set();

  while (true) {
    const newMoonMs = REFERENCE_NEW_MOON_MS + lunationIndex * SYNODIC_MONTH_MS;
    const fullMoonMs = newMoonMs + SYNODIC_MONTH_MS / 2;

    if (newMoonMs > end && fullMoonMs > end) {
      break;
    }

    if (newMoonMs >= start && newMoonMs <= end) {
      const isoDate = toIsoDateUTC(newMoonMs);
      const key = `new-${isoDate}`;
      if (!seen.has(key)) {
        phases.push({ phase: "new", date: isoDate });
        seen.add(key);
      }
    }

    if (fullMoonMs >= start && fullMoonMs <= end) {
      const isoDate = toIsoDateUTC(fullMoonMs);
      const key = `full-${isoDate}`;
      if (!seen.has(key)) {
        phases.push({ phase: "full", date: isoDate });
        seen.add(key);
      }
    }

    lunationIndex += 1;
  }

  phases.sort((a, b) => a.date.localeCompare(b.date));
  return phases;
}

const translations = {

  en: {
    portalEyebrow: "Seva Management Portal",
    portalTitle: "Volunteer registration for Kanakkanpatti Om Shri Sarguru Palani Swamigal Swamy Temple.",
    templeName: "Kanakkanpatti Om Shri Sarguru Palani Swamigal Swamy Temple",
    templeLocation: "Erramanaickenpatti, Dindigul-624613, Tamil Nadu",
    english: "English",
    tamil: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD",
    registrationConfirmed: "Registration Confirmed",
    confirmedLine: (name, eventTitle) => `${name} registered for ${eventTitle}`,
    ongoingEvents: "Ongoing Events",
    loadingEvents: "Loading ongoing events...",
    noEvents: "No ongoing events available right now.",
    dateLabel: "Date",
    locationLabel: "Location",
    availableSlots: "Available slots",
    registeredLabel: "Registered",
    full: "Full",
    submitting: "Submitting...",
    closeForm: "Close Form",
    register: "Register",
    registrationTypeLabel: "Registration Type",
    individualOption: "Individual",
    teamOption: "Team",
    teamNamePlaceholder: "Team Name",
    teamLeadNamePlaceholder: "Team Lead Name",
    teamLeadPhonePlaceholder: "Team Lead Phone",
    teamMembersHeading: "Team Members",
    memberNamePlaceholder: "Member Name",
    memberPhonePlaceholder: "Member Phone",
    memberCityPlaceholder: "Member City",
    memberPhotoLabel: "Member Photo",
    addMember: "Add Member",
    removeMember: "Remove",
    teamIdentityRequired:
      "Team name, team lead name, and team lead phone are required for team registration.",
    teamMinimumMembers: "Add at least 2 team members to register as a team.",
    teamMemberDetailsRequired:
      "Each team member must include full name, phone, city, date of birth, and photo.",
    teamDuplicatePhones: "Team member phone numbers must be unique.",
    teamLeadMustBeMember: "Team lead phone must match one of the team members.",
    fullNamePlaceholder: "Full Name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone",
    phoneTitle: "Enter a valid phone number (10-15 digits)",
    cityPlaceholder: "City *",
    statePlaceholder: "State",
    countryPlaceholder: "Country",
    pincodePlaceholder: "Pincode",
    changePhoto: "Change Photo",
    uploadPhoto: "Upload Photo *",
    removePhoto: "Remove Photo",
    photoSelected: (name) => `Selected: ${name}`,
    aadhaarSectionTitle: "Aadhaar Document",
    aadhaarHelpText:
      "Upload a masked Aadhaar copy once. If it already exists for this phone number, you can reuse it or update it.",
    aadhaarChecking: "Checking if Aadhaar is already on file...",
    aadhaarPhoneHint: "Enter a valid phone number to check for saved Aadhaar.",
    aadhaarLookupFailed: "Could not check saved Aadhaar right now. You can still upload a new one.",
    aadhaarOnFile: (last4) => `Aadhaar already on file ending ${last4}.`,
    aadhaarUploadedOn: (dateLabel) => `Saved on ${dateLabel}`,
    aadhaarNotFound: "No Aadhaar found for this phone. Upload one to continue.",
    useSavedAadhaar: "Use Saved Aadhaar",
    updateAadhaar: "Update Aadhaar",
    aadhaarLast4Placeholder: "Aadhaar Last 4 Digits",
    aadhaarMaskedLabel: "This is a masked Aadhaar copy",
    uploadAadhaar: "Upload Aadhaar *",
    changeAadhaar: "Change Aadhaar",
    removeAadhaar: "Remove Aadhaar",
    aadhaarSelected: (name) => `Selected Aadhaar: ${name}`,
    aadhaarRequired: "Aadhaar is required for individual registration.",
    aadhaarInvalidLast4: "Enter the last 4 digits of Aadhaar.",
    aadhaarUploadFormatHint: "Accepted: PDF, JPG, PNG. Prefer masked Aadhaar.",
    submitRegistration: "Submit Registration",
    requiredFields:
      "Full name, phone, city, state, country, pincode, date of birth, and photo are required for individual registration.",
    sharedRequiredFields:
      "State, country, and pincode are required for registration.",
    invalidEmail: "Enter a valid email address.",
    invalidPhone: "Enter a valid phone number (10-15 digits).",
    invalidPincode: "Enter a valid pincode (4-10 digits).",
    invalidDateOfBirth: "Enter a valid date of birth. Future dates are not allowed.",
    alreadyRegistered: "You are already registered for this event.",
    invalidRegistrationType: "Invalid registration type.",
    ageLimit:
      "For safety reasons, volunteer registration is permitted only for individuals between 20 and 60 years of age.",
    emailPopup: "Enter a valid email address.",
    phonePopup: "Enter a valid phone number.",
    dateOfBirthLabel: "Date of Birth",
    dateOfBirthPlaceholder: "Date of Birth (DD-MM-YYYY)",
    selectedEvent: "Selected Event",
    thankYouMessage: "Thank you for registering for seva.",
    reportingInstruction:
      "Please report to Kanakkanpatti Satguru Palani Swamy Temple Kalyana Mandapam at 8.00 AM to collect volunteer ID cards.",
    termsAndConditionsTitle: "Terms and Conditions",
    acceptTerms: "I accept the terms and conditions",
    termsRequired: "You must accept the terms and conditions to register.",
    termsContent: `Terms and Conditions for Volunteer Registration at Satguru Palani Swamy Temple

1. Volunteer Commitment: By registering as a volunteer, you commit to serving at the temple as scheduled.

2. Code of Conduct: All volunteers must adhere to the temple's code of conduct and show respect to all members and visitors.

3. Punctuality: Volunteers are expected to arrive on time for their assigned shifts.

4. Health & Safety: Volunteers must maintain good health and follow all safety guidelines at the temple.

5. Eligibility: For safety reasons, volunteer registration is permitted only for individuals between 20 and 60 years of age. Applicants below 20 years of age and above 60 years of age are not eligible to register as volunteers.

6. Photography & Privacy: Personal information will be used only for identification and contact purposes.

7. Event Attendance: If a volunteer fails to attend a registered event for any reason, they will not be eligible to register for volunteering opportunities for a period of one year from the event date.

8. ID Card Collection: All volunteers must collect their identification cards on the event date by 8:00 AM at the temple. ID cards not collected by the designated time will be forfeited.

9. Duration: Volunteer registration is valid for the duration of the event.`
  },

  ta: {
    portalEyebrow: "சேவா மேலாண்மை தளம்",
    portalTitle: "\u0b95\u0ba3\u0b95\u0bcd\u0b95\u0ba9\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bbf \u0b93\u0bae\u0bcd \u0bb8\u0bcd\u0bb0\u0bc0 \u0b9a\u0bb0\u0bcd\u0b95\u0bc1\u0bb0\u0bc1 \u0baa\u0bb4\u0ba9\u0bbf \u0b9a\u0bc1\u0bb5\u0bbe\u0bae\u0bbf\u0b95\u0bb3\u0bcd \u0b9a\u0bc1\u0bb5\u0bbe\u0bae\u0bbf \u0b95\u0bcb\u0bb5\u0bbf\u0bb2\u0bc1\u0b95\u0bcd\u0b95\u0bbe\u0ba9 \u0ba4\u0ba9\u0bcd\u0ba9\u0bbe\u0bb0\u0bcd\u0bb5\u0bbe\u0bb3\u0bb0\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bc1.",
    templeName: "\u0b95\u0ba3\u0b95\u0bcd\u0b95\u0ba9\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bbf \u0b93\u0bae\u0bcd \u0bb8\u0bcd\u0bb0\u0bc0 \u0b9a\u0bb0\u0bcd\u0b95\u0bc1\u0bb0\u0bc1 \u0baa\u0bb4\u0ba9\u0bbf \u0b9a\u0bc1\u0bb5\u0bbe\u0bae\u0bbf\u0b95\u0bb3\u0bcd \u0b9a\u0bc1\u0bb5\u0bbe\u0bae\u0bbf \u0b95\u0bcb\u0bb5\u0bbf\u0bb2\u0bcd",
    templeLocation: "\u0b8e\u0bb0\u0bcd\u0bb0\u0bae\u0ba8\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0ba9\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bbf, \u0ba4\u0bbf\u0ba3\u0bcd\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bb2\u0bcd-624613, \u0ba4\u0bae\u0bbf\u0bb4\u0bcd\u0ba8\u0bbe\u0b9f\u0bc1",
    english: "English",
    tamil: "தமிழ்",
    registrationConfirmed: "பதிவு உறுதிசெய்யப்பட்டது",
    confirmedLine: (name, eventTitle) =>
      `${name} அவர்கள் ${eventTitle} நிகழ்விற்கு பதிவு செய்தார்`,
    ongoingEvents: "நடப்பு நிகழ்வுகள்",
    loadingEvents: "நடப்பு நிகழ்வுகள் ஏற்றப்படுகிறது...",
    noEvents: "தற்போது நடப்பு நிகழ்வுகள் இல்லை.",
    dateLabel: "தேதி",
    locationLabel: "இடம்",
    availableSlots: "காலி இடங்கள்",
    registeredLabel: "பதிவு செய்தோர்",
    full: "முழுவதும் நிரம்பியது",
    submitting: "சமர்ப்பிக்கிறது...",
    closeForm: "படிவத்தை மூடு",
    register: "பதிவு செய்",
    fullNamePlaceholder: "முழுப் பெயர்",
    emailPlaceholder: "மின்னஞ்சல்",
    phonePlaceholder: "தொலைபேசி எண்",
    phoneTitle: "சரியான தொலைபேசி எண்ணை உள்ளிடவும் (10-15 இலக்கங்கள்)",
    cityPlaceholder: "நகரம்",
    statePlaceholder: "மாநிலம்",
    countryPlaceholder: "நாடு",
    pincodePlaceholder: "அஞ்சல் குறியீடு",
    changePhoto: "புகைப்படத்தை மாற்று",
    uploadPhoto: "புகைப்படம் பதிவேற்று *",
    removePhoto: "புகைப்படம் நீக்கு",
    photoSelected: (name) => `தேர்ந்தெடுத்தது: ${name}`,
    submitRegistration: "பதிவை சமர்ப்பி",
    requiredFields:
      "முழுப் பெயர், தொலைபேசி எண், நகரம், மாநிலம், நாடு, அஞ்சல் குறியீடு, பிறந்த தேதி மற்றும் புகைப்படம் அவசியம்.",
    invalidEmail: "சரியான மின்னஞ்சலை உள்ளிடவும்.",
    invalidPhone: "சரியான தொலைபேசி எண்ணை உள்ளிடவும் (10-15 இலக்கங்கள்).",
    invalidPincode: "சரியான அஞ்சல் குறியீட்டை உள்ளிடவும் (4-10 இலக்கங்கள்).",
    emailPopup: "சரியான மின்னஞ்சலை உள்ளிடவும்.",
    phonePopup: "சரியான தொலைபேசி எண்ணை உள்ளிடவும்.",
    ageLimit:
      "பாதுகாப்பு காரணங்களால், 20 முதல் 60 வயதுக்குள் உள்ளவர்களுக்கு மட்டுமே தன்னார்வாளர் பதிவு அனுமதிக்கப்படுகிறது.",
    dateOfBirthLabel: "பிறந்த தேதி",
    dateOfBirthPlaceholder: "பிறந்த தேதி (DD-MM-YYYY)",
    selectedEvent: "தேர்ந்தெடுத்த நிகழ்வு",
    thankYouMessage: "சேவைக்கு பதிவு செய்ததற்கு நன்றி.",
    reportingInstruction:
      "தன்னார்வாளர் அடையாள அட்டையை பெற தேர்ந்தெடுத்த தேதியில் காலை 8.00 மணிக்கு கனக்கன்பட்டி சத்குரு பழனி சுவாமி கோவில் கல்யாண மண்டபத்திற்கு வரவும்.",
    termsAndConditionsTitle: "விதிமுறைகள் மற்றும் நிபந்தனைகள்",
    acceptTerms: "நான் விதிமுறைகள் மற்றும் நிபந்தனைகளை ஏற்கின்றேன்",
    termsRequired: "பதிவு செய்ய நீங்கள் விதிமுறைகள் மற்றும் நிபந்தனைகளை ஏற்க வேண்டும்.",
    registrationTypeLabel: "பதிவு வகை",
    individualOption: "தனிநபர்",
    teamOption: "குழு",
    teamNamePlaceholder: "குழு பெயர்",
    teamLeadNamePlaceholder: "குழு தலைவர் பெயர்",
    teamLeadPhonePlaceholder: "குழு தலைவர் தொலைபேசி",
    teamMembersHeading: "குழு உறுப்பினர்கள்",
    memberNamePlaceholder: "உறுப்பினர் பெயர்",
    memberPhonePlaceholder: "உறுப்பினர் தொலைபேசி",
    memberCityPlaceholder: "உறுப்பினர் நகரம்",
    memberPhotoLabel: "உறுப்பினர் புகைப்படம்",
    addMember: "உறுப்பினரைச் சேர்க்கவும்",
    removeMember: "நீக்கு",
    teamIdentityRequired:
      "குழு பதிவுக்கு குழு பெயர், குழு தலைவர் பெயர் மற்றும் குழு தலைவர் தொலைபேசி தேவை.",
    teamMinimumMembers: "குழுவாக பதிவு செய்ய குறைந்தபட்சம் 2 குழு உறுப்பினர்களை சேர்க்கவும்.",
    teamMemberDetailsRequired:
      "ஒவ்வொரு குழு உறுப்பினரும் முழுப் பெயர், தொலைபேசி, நகரம், பிறந்த தேதி மற்றும் புகைப்படத்தை உள்ளடக்க வேண்டும்.",
    teamDuplicatePhones: "குழு உறுப்பினர் தொலைபேசி எண்கள் தனிப்பட்டதாக இருக்க வேண்டும்.",
    teamLeadMustBeMember: "குழு தலைவர் தொலைபேசி குழு உறுப்பினர்களில் ஒருவருடன் பொருந்த வேண்டும்.",
    sharedRequiredFields:
      "பதிவுக்கு மாநிலம், நாடு மற்றும் அஞ்சல் குறியீடு தேவை.",
    termsContent: `சத்குரு பழனி சுவாமி கோவில் தன்னார்வாளர் பதிவுக்கான விதிமுறைகள் மற்றும் நிபந்தனைகள்

1. தன்னார்வாளர் சேவை: பதிவு செய்வதன் மூலம், நீங்கள் கோவிலில் பணியாற்ற சம்மதம் தெரிவிக்கிறீர்கள்.

2. நடத்தை விதிமுறை: அனைத்து தன்னார்வாளர்களும் கோவிலின் நடத்தை விதிமுறைகளை பின்பற்ற வேண்டும்.

3. நேரத்தில் வருதல்: தன்னார்வாளர்கள் ஒதுக்கப்பட்ட நேரத்தில் வர வேண்டும்.

4. ஆரோக்கியம் மற்றும் பாதுகாப்பு: தன்னார்வாளர்கள் நல்ல ஆரோக்கியத்தை பராமரிக்க வேண்டும்.

5. தகுதி: பாதுகாப்பு காரணங்களால், 20 முதல் 60 வயதுக்குள் உள்ளவர்களின் தன்னார்வாளர் பதிவுகள் மட்டுமே ஏற்கப்படும். 20 வயதிற்குக் குறைவானவர்களும் 60 வயதிற்கு மேற்பட்டவர்களும் தன்னார்வாளர் பதிவிற்கு தகுதியற்றவர்கள்.

6. புகைப்படம் மற்றும் தனியுரிமை: தனிப்பட்ட தகவல்கள் அடையாள மற்றும் தொடர்புக்கு மட்டுமே பயன்படுத்தப்படும்.

7. நிகழ்வு வருகை: பதிவு செய்த நிகழ்வில் தன்னார்வாளர் எந்த காரணத்திற்காகவாவது வரத் தவறினால், நிகழ்வு நாளிலிருந்து ஒரு வருடத்திற்கு எந்த தன்னார்வாளர் வாய்ப்பிற்கும் பதிவு செய்ய தகுதியற்றவராக இருப்பார்.

8. அடையாள அட்டை சேகரிப்பு: அனைத்து தன்னார்வாளர்களும் நிகழ்வு நாளின் காலை 8.00 மணிக்கு கோவிலில் தங்கள் அடையாள அட்டையை சேகரிக்க வேண்டும். குறிப்பிட்ட நேரத்திற்குள் சேகரிக்கப்படாத அடையாள அட்டைகள் நீக்கப்படும்.

9. கால அளவு: பதிவு நிகழ்வு நடக்கும் காலத்திற்கு செல்லுபடியாகும்.`
  }

};

export default function App() {
  const currentYear = new Date().getFullYear();
  const moonDates = useMemo(() => getMoonPhasesForYear(currentYear), [currentYear]);
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") {
      return "en";
    }

    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  });
  const [activeScreen, setActiveScreen] = useState("home");
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
  });
  const [adminForm, setAdminForm] = useState({ username: "", password: "" });
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminSummary, setAdminSummary] = useState([]);
  const [adminSummaryTotals, setAdminSummaryTotals] = useState({
    events: 0,
    registrations: 0
  });
  const [adminSummaryLoading, setAdminSummaryLoading] = useState(false);
  const [adminSummaryError, setAdminSummaryError] = useState("");
  const [adminActiveTab, setAdminActiveTab] = useState("attendance");
  const [batchCountInput, setBatchCountInput] = useState("1");
  const [eventSettings, setEventSettings] = useState({
    normalSlots: 999,
    specialSlots: 999
  });
  const [eventSettingsLoading, setEventSettingsLoading] = useState(false);
  const [eventSettingsError, setEventSettingsError] = useState("");
  const [eventSettingsForm, setEventSettingsForm] = useState({
    normalSlots: "",
    specialSlots: ""
  });
  const [eventSettingsSaving, setEventSettingsSaving] = useState(false);
  const [eventSettingsSuccess, setEventSettingsSuccess] = useState("");
  const [activeRegistrations, setActiveRegistrations] = useState(0);
  const [activeRegistrationsLoading, setActiveRegistrationsLoading] = useState(false);
  const [selectedAttendanceEventId, setSelectedAttendanceEventId] = useState(null);
  const [attendanceRegistrations, setAttendanceRegistrations] = useState([]);
  const [attendanceDetailsLoading, setAttendanceDetailsLoading] = useState(false);
  const [attendanceDetailsError, setAttendanceDetailsError] = useState("");
  const [attendanceStatusUpdating, setAttendanceStatusUpdating] = useState(null);
  const [kycDocumentLoadingId, setKycDocumentLoadingId] = useState(null);
  const [idCardModalOpen, setIdCardModalOpen] = useState(false);
  const [selectedVolunteersForIdCards, setSelectedVolunteersForIdCards] = useState(new Set());
  const [idCardPrintPreviewOpen, setIdCardPrintPreviewOpen] = useState(false);
  const [visitorPassRegistrations, setVisitorPassRegistrations] = useState([]);
  const [visitorPassTotals, setVisitorPassTotals] = useState({
    registrations: 0,
    visitDates: 0
  });
  const [visitorPassLoading, setVisitorPassLoading] = useState(false);
  const [visitorPassAdminError, setVisitorPassAdminError] = useState("");
  const [selectedVisitorPasses, setSelectedVisitorPasses] = useState(new Set());
  const [visitorPassPrintPreviewOpen, setVisitorPassPrintPreviewOpen] = useState(false);
  const [visitorPassModalOpen, setVisitorPassModalOpen] = useState(false);
  const [visitorPassForm, setVisitorPassForm] = useState(() =>
    createInitialVisitorPassForm()
  );
  const [visitorPassFieldErrors, setVisitorPassFieldErrors] = useState({
    phone: ""
  });
  const [visitorPassSubmitting, setVisitorPassSubmitting] = useState(false);
  const [visitorPassError, setVisitorPassError] = useState("");
  const [visitorPassReceipt, setVisitorPassReceipt] = useState(null);

  const setSupportedLanguage = (nextLanguage) => {
    setLanguage(normalizeLanguage(nextLanguage));
  };
  const [selectedMoonDate, setSelectedMoonDate] = useState("");
  const [selectedCardType, setSelectedCardType] = useState("");
  const [templeEvents, setTempleEvents] = useState([]);
  const [openEventId, setOpenEventId] = useState(null);
  const [registrationForm, setRegistrationForm] = useState(() =>
    createInitialRegistrationForm()
  );
  const [fieldErrors, setFieldErrors] = useState({
    phone: ""
  });
  const [registrationPhoto, setRegistrationPhoto] = useState(null);
  const [aadhaarState, setAadhaarState] = useState(() =>
    createInitialAadhaarState()
  );
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [error, setError] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [submittingEventId, setSubmittingEventId] = useState(null);
  const [thankYou, setThankYou] = useState(null);
  const photoInputRef = useRef(null);
  const aadhaarInputRef = useRef(null);
  const t = translations[language];
  const moonText = moonUi[language] || moonUi.en;
  const adminText = adminUi[language] || adminUi.en;
  const visitorText = visitorPassUi[language] || visitorPassUi.en;
  const templeCardBannerUrl =
    "https://tse4.mm.bing.net/th/id/OIP.OM_hCZiMHIPzpy0h9BYI4AHaEK?pid=Api&P=0&h=180";
  const clearCardFontFamily =
    '"Noto Sans Tamil", "Noto Sans", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
  const volunteerCardText = {
    previewTitle: "Volunteer ID Card Print Preview",
    previewDescription: (count) =>
      `${count} volunteer ID card${count === 1 ? "" : "s"} will be printed. Standard ID card size: 3.5" x 2.125"`,
    cardTitle: "Volunteer ID Card",
    volunteerIdLabel: "Volunteer ID",
    serviceDateLabel: language === "ta" ? "???? ????" : "Service Date",
    nameLabel: adminText.volunteerName || adminUi.en.volunteerName || "Volunteer Name",
    phoneLabel: adminText.volunteerPhone || adminUi.en.volunteerPhone || "Phone",
    cityLabel: adminText.volunteerCity || adminUi.en.volunteerCity || "City",
    pincodeLabel: "Pincode",
    registrationLabel: adminText.registrationType || adminUi.en.registrationType || "Type",
    teamNameLabel: t.teamNamePlaceholder || translations.en.teamNamePlaceholder || "Team Name",
    teamLeadNameLabel:
      t.teamLeadNamePlaceholder ||
      translations.en.teamLeadNamePlaceholder ||
      "Team Lead Name",
    printButtonLabel: "Print Volunteer ID Cards",
    photoFallbackLabel: "Photo"
  };

  function getVolunteerRegistrationTypeLabel(volunteer = {}) {
    const individualLabel =
      t.individualOption || translations.en.individualOption || "Individual";
    const teamLabel = t.teamOption || translations.en.teamOption || "Team";

    if (volunteer.registration_type === "team") {
      return teamLabel;
    }

    return individualLabel;
  }

  function getVolunteerServiceDate(volunteer = {}) {
    if (validateIsoCalendarDate(selectedAttendanceEventId).isValid) {
      return selectedAttendanceEventId;
    }

    const registrationDates = Array.isArray(volunteer.registration_dates ?? volunteer.registrationDates)
      ? volunteer.registration_dates ?? volunteer.registrationDates
      : [];
    const latestDate = registrationDates
      .map((value) => String(value).slice(0, 10))
      .filter((value) => validateIsoCalendarDate(value).isValid)
      .sort()
      .at(-1);
    if (latestDate) {
      return latestDate;
    }

    const eventId = Number(volunteer.event_id ?? volunteer.eventId);
    if (Number.isFinite(eventId) && eventId > 0) {
      const eventDate = String(eventId).match(/^(\d{4})(\d{2})(\d{2})$/);
      if (eventDate) {
        const isoDate = `${eventDate[1]}-${eventDate[2]}-${eventDate[3]}`;
        if (validateIsoCalendarDate(isoDate).isValid) {
          return isoDate;
        }
      }
    }

    const createdAt = String(volunteer.created_at ?? volunteer.createdAt ?? "").slice(0, 10);
    return validateIsoCalendarDate(createdAt).isValid ? createdAt : "";
  }

  function getVolunteerCardFields(volunteer = {}) {
    const serviceDate = getVolunteerServiceDate(volunteer);
    const fields = [
      {
        label: volunteerCardText.volunteerIdLabel,
        value: volunteer.volunteer_id || "-"
      },
      {
        label: volunteerCardText.serviceDateLabel,
        value: formatAdminMetaDate(serviceDate) || "-"
      },
      {
        label: volunteerCardText.nameLabel,
        value: volunteer.full_name || "-"
      },
      {
        label: volunteerCardText.phoneLabel,
        value: volunteer.phone || "-"
      },
      {
        label: volunteerCardText.cityLabel,
        value: volunteer.city || "-"
      },
      {
        label: volunteerCardText.pincodeLabel,
        value: volunteer.pincode || "-"
      },
      {
        label: volunteerCardText.registrationLabel,
        value: getVolunteerRegistrationTypeLabel(volunteer)
      }
    ];

    if (volunteer.registration_type === "team") {
      fields.push({
        label: volunteerCardText.teamNameLabel,
        value: volunteer.team_name || "-"
      });
      fields.push({
        label: volunteerCardText.teamLeadNameLabel,
        value: volunteer.team_lead_name || "-"
      });
    }

    return fields;
  }

  function renderVolunteerIdPreviewCard(volunteer) {
    return (
      <div
        key={volunteer.id}
        style={{
          width: "280px",
          minHeight: "176px",
          border: "2px solid #355543",
          borderRadius: "8px",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          fontFamily: clearCardFontFamily,
          backgroundColor: "white",
          boxShadow: "0 4px 12px rgba(34, 51, 40, 0.12)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: "100%",
            height: "80px",
            borderBottom: "2px solid #355543",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: 0,
            flexShrink: 0,
            background: "#f5f5f5",
            overflow: "hidden"
          }}
        >
          <img
            src={templeCardBannerUrl}
            alt="Temple"
            style={{
              width: "100%",
              height: "67px",
              objectFit: "cover",
              flexShrink: 0
            }}
          />
          <div
            style={{
              width: "100%",
              height: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "5px",
              fontWeight: "700",
              textAlign: "center",
              padding: "0.5px 2px",
              boxSizing: "border-box",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "0.03em"
            }}
          >
            Satguru Palani Swamy Kovil - Kanakkanpatti
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 74px",
            gap: "10px",
            padding: "10px",
            alignItems: "start"
          }}
        >
          <div style={{ display: "grid", gap: "4px", alignContent: "start" }}>
            <div
              style={{
                fontWeight: "700",
                fontSize: "12px",
                color: "#1f3527",
                letterSpacing: "0.02em",
                marginBottom: "2px"
              }}
            >
              {volunteerCardText.cardTitle}
            </div>
            {getVolunteerCardFields(volunteer).map((field) => (
              <div
                key={field.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "74px 1fr",
                  gap: "6px",
                  fontSize: "11px",
                  lineHeight: 1.25,
                  color: "#1d2b23"
                }}
              >
                <span style={{ fontWeight: "700", color: "#41554a" }}>
                  {field.label}:
                </span>
                <span style={{ wordBreak: "break-word" }}>{field.value}</span>
              </div>
            ))}
          </div>
          {volunteer.photo_url ? (
            <img
              src={volunteer.photo_url}
              alt={volunteer.full_name || volunteerCardText.photoFallbackLabel}
              style={{
                width: "74px",
                height: "96px",
                objectFit: "cover",
                border: "1.5px solid #45604f",
                borderRadius: "6px",
                alignSelf: "center",
                background: "#f0f4f1"
              }}
              onError={(event) => {
                event.target.style.background = "#f0f4f1";
              }}
            />
          ) : (
            <div
              style={{
                width: "74px",
                height: "96px",
                border: "1.5px dashed #9bb2a4",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "9px",
                fontWeight: "700",
                color: "#6d8175",
                background: "#f7faf8",
                alignSelf: "center"
              }}
            >
              {volunteerCardText.photoFallbackLabel}
            </div>
          )}
        </div>
      </div>
    );
  }
  const specialEventsHeading =
    language === "ta" ? "சிறப்பு நிகழ்வுகள்" : "Special Events";
  const specialEventTitle =
    language === "ta"
      ? "12வது குரு பூஜை கொண்டாட்டம்"
      : "12th Guru Pooja Celebration";
  const specialEventDateRange =
    language === "ta"
      ? `${currentYear} பிப் 27 முதல் மார்ச் 1 வரை`
      : `Feb 27 to Mar 1, ${currentYear}`;
  const isHomeScreen = activeScreen === "home";
  const isAdminLoginScreen = activeScreen === "admin-login";
  const isAdminDashboardScreen = activeScreen === "admin-dashboard";
  const isEventsScreen = activeScreen === "events" && Boolean(selectedMoonDate);
  const isSpecialEventSelection = selectedCardType === "special";
  const todayIsoDate = toIsoDateUTC(Date.now());
  const dateOfBirthMax = useMemo(() => getTodayIsoDate(), []);
  const specialEventStartDate = `${currentYear}-02-27`;
  const specialEventEndDate = `${currentYear}-03-01`;
  const filteredTempleEvents = useMemo(() => {
    if (!selectedMoonDate) {
      return [];
    }

    if (isSpecialEventSelection) {
      return templeEvents.filter(
        (event) =>
          event.date >= specialEventStartDate && event.date <= specialEventEndDate
      );
    }

    return templeEvents.filter((event) => event.date === selectedMoonDate);
  }, [
    isSpecialEventSelection,
    selectedMoonDate,
    specialEventEndDate,
    specialEventStartDate,
    templeEvents
  ]);
  const fallbackEvent = selectedMoonDate
    ? {
        id: Number(selectedMoonDate.replace(/-/g, "")) || 0,
        title: isSpecialEventSelection ? specialEventTitle : t.selectedEvent,
        date: selectedMoonDate,
        location: t.templeLocation,
        slots: 999,
        registrations: 0
      }
    : null;
  const activeEvent = filteredTempleEvents[0] || fallbackEvent;

  const attendanceRows = useMemo(() => {
    const eventsByDate = new Map();
    templeEvents.forEach((event) => {
      if (!eventsByDate.has(event.date)) {
        eventsByDate.set(event.date, event);
      }
    });

    const getEventIdForDate = (isoDate) => {
      const event = eventsByDate.get(isoDate);
      const eventId = Number(event?.id);
      if (Number.isFinite(eventId) && eventId > 0) {
        return eventId;
      }
      const fallbackId = Number(String(isoDate || "").replace(/-/g, ""));
      return Number.isFinite(fallbackId) ? fallbackId : 0;
    };

    const specialEventsInRange = templeEvents
      .filter(
        (event) =>
          event.date >= specialEventStartDate && event.date <= specialEventEndDate
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const specialEventId =
      Number(specialEventsInRange[0]?.id) || getEventIdForDate(specialEventStartDate);

    const rows = [
      {
        key: "special-event",
        label: specialEventTitle,
        dateLabel: specialEventDateRange,
        isoDate: specialEventStartDate,
        eventId: specialEventId
      }
    ];

    moonDates.forEach((phaseDate) => {
      rows.push({
        key: `${phaseDate.phase}-${phaseDate.date}`,
        label: phaseDate.phase === "full" ? moonText.fullMoon : moonText.newMoon,
        dateLabel: formatDisplayDate(phaseDate.date),
        isoDate: phaseDate.date,
        eventId: getEventIdForDate(phaseDate.date)
      });
    });

    return rows;
  }, [
    moonDates,
    templeEvents,
    specialEventDateRange,
    specialEventStartDate,
    specialEventEndDate,
    specialEventTitle,
    moonText.fullMoon,
    moonText.newMoon,
    language
  ]);

  const activeSlotLimit = isSpecialEventSelection
    ? eventSettings.specialSlots
    : eventSettings.normalSlots;
  const displayRegistrations = Number.isFinite(activeSlotLimit)
    ? activeRegistrations
    : activeEvent?.registrations ?? 0;
  const normalizeCount = (value, fallback) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
    return Math.max(0, Math.floor(Number(fallback) || 0));
  };

  const normalizeBatchCount = (value) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.floor(parsed));
    }
    return 1;
  };

  const splitIntoBatches = (total, batches) => {
    const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
    const safeBatches = Math.max(1, Math.floor(Number(batches) || 1));
    const base = Math.floor(safeTotal / safeBatches);
    const remainder = safeTotal % safeBatches;
    return Array.from({ length: safeBatches }, (_value, index) =>
      base + (index < remainder ? 1 : 0)
    );
  };

  const normalizedBatchCount = normalizeBatchCount(batchCountInput);
  const normalizedNormalSlots = normalizeCount(
    eventSettingsForm.normalSlots,
    eventSettings.normalSlots
  );
  const normalizedSpecialSlots = normalizeCount(
    eventSettingsForm.specialSlots,
    eventSettings.specialSlots
  );
  const normalBatchSplit = splitIntoBatches(
    normalizedNormalSlots,
    normalizedBatchCount
  );
  const specialBatchSplit = splitIntoBatches(
    normalizedSpecialSlots,
    normalizedBatchCount
  );

  const displayAvailableSlots = Number.isFinite(activeSlotLimit)
    ? Math.max(0, activeSlotLimit - displayRegistrations)
    : activeEvent?.slots ?? 0;

  function isValidPhone(phone = "") {
    return /^\+?[0-9]{10,15}$/.test(String(phone).trim());
  }

  function normalizePhoneInput(phone = "") {
    const cleaned = String(phone).replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) {
      return `+${cleaned.slice(1).replace(/\+/g, "")}`;
    }
    return cleaned.replace(/\+/g, "");
  }

  function isValidAadhaarLast4Input(value = "") {
    return /^[0-9]{4}$/.test(String(value).trim());
  }

  function isValidPincode(pincode = "") {
    return /^[0-9]{4,10}$/.test(String(pincode).trim());
  }

  function isValidDateOfBirth(value = "") {
    return validateDateOfBirth(value, { todayIsoDate: dateOfBirthMax }).isValid;
  }

  function setInlineFieldError(field, message) {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }

  function withRequiredMarker(text = "") {
    const normalized = String(text).trim();
    if (!normalized) {
      return "*";
    }
    return normalized.endsWith("*") ? normalized : `${normalized} *`;
  }

  function localizeError(message) {
    const map = {
      "Failed to fetch temple events.": t.loadingEvents,
      "Unexpected error.": t.loadingEvents,
      "Could not register for event.": t.submitRegistration,
      "Enter a valid email address.": t.invalidEmail,
      "Enter a valid phone number (10-15 digits).": t.invalidPhone,
      "Enter the last 4 digits of Aadhaar.":
        t.aadhaarInvalidLast4 || translations.en.aadhaarInvalidLast4,
      "Aadhaar must be a PDF or image file.":
        t.aadhaarUploadFormatHint || translations.en.aadhaarUploadFormatHint,
      "Upload a masked Aadhaar PDF or image to continue.":
        t.aadhaarRequired || translations.en.aadhaarRequired,
      "Upload a new Aadhaar file to replace the one on file.":
        t.updateAadhaar || translations.en.updateAadhaar,
      "Aadhaar document must be less than 10 MB in size.":
        t.aadhaarUploadFormatHint || translations.en.aadhaarUploadFormatHint,
      "Enter a valid pincode (4-10 digits).": t.invalidPincode,
      "Enter a valid date of birth.":
        t.invalidDateOfBirth || translations.en.invalidDateOfBirth,
      "Enter a valid date of birth. Future dates are not allowed.":
        t.invalidDateOfBirth || translations.en.invalidDateOfBirth,
      "No volunteer slots available.": t.full,
      "You are already registered for this event.":
        t.alreadyRegistered || translations.en.alreadyRegistered,
      "Invalid registration type.":
        t.invalidRegistrationType || translations.en.invalidRegistrationType,
      "For safety reasons, volunteer registration is permitted only for individuals between 20 and 60 years of age.":
        t.ageLimit || translations.en.ageLimit,
      "Sorry, registration is not allowed for volunteers over 60 years of age.":
        t.ageLimit || translations.en.ageLimit,
      "Invalid team members format.":
        t.teamMemberDetailsRequired || translations.en.teamMemberDetailsRequired,
      "Add at least 2 team members to register as a team.":
        t.teamMinimumMembers || translations.en.teamMinimumMembers,
      "Each team member must include full name and phone.":
        t.teamMemberDetailsRequired || translations.en.teamMemberDetailsRequired,
      "Each team member must include full name, phone, city, and photo.":
        t.teamMemberDetailsRequired || translations.en.teamMemberDetailsRequired,
      "Team member phone numbers must be unique.":
        t.teamDuplicatePhones || translations.en.teamDuplicatePhones,
      "Team name, team lead name, and team lead phone are required for team registration.":
        t.teamIdentityRequired || translations.en.teamIdentityRequired,
      "Team lead phone must match one of the team members.":
        t.teamLeadMustBeMember || translations.en.teamLeadMustBeMember,
      "State, country, and pincode are required for registration.":
        t.sharedRequiredFields || translations.en.sharedRequiredFields,
      "Full name and phone are required for individual registration.":
        t.requiredFields,
      "Full name, phone, city, and photo are required for individual registration.":
        t.requiredFields,
      "Full name, phone, city, state, country, pincode, and photo are required.":
        t.requiredFields
    };
    return map[message] || message;
  }

  function localizeAdminError(message) {
    const normalizedMessage = String(message || "").trim();
    if (
      normalizedMessage === "Failed to fetch" ||
      normalizedMessage.includes("Cannot POST /api/admin/login") ||
      isHtmlResponse(normalizedMessage)
    ) {
      return adminText.serviceUnavailable || adminUi.en.serviceUnavailable;
    }

    const map = {
      "Invalid admin username or password.": adminText.loginFailed,
      "Admin session expired. Login again.": adminText.sessionExpired,
      "Failed to fetch admin summary.": adminText.summaryFailed,
      "Failed to generate document access URL.": adminText.kycAccessFailed,
      "No Aadhaar document is available for this registration.": adminText.kycUnavailable,
      "Username and password are required.": adminText.credentialsRequired,
      "Admin service is unavailable right now. Check that the backend API is running.":
        adminText.serviceUnavailable || adminUi.en.serviceUnavailable
    };
    return map[normalizedMessage] || normalizedMessage || adminText.summaryFailed;
  }

  function localizeVisitorPassError(message) {
    const normalizedMessage = String(message || "").trim();
    if (
      normalizedMessage === "Failed to fetch" ||
      normalizedMessage.includes("Cannot POST /api/visitor-passes/register") ||
      normalizedMessage.startsWith("<!DOCTYPE html>")
    ) {
      return visitorText.serviceUnavailable || visitorText.submitFailed;
    }

    const map = {
      "Admin session expired. Login again.": adminText.sessionExpired,
      "Name, phone, visit date, city, and pincode are required.": visitorText.requiredFields,
      "Enter a valid visit date.": visitorText.invalidDate,
      "Visit date cannot be in the past.": visitorText.pastDate,
      "A visitor pass already exists for this phone number on the selected date.": visitorText.duplicate,
      "Could not submit visitor pass. Please try again.": visitorText.submitFailed,
      "Visitor pass service is unavailable.":
        visitorText.serviceUnavailable || visitorText.submitFailed,
      "Enter a valid phone number (10-15 digits).": t.invalidPhone,
      "Enter a valid pincode (4-10 digits).": t.invalidPincode
    };

    return map[normalizedMessage] || normalizedMessage || visitorText.submitFailed;
  }

  async function fetchAdminSummary(token = adminToken) {
    if (!token) {
      return;
    }

    try {
      setAdminSummaryLoading(true);
      setAdminSummaryError("");

      const authRes = await fetch(buildApiUrl("/api/admin/events-summary"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (authRes.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error("Admin session expired. Login again.");
      }

      if (!authRes.ok) {
        const data = await authRes.json();
        throw new Error(data.message || "Failed to fetch admin summary.");
      }

      const authData = await authRes.json();
      const summaryRows = (authData.events || []).map((event) => ({
        key: `event-${event.id}`,
        id: event.id,
        label: event.title,
        titleTa: event.titleTa,
        dateLabel: formatDisplayDate(event.date),
        registrations: event.registrations || 0
      }));

      setAdminSummary(summaryRows);
      setAdminSummaryTotals({
        events: summaryRows.length,
        registrations: summaryRows.reduce(
          (acc, row) => acc + (Number(row.registrations) || 0),
          0
        )
      });
    } catch (error) {
      setAdminSummaryError(localizeAdminError(error.message));
    } finally {
      setAdminSummaryLoading(false);
    }
  }

  async function fetchEventSettings() {
    try {
      setEventSettingsLoading(true);
      const res = await fetch(buildApiUrl("/api/event-settings"));
      const rawText = await res.text();
      let data = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch (_error) {
          data = {};
        }
      }

      if (!res.ok) {
        throw new Error(data.message || adminText.settingsFailed);
      }

      const normalSlots = Number(data?.normalSlots);
      const specialSlots = Number(data?.specialSlots);
      setEventSettings({
        normalSlots: Number.isFinite(normalSlots) ? normalSlots : 999,
        specialSlots: Number.isFinite(specialSlots) ? specialSlots : 999
      });
      setEventSettingsError("");
    } catch (_error) {
      setEventSettingsError(adminText.settingsFailed);
    } finally {
      setEventSettingsLoading(false);
    }
  }

  async function handleSaveEventSettings() {
    const normalSlots = Number(eventSettingsForm.normalSlots);
    const specialSlots = Number(eventSettingsForm.specialSlots);

    if (!Number.isFinite(normalSlots) || !Number.isFinite(specialSlots)) {
      setEventSettingsError(adminText.countsRequired);
      return;
    }

    if (normalSlots < 0 || specialSlots < 0) {
      setEventSettingsError(adminText.countsInvalid);
      return;
    }

    try {
      setEventSettingsSaving(true);
      setEventSettingsError("");
      setEventSettingsSuccess("");

      const res = await fetch(buildApiUrl("/api/admin/event-settings"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          normalSlots: Math.floor(normalSlots),
          specialSlots: Math.floor(specialSlots)
        })
      });

      const rawText = await res.text();
      let data = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch (_error) {
          data = {};
        }
      }

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error(adminText.sessionExpired);
      }

      if (!res.ok) {
        throw new Error(data.message || adminText.settingsFailed);
      }

      const nextNormalSlots = Number(data?.normalSlots);
      const nextSpecialSlots = Number(data?.specialSlots);
      const resolvedNormalSlots = Number.isFinite(nextNormalSlots)
        ? nextNormalSlots
        : Math.floor(normalSlots);
      const resolvedSpecialSlots = Number.isFinite(nextSpecialSlots)
        ? nextSpecialSlots
        : Math.floor(specialSlots);

      setEventSettings({
        normalSlots: resolvedNormalSlots,
        specialSlots: resolvedSpecialSlots
      });
      setEventSettingsForm({
        normalSlots: String(resolvedNormalSlots),
        specialSlots: String(resolvedSpecialSlots)
      });
      setEventSettingsSuccess(adminText.countsSaved);
    } catch (error) {
      setEventSettingsError(error.message || adminText.settingsFailed);
    } finally {
      setEventSettingsSaving(false);
    }
  }

  async function fetchRegistrationCount(eventId) {
    if (!eventId) {
      return;
    }

    try {
      setActiveRegistrationsLoading(true);
      const res = await fetch(buildApiUrl(`/api/events/${eventId}/registrations`));
      if (!res.ok) {
        throw new Error("Failed to fetch registrations.");
      }
      const data = await res.json();
      const registrations = Number(data?.registrations);
      setActiveRegistrations(Number.isFinite(registrations) ? registrations : 0);
    } catch (_error) {
      setActiveRegistrations(0);
    } finally {
      setActiveRegistrationsLoading(false);
    }
  }

  async function fetchAttendanceDetails(eventId) {
    try {
      setAttendanceDetailsLoading(true);
      setAttendanceDetailsError("");
      setKycDocumentLoadingId(null);

      const res = await fetch(buildApiUrl(`/api/admin/attendance/${eventId}`), {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error(adminText.sessionExpired);
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || adminText.attendanceFailed);
      }

      const data = await res.json();
      setAttendanceRegistrations(data.registrations || []);
    } catch (error) {
      setAttendanceDetailsError(localizeAdminError(error.message));
    } finally {
      setAttendanceDetailsLoading(false);
    }
  }

  async function fetchAttendanceDetailsByDate(isoDate) {
    try {
      setAttendanceDetailsLoading(true);
      setAttendanceDetailsError("");
      setKycDocumentLoadingId(null);

      const res = await fetch(buildApiUrl(`/api/admin/attendance-by-date/${isoDate}`), {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error(adminText.sessionExpired);
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || adminText.attendanceFailed);
      }

      const data = await res.json();
      setAttendanceRegistrations(data.registrations || []);
    } catch (error) {
      setAttendanceDetailsError(localizeAdminError(error.message));
    } finally {
      setAttendanceDetailsLoading(false);
    }
  }

  async function handleKycDocumentAction(registrationId, disposition) {
    try {
      setKycDocumentLoadingId(registrationId);
      setAttendanceDetailsError("");

      const res = await fetch(
        buildApiUrl(`/api/admin/attendance/${registrationId}/kyc-document?disposition=${encodeURIComponent(disposition)}`),
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      );

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error(adminText.sessionExpired);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || adminText.kycAccessFailed);
      }

      if (!data.url) {
        throw new Error("Failed to generate document access URL.");
      }

      if (disposition === "download") {
        const link = document.createElement("a");
        link.href = data.url;
        link.setAttribute("download", data.fileName || "aadhaar-document");
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setAttendanceDetailsError(localizeAdminError(error.message));
    } finally {
      setKycDocumentLoadingId(null);
    }
  }

  async function fetchAttendanceDates() {
    try {
      setAdminSummaryLoading(true);
      setAdminSummaryError("");

      const res = await fetch(buildApiUrl("/api/admin/attendance-dates"), {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error(adminText.sessionExpired);
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to fetch attendance dates.");
      }

      const data = await res.json();
      const dateRows = (data.dates || []).map((dateItem) => ({
        key: `date-${dateItem.date}`,
        id: dateItem.date,
        label: formatDisplayDate(dateItem.date),
        dateLabel: dateItem.date,
        registrations: dateItem.registrations || 0
      }));

      setAdminSummary(dateRows);
      setAdminSummaryTotals({
        events: dateRows.length,
        registrations: data.totals?.registrations || 0
      });
    } catch (error) {
      setAdminSummaryError(localizeAdminError(error.message));
    } finally {
      setAdminSummaryLoading(false);
    }
  }

  async function updateAttendanceStatus(registrationId, newStatus) {
    // Get the current registration to find its current status
    const currentReg = attendanceRegistrations.find(r => r.id === registrationId);
    const currentStatus = currentReg?.attendance_status || "pending";

    // Show confirmation dialog if changing to "cancelled"
    if (newStatus === "cancelled") {
      const confirmed = window.confirm(
        `Warning: Moving this volunteer to "Cancelled" will completely remove their registration record from the database. This action cannot be undone.\n\nDo you want to proceed?`
      );
      
      if (!confirmed) {
        // User clicked Cancel, don't change the status - revert dropdown value
        return;
      }
    }

    try {
      setAttendanceStatusUpdating(registrationId);
      setAttendanceDetailsError("");

      const res = await fetch(buildApiUrl(`/api/admin/attendance/${registrationId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ attendanceStatus: newStatus })
      });

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error(adminText.sessionExpired);
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || adminText.statusUpdateFailed);
      }

      const updatedReg = await res.json();
      
      // If status is cancelled, remove the volunteer from the list
      if (newStatus === "cancelled") {
        setAttendanceRegistrations(prev =>
          prev.filter(reg => reg.id !== registrationId)
        );
      } else {
        // For other statuses, update the status
        setAttendanceRegistrations(prev =>
          prev.map(reg => 
            reg.id === registrationId 
              ? { ...reg, attendance_status: updatedReg.attendance_status }
              : reg
          )
        );
      }
      setAttendanceDetailsError("");
    } catch (error) {
      setAttendanceDetailsError(localizeAdminError(error.message));
    } finally {
      setAttendanceStatusUpdating(null);
    }
  }

  function exportAttendanceToCSV() {
    if (attendanceRegistrations.length === 0) {
      setAttendanceDetailsError("No volunteer data to export.");
      return;
    }

    try {
      const headers = [
        "Volunteer Name",
        "Phone",
        "City",
        "Email",
        "Registration Type",
        "Team Name",
        "Attendance Status",
        "KYC Status",
        "Aadhaar Last 4",
        "Registered Date"
      ];

      const rows = attendanceRegistrations.map((reg) => [
        reg.full_name || "",
        reg.phone || "",
        reg.city || "",
        reg.email || "",
        getRegistrationTypeLabel(reg),
        reg.team_name || "",
        reg.attendance_status || "pending",
        getKycStatusLabel(reg.kyc?.status),
        reg.kyc?.last4 || "",
        new Date(reg.created_at).toLocaleDateString(language === "ta" ? "ta-IN" : "en-IN")
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      const dateStr = selectedAttendanceEventId || new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `volunteers_${dateStr}.csv`);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setAttendanceDetailsError("");
    } catch (_error) {
      setAttendanceDetailsError("Failed to export data.");
    }
  }

  const ID_CARDS_PER_SHEET = 6;

  function toggleVolunteerForIdCard(registrationId) {
    const newSelected = new Set(selectedVolunteersForIdCards);
    if (newSelected.has(registrationId)) {
      newSelected.delete(registrationId);
    } else {
      if (newSelected.size >= ID_CARDS_PER_SHEET) {
        alert(`ID Card limit exceeded! Maximum ${ID_CARDS_PER_SHEET} ID cards can be printed in one sheet. Please deselect some volunteers.`);
        return;
      }
      newSelected.add(registrationId);
    }
    setSelectedVolunteersForIdCards(newSelected);
  }

  function toggleSelectAllVolunteers() {
    if (selectedVolunteersForIdCards.size === 0) {
      const newSelected = new Set();
      for (let i = 0; i < Math.min(ID_CARDS_PER_SHEET, attendanceRegistrations.length); i++) {
        newSelected.add(attendanceRegistrations[i].id);
      }
      setSelectedVolunteersForIdCards(newSelected);
      if (attendanceRegistrations.length > ID_CARDS_PER_SHEET) {
        alert(`Only the first ${ID_CARDS_PER_SHEET} volunteers can be selected per sheet.`);
      }
    } else {
      setSelectedVolunteersForIdCards(new Set());
    }
  }

  function handleGenerateIdCards() {
    if (selectedVolunteersForIdCards.size === 0) {
      alert("Please select at least one volunteer to generate ID cards.");
      return;
    }
    setIdCardPrintPreviewOpen(true);
  }

  function getSelectedVolunteersData() {
    return attendanceRegistrations.filter((reg) =>
      selectedVolunteersForIdCards.has(reg.id)
    );
  }

  function handlePrintIdCards() {
    const selectedData = getSelectedVolunteersData();
    const printWindow = window.open("", "_blank");

    if (!printWindow || selectedData.length === 0) {
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language === "ta" ? "ta" : "en"}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(volunteerCardText.previewTitle)}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: ${clearCardFontFamily};
            background: white;
            padding: 0;
            margin: 0;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          .volunteer-card-sheet {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto auto;
            gap: 15mm;
            padding: 10mm;
            page-break-after: always;
          }
          .volunteer-card {
            width: 85.6mm;
            height: 53.98mm;
            border: 2px solid #355543;
            border-radius: 5px;
            overflow: hidden;
            background: white;
            display: flex;
            flex-direction: column;
            font-family: ${clearCardFontFamily};
          }
          .volunteer-card-header {
            border-bottom: 2px solid #355543;
            background: #f5f5f5;
          }
          .volunteer-card-header img {
            width: 100%;
            height: 20mm;
            object-fit: cover;
            display: block;
          }
          .volunteer-card-header-text {
            height: 4mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 5px;
            font-weight: 700;
            text-align: center;
            padding: 0.5px 2px;
            line-height: 1.1;
            letter-spacing: 0.03em;
          }
          .volunteer-card-body {
            flex: 1;
            padding: 2.8mm 3mm;
            display: grid;
            grid-template-columns: 1fr 18mm;
            gap: 2.5mm;
            align-items: start;
          }
          .volunteer-card-info {
            display: grid;
            gap: 1mm;
            align-content: start;
          }
          .volunteer-card-title {
            font-size: 9px;
            font-weight: 700;
            color: #1f3527;
            margin-bottom: 0.4mm;
            letter-spacing: 0.02em;
          }
          .volunteer-card-field {
            display: grid;
            grid-template-columns: 17mm 1fr;
            gap: 1mm;
            font-size: 7.2px;
            line-height: 1.25;
            color: #1d2b23;
          }
          .volunteer-card-label {
            font-weight: 700;
            white-space: nowrap;
            color: #41554a;
          }
          .volunteer-card-value {
            word-break: break-word;
          }
          .volunteer-card-photo {
            width: 18mm;
            height: 24mm;
            object-fit: cover;
            border: 1.4px solid #45604f;
            border-radius: 3px;
            background: #f0f4f1;
          }
          .volunteer-card-photo-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 6px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6d8175;
            border-style: dashed;
            background: #f7faf8;
          }
        </style>
      </head>
      <body>
        <div class="volunteer-card-sheet">
          ${selectedData
            .map((volunteer) => {
              const fieldsMarkup = getVolunteerCardFields(volunteer)
                .map(
                  (field) => `
                    <div class="volunteer-card-field">
                      <span class="volunteer-card-label">${escapeHtml(field.label)}:</span>
                      <span class="volunteer-card-value">${escapeHtml(field.value)}</span>
                    </div>
                  `
                )
                .join("");
              const photoMarkup = volunteer.photo_url
                ? `<img src="${escapeHtml(volunteer.photo_url)}" alt="${escapeHtml(
                    volunteer.full_name || volunteerCardText.photoFallbackLabel
                  )}" class="volunteer-card-photo">`
                : `<div class="volunteer-card-photo volunteer-card-photo-placeholder">${escapeHtml(
                    volunteerCardText.photoFallbackLabel
                  )}</div>`;

              return `
                <div class="volunteer-card">
                  <div class="volunteer-card-header">
                    <img src="${escapeHtml(templeCardBannerUrl)}" alt="Temple">
                    <div class="volunteer-card-header-text">Satguru Palani Swamy Kovil - Kanakkanpatti</div>
                  </div>
                  <div class="volunteer-card-body">
                    <div class="volunteer-card-info">
                      <div class="volunteer-card-title">${escapeHtml(volunteerCardText.cardTitle)}</div>
                      ${fieldsMarkup}
                    </div>
                    ${photoMarkup}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      setIdCardPrintPreviewOpen(false);
      setSelectedVolunteersForIdCards(new Set());
    }, 250);
  }
  async function fetchVisitorPassRegistrations(token = adminToken) {
    if (!token) {
      return;
    }

    try {
      setVisitorPassLoading(true);
      setVisitorPassAdminError("");

      const res = await fetch(buildApiUrl("/api/admin/visitor-passes"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const rawText = await res.text();
      let data = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch (_error) {
          data = {};
        }
      }

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error("Admin session expired. Login again.");
      }

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch visitor passes.");
      }

      const registrations = Array.isArray(data.registrations)
        ? data.registrations
        : [];

      setVisitorPassRegistrations(registrations);
      setVisitorPassTotals({
        registrations: Number(data.totals?.registrations) || registrations.length,
        visitDates:
          Number(data.totals?.visitDates) ||
          new Set(registrations.map((item) => item.dateOfVisit)).size
      });
      setSelectedVisitorPasses(new Set());
      setVisitorPassPrintPreviewOpen(false);
    } catch (error) {
      setVisitorPassAdminError(localizeVisitorPassError(error.message));
    } finally {
      setVisitorPassLoading(false);
    }
  }

  function openVisitorPassModal() {
    setVisitorPassForm(createInitialVisitorPassForm());
    clearVisitorPassFeedback();
    setVisitorPassReceipt(null);
    setVisitorPassModalOpen(true);
  }

  function closeVisitorPassModal() {
    setVisitorPassModalOpen(false);
    setVisitorPassForm(createInitialVisitorPassForm());
    clearVisitorPassFeedback();
  }

  function clearVisitorPassFeedback() {
    setVisitorPassError("");
    setVisitorPassFieldErrors({ phone: "" });
  }

  function handleVisitorPassPhoneBlur() {
    const phone = visitorPassForm.phone.trim();
    if (phone && !isValidPhone(phone)) {
      setVisitorPassFieldErrors({ phone: t.invalidPhone });
      return;
    }

    setVisitorPassFieldErrors({ phone: "" });
  }

  async function handleVisitorPassSubmit(event) {
    event.preventDefault();

    const fullName = visitorPassForm.fullName.trim();
    const phone = normalizePhoneInput(visitorPassForm.phone);
    const dateOfVisit = visitorPassForm.dateOfVisit.trim();
    const city = visitorPassForm.city.trim();
    const pincode = visitorPassForm.pincode.trim();
    const today = getTodayIsoDate();
    const visitDateValidation = validateVisitDate(dateOfVisit, {
      todayIsoDate: today
    });

    setVisitorPassError("");
    setVisitorPassFieldErrors({ phone: "" });

    if (!fullName || !phone || !dateOfVisit || !city || !pincode) {
      setVisitorPassError(visitorText.requiredFields);
      return;
    }

    if (!isValidPhone(phone)) {
      setVisitorPassFieldErrors({ phone: t.invalidPhone });
      return;
    }

    if (!visitDateValidation.isValid) {
      setVisitorPassError(
        visitDateValidation.reason === "past"
          ? visitorText.pastDate
          : visitorText.invalidDate
      );
      return;
    }

    if (!isValidPincode(pincode)) {
      setVisitorPassError(t.invalidPincode);
      return;
    }

    try {
      setVisitorPassSubmitting(true);

      const res = await fetch(buildApiUrl("/api/visitor-passes/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName,
          phone,
          dateOfVisit,
          city,
          pincode
        })
      });

      const rawText = await res.text();
      let data = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch (_error) {
          data = {};
        }
      }

      if (!res.ok) {
        const normalizedRawText = rawText.trim();
        const fallbackMessage =
          normalizedRawText.startsWith("<!DOCTYPE html>") ||
          normalizedRawText.includes("Cannot POST /api/visitor-passes/register")
            ? "Visitor pass service is unavailable."
            : normalizedRawText || visitorText.submitFailed;
        throw new Error(data.message || fallbackMessage);
      }

      const receiptDateOfVisit = normalizeReceiptDateValue(
        data.dateOfVisit ?? data.date_of_visit ?? dateOfVisit
      );

      setVisitorPassReceipt({
        id: data.id,
        visitorPassId: data.visitorPassId,
        fullName: data.fullName || fullName,
        phone: data.phone || phone,
        dateOfVisit: receiptDateOfVisit || dateOfVisit,
        city: data.city || city,
        pincode: data.pincode || pincode,
        createdAt: data.createdAt || new Date().toISOString()
      });
      setVisitorPassModalOpen(false);
      setVisitorPassForm(createInitialVisitorPassForm());
      clearVisitorPassFeedback();

      if (adminToken && adminActiveTab === "visitor-passes") {
        await fetchVisitorPassRegistrations(adminToken);
      }
    } catch (error) {
      const localizedError = localizeVisitorPassError(error.message);
      if ((error.message || "").toLowerCase().includes("phone number")) {
        setVisitorPassFieldErrors({ phone: localizedError });
      } else {
        setVisitorPassError(localizedError);
      }
    } finally {
      setVisitorPassSubmitting(false);
    }
  }

  function toggleVisitorPassSelection(registrationId) {
    const nextSelected = new Set(selectedVisitorPasses);
    if (nextSelected.has(registrationId)) {
      nextSelected.delete(registrationId);
    } else {
      if (nextSelected.size >= ID_CARDS_PER_SHEET) {
        alert(
          `Visitor pass limit exceeded. Maximum ${ID_CARDS_PER_SHEET} passes can be printed in one sheet.`
        );
        return;
      }
      nextSelected.add(registrationId);
    }

    setSelectedVisitorPasses(nextSelected);
  }

  function toggleSelectAllVisitorPasses() {
    if (selectedVisitorPasses.size === 0) {
      const nextSelected = new Set();
      for (
        let index = 0;
        index < Math.min(ID_CARDS_PER_SHEET, visitorPassRegistrations.length);
        index += 1
      ) {
        nextSelected.add(visitorPassRegistrations[index].id);
      }
      setSelectedVisitorPasses(nextSelected);

      if (visitorPassRegistrations.length > ID_CARDS_PER_SHEET) {
        alert(
          `Only the first ${ID_CARDS_PER_SHEET} visitor passes can be selected per print sheet.`
        );
      }
      return;
    }

    setSelectedVisitorPasses(new Set());
  }

  function getSelectedVisitorPassData() {
    return visitorPassRegistrations.filter((registration) =>
      selectedVisitorPasses.has(registration.id)
    );
  }

  function handleGenerateVisitorPassPrint() {
    if (selectedVisitorPasses.size === 0) {
      alert("Please select at least one visitor pass to print.");
      return;
    }

    setVisitorPassPrintPreviewOpen(true);
  }

  function handlePrintVisitorPasses() {
    const selectedData = getSelectedVisitorPassData();
    const printWindow = window.open("", "_blank");

    if (!printWindow || selectedData.length === 0) {
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language === "ta" ? "ta" : "en"}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(visitorText.printPreviewTitle)}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            background: white;
            padding: 0;
            margin: 0;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          .pass-sheet {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto auto;
            gap: 15mm;
            padding: 10mm;
            page-break-after: always;
          }
          .pass-card {
            width: 85.6mm;
            height: 53.98mm;
            border: 2px solid #333;
            border-radius: 4px;
            overflow: hidden;
            background: white;
            display: flex;
            flex-direction: column;
          }
          .pass-card-header {
            border-bottom: 2px solid #333;
            background: #f5f5f5;
          }
          .pass-card-header img {
            width: 100%;
            height: 20mm;
            object-fit: cover;
            display: block;
          }
          .pass-card-header-text {
            height: 4mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 5px;
            font-weight: bold;
            text-align: center;
            padding: 0.5px 2px;
            line-height: 1.1;
          }
          .pass-card-body {
            flex: 1;
            padding: 2.5mm 3mm;
            display: grid;
            gap: 1.2mm;
            font-size: 7px;
          }
          .pass-card-title {
            font-size: 8.5px;
            font-weight: bold;
            color: #1f2522;
            margin-bottom: 0.8mm;
          }
          .pass-card-field {
            display: grid;
            grid-template-columns: 16mm 1fr;
            gap: 1mm;
            line-height: 1.2;
          }
          .pass-card-label {
            font-weight: bold;
            white-space: nowrap;
          }
          .pass-card-value {
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <div class="pass-sheet">
          ${selectedData
            .map(
              (visitor) => `
                <div class="pass-card">
                  <div class="pass-card-header">
                    <img src="https://tse4.mm.bing.net/th/id/OIP.OM_hCZiMHIPzpy0h9BYI4AHaEK?pid=Api&P=0&h=180" alt="Temple">
                    <div class="pass-card-header-text">Satguru Palani Swamy Kovil - Kanakkanpatti</div>
                  </div>
                  <div class="pass-card-body">
                    <div class="pass-card-title">${escapeHtml(visitorText.printCardTitle)}</div>
                    <div class="pass-card-field">
                      <span class="pass-card-label">${escapeHtml(visitorText.passId)}:</span>
                      <span class="pass-card-value">${escapeHtml(visitor.visitorPassId || "-")}</span>
                    </div>
                    <div class="pass-card-field">
                      <span class="pass-card-label">${escapeHtml(visitorText.name)}:</span>
                      <span class="pass-card-value">${escapeHtml(visitor.fullName || "-")}</span>
                    </div>
                    <div class="pass-card-field">
                      <span class="pass-card-label">${escapeHtml(visitorText.phone)}:</span>
                      <span class="pass-card-value">${escapeHtml(visitor.phone || "-")}</span>
                    </div>
                    <div class="pass-card-field">
                      <span class="pass-card-label">${escapeHtml(visitorText.visitDateLabel)}:</span>
                      <span class="pass-card-value">${escapeHtml(formatDisplayDate(visitor.dateOfVisit) || visitor.dateOfVisit || "-")}</span>
                    </div>
                    <div class="pass-card-field">
                      <span class="pass-card-label">${escapeHtml(visitorText.city)}:</span>
                      <span class="pass-card-value">${escapeHtml(visitor.city || "-")}</span>
                    </div>
                    <div class="pass-card-field">
                      <span class="pass-card-label">${escapeHtml(visitorText.pincode)}:</span>
                      <span class="pass-card-value">${escapeHtml(visitor.pincode || "-")}</span>
                    </div>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      setVisitorPassPrintPreviewOpen(false);
      setSelectedVisitorPasses(new Set());
    }, 250);
  }
  async function handleAdminLoginSubmit(event) {
    event.preventDefault();
    const username = adminForm.username.trim();
    const password = adminForm.password.trim();

    if (!username || !password) {
      setAdminAuthError(adminText.credentialsRequired);
      return;
    }

    try {
      setAdminAuthLoading(true);
      setAdminAuthError("");

      const res = await fetch(buildApiUrl("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const rawText = await res.text();
      let data = null;
      if (rawText && !isHtmlResponse(rawText)) {
        try {
          data = JSON.parse(rawText);
        } catch (_error) {
          data = null;
        }
      }

      if (!res.ok) {
        throw new Error(
          data?.message ||
            (isHtmlResponse(rawText)
              ? "Admin service is unavailable right now. Check that the backend API is running."
              : rawText || "Invalid admin username or password.")
        );
      }

      const token = String(data?.token || "");
      if (!token) {
        throw new Error("Admin service is unavailable right now. Check that the backend API is running.");
      }

      setAdminToken(token);
      setAdminForm({ username: "", password: "" });
      setActiveScreen("admin-dashboard");
      await fetchAdminSummary(token);
    } catch (error) {
      setAdminAuthError(localizeAdminError(error.message));
    } finally {
      setAdminAuthLoading(false);
    }
  }

  async function handleAdminLogout() {
    const token = adminToken;
    if (token) {
      try {
        await fetch(buildApiUrl("/api/admin/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } catch (_error) {
        // Ignore logout request failures and clear local session.
      }
    }

    setAdminToken("");
    setAdminSummary([]);
    setAdminSummaryTotals({ events: 0, registrations: 0 });
    setAdminSummaryError("");
    setAdminAuthError("");
    setSelectedAttendanceEventId(null);
    setAttendanceRegistrations([]);
    setAttendanceDetailsError("");
    setKycDocumentLoadingId(null);
    setSelectedVolunteersForIdCards(new Set());
    setIdCardPrintPreviewOpen(false);
    setVisitorPassRegistrations([]);
    setVisitorPassTotals({ registrations: 0, visitDates: 0 });
    setVisitorPassAdminError("");
    setSelectedVisitorPasses(new Set());
    setVisitorPassPrintPreviewOpen(false);
    setVisitorPassModalOpen(false);
    setVisitorPassReceipt(null);
    setActiveScreen("home");
  }

  function openAdminPortal() {
    setError("");
    setThankYou(null);
    setOpenEventId(null);

    if (adminToken) {
      setActiveScreen("admin-dashboard");
      return;
    }

    setActiveScreen("admin-login");
  }

  function getLocalizedEventTitle(event) {
    if (!event) {
      return t.selectedEvent;
    }

    if (language === "ta") {
      return event.titleTa || event.title_ta || event.title || t.selectedEvent;
    }

    return event.title || t.selectedEvent;
  }

  function getEventImage(event) {
    const eventId = Number(event?.id);
    return EVENT_IMAGES[eventId] || null;
  }

  function normalizeReceiptDateValue(value) {
    const rawValue = String(value || "").trim();
    if (!rawValue) {
      return "";
    }

    const isoDatePrefix = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!isoDatePrefix) {
      return rawValue;
    }

    const normalizedDate = isoDatePrefix[1];
    return validateIsoCalendarDate(normalizedDate).isValid ? normalizedDate : rawValue;
  }

  function formatDisplayDate(isoDate) {
    const normalizedDate = normalizeReceiptDateValue(isoDate);
    if (!normalizedDate) {
      return "";
    }

    const parsedDate = validateIsoCalendarDate(normalizedDate);
    if (!parsedDate.isValid) {
      return normalizedDate;
    }

    const locale = language === "ta" ? "ta-IN" : "en-IN";
    return new Date(
      Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)
    ).toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function formatAdminMetaDate(value) {
    if (!value) {
      return "";
    }

    const locale = language === "ta" ? "ta-IN" : "en-IN";
    return new Date(value).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function getRegistrationTypeLabel(registration) {
    if (registration?.registration_type === "team") {
      return registration?.team_name
        ? `${t.teamOption} (${registration.team_name})`
        : t.teamOption;
    }

    return t.individualOption;
  }

  function getKycStatusLabel(status) {
    switch (String(status || "").toLowerCase()) {
      case "verified":
        return adminText.kycVerified;
      case "rejected":
        return adminText.kycRejected;
      case "pending":
        return adminText.kycPending;
      default:
        return adminText.kycMissing;
    }
  }

  function getKycStatusClassName(status) {
    switch (String(status || "").toLowerCase()) {
      case "verified":
        return "verified";
      case "rejected":
        return "rejected";
      case "pending":
        return "pending";
      default:
        return "missing";
    }
  }

  function isDateFullyBooked(isoDate) {
    if (!isoDate) {
      return false;
    }
    const eventsOnDate = templeEvents.filter((event) => event.date === isoDate);
    return (
      eventsOnDate.length > 0 &&
      eventsOnDate.every((event) => Number(event.slots) <= 0)
    );
  }

  function openEventsScreen(isoDate) {
    fetchEventSettings();
    setSelectedCardType("moon");
    setSelectedMoonDate(isoDate);
    setActiveScreen("events");
  }

  function openSpecialEventScreen() {
    fetchEventSettings();
    setSelectedCardType("special");
    setSelectedMoonDate(`${currentYear}-02-27`);
    setActiveScreen("events");
  }

  function goBackToDateCards() {
    setOpenEventId(null);
    setSelectedCardType("");
    setSelectedMoonDate("");
    setActiveScreen("home");
  }

  function clearAadhaarFileSelection() {
    if (aadhaarInputRef.current) {
      aadhaarInputRef.current.value = "";
    }
  }

  function resetAadhaarState() {
    setAadhaarState(createInitialAadhaarState());
    clearAadhaarFileSelection();
  }

  async function lookupSavedAadhaar(phone) {
    setAadhaarState((prev) => ({
      ...prev,
      lookupPhone: phone,
      lookupStatus: "loading",
      lookupError: ""
    }));

    try {
      const res = await fetch(
        buildApiUrl(`/api/volunteers/identity-document?phone=${encodeURIComponent(phone)}`)
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to check Aadhaar status.");
      }

      setAadhaarState({
        lookupPhone: phone,
        lookupStatus: "success",
        lookupError: "",
        existingDocument: data?.aadhaar || null,
        mode: data?.aadhaar ? "reuse" : "upload",
        file: null,
        last4: data?.aadhaar?.last4 || "",
        masked: data?.aadhaar?.isMasked ?? true
      });
      clearAadhaarFileSelection();
    } catch (_error) {
      setAadhaarState({
        lookupPhone: phone,
        lookupStatus: "error",
        lookupError:
          t.aadhaarLookupFailed || translations.en.aadhaarLookupFailed,
        existingDocument: null,
        mode: "upload",
        file: null,
        last4: "",
        masked: true
      });
      clearAadhaarFileSelection();
    }
  }

  async function handlePhoneBlur() {
    if (registrationForm.registrationType !== "individual") {
      return;
    }
    const phone = normalizePhoneInput(registrationForm.phone.trim());
    if (phone && !isValidPhone(phone)) {
      setInlineFieldError("phone", t.invalidPhone);
      return;
    }
    setInlineFieldError("phone", "");
    if (!phone) {
      resetAadhaarState();
      return;
    }
    if (
      aadhaarState.lookupPhone === phone &&
      ["loading", "success", "error"].includes(aadhaarState.lookupStatus)
    ) {
      return;
    }
    await lookupSavedAadhaar(phone);
  }

  function addTeamMember() {
    setRegistrationForm((prev) => ({
      ...prev,
      teamMembers: [...prev.teamMembers, createTeamMember()]
    }));
  }

  function removeTeamMember(indexToRemove) {
    setRegistrationForm((prev) => {
      if (prev.teamMembers.length <= MIN_TEAM_MEMBERS) {
        return prev;
      }

      return {
        ...prev,
        teamMembers: prev.teamMembers.filter(
          (_member, index) => index !== indexToRemove
        )
      };
    });
  }

  function updateTeamMember(indexToUpdate, field, value) {
    setRegistrationForm((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.map((member, index) =>
        index === indexToUpdate ? { ...member, [field]: value } : member
      )
    }));
  }

  useEffect(() => {
    fetchEventSettings();
  }, []);

  useEffect(() => {
    setEventSettingsForm({
      normalSlots: String(eventSettings.normalSlots ?? ""),
      specialSlots: String(eventSettings.specialSlots ?? "")
    });
  }, [eventSettings.normalSlots, eventSettings.specialSlots]);

  useEffect(() => {
    document.documentElement.lang = language === "ta" ? "ta" : "en";
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (adminToken) {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  }, [adminToken]);

  useEffect(() => {
    if (activeScreen !== "admin-dashboard") {
      return;
    }

    if (!adminToken) {
      setActiveScreen("admin-login");
      return;
    }

    fetchEventSettings();

    if (adminActiveTab === "attendance") {
      fetchAttendanceDates();
      return;
    }

    if (adminActiveTab === "visitor-passes") {
      fetchVisitorPassRegistrations();
    }
  }, [activeScreen, adminToken, adminActiveTab]);

  useEffect(() => {
    setOpenEventId(null);
    setError("");
    setError("");
    setFieldErrors({ phone: "" });
    resetAadhaarState();
  }, [selectedMoonDate]);

  useEffect(() => {
    if (!selectedMoonDate) {
      setActiveScreen("home");
      setActiveRegistrations(0);
    }
  }, [selectedMoonDate]);

  useEffect(() => {
    if (!selectedMoonDate) {
      return;
    }

    if (selectedCardType !== "moon") {
      return;
    }

    const selectedDateIsFull = isDateFullyBooked(selectedMoonDate);

    if (selectedMoonDate < todayIsoDate || selectedDateIsFull) {
      setSelectedMoonDate("");
    }
  }, [selectedMoonDate, todayIsoDate, templeEvents, selectedCardType]);

  useEffect(() => {
    if (!isEventsScreen) {
      return;
    }

    if (activeEvent) {
      setOpenEventId(activeEvent.id);
    } else {
      setOpenEventId(null);
    }
  }, [activeEvent, isEventsScreen]);

  useEffect(() => {
    if (!openEventId) {
      return;
    }

    fetchRegistrationCount(openEventId);
  }, [openEventId]);
  async function handleRegister(e, eventId) {
    e.preventDefault();
    
    if (!registrationForm.termsAccepted) {
      setError(t.termsRequired);
      return;
    }
    
    const registrationType = registrationForm.registrationType;
    const city = registrationForm.city.trim();
    const state = registrationForm.state.trim();
    const country = registrationForm.country.trim();
    const pincode = registrationForm.pincode.trim();
    setError("");
    setFieldErrors({ phone: "" });

    if (!isValidPincode(pincode)) {
      setError(t.invalidPincode);
      return;
    }

    if (!state || !country || !pincode) {
      setError(t.sharedRequiredFields || translations.en.sharedRequiredFields);
      return;
    }

    const invalidDobMessage =
      t.invalidDateOfBirth || translations.en.invalidDateOfBirth;

    const payload = new FormData();
    payload.append("registrationType", registrationType);
    payload.append("state", state);
    payload.append("country", country);
    payload.append("pincode", pincode);
    payload.append("termsAccepted", registrationForm.termsAccepted);

    if (registrationType === "team") {
      const teamName = registrationForm.teamName.trim();
      const teamLeadName = registrationForm.teamLeadName.trim();
      const teamLeadPhone = normalizePhoneInput(registrationForm.teamLeadPhone.trim());
      const members = registrationForm.teamMembers.map((member) => ({
        fullName: member.fullName.trim(),
        phone: member.phone.trim(),
        city: member.city.trim(),
        dateOfBirth: member.dateOfBirth.trim(),
        photo: member.photo
      }));

      if (!teamName || !teamLeadName || !teamLeadPhone) {
        setError(t.teamIdentityRequired || translations.en.teamIdentityRequired);
        return;
      }

      if (!isValidPhone(teamLeadPhone)) {
        setError(t.invalidPhone);
        return;
      }

      if (members.length < MIN_TEAM_MEMBERS) {
        setError(t.teamMinimumMembers || translations.en.teamMinimumMembers);
        return;
      }

      if (members.some((member) => !member.fullName || !member.phone || !member.city || !member.dateOfBirth || !member.photo)) {
        setError(
          t.teamMemberDetailsRequired || translations.en.teamMemberDetailsRequired
        );
        return;
      }

      if (members.some((member) => !isValidDateOfBirth(member.dateOfBirth))) {
        setError(invalidDobMessage);
        return;
      }

      if (members.some((member) => !isValidPhone(member.phone))) {
        setError(t.invalidPhone);
        return;
      }

      const uniquePhones = new Set(
        members.map((member) => normalizePhoneInput(member.phone))
      );
      if (uniquePhones.size !== members.length) {
        setError(t.teamDuplicatePhones || translations.en.teamDuplicatePhones);
        return;
      }

      if (!uniquePhones.has(teamLeadPhone)) {
        setError(t.teamLeadMustBeMember || translations.en.teamLeadMustBeMember);
        return;
      }

      payload.append("teamName", teamName);
      payload.append("teamLeadName", teamLeadName);
      payload.append("teamLeadPhone", teamLeadPhone);
      payload.append(
        "members",
        JSON.stringify(
          members.map((member, index) => {
            const photoField = `memberPhoto_${index}`;
            payload.append(photoField, member.photo);
            return {
            fullName: member.fullName,
            phone: normalizePhoneInput(member.phone),
            city: member.city,
            dateOfBirth: validateDateOfBirth(member.dateOfBirth, { todayIsoDate: dateOfBirthMax }).normalized,
            photoField
            };
          })
        )
      );
    } else {
      const fullName = registrationForm.fullName.trim();
      const phone = normalizePhoneInput(registrationForm.phone.trim());
      const dateOfBirth = registrationForm.dateOfBirth.trim();
      const aadhaarMode =
        aadhaarState.existingDocument && aadhaarState.mode === "reuse"
          ? "reuse"
          : aadhaarState.existingDocument
            ? "update"
            : "upload";

      if (!fullName || !phone || !dateOfBirth || !city || !registrationPhoto) {
        setError(t.requiredFields);
        return;
      }

      if (!isValidPhone(phone)) {
        setInlineFieldError("phone", t.invalidPhone);
        return;
      }

      if (!isValidDateOfBirth(dateOfBirth)) {
        setError(invalidDobMessage);
        return;
      }

      if (aadhaarMode !== "reuse" && !aadhaarState.file) {
        setError(t.aadhaarRequired || translations.en.aadhaarRequired);
        return;
      }

      if (aadhaarMode !== "reuse" && !isValidAadhaarLast4Input(aadhaarState.last4)) {
        setError(t.aadhaarInvalidLast4 || translations.en.aadhaarInvalidLast4);
        return;
      }

      payload.append("fullName", fullName);
      payload.append("phone", phone);
      payload.append("city", city);
      payload.append(
        "dateOfBirth",
        validateDateOfBirth(dateOfBirth, { todayIsoDate: dateOfBirthMax }).normalized
      );
      payload.append("photo", registrationPhoto);
      payload.append("aadhaarAction", aadhaarMode);
      payload.append("aadhaarMasked", aadhaarState.masked);
      if (aadhaarMode !== "reuse") {
        payload.append("aadhaarLast4", aadhaarState.last4.trim());
        payload.append("aadhaar", aadhaarState.file);
      }
    }

    if (submittingEventId === eventId) {
      return;
    }

    setSubmittingEventId(eventId);

    try {
      const res = await fetch(buildApiUrl(`/api/events/${eventId}/register`), {
        method: "POST",
        body: payload
      });
      if (!res.ok) {
        const data = await res.json();
        const rawMessage = data.message || "Could not register for event.";
        setError(localizeError(rawMessage));
        if (
          registrationType === "individual" &&
          rawMessage.toLowerCase().includes("phone number")
        ) {
          setInlineFieldError("phone", t.invalidPhone);
        }
        return;
      }

      const result = await res.json();
      const event = templeEvents.find((item) => item.id === eventId) || activeEvent;
      const registeredTeamCount = Array.isArray(result.members)
        ? result.members.length
        : registrationForm.teamMembers.length;
      setThankYou({
        fullName:
          registrationType === "team"
            ? result.teamName || `${registeredTeamCount} ${t.teamOption || "Team"}`
            : result.fullName,
        eventTitle: getLocalizedEventTitle(event),
        signedPhotoUrl: result.signedPhotoUrl || null
      });

      setRegistrationForm(createInitialRegistrationForm());
      setRegistrationPhoto(null);
      resetAadhaarState();
      setError("");
    setFieldErrors({ phone: "" });
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      await fetchRegistrationCount(eventId);
      setOpenEventId(null);
      setError("");
    } finally {
      setSubmittingEventId(null);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">{t.portalEyebrow}</p>
          <div className="hero-actions">
            <button
              type="button"
              className="secondary-btn admin-nav-btn"
              onClick={openAdminPortal}
            >
              {adminText.openPortal}
            </button>
            <div className="language-switch">
              <button
                type="button"
                className={`lang-btn ${language === "en" ? "active" : ""}`}
                onClick={() => setSupportedLanguage("en")}
              >
                {t.english}
              </button>
              <button
                type="button"
                className={`lang-btn ${language === "ta" ? "active" : ""}`}
                onClick={() => setSupportedLanguage("ta")}
              >
                {t.tamil}
              </button>
            </div>
          </div>
        </div>
      </header>

      {isHomeScreen && (
        <section className="official-banner">
          <img src={TEMPLE_IMAGES[0].src} alt={TEMPLE_IMAGES[0].alt} />
          <div className="official-banner-content">
            <h2>{t.templeName}</h2>
            <p>{t.templeLocation}</p>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <main className="panel">
        {isAdminLoginScreen && (
          <section className="admin-panel">
            <div className="admin-panel-top">
              <h3>{adminText.loginTitle}</h3>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setActiveScreen("home")}
              >
                {adminText.backHome}
              </button>
            </div>
            {adminAuthError && <p className="error">{adminAuthError}</p>}
            <form className="volunteer-form admin-login-form" onSubmit={handleAdminLoginSubmit}>
              <input
                placeholder={adminText.username}
                value={adminForm.username}
                onChange={(event) =>
                  setAdminForm({
                    ...adminForm,
                    username: event.target.value
                  })
                }
                required
              />
              <div className="password-field">
                <input
                  className="password-input"
                  type={showAdminPassword ? "text" : "password"}
                  placeholder={adminText.password}
                  value={adminForm.password}
                  onChange={(event) =>
                    setAdminForm({
                      ...adminForm,
                      password: event.target.value
                    })
                  }
                  required
                />
                <button
                  type="button"
                  className="password-toggle-icon"
                  onClick={() => setShowAdminPassword((prev) => !prev)}
                  aria-label={showAdminPassword ? adminText.hidePassword : adminText.showPassword}
                  title={showAdminPassword ? adminText.hidePassword : adminText.showPassword}
                >
                  {showAdminPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M2.3 5.6a1 1 0 0 1 1.4 0l14.7 14.7a1 1 0 1 1-1.4 1.4l-2.3-2.3A11.1 11.1 0 0 1 12 21C6.5 21 2 16.8 2 12c0-1.8.6-3.6 1.8-5.1L2.3 7a1 1 0 0 1 0-1.4zM12 5c5.5 0 10 4.2 10 7 0 1.3-.6 2.8-1.7 4.1l-2.1-2.1c.5-.7.8-1.4.8-2 0-1.7-3.2-4-7-4-1 0-2 .2-2.9.5L7.5 6.8A11.8 11.8 0 0 1 12 5zm-3.7 5.3 2 2a2.5 2.5 0 0 0 3.4 3.4l1.9 1.9A4.5 4.5 0 0 1 7.5 9.4z"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 5c5.5 0 10 4.2 10 7s-4.5 7-10 7S2 14.8 2 12s4.5-7 10-7zm0 2C8.2 7 5 9.3 5 12s3.2 5 7 5 7-2.3 7-5-3.2-5-7-5zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <button type="submit" disabled={adminAuthLoading}>
                {adminAuthLoading ? adminText.loginLoading : adminText.loginButton}
              </button>
            </form>
          </section>
        )}

        {isAdminDashboardScreen && (
          <section className="admin-panel">
            <div className="admin-panel-top">
              <h3>{adminText.dashboardTitle}</h3>
              <div className="admin-panel-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setActiveScreen("home")}
                >
                  {adminText.backHome}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={adminSummaryLoading || visitorPassLoading}
                  onClick={() => {
                    if (adminActiveTab === "attendance") {
                      fetchAttendanceDates();
                      return;
                    }

                    if (adminActiveTab === "visitor-passes") {
                      fetchVisitorPassRegistrations();
                      return;
                    }

                    fetchEventSettings();
                  }}
                >
                  {adminText.refresh}
                </button>
                <button
                  type="button"
                  className="secondary-btn danger-outline"
                  onClick={handleAdminLogout}
                >
                  {adminText.logout}
                </button>
              </div>
            </div>

            <div className="admin-tabs">
              <button
                type="button"
                className={`admin-tab-btn ${adminActiveTab === "counts" ? "active" : ""}`}
                onClick={() => setAdminActiveTab("counts")}
              >
                {adminText.countsTab}
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${adminActiveTab === "attendance" ? "active" : ""}`}
                onClick={() => {
                  setAdminActiveTab("attendance");
                  fetchAttendanceDates();
                }}
              >
                {adminText.attendanceTab}
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${adminActiveTab === "visitor-passes" ? "active" : ""}`}
                onClick={() => {
                  setAdminActiveTab("visitor-passes");
                  fetchVisitorPassRegistrations();
                }}
              >
                {visitorText.adminTab}
              </button>
            </div>

            {adminActiveTab === "counts" && (
              <section className="admin-settings">
                <div className="admin-settings-header">
                  <h4>{adminText.countsTitle}</h4>
                </div>
                <div className="admin-settings-grid">
                  <label>
                    <span>{adminText.normalCountLabel}</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={eventSettingsForm.normalSlots}
                      disabled={eventSettingsSaving || eventSettingsLoading}
                      onChange={(event) => {
                        setEventSettingsForm((prev) => ({
                          ...prev,
                          normalSlots: event.target.value
                        }));
                        setEventSettingsError("");
                        setEventSettingsSuccess("");
                      }}
                    />
                  </label>
                  <label>
                    <span>{adminText.specialCountLabel}</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={eventSettingsForm.specialSlots}
                      disabled={eventSettingsSaving || eventSettingsLoading}
                      onChange={(event) => {
                        setEventSettingsForm((prev) => ({
                          ...prev,
                          specialSlots: event.target.value
                        }));
                        setEventSettingsError("");
                        setEventSettingsSuccess("");
                      }}
                    />
                  </label>
                  <label>
                    <span>{adminText.batchCountLabel}</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder={adminText.batchCountPlaceholder}
                      value={batchCountInput}
                      disabled={eventSettingsSaving || eventSettingsLoading}
                      onChange={(event) => {
                        setBatchCountInput(event.target.value);
                      }}
                    />
                  </label>
                </div>
                {normalizedBatchCount <= 1 ? (
                  <p className="subtle">{adminText.batchSingleHint}</p>
                ) : (
                  <div className="batch-summary">
                    <p className="batch-title">{adminText.batchNormalTitle}</p>
                    <div className="batch-chips">
                      {normalBatchSplit.map((count, index) => (
                        <span
                          className="batch-chip"
                          key={`normal-batch-${index}`}
                        >
                          {adminText.batchItemPrefix} {index + 1}: {count}
                        </span>
                      ))}
                    </div>
                    <p className="batch-title">{adminText.batchSpecialTitle}</p>
                    <div className="batch-chips">
                      {specialBatchSplit.map((count, index) => (
                        <span
                          className="batch-chip"
                          key={`special-batch-${index}`}
                        >
                          {adminText.batchItemPrefix} {index + 1}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="admin-settings-actions">
                  <button
                    type="button"
                    disabled={eventSettingsSaving || eventSettingsLoading}
                    onClick={handleSaveEventSettings}
                  >
                    {eventSettingsSaving ? adminText.savingCounts : adminText.saveCounts}
                  </button>
                </div>
                {eventSettingsError && <p className="error">{eventSettingsError}</p>}
                {eventSettingsSuccess && <p className="success">{eventSettingsSuccess}</p>}
              </section>
            )}
            {adminActiveTab === "attendance" && (
              <>
                {selectedAttendanceEventId === null ? (
                  <>
                    <div className="admin-stats-grid">
                      <article className="admin-stat-card">
                        <p>{adminText.date}s</p>
                        <h4>{adminSummaryTotals.events || 0}</h4>
                      </article>
                      <article className="admin-stat-card">
                        <p>{adminText.registrationsTotal}</p>
                        <h4>{adminSummaryTotals.registrations || 0}</h4>
                      </article>
                    </div>

                    {adminSummaryLoading && <p>{adminText.summaryLoading}</p>}
                    {adminSummaryError && <p className="error">{adminSummaryError}</p>}
                    {!adminSummaryLoading && !adminSummaryError && adminSummary.length === 0 && (
                      <p>{adminText.emptySummary}</p>
                    )}

                    {!adminSummaryLoading && !adminSummaryError && adminSummary.length > 0 && (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>{adminText.date}</th>
                              <th>{adminText.registered}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminSummary.map((summary) => (
                              <tr 
                                key={summary.key}
                                onClick={() => {
                                  setSelectedAttendanceEventId(summary.id);
                                  fetchAttendanceDetailsByDate(summary.id);
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                <td>
                                  <div className="attendance-date">
                                    <span className="attendance-label">{summary.label}</span>
                                    <span className="subtle">{summary.dateLabel}</span>
                                  </div>
                                </td>
                                <td>{summary.registrations}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="admin-panel-top">
                      <h4>{adminText.attendanceDetails}</h4>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setSelectedAttendanceEventId(null);
                            setAttendanceRegistrations([]);
                            setAttendanceDetailsError("");
                            setKycDocumentLoadingId(null);
                          }}
                        >
                          {adminText.backToAttendance}
                        </button>
                        {selectedAttendanceEventId && (
                          <>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={exportAttendanceToCSV}
                              disabled={attendanceDetailsLoading || attendanceRegistrations.length === 0}
                              title="Download volunteer details as CSV"
                            >
                              📥 Export
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={handleGenerateIdCards}
                              disabled={attendanceDetailsLoading || attendanceRegistrations.length === 0 || selectedVolunteersForIdCards.size === 0}
                              title="Generate and print ID cards"
                            >
                              🎫 Print ID Card ({selectedVolunteersForIdCards.size} selected)
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {attendanceDetailsLoading && <p>{adminText.attendanceLoading}</p>}
                    {attendanceDetailsError && <p className="error">{attendanceDetailsError}</p>}
                    {!attendanceDetailsLoading && !attendanceDetailsError && attendanceRegistrations.length === 0 && (
                      <p>{adminText.noVolunteers}</p>
                    )}

                    {!attendanceDetailsLoading && !attendanceDetailsError && attendanceRegistrations.length > 0 && (
                      <>
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                          <thead>
                            <tr>
                              <th style={{ width: "50px" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedVolunteersForIdCards.size > 0}
                                  onChange={toggleSelectAllVolunteers}
                                  title="Select/Deselect all volunteers for ID cards"
                                />
                              </th>
                              <th>{adminText.volunteerName}</th>
                              <th>{adminText.volunteerPhone}</th>
                              <th>{adminText.volunteerCity}</th>
                              <th>{adminText.registrationType}</th>
                              <th>{adminText.status}</th>
                              <th>{adminText.kycStatus}</th>
                              <th>{adminText.kycDocument}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceRegistrations.map((reg) => (
                              <tr key={reg.id}>
                                <td style={{ textAlign: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedVolunteersForIdCards.has(reg.id)}
                                    onChange={() => toggleVolunteerForIdCard(reg.id)}
                                    title="Select this volunteer for ID card"
                                  />
                                </td>
                                <td>{reg.full_name}</td>
                                <td>{reg.phone}</td>
                                <td>{reg.city}</td>
                                <td>{getRegistrationTypeLabel(reg)}</td>
                                <td>
                                  <select
                                    value={reg.attendance_status || "pending"}
                                    onChange={(event) => {
                                      updateAttendanceStatus(reg.id, event.target.value);
                                    }}
                                    disabled={attendanceStatusUpdating === reg.id}
                                    style={{
                                      padding: "0.5rem",
                                      borderRadius: "4px",
                                      border: "1px solid #ccc",
                                      cursor: attendanceStatusUpdating === reg.id ? "not-allowed" : "pointer"
                                    }}
                                  >
                                    <option value="pending">{adminText.statusPending}</option>
                                    <option value="attended">{adminText.statusAttended}</option>
                                    <option value="absent">{adminText.statusAbsent}</option>
                                    <option value="cancelled">{adminText.statusCancelled}</option>
                                  </select>
                                </td>
                                <td>
                                  <div className="kyc-cell">
                                    <span className={"kyc-status-badge " + getKycStatusClassName(reg.kyc?.status)}>
                                      {getKycStatusLabel(reg.kyc?.status)}
                                    </span>
                                    {reg.kyc?.last4 && (
                                      <span className="subtle">{adminText.kycLast4(reg.kyc.last4)}</span>
                                    )}
                                    {reg.kyc?.uploadedAt && (
                                      <span className="subtle">
                                        {adminText.kycUploadedOn(formatAdminMetaDate(reg.kyc.uploadedAt))}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="kyc-cell">
                                    {reg.kyc?.hasDocument ? (
                                      <div className="kyc-document-actions">
                                        <button
                                          type="button"
                                          className="secondary-btn kyc-action-btn"
                                          onClick={() => handleKycDocumentAction(reg.id, "preview")}
                                          disabled={kycDocumentLoadingId === reg.id}
                                        >
                                          {adminText.kycPreview}
                                        </button>
                                        <button
                                          type="button"
                                          className="secondary-btn kyc-action-btn"
                                          onClick={() => handleKycDocumentAction(reg.id, "download")}
                                          disabled={kycDocumentLoadingId === reg.id}
                                        >
                                          {adminText.kycDownload}
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="subtle">{adminText.kycUnavailable}</span>
                                    )}
                                    {(attendanceStatusUpdating === reg.id || kycDocumentLoadingId === reg.id) && (
                                      <span className="subtle">...</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "1rem" }}>
                        Selected for ID cards: <strong>{selectedVolunteersForIdCards.size}</strong> (Max {ID_CARDS_PER_SHEET} per sheet)
                      </p>
                    </>
                    )}
                  </>
                )}
              </>
            )}

            {adminActiveTab === "visitor-passes" && (
              <>
                <div className="admin-panel-top">
                  <div>
                    <h4>{visitorText.adminTitle}</h4>
                    <p className="subtle">{visitorText.adminDescription}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleGenerateVisitorPassPrint}
                    disabled={visitorPassLoading || selectedVisitorPasses.size === 0}
                  >
                    {visitorText.printSelected} ({selectedVisitorPasses.size})
                  </button>
                </div>

                <div className="admin-stats-grid">
                  <article className="admin-stat-card">
                    <p>{visitorText.totalPasses}</p>
                    <h4>{visitorPassTotals.registrations || 0}</h4>
                  </article>
                  <article className="admin-stat-card">
                    <p>{visitorText.visitDates}</p>
                    <h4>{visitorPassTotals.visitDates || 0}</h4>
                  </article>
                </div>

                {visitorPassLoading && <p>{visitorText.loading}</p>}
                {visitorPassAdminError && <p className="error">{visitorPassAdminError}</p>}
                {!visitorPassLoading && !visitorPassAdminError && visitorPassRegistrations.length === 0 && (
                  <p>{visitorText.empty}</p>
                )}

                {!visitorPassLoading && !visitorPassAdminError && visitorPassRegistrations.length > 0 && (
                  <>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th style={{ width: "50px" }}>
                              <input
                                type="checkbox"
                                checked={
                                  visitorPassRegistrations.length > 0 &&
                                  selectedVisitorPasses.size ===
                                    Math.min(ID_CARDS_PER_SHEET, visitorPassRegistrations.length)
                                }
                                onChange={toggleSelectAllVisitorPasses}
                                title={visitorText.selectHint}
                              />
                            </th>
                            <th>{visitorText.passId}</th>
                            <th>{visitorText.name}</th>
                            <th>{visitorText.phone}</th>
                            <th>{visitorText.visitDateLabel}</th>
                            <th>{visitorText.city}</th>
                            <th>{visitorText.pincode}</th>
                            <th>{visitorText.createdAt}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitorPassRegistrations.map((registration) => (
                            <tr key={registration.id}>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedVisitorPasses.has(registration.id)}
                                  onChange={() => toggleVisitorPassSelection(registration.id)}
                                  title={visitorText.selectHint}
                                />
                              </td>
                              <td>{registration.visitorPassId}</td>
                              <td>{registration.fullName}</td>
                              <td>{registration.phone}</td>
                              <td>{formatDisplayDate(registration.dateOfVisit)}</td>
                              <td>{registration.city}</td>
                              <td>{registration.pincode}</td>
                              <td>
                                {registration.createdAt
                                  ? new Date(registration.createdAt).toLocaleString(
                                      language === "ta" ? "ta-IN" : "en-IN"
                                    )
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "1rem" }}>
                      {visitorText.selectHint}: <strong>{selectedVisitorPasses.size}</strong> (Max {ID_CARDS_PER_SHEET} per sheet)
                    </p>
                  </>
                )}
              </>
            )}
            {idCardPrintPreviewOpen && selectedAttendanceEventId !== null && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                  overflow: "auto"
                }}
                onClick={() => setIdCardPrintPreviewOpen(false)}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "10px",
                    padding: "1.5rem",
                    maxWidth: "900px",
                    width: "95%",
                    maxHeight: "90vh",
                    overflow: "auto",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>{volunteerCardText.previewTitle}</h4>
                  <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
                    {volunteerCardText.previewDescription(selectedVolunteersForIdCards.size)}
                  </p>

                  {/* Preview Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "20px",
                      marginBottom: "1.5rem",
                      padding: "1rem",
                      backgroundColor: "#f9f9f9",
                      borderRadius: "6px",
                      border: "1px solid #ddd"
                    }}
                  >
                    {getSelectedVolunteersData().map(renderVolunteerIdPreviewCard)}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIdCardPrintPreviewOpen(false);
                      }}
                    >
                      {visitorText.close}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handlePrintIdCards}
                      style={{ backgroundColor: "#2d7a3e", color: "white", cursor: "pointer" }}
                    >
                      {volunteerCardText.printButtonLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

            {visitorPassPrintPreviewOpen && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                  overflow: "auto"
                }}
                onClick={() => setVisitorPassPrintPreviewOpen(false)}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "10px",
                    padding: "1.5rem",
                    maxWidth: "900px",
                    width: "95%",
                    maxHeight: "90vh",
                    overflow: "auto",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>
                    {visitorText.printPreviewTitle}
                  </h4>
                  <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
                    {visitorText.printPreviewDescription(selectedVisitorPasses.size)}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "20px",
                      marginBottom: "1.5rem",
                      padding: "1rem",
                      backgroundColor: "#f9f9f9",
                      borderRadius: "6px",
                      border: "1px solid #ddd"
                    }}
                  >
                    {getSelectedVisitorPassData().map((visitor) => (
                      <div
                        key={visitor.id}
                        style={{
                          width: "280px",
                          minHeight: "176px",
                          border: "2px solid #333",
                          borderRadius: "4px",
                          padding: 0,
                          display: "flex",
                          flexDirection: "column",
                          fontFamily: "Arial, sans-serif",
                          fontSize: "8px",
                          backgroundColor: "white",
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                          overflow: "hidden"
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "80px",
                            borderBottom: "2px solid #333",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            padding: 0,
                            flexShrink: 0,
                            background: "#f5f5f5",
                            overflow: "hidden"
                          }}
                        >
                          <img
                            src="https://tse4.mm.bing.net/th/id/OIP.OM_hCZiMHIPzpy0h9BYI4AHaEK?pid=Api&P=0&h=180"
                            alt="Temple"
                            style={{
                              width: "100%",
                              height: "67px",
                              objectFit: "cover",
                              flexShrink: 0
                            }}
                          />
                          <div
                            style={{
                              width: "100%",
                              height: "13px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "5px",
                              fontWeight: "bold",
                              textAlign: "center",
                              padding: "0.5px 2px",
                              boxSizing: "border-box",
                              lineHeight: 1.1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            Satguru Palani Swamy Kovil - Kanakkanpatti
                          </div>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            display: "grid",
                            gap: "4px",
                            padding: "8px 10px",
                            alignContent: "start"
                          }}
                        >
                          <div style={{ fontWeight: "bold", fontSize: "11px" }}>
                            {visitorText.printCardTitle}
                          </div>
                          <div><strong>{visitorText.passId}:</strong> {visitor.visitorPassId}</div>
                          <div><strong>{visitorText.name}:</strong> {visitor.fullName}</div>
                          <div><strong>{visitorText.phone}:</strong> {visitor.phone}</div>
                          <div><strong>{visitorText.visitDateLabel}:</strong> {formatDisplayDate(visitor.dateOfVisit)}</div>
                          <div><strong>{visitorText.city}:</strong> {visitor.city}</div>
                          <div><strong>{visitorText.pincode}:</strong> {visitor.pincode}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setVisitorPassPrintPreviewOpen(false);
                      }}
                    >
                      {visitorText.close}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handlePrintVisitorPasses}
                      style={{ backgroundColor: "#2d7a3e", color: "white", cursor: "pointer" }}
                    >
                      {visitorText.printSelected}
                    </button>
                  </div>
                </div>
              </div>
            )}
        {!isAdminLoginScreen && !isAdminDashboardScreen && (
        <section className="temple-events single-temple">
          <h2>{t.templeName}</h2>
          <p className="subtle">{t.templeLocation}</p>
          {!isEventsScreen && (
            <>
              <section className="visitor-pass-panel">
                <div>
                  <p className="visitor-pass-kicker">{visitorText.sectionTitle}</p>
                  <h3>{visitorText.buttonLabel}</h3>
                  <p className="subtle">{visitorText.sectionDescription}</p>
                </div>
                <button
                  type="button"
                  className="visitor-pass-cta"
                  onClick={openVisitorPassModal}
                >
                  {visitorText.buttonLabel}
                </button>
              </section>
              <section className="special-events-panel">
                <h3>{specialEventsHeading}</h3>
                <button
                  type="button"
                  className="special-event-card special-event-btn"
                  onClick={openSpecialEventScreen}
                >
                  <p className="special-event-title">{specialEventTitle}</p>
                  <p className="special-event-date">{specialEventDateRange}</p>
                </button>
              </section>
              <section className="moon-panel">
                <div className="moon-panel-top">
                  <h3>{moonText.title(currentYear)}</h3>
                </div>
                <p className="subtle moon-subtle">{moonText.subtitle}</p>
                <div className="moon-date-grid">
                  {moonDates.map((phaseDate) => {
                    const pastDate = phaseDate.date < todayIsoDate;
                    const fullyBookedDate = isDateFullyBooked(phaseDate.date);
                    const disabledDateCard = pastDate || fullyBookedDate;

                    return (
                      <button
                        key={`${phaseDate.phase}-${phaseDate.date}`}
                        type="button"
                        className={`moon-date-chip ${
                          selectedMoonDate === phaseDate.date ? "active" : ""
                        } ${disabledDateCard ? "disabled" : ""}`}
                        disabled={disabledDateCard}
                        onClick={() => openEventsScreen(phaseDate.date)}
                      >
                        <span className={`moon-phase-pill ${phaseDate.phase}`}>
                          {phaseDate.phase === "full" ? moonText.fullMoon : moonText.newMoon}
                        </span>
                        <span className="moon-date-label">
                          {formatDisplayDate(phaseDate.date)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {isEventsScreen && (
            <div className="events-screen-top">
              <button
                type="button"
                className="secondary-btn moon-clear-btn"
                onClick={goBackToDateCards}
              >
                {moonText.backToDates}
              </button>
            </div>
          )}

          {isEventsScreen && (
            <h3>
              {isSpecialEventSelection
                ? `${specialEventTitle}: ${specialEventDateRange}`
                : `${moonText.eventsOn}: ${formatDisplayDate(selectedMoonDate)}`}
            </h3>
          )}
          {isEventsScreen && eventsLoading && <p>{t.loadingEvents}</p>}
          {isEventsScreen && !eventsLoading && !activeEvent && (
            <p>{moonText.noEvents}</p>
          )}

          {isEventsScreen && activeEvent && !openEventId && (
            <p style={{ textAlign: 'center', color: '#709d83' }}>Loading registration form...</p>
          )}

          {isEventsScreen && openEventId && (
                    <form
                      className="volunteer-form register-form"
                      onSubmit={(e) => handleRegister(e, openEventId)}
                    >
                      <div className="registration-mode-group">
                        <p className="registration-mode-label">
                          {t.registrationTypeLabel || translations.en.registrationTypeLabel}
                        </p>
                        <div className="registration-mode-options">
                          <label className="registration-mode-option">
                            <input
                              type="radio"
                              name="registrationType"
                              value="individual"
                              checked={registrationForm.registrationType === "individual"}
                              onChange={() => {
                                setRegistrationForm((prev) => ({
                                  ...prev,
                                  registrationType: "individual"
                                }));
                                setInlineFieldError("phone", "");
                                resetAadhaarState();
                              }}
                              disabled={submittingEventId === openEventId}
                            />
                            <span>{t.individualOption || translations.en.individualOption}</span>
                          </label>
                          <label className="registration-mode-option">
                            <input
                              type="radio"
                              name="registrationType"
                              value="team"
                              checked={registrationForm.registrationType === "team"}
                              onChange={() => {
                                setRegistrationForm((prev) => ({
                                  ...prev,
                                  registrationType: "team"
                                }));
                                setInlineFieldError("phone", "");
                                resetAadhaarState();
                              }}
                              disabled={submittingEventId === openEventId}
                            />
                            <span>{t.teamOption || translations.en.teamOption}</span>
                          </label>
                        </div>
                      </div>

                      {registrationForm.registrationType === "individual" ? (
                        <>
                          <input
                            placeholder={withRequiredMarker(t.fullNamePlaceholder)}
                            value={registrationForm.fullName}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                fullName: e.target.value
                              })
                            }
                            required
                          />
                          <input
                            placeholder={withRequiredMarker(t.phonePlaceholder)}
                            type="tel"
                            inputMode="tel"
                            className={fieldErrors.phone ? "input-invalid" : ""}
                            value={registrationForm.phone}
                            onChange={(e) => {
                              const nextPhone = normalizePhoneInput(e.target.value);
                              setRegistrationForm({
                                ...registrationForm,
                                phone: nextPhone
                              });
                              if (fieldErrors.phone) {
                                setInlineFieldError("phone", "");
                              }
                              if (aadhaarState.lookupPhone && aadhaarState.lookupPhone !== nextPhone) {
                                resetAadhaarState();
                              }
                            }}
                            onBlur={handlePhoneBlur}
                            required
                          />
                          {fieldErrors.phone && (
                            <p className="field-error">{fieldErrors.phone}</p>
                          )}
                          <div className="identity-proof-card">
                            <p className="team-members-title">
                              {t.aadhaarSectionTitle || translations.en.aadhaarSectionTitle}
                            </p>
                            <p className="subtle identity-proof-subtle">
                              {t.aadhaarHelpText || translations.en.aadhaarHelpText}
                            </p>
                            {aadhaarState.lookupStatus === "loading" && (
                              <p className="subtle identity-proof-status">
                                {t.aadhaarChecking || translations.en.aadhaarChecking}
                              </p>
                            )}
                            {aadhaarState.lookupStatus === "error" && aadhaarState.lookupError && (
                              <p className="subtle identity-proof-status">
                                {aadhaarState.lookupError}
                              </p>
                            )}
                            {aadhaarState.existingDocument ? (
                              <div className="identity-proof-banner">
                                <p className="identity-proof-title">
                                  {(t.aadhaarOnFile || translations.en.aadhaarOnFile)(
                                    aadhaarState.existingDocument.last4
                                  )}
                                </p>
                                {aadhaarState.existingDocument.uploadedAt && (
                                  <p className="subtle identity-proof-status">
                                    {(t.aadhaarUploadedOn || translations.en.aadhaarUploadedOn)(
                                      new Date(
                                        aadhaarState.existingDocument.uploadedAt
                                      ).toLocaleDateString(language === "ta" ? "ta-IN" : "en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                      })
                                    )}
                                  </p>
                                )}
                              </div>
                            ) : aadhaarState.lookupPhone &&
                              aadhaarState.lookupStatus === "success" ? (
                              <p className="subtle identity-proof-status">
                                {t.aadhaarNotFound || translations.en.aadhaarNotFound}
                              </p>
                            ) : (
                              <p className="subtle identity-proof-status">
                                {t.aadhaarPhoneHint || translations.en.aadhaarPhoneHint}
                              </p>
                            )}
                            {aadhaarState.existingDocument && (
                              <div className="registration-mode-options identity-proof-options">
                                <label className="registration-mode-option">
                                  <input
                                    type="radio"
                                    name="aadhaarMode"
                                    checked={aadhaarState.mode === "reuse"}
                                    onChange={() => {
                                      setAadhaarState((prev) => ({
                                        ...prev,
                                        mode: "reuse",
                                        file: null,
                                        last4: prev.existingDocument?.last4 || prev.last4
                                      }));
                                      clearAadhaarFileSelection();
                                    }}
                                    disabled={submittingEventId === openEventId}
                                  />
                                  <span>{t.useSavedAadhaar || translations.en.useSavedAadhaar}</span>
                                </label>
                                <label className="registration-mode-option">
                                  <input
                                    type="radio"
                                    name="aadhaarMode"
                                    checked={aadhaarState.mode === "update"}
                                    onChange={() => {
                                      setAadhaarState((prev) => ({
                                        ...prev,
                                        mode: "update",
                                        file: null,
                                        last4: prev.existingDocument?.last4 || prev.last4
                                      }));
                                      clearAadhaarFileSelection();
                                    }}
                                    disabled={submittingEventId === openEventId}
                                  />
                                  <span>{t.updateAadhaar || translations.en.updateAadhaar}</span>
                                </label>
                              </div>
                            )}
                            {aadhaarState.mode !== "reuse" && (
                              <>
                                <input
                                  placeholder={withRequiredMarker(
                                    t.aadhaarLast4Placeholder ||
                                      translations.en.aadhaarLast4Placeholder
                                  )}
                                  inputMode="numeric"
                                  pattern="[0-9]{4}"
                                  value={aadhaarState.last4}
                                  onChange={(e) =>
                                    setAadhaarState((prev) => ({
                                      ...prev,
                                      last4: e.target.value
                                        .replace(/[^0-9]/g, "")
                                        .slice(0, 4)
                                    }))
                                  }
                                  required
                                />
                                <input
                                  ref={aadhaarInputRef}
                                  className="photo-input-hidden"
                                  type="file"
                                  accept=".pdf,image/*"
                                  onChange={(e) =>
                                    setAadhaarState((prev) => ({
                                      ...prev,
                                      file: e.target.files?.[0] || null
                                    }))
                                  }
                                />
                                <div className="photo-actions">
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    disabled={submittingEventId === openEventId}
                                    onClick={() => aadhaarInputRef.current?.click()}
                                  >
                                    {aadhaarState.file
                                      ? t.changeAadhaar || translations.en.changeAadhaar
                                      : withRequiredMarker(
                                          t.uploadAadhaar || translations.en.uploadAadhaar
                                        )}
                                  </button>
                                  {aadhaarState.file && (
                                    <button
                                      type="button"
                                      className="secondary-btn danger-outline"
                                      disabled={submittingEventId === openEventId}
                                      onClick={() => {
                                        setAadhaarState((prev) => ({ ...prev, file: null }));
                                        clearAadhaarFileSelection();
                                      }}
                                    >
                                      {t.removeAadhaar || translations.en.removeAadhaar}
                                    </button>
                                  )}
                                </div>
                                {aadhaarState.file && (
                                  <p className="photo-selected">
                                    {(t.aadhaarSelected || translations.en.aadhaarSelected)(
                                      aadhaarState.file.name
                                    )}
                                  </p>
                                )}
                                <label className="identity-proof-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={aadhaarState.masked}
                                    onChange={(e) =>
                                      setAadhaarState((prev) => ({
                                        ...prev,
                                        masked: e.target.checked
                                      }))
                                    }
                                  />
                                  <span>
                                    {t.aadhaarMaskedLabel || translations.en.aadhaarMaskedLabel}
                                  </span>
                                </label>
                                <p className="subtle identity-proof-status">
                                  {t.aadhaarUploadFormatHint ||
                                    translations.en.aadhaarUploadFormatHint}
                                </p>
                              </>
                            )}
                          </div>
                          <label style={{ display: 'block', marginTop: '0.5rem', marginBottom: '0.3rem', fontWeight: '500', fontSize: '0.9rem' }}>
                            {withRequiredMarker(t.dateOfBirthLabel)}
                          </label>
                          <input
                            placeholder="DD-MM-YYYY"
                            type="date"
                            min={`${MIN_DOB_YEAR}-01-01`}
                            max={dateOfBirthMax}
                            value={registrationForm.dateOfBirth}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                dateOfBirth: e.target.value
                              })
                            }
                            required
                            style={{ width: '100%' }}
                          />
                        </>
                      ) : (
                        <div className="team-members-group">
                          <input
                            placeholder={withRequiredMarker(
                              t.teamNamePlaceholder || translations.en.teamNamePlaceholder
                            )}
                            value={registrationForm.teamName}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                teamName: e.target.value
                              })
                            }
                            required
                          />
                          <input
                            placeholder={withRequiredMarker(
                              t.teamLeadNamePlaceholder ||
                                translations.en.teamLeadNamePlaceholder
                            )}
                            value={registrationForm.teamLeadName}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                teamLeadName: e.target.value
                              })
                            }
                            required
                          />
                          <input
                            placeholder={withRequiredMarker(
                              t.teamLeadPhonePlaceholder ||
                                translations.en.teamLeadPhonePlaceholder
                            )}
                            type="tel"
                            inputMode="tel"
                            value={registrationForm.teamLeadPhone}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                teamLeadPhone: normalizePhoneInput(e.target.value)
                              })
                            }
                            required
                          />
                          <p className="team-members-title">
                            {t.teamMembersHeading || translations.en.teamMembersHeading}
                          </p>
                          {registrationForm.teamMembers.map((member, memberIndex) => (
                            <div className="team-member-row" key={`member-${memberIndex}`}>
                              <input
                                placeholder={`${withRequiredMarker(t.memberNamePlaceholder || translations.en.memberNamePlaceholder)} ${memberIndex + 1}`}
                                value={member.fullName}
                                onChange={(e) =>
                                  updateTeamMember(
                                    memberIndex,
                                    "fullName",
                                    e.target.value
                                  )
                                }
                                required
                              />
                              <input
                                placeholder={`${withRequiredMarker(t.memberPhonePlaceholder || translations.en.memberPhonePlaceholder)} ${memberIndex + 1}`}
                                type="tel"
                                inputMode="tel"
                                value={member.phone}
                                onChange={(e) =>
                                  updateTeamMember(
                                    memberIndex,
                                    "phone",
                                    normalizePhoneInput(e.target.value)
                                  )
                                }
                                required
                              />
                              <input
                                placeholder={`${withRequiredMarker(t.memberCityPlaceholder || translations.en.memberCityPlaceholder)} ${memberIndex + 1}`}
                                value={member.city}
                                onChange={(e) =>
                                  updateTeamMember(
                                    memberIndex,
                                    "city",
                                    e.target.value
                                  )
                                }
                                required
                              />
                              <label style={{ display: 'block', marginTop: '0.5rem', marginBottom: '0.3rem', fontWeight: '500', fontSize: '0.9rem' }}>
                                {withRequiredMarker(`${t.dateOfBirthLabel || 'Date of Birth'} ${memberIndex + 1}`)}
                              </label>
                              <input
                                type="date"
                                placeholder="DD-MM-YYYY"
                                min={`${MIN_DOB_YEAR}-01-01`}
                                max={dateOfBirthMax}
                                value={member.dateOfBirth}
                                onChange={(e) =>
                                  updateTeamMember(
                                    memberIndex,
                                    "dateOfBirth",
                                    e.target.value
                                  )
                                }
                                required
                                style={{ width: '100%' }}
                              />
                              <input
                                type="file"
                                accept="image/*"
                                aria-label={`${t.memberPhotoLabel || translations.en.memberPhotoLabel} ${memberIndex + 1}`}
                                onChange={(e) =>
                                  updateTeamMember(
                                    memberIndex,
                                    "photo",
                                    e.target.files?.[0] || null
                                  )
                                }
                                required
                              />
                              {member.photo && (
                                <p className="photo-selected">
                                  {t.photoSelected(member.photo.name)}
                                </p>
                              )}
                              {registrationForm.teamMembers.length > MIN_TEAM_MEMBERS && (
                                <button
                                  type="button"
                                  className="secondary-btn team-member-remove"
                                  disabled={submittingEventId === openEventId}
                                  onClick={() => removeTeamMember(memberIndex)}
                                >
                                  {t.removeMember || translations.en.removeMember}
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="secondary-btn team-member-add"
                            disabled={submittingEventId === openEventId}
                            onClick={addTeamMember}
                          >
                            {t.addMember || translations.en.addMember}
                          </button>
                        </div>
                      )}
                      {registrationForm.registrationType === "individual" && (
                        <input
                          name="city"
                          placeholder={withRequiredMarker(t.cityPlaceholder || "City")}
                          value={registrationForm.city}
                          onChange={(e) =>
                            setRegistrationForm({
                              ...registrationForm,
                              city: e.target.value
                            })
                          }
                          required
                        />
                      )}
                      <input
                        placeholder={withRequiredMarker(t.statePlaceholder)}
                        value={registrationForm.state}
                        onChange={(e) =>
                          setRegistrationForm({
                            ...registrationForm,
                            state: e.target.value
                          })
                        }
                        required
                      />
                      <input
                        placeholder={withRequiredMarker(t.countryPlaceholder)}
                        value={registrationForm.country}
                        onChange={(e) =>
                          setRegistrationForm({
                            ...registrationForm,
                            country: e.target.value
                          })
                        }
                        required
                      />
                      <input
                        placeholder={withRequiredMarker(t.pincodePlaceholder)}
                        inputMode="numeric"
                        pattern="[0-9]{4,10}"
                        value={registrationForm.pincode}
                        onChange={(e) =>
                          setRegistrationForm({
                            ...registrationForm,
                            pincode: e.target.value
                          })
                        }
                        required
                      />
                      {registrationForm.registrationType === "individual" && (
                        <>
                          <input
                            ref={photoInputRef}
                            className="photo-input-hidden"
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              setRegistrationPhoto(e.target.files?.[0] || null)
                            }
                          />
                          <div className="photo-actions">
                            <button
                              type="button"
                              className="secondary-btn"
                              disabled={submittingEventId === openEventId}
                              onClick={() => photoInputRef.current?.click()}
                            >
                              {registrationPhoto
                                ? t.changePhoto
                                : withRequiredMarker(t.uploadPhoto)}
                            </button>
                            {registrationPhoto && (
                              <button
                                type="button"
                                className="secondary-btn danger-outline"
                                disabled={submittingEventId === openEventId}
                                onClick={() => {
                                  setRegistrationPhoto(null);
                                  if (photoInputRef.current) {
                                    photoInputRef.current.value = "";
                                  }
                                }}
                              >
                                {t.removePhoto}
                              </button>
                            )}
                          </div>
                          {registrationPhoto && (
                            <p className="photo-selected">
                              {t.photoSelected(registrationPhoto.name)}
                            </p>
                          )}
                        </>
                      )}
                      <div className="terms-checkbox-container">
                        <label className="terms-checkbox-label">
                          <input
                            type="checkbox"
                            checked={registrationForm.termsAccepted}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                termsAccepted: e.target.checked
                              })
                            }
                          />
                          <span>{t.acceptTerms}</span>
                        </label>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => setShowTermsModal(true)}
                        >
                          {t.termsAndConditionsTitle}
                        </button>
                      </div>
                      <button type="submit" disabled={submittingEventId === openEventId || !registrationForm.termsAccepted}>
                        {submittingEventId === openEventId
                          ? t.submitting
                          : t.submitRegistration}
                      </button>
                    </form>
          )}

        </section>
        )}
      </main>
      {showTermsModal && (
        <div
          className="thankyou-modal-overlay"
          role="presentation"
          onClick={() => setShowTermsModal(false)}
        >
          <article
            className="thankyou-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.termsAndConditionsTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="thankyou-title">{t.termsAndConditionsTitle}</p>
            <div style={{
              maxHeight: '60vh',
              overflowY: 'auto',
              marginBottom: '1rem',
              padding: '0 1rem',
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              lineHeight: '1.6'
            }}>
              {t.termsContent}
            </div>
            <button onClick={() => setShowTermsModal(false)}>
              {language === "ta" ? "மூடு" : "Close"}
            </button>
          </article>
        </div>
      )}
      {visitorPassModalOpen && (
        <div
          className="thankyou-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!visitorPassSubmitting) {
              closeVisitorPassModal();
            }
          }}
        >
          <article
            className="thankyou-modal visitor-pass-modal"
            role="dialog"
            aria-modal="true"
            aria-label={visitorText.formTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="thankyou-title">{visitorText.formTitle}</p>
            <p className="thankyou-line">{visitorText.formDescription}</p>
            <form className="volunteer-form visitor-pass-form" onSubmit={handleVisitorPassSubmit}>
              <input
                placeholder={withRequiredMarker(t.fullNamePlaceholder)}
                value={visitorPassForm.fullName}
                onChange={(event) => {
                  setVisitorPassForm((prev) => ({
                    ...prev,
                    fullName: event.target.value
                  }));
                  setVisitorPassError("");
                }}
                required
              />
              <input
                placeholder={withRequiredMarker(t.phonePlaceholder)}
                type="tel"
                inputMode="tel"
                className={visitorPassFieldErrors.phone ? "input-invalid" : ""}
                value={visitorPassForm.phone}
                onChange={(event) => {
                  setVisitorPassForm((prev) => ({
                    ...prev,
                    phone: normalizePhoneInput(event.target.value)
                  }));
                  setVisitorPassError("");
                  if (visitorPassFieldErrors.phone) {
                    setVisitorPassFieldErrors({ phone: "" });
                  }
                }}
                onBlur={handleVisitorPassPhoneBlur}
                required
              />
              {visitorPassFieldErrors.phone && (
                <p className="field-error">{visitorPassFieldErrors.phone}</p>
              )}
              <label className="visitor-pass-date-field">
                <span>{withRequiredMarker(visitorText.dateOfVisitLabel)}</span>
                <input
                  type="date"
                  min={getTodayIsoDate()}
                  value={visitorPassForm.dateOfVisit}
                  onChange={(event) => {
                    setVisitorPassForm((prev) => ({
                      ...prev,
                      dateOfVisit: event.target.value
                    }));
                    setVisitorPassError("");
                  }}
                  required
                />
              </label>
              <input
                placeholder={withRequiredMarker(t.cityPlaceholder || visitorText.city)}
                value={visitorPassForm.city}
                onChange={(event) => {
                  setVisitorPassForm((prev) => ({
                    ...prev,
                    city: event.target.value
                  }));
                  setVisitorPassError("");
                }}
                required
              />
              <input
                placeholder={withRequiredMarker(t.pincodePlaceholder)}
                inputMode="numeric"
                pattern="[0-9]{4,10}"
                value={visitorPassForm.pincode}
                onChange={(event) => {
                  setVisitorPassForm((prev) => ({
                    ...prev,
                    pincode: event.target.value.replace(/[^0-9]/g, "")
                  }));
                  setVisitorPassError("");
                }}
                required
              />
              {visitorPassError && <p className="error">{visitorPassError}</p>}
              <div className="visitor-pass-form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeVisitorPassModal}
                  disabled={visitorPassSubmitting}
                >
                  {visitorText.close}
                </button>
                <button type="submit" disabled={visitorPassSubmitting}>
                  {visitorPassSubmitting ? visitorText.submitting : visitorText.submit}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}
      {visitorPassReceipt && (
        <div
          className="thankyou-modal-overlay"
          role="presentation"
          onClick={() => setVisitorPassReceipt(null)}
        >
          <article
            className="thankyou-modal visitor-pass-modal"
            role="dialog"
            aria-modal="true"
            aria-label={visitorText.successTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="thankyou-title">{visitorText.successTitle}</p>
            <p className="thankyou-line">{visitorText.successMessage}</p>
            <p className="thankyou-line">{visitorText.successInstruction}</p>
            <div className="visitor-pass-receipt-card">
              <p>
                <strong>{visitorText.passNumberLabel}:</strong> {visitorPassReceipt.visitorPassId}
              </p>
              <p>
                <strong>{visitorText.name}:</strong> {visitorPassReceipt.fullName}
              </p>
              <p>
                <strong>{visitorText.phone}:</strong> {visitorPassReceipt.phone}
              </p>
              <p>
                <strong>{visitorText.visitDateLabel}:</strong> {formatDisplayDate(visitorPassReceipt.dateOfVisit)}
              </p>
              <p>
                <strong>{visitorText.city}:</strong> {visitorPassReceipt.city}
              </p>
              <p>
                <strong>{visitorText.pincode}:</strong> {visitorPassReceipt.pincode}
              </p>
            </div>
            <button
              type="button"
              className="thankyou-close-btn"
              onClick={() => setVisitorPassReceipt(null)}
            >
              {visitorText.close}
            </button>
          </article>
        </div>
      )}
      {thankYou && (
        <div
          className="thankyou-modal-overlay"
          role="presentation"
          onClick={() => setThankYou(null)}
        >
          <article
            className="thankyou-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.registrationConfirmed}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="thankyou-title">{t.registrationConfirmed}</p>
            <p className="thankyou-line">
              {t.thankYouMessage || translations.en.thankYouMessage}
            </p>
            <p className="thankyou-line">
              {t.reportingInstruction ||
                translations.en.reportingInstruction}
            </p>
            {thankYou.signedPhotoUrl && (
              <img
                className="thankyou-photo"
                src={thankYou.signedPhotoUrl}
                alt={`${thankYou.fullName} registration`}
              />
            )}
            <button
              type="button"
              className="thankyou-close-btn"
              onClick={() => setThankYou(null)}
            >
              OK
            </button>
          </article>
        </div>
      )}
    </div>
  );
}




















