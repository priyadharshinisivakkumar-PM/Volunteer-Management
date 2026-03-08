import { useEffect, useMemo, useRef, useState } from "react";

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
const MIN_TEAM_MEMBERS = 2;

function createTeamMember() {
  return { fullName: "", phone: "", city: "", photo: null };
}

function createInitialRegistrationForm() {
  return {
    registrationType: "individual",
    teamName: "",
    teamLeadName: "",
    teamLeadPhone: "",
    fullName: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    teamMembers: [createTeamMember(), createTeamMember()]
  };
}

const moonUi = {
  en: {
    title: (year) => `Full Moon & New Moon Dates - ${year}`,
    subtitle: "Select any date to view events planned for that day.",
    fullMoon: "Full Moon",
    newMoon: "New Moon",
    clear: "Clear Selection",
    selectHint: "Select a full moon or new moon date to view events.",
    eventsOn: "Events on",
    noEvents: "No events are planned for this selected date.",
    backToDates: "Back to Date Cards"
  },
  ta: {
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

const adminUi = {
  en: {
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
    eventsTotal: "Events",
    registrationsTotal: "Registrations",
    date: "Date",
    location: "Location",
    totalSlots: "Total Slots",
    registered: "Registered",
    available: "Available",
    summaryLoading: "Loading admin summary...",
    emptySummary: "No event summary found.",
    loginFailed: "Invalid admin username or password.",
    summaryFailed: "Failed to fetch admin summary.",
    sessionExpired: "Admin session expired. Login again.",
    credentialsRequired: "Enter admin username and password."
  },
  ta: {
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
    portalTitle: "Volunteer registration for Satguru Palani Swamy Temple.",
    templeName: "Satguru Palani Swamy Temple",
    templeLocation: "Palani, Tamil Nadu",
    english: "English",
    tamil: "தமிழ்",
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
      "Each team member must include full name, phone, city, and photo.",
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
    submitRegistration: "Submit Registration",
    requiredFields:
      "Full name, phone, city, and photo are required for individual registration.",
    sharedRequiredFields:
      "State, country, and pincode are required for registration.",
    invalidEmail: "Enter a valid email address.",
    invalidPhone: "Enter a valid phone number (10-15 digits).",
    invalidPincode: "Enter a valid pincode (4-10 digits).",
    emailPopup: "Enter a valid email address.",
    phonePopup: "Enter a valid phone number.",
    selectedEvent: "Selected Event",
    thankYouMessage: "Thank you for registering for seva.",
    reportingInstruction:
      "Please report to Kanakkanpatti Satguru Palani Swamy Temple Kalyana Mandapam at 8.00 AM to collect volunteer ID cards."
  },
  ta: {
    portalEyebrow: "சேவா மேலாண்மை தளம்",
    portalTitle: "சத்குரு பழனி சுவாமி கோவிலுக்கான தன்னார்வாளர் பதிவு.",
    templeName: "சத்குரு பழனி சுவாமி கோவில்",
    templeLocation: "பழனி, தமிழ்நாடு",
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
      "முழுப் பெயர், தொலைபேசி எண், நகரம், மாநிலம், நாடு, அஞ்சல் குறியீடு மற்றும் புகைப்படம் அவசியம்.",
    invalidEmail: "சரியான மின்னஞ்சலை உள்ளிடவும்.",
    invalidPhone: "சரியான தொலைபேசி எண்ணை உள்ளிடவும் (10-15 இலக்கங்கள்).",
    invalidPincode: "சரியான அஞ்சல் குறியீட்டை உள்ளிடவும் (4-10 இலக்கங்கள்).",
    emailPopup: "சரியான மின்னஞ்சலை உள்ளிடவும்.",
    phonePopup: "சரியான தொலைபேசி எண்ணை உள்ளிடவும்.",
    selectedEvent: "தேர்ந்தெடுத்த நிகழ்வு",
    thankYouMessage: "சேவைக்கு பதிவு செய்ததற்கு நன்றி.",
    reportingInstruction:
      "தன்னார்வாளர் அடையாள அட்டையை பெற தேர்ந்தெடுத்த தேதியில் காலை 8.00 மணிக்கு கனக்கன்பட்டி சத்குரு பழனி சுவாமி கோவில் கல்யாண மண்டபத்திற்கு வரவும்."
  }
};

export default function App() {
  const currentYear = new Date().getFullYear();
  const moonDates = useMemo(() => getMoonPhasesForYear(currentYear), [currentYear]);
  const [language, setLanguage] = useState("en");
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
  const [adminSummary, setAdminSummary] = useState([]);
  const [adminSummaryTotals, setAdminSummaryTotals] = useState({
    events: 0,
    registrations: 0
  });
  const [adminSummaryLoading, setAdminSummaryLoading] = useState(false);
  const [adminSummaryError, setAdminSummaryError] = useState("");
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
  const [error, setError] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [submittingEventId, setSubmittingEventId] = useState(null);
  const [thankYou, setThankYou] = useState(null);
  const photoInputRef = useRef(null);
  const t = translations[language];
  const moonText = moonUi[language] || moonUi.en;
  const adminText = adminUi[language] || adminUi.en;
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
  const featuredEvents = useMemo(() => {
    const featuredIds = [1, 4, 5];
    const prioritized = featuredIds
      .map((eventId) =>
        templeEvents.find((event) => Number(event.id) === eventId)
      )
      .filter(Boolean);

    return prioritized.length === 3 ? prioritized : templeEvents.slice(0, 3);
  }, [templeEvents]);
  const filteredTempleEvents = selectedMoonDate
    ? featuredEvents
    : [];

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

  function isValidPincode(pincode = "") {
    return /^[0-9]{4,10}$/.test(String(pincode).trim());
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
      "Enter a valid pincode (4-10 digits).": t.invalidPincode,
      "No volunteer slots available.": t.full,
      "You are already registered for this event.": t.register,
      "Invalid registration type.": t.submitRegistration,
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
    const map = {
      "Invalid admin username or password.": adminText.loginFailed,
      "Admin session expired. Login again.": adminText.sessionExpired,
      "Failed to fetch admin summary.": adminText.summaryFailed,
      "Username and password are required.": adminText.credentialsRequired
    };
    return map[message] || message || adminText.summaryFailed;
  }

  async function fetchAdminSummary(token = adminToken) {
    if (!token) {
      return;
    }

    try {
      setAdminSummaryLoading(true);
      setAdminSummaryError("");

      const res = await fetch("/api/admin/events-summary", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        setAdminToken("");
        setActiveScreen("admin-login");
        throw new Error("Admin session expired. Login again.");
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to fetch admin summary.");
      }

      const data = await res.json();
      setAdminSummary(data.events || []);
      setAdminSummaryTotals(
        data.totals || { events: (data.events || []).length, registrations: 0 }
      );
    } catch (error) {
      setAdminSummaryError(localizeAdminError(error.message));
    } finally {
      setAdminSummaryLoading(false);
    }
  }

  async function handleAdminLoginSubmit(event) {
    event.preventDefault();
    const username = adminForm.username.trim();
    const password = adminForm.password;

    if (!username || !password) {
      setAdminAuthError(adminText.credentialsRequired);
      return;
    }

    try {
      setAdminAuthLoading(true);
      setAdminAuthError("");

      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Invalid admin username or password.");
      }

      const data = await res.json();
      const token = String(data.token || "");
      if (!token) {
        throw new Error("Invalid admin username or password.");
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
        await fetch("/api/admin/logout", {
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

  function formatDisplayDate(isoDate) {
    if (!isoDate) {
      return "";
    }

    const locale = language === "ta" ? "ta-IN" : "en-IN";
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function isDateFullyBooked() {
    const eventsOnDate = featuredEvents;
    return (
      eventsOnDate.length > 0 &&
      eventsOnDate.every((event) => Number(event.slots) <= 0)
    );
  }

  function openEventsScreen(isoDate) {
    setSelectedCardType("moon");
    setSelectedMoonDate(isoDate);
    setActiveScreen("events");
  }

  function openSpecialEventScreen() {
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

  function handlePhoneBlur() {
    if (registrationForm.registrationType !== "individual") {
      return;
    }
    const phone = registrationForm.phone.trim();
    if (phone && !isValidPhone(phone)) {
      setInlineFieldError("phone", t.invalidPhone);
      return;
    }
    setInlineFieldError("phone", "");
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

  async function fetchTempleEvents() {
    try {
      setEventsLoading(true);
      const res = await fetch(`/api/temples/${TEMPLE_ID}/events`);
      if (!res.ok) {
        throw new Error("Failed to fetch temple events.");
      }
      const data = await res.json();
      setTempleEvents(data);
      setError("");
    } catch (err) {
      setError(localizeError(err.message || "Unexpected error."));
    } finally {
      setEventsLoading(false);
    }
  }

  useEffect(() => {
    fetchTempleEvents();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "ta" ? "ta" : "en";
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

    fetchAdminSummary(adminToken);
  }, [activeScreen, adminToken]);

  useEffect(() => {
    setOpenEventId(null);
    setError("");
    setFieldErrors({ phone: "" });
  }, [selectedMoonDate]);

  useEffect(() => {
    if (!selectedMoonDate) {
      setActiveScreen("home");
    }
  }, [selectedMoonDate]);

  useEffect(() => {
    if (!selectedMoonDate) {
      return;
    }

    if (selectedCardType !== "moon") {
      return;
    }

    const selectedDateIsFull = isDateFullyBooked();

    if (selectedMoonDate < todayIsoDate || selectedDateIsFull) {
      setSelectedMoonDate("");
    }
  }, [selectedMoonDate, todayIsoDate, featuredEvents, selectedCardType]);

  useEffect(() => {
    if (!openEventId) {
      return;
    }

    const openEvent = filteredTempleEvents.find(
      (event) => Number(event.id) === Number(openEventId)
    );

    if (!openEvent || Number(openEvent.slots) <= 0) {
      setOpenEventId(null);
    }
  }, [openEventId, filteredTempleEvents]);

  async function handleRegister(e, eventId) {
    e.preventDefault();
    const registrationType = registrationForm.registrationType;
    const city = registrationForm.city.trim();
    const state = registrationForm.state.trim();
    const country = registrationForm.country.trim();
    const pincode = registrationForm.pincode.trim();
    setFieldErrors({ phone: "" });

    if (!isValidPincode(pincode)) {
      setError(t.invalidPincode);
      return;
    }

    if (!state || !country || !pincode) {
      setError(t.sharedRequiredFields || translations.en.sharedRequiredFields);
      return;
    }

    const payload = new FormData();
    payload.append("registrationType", registrationType);
    payload.append("state", state);
    payload.append("country", country);
    payload.append("pincode", pincode);

    if (registrationType === "team") {
      const teamName = registrationForm.teamName.trim();
      const teamLeadName = registrationForm.teamLeadName.trim();
      const teamLeadPhone = normalizePhoneInput(registrationForm.teamLeadPhone.trim());
      const members = registrationForm.teamMembers.map((member) => ({
        fullName: member.fullName.trim(),
        phone: member.phone.trim(),
        city: member.city.trim(),
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

      if (members.some((member) => !member.fullName || !member.phone || !member.city || !member.photo)) {
        setError(
          t.teamMemberDetailsRequired || translations.en.teamMemberDetailsRequired
        );
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
            photoField
            };
          })
        )
      );
    } else {
      const fullName = registrationForm.fullName.trim();
      const phone = registrationForm.phone.trim();
      if (!fullName || !phone || !city || !registrationPhoto) {
        setError(t.requiredFields);
        return;
      }

      if (!isValidPhone(phone)) {
        setInlineFieldError("phone", t.invalidPhone);
        return;
      }

      payload.append("fullName", fullName);
      payload.append("phone", phone);
      payload.append("city", city);
      payload.append("photo", registrationPhoto);
    }

    if (submittingEventId === eventId) {
      return;
    }

    setSubmittingEventId(eventId);

    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
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
      const event = templeEvents.find((item) => item.id === eventId);
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
      setFieldErrors({ phone: "" });
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      setOpenEventId(null);
      setError("");
      fetchTempleEvents();
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
                onClick={() => setLanguage("en")}
              >
                {t.english}
              </button>
              <button
                type="button"
                className={`lang-btn ${language === "ta" ? "active" : ""}`}
                onClick={() => setLanguage("ta")}
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
              <input
                type="password"
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
                  disabled={adminSummaryLoading}
                  onClick={() => fetchAdminSummary(adminToken)}
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

            <div className="admin-stats-grid">
              <article className="admin-stat-card">
                <p>{adminText.eventsTotal}</p>
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
                      <th>{t.ongoingEvents}</th>
                      <th>{adminText.date}</th>
                      <th>{adminText.location}</th>
                      <th>{adminText.totalSlots}</th>
                      <th>{adminText.registered}</th>
                      <th>{adminText.available}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminSummary.map((eventSummary) => (
                      <tr key={eventSummary.id}>
                        <td>
                          {language === "ta" && eventSummary.titleTa
                            ? eventSummary.titleTa
                            : eventSummary.title}
                        </td>
                        <td>{eventSummary.date}</td>
                        <td>{eventSummary.location}</td>
                        <td>{eventSummary.totalSlots}</td>
                        <td>{eventSummary.registrations}</td>
                        <td>{eventSummary.availableSlots}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {!isAdminLoginScreen && !isAdminDashboardScreen && (
        <section className="temple-events single-temple">
          <h2>{t.templeName}</h2>
          <p className="subtle">{t.templeLocation}</p>
          {!isEventsScreen && (
            <>
              <div className="temple-gallery-grid">
                {TEMPLE_IMAGES.map((image, index) => (
                  <figure className="temple-gallery-card" key={`${image.src}-${index}`}>
                    <img
                      src={image.src}
                      alt={image.alt}
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </figure>
                ))}
              </div>
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
                    const fullyBookedDate = isDateFullyBooked();
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
          {isEventsScreen && !eventsLoading && filteredTempleEvents.length === 0 && (
            <p>{moonText.noEvents}</p>
          )}

          {isEventsScreen && <div className="events">
            {filteredTempleEvents.map((event) => {
              const eventImage = getEventImage(event);
              const isEventFull = Number(event.slots) <= 0;

              return (
                <article
                  className={`event-card ${isEventFull ? "event-card-disabled" : ""}`}
                  key={event.id}
                  aria-disabled={isEventFull}
                >
                  {eventImage && (
                    <img
                      className="event-thumb"
                      src={eventImage.src}
                      alt={eventImage.alt}
                      loading="lazy"
                    />
                  )}
                  <h3>{getLocalizedEventTitle(event)}</h3>
                  <p>{t.dateLabel}: {event.date}</p>
                  <p>{t.locationLabel}: {event.location}</p>
                  <p>{t.availableSlots}: {event.slots}</p>
                  <p>{t.registeredLabel}: {event.registrations ?? 0}</p>
                  <button
                    className="register-btn"
                    disabled={isEventFull || submittingEventId === event.id}
                    onClick={() =>
                      setOpenEventId(openEventId === event.id ? null : event.id)
                    }
                  >
                    {isEventFull
                      ? t.full
                      : submittingEventId === event.id
                      ? t.submitting
                      : openEventId === event.id
                      ? t.closeForm
                      : t.register}
                  </button>

                  {!isEventFull && openEventId === event.id && (
                    <form
                      className="volunteer-form register-form"
                      onSubmit={(e) => handleRegister(e, event.id)}
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
                              }}
                              disabled={submittingEventId === event.id}
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
                              }}
                              disabled={submittingEventId === event.id}
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
                              setRegistrationForm({
                                ...registrationForm,
                                phone: normalizePhoneInput(e.target.value)
                              });
                              if (fieldErrors.phone) {
                                setInlineFieldError("phone", "");
                              }
                            }}
                            onBlur={handlePhoneBlur}
                            required
                          />
                          {fieldErrors.phone && (
                            <p className="field-error">{fieldErrors.phone}</p>
                          )}
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
                                  disabled={submittingEventId === event.id}
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
                            disabled={submittingEventId === event.id}
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
                              disabled={submittingEventId === event.id}
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
                                disabled={submittingEventId === event.id}
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
                      <button type="submit" disabled={submittingEventId === event.id}>
                        {submittingEventId === event.id
                          ? t.submitting
                          : t.submitRegistration}
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>}
        </section>
        )}
      </main>
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
