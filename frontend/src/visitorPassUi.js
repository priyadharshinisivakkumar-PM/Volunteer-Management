import { getTodayIsoDate } from "../../shared/registrationValidation.js";

export function createInitialVisitorPassForm() {
  return {
    fullName: "",
    phone: "",
    dateOfVisit: getTodayIsoDate(),
    city: "",
    pincode: ""
  };
}

export const visitorPassUi = {
  en: {
    buttonLabel: "Visitor Pass",
    sectionTitle: "Visitor Pass Registration",
    sectionDescription:
      "Register here to get visitor pass",
    formTitle: "Register Visitor Pass",
    formDescription:
      "Enter the visitor details below.",
    dateOfVisitLabel: "Date of Visit",
    requiredFields: "Name, phone, visit date, city, and pincode are required.",
    invalidDate: "Enter a valid visit date.",
    pastDate: "Visit date cannot be in the past.",
    duplicate:
      "A visitor pass already exists for this phone number on the selected date.",
    submitFailed: "Could not submit visitor pass. Please try again.",
    serviceUnavailable: "Visitor pass service is unavailable. Please restart the backend.",
    submit: "Submit Visitor Pass",
    submitting: "Submitting visitor pass...",
    successTitle: "Visitor Pass Confirmed",
    successMessage: "Visitor pass created successfully.",
    successInstruction:
      "Please note the pass number below for admin printing and temple entry verification.",
    passNumberLabel: "Visitor Pass No.",
    visitDateLabel: "Visit Date",
    adminTab: "Visitor Passes",
    adminTitle: "Visitor Pass Registrations",
    adminDescription:
      "Review registered visitors and print passes in the same card format used by the temple desk.",
    totalPasses: "Visitor Passes",
    visitDates: "Visit Dates",
    loading: "Loading visitor pass registrations...",
    empty: "No visitor pass registrations found.",
    passId: "Pass No.",
    name: "Name",
    phone: "Phone",
    city: "City",
    pincode: "Pincode",
    createdAt: "Registered On",
    printSelected: "Print Visitor Passes",
    selectHint: "Selected for visitor pass print",
    printPreviewTitle: "Visitor Pass Print Preview",
    printPreviewDescription: (count) =>
      `${count} visitor pass(es) will be printed. Standard card size: 3.5 x 2.125 inches.`,
    printCardTitle: "Temple Visitor Pass",
    close: "Close"
  },
  ta: {
    buttonLabel: "பார்வையாளர் அனுமதி",
    sectionTitle: "பார்வையாளர் அனுமதி பதிவு",
    sectionDescription:
      "தன்னார்வலர் பதிவு இல்லாமல் கோவில் வருகைக்கான எளிய பார்வையாளர் அனுமதியை இங்கே பதிவு செய்யலாம்.",
    formTitle: "பார்வையாளர் அனுமதி பதிவு",
    formDescription:
      "பெயர், தொலைபேசி, வருகை தேதி, நகரம் மற்றும் அஞ்சல் குறியீட்டை மட்டும் பதிவு செய்யவும்.",
    dateOfVisitLabel: "வருகை தேதி",
    requiredFields: "பெயர், தொலைபேசி, வருகை தேதி, நகரம் மற்றும் அஞ்சல் குறியீடு அவசியம்.",
    invalidDate: "சரியான வருகை தேதியை உள்ளிடவும்.",
    pastDate: "கடந்த தேதிக்கு பார்வையாளர் அனுமதி உருவாக்க முடியாது.",
    duplicate:
      "இந்த தொலைபேசி எண்ணுக்கு தேர்ந்தெடுத்த தேதியில் ஏற்கனவே பார்வையாளர் அனுமதி உள்ளது.",
    submit: "பார்வையாளர் அனுமதி சமர்ப்பி",
    submitting: "பார்வையாளர் அனுமதி சமர்ப்பிக்கப்படுகிறது...",
    successTitle: "பார்வையாளர் அனுமதி உறுதி செய்யப்பட்டது",
    successMessage: "பார்வையாளர் அனுமதி வெற்றிகரமாக உருவாக்கப்பட்டது.",
    successInstruction:
      "கோவில் நுழைவு மற்றும் நிர்வாக அச்சிடலுக்காக கீழே உள்ள அனுமதி எண்ணை குறிப்பெடுக்கவும்.",
    passNumberLabel: "அனுமதி எண்",
    visitDateLabel: "வருகை தேதி",
    adminTab: "பார்வையாளர் அனுமதிகள்",
    adminTitle: "பார்வையாளர் அனுமதி பதிவுகள்",
    adminDescription:
      "பதிவு செய்யப்பட்ட பார்வையாளர்களை பார்த்து, கோவில் அலுவலக பயன்பாட்டிற்கு அனுமதி அட்டைகளை அச்சிடலாம்.",
    totalPasses: "அனுமதிகள்",
    visitDates: "வருகை தேதிகள்",
    loading: "பார்வையாளர் அனுமதி பதிவுகள் ஏற்றப்படுகின்றன...",
    empty: "பார்வையாளர் அனுமதி பதிவுகள் இல்லை.",
    passId: "அனுமதி எண்",
    name: "பெயர்",
    phone: "தொலைபேசி",
    city: "நகரம்",
    pincode: "அஞ்சல் குறியீடு",
    createdAt: "பதிவு செய்த தேதி",
    printSelected: "பார்வையாளர் அனுமதி அச்சிடு",
    selectHint: "அச்சிட தேர்ந்தெடுத்த பார்வையாளர் அனுமதிகள்",
    printPreviewTitle: "பார்வையாளர் அனுமதி அச்சு முன்னோட்டம்",
    printPreviewDescription: (count) =>
      `${count} பார்வையாளர் அனுமதி அட்டைகள் அச்சிடப்படும். அட்டை அளவு: 3.5 x 2.125 அங்குலம்.`,
    printCardTitle: "கோவில் பார்வையாளர் அனுமதி",
    close: "மூடு"
  }
};


