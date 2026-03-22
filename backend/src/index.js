import dotenv from "dotenv";

const ENV_PATH = new URL("../.env", import.meta.url);

dotenv.config({ path: ENV_PATH, override: true });
import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  calculateAgeFromDateOfBirth,
  validateDateOfBirth,
  validateIsoCalendarDate,
  validateVisitDate
} from "../../shared/registrationValidation.js";

const app = express();
const PORT = process.env.PORT || 5000;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_AADHAAR_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_SIZE_BYTES = Math.max(MAX_PHOTO_SIZE_BYTES, MAX_AADHAAR_SIZE_BYTES);
const MIN_TEAM_MEMBERS = 2;
const MIN_VOLUNTEER_AGE = 20;
const MAX_VOLUNTEER_AGE = 60;
const AGE_LIMIT_ERROR_MESSAGE =
  "For safety reasons, volunteer registration is permitted only for individuals between 20 and 60 years of age.";
const INVALID_DOB_ERROR_MESSAGE =
  "Enter a valid date of birth. Future dates are not allowed.";
const INVALID_AADHAAR_LAST4_ERROR_MESSAGE = "Enter the last 4 digits of Aadhaar.";
const INVALID_AADHAAR_FILE_TYPE_ERROR_MESSAGE = "Aadhaar must be a PDF or image file.";
const AADHAAR_REQUIRED_ERROR_MESSAGE = "Upload a masked Aadhaar PDF or image to continue.";
const AADHAAR_UPDATE_REQUIRED_ERROR_MESSAGE = "Upload a new Aadhaar file to replace the one on file.";
const AADHAAR_SIZE_ERROR_MESSAGE = "Aadhaar document must be less than 10 MB in size.";
const PHOTO_FILE_TYPE_ERROR_MESSAGE = "Photo must be an image file.";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES }
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const DATABASE_URL = String(process.env.DATABASE_URL || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)
  .trim()
  .replace(/^['"]|['"]$/g, "");
const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || "volunteer-photos";
const SUPABASE_DOCUMENTS_BUCKET =
  process.env.SUPABASE_DOCUMENTS_BUCKET || "volunteer-documents";
const signedUrlExpiresRaw = Number(
  process.env.SUPABASE_SIGNED_URL_EXPIRES_IN || 3600
);
const SIGNED_URL_EXPIRES_IN =
  Number.isFinite(signedUrlExpiresRaw) && signedUrlExpiresRaw > 0
    ? signedUrlExpiresRaw
    : 3600;
const VALID_DOCUMENT_VERIFICATION_STATUSES = new Set([
  "pending",
  "verified",
  "rejected"
]);
const ATTENDANCE_REGISTRATION_SELECT = 
  `SELECT er.id, er.event_id, er.full_name, er.phone, er.city, er.pincode, er.email,
          er.registration_type, er.team_name, er.team_lead_name, er.team_id,
          er.attendance_status, er.created_at, er.photo_path, er.photo_filename,
          er.photo_mime_type, er.photo_size_bytes, er.volunteer_id,
          er.registration_dates,
          vd.id AS kyc_document_id, vd.storage_path AS kyc_storage_path,
          vd.file_name AS kyc_file_name, vd.mime_type AS kyc_mime_type,
          vd.size_bytes AS kyc_size_bytes, vd.document_last4 AS kyc_document_last4,
          vd.is_masked AS kyc_is_masked,
          vd.verification_status AS kyc_verification_status,
          vd.uploaded_at AS kyc_uploaded_at, vd.verified_at AS kyc_verified_at,
          vd.verified_by AS kyc_verified_by
   FROM event_registrations er
   LEFT JOIN volunteer_documents vd
     ON vd.volunteer_id = er.volunteer_id
    AND vd.document_type = 'aadhaar'`;
function getAdminCredentials() {
  dotenv.config({ path: ENV_PATH, override: true });
  const username = String(process.env.ADMIN_USERNAME || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const passwordHash = String(process.env.ADMIN_PASSWORD_HASH || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  return { username, passwordHash };
}
const adminSessionTtlRaw = Number(process.env.ADMIN_SESSION_TTL_SECONDS || 43200);
const ADMIN_SESSION_TTL_SECONDS =
  Number.isFinite(adminSessionTtlRaw) && adminSessionTtlRaw > 0
    ? Math.floor(adminSessionTtlRaw)
    : 43200;
const adminSessions = new Map();
const SYNODIC_MONTH_MS = 29.530588861 * 24 * 60 * 60 * 1000;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const ACTIVE_YEAR = new Date().getFullYear();
const SCHEMA_SQL_PATH = new URL("../sql/schema.sql", import.meta.url);

function toIsoDateUTC(timestampMs) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function getMoonPhasesForYear(year) {
  const start = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const end = Date.UTC(year, 11, 31, 23, 59, 59, 999);
  let lunationIndex =
    Math.floor((start - REFERENCE_NEW_MOON_MS) / SYNODIC_MONTH_MS) - 2;
  const phases = [];

  while (true) {
    const newMoonMs = REFERENCE_NEW_MOON_MS + lunationIndex * SYNODIC_MONTH_MS;
    const fullMoonMs = newMoonMs + SYNODIC_MONTH_MS / 2;

    if (newMoonMs > end && fullMoonMs > end) {
      break;
    }

    if (newMoonMs >= start && newMoonMs <= end) {
      phases.push({ phase: "new", date: toIsoDateUTC(newMoonMs) });
    }

    if (fullMoonMs >= start && fullMoonMs <= end) {
      phases.push({ phase: "full", date: toIsoDateUTC(fullMoonMs) });
    }

    lunationIndex += 1;
  }

  phases.sort((a, b) => a.date.localeCompare(b.date));
  return phases;
}

const annualMoonPhases = getMoonPhasesForYear(ACTIVE_YEAR);

function getMoonPhaseDate(index, fallbackMonthDay) {
  return annualMoonPhases[index]?.date || `${ACTIVE_YEAR}-${fallbackMonthDay}`;
}

function isAdminConfigured() {
  const { username, passwordHash } = getAdminCredentials();
  return Boolean(username && passwordHash);
}

function secureCompare(valueA, valueB) {
  const a = Buffer.from(String(valueA));
  const b = Buffer.from(String(valueB));
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function cleanupExpiredAdminSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

const adminSessionCleanup = setInterval(cleanupExpiredAdminSessions, 10 * 60 * 1000);
if (typeof adminSessionCleanup.unref === "function") {
  adminSessionCleanup.unref();
}

function getDatabasePool() {
  if (!DATABASE_URL) {
    return { dbPool: null, configError: "Missing DATABASE_URL in backend/.env." };
  }

  if (DATABASE_URL.includes("<") || DATABASE_URL.includes(">")) {
    return {
      dbPool: null,
      configError:
        "DATABASE_URL appears to contain placeholder text. Replace it with your real Supabase Postgres connection string."
    };
  }

  try {
    const parsed = new URL(DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      throw new Error("Connection string must start with postgresql://");
    }
    return { dbPool: new Pool({ connectionString: DATABASE_URL }), configError: null };
  } catch (error) {
    return {
      dbPool: null,
      configError: `Invalid DATABASE_URL in backend/.env: ${error.message}`
    };
  }
}

const { dbPool: pool, configError: databaseConfigError } = getDatabasePool();

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      client: null,
      configError: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env."
    };
  }

  if (SUPABASE_URL.includes("<project-ref>")) {
    return {
      client: null,
      configError:
        "SUPABASE_URL still has placeholder <project-ref>. Replace it with your real Supabase project URL."
    };
  }

  try {
    const parsed = new URL(SUPABASE_URL);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL must start with http:// or https://");
    }
    return {
      client: createClient(parsed.origin, SUPABASE_SERVICE_ROLE_KEY),
      configError: null
    };
  } catch (error) {
    return {
      client: null,
      configError: `Invalid SUPABASE_URL in backend/.env: ${error.message}`
    };
  }
}

const { client: supabase, configError: supabaseConfigError } = getSupabaseClient();

const temples = [
  {
    id: 1,
    name: "Satguru Palani Swamy Temple",
    city: "Palani",
    state: "Tamil Nadu"
  }
];

const events = [
  {
    id: 1,
    templeId: 1,
    title: "Annadana Prasada Distribution Seva",
    titleTa: "அன்னதான பிரசாத விநியோக சேவை",
    date: getMoonPhaseDate(5, "03-18"),
    location: "North Hall",
    slots: 30,
    status: "ongoing"
  },
  {
    id: 2,
    templeId: 1,
    title: "Weekend Darshan Queue Support",
    titleTa: "வார இறுதி தரிசன வரிசை சேவை",
    date: getMoonPhaseDate(6, "04-02"),
    location: "Main Entrance",
    slots: 24,
    status: "ongoing"
  },
  {
    id: 3,
    templeId: 1,
    title: "Pilgrim Help Desk",
    titleTa: "யாத்திரிகர் உதவி மையம்",
    date: getMoonPhaseDate(7, "04-17"),
    location: "Gate 2",
    slots: 18,
    status: "ongoing"
  },
  {
    id: 4,
    templeId: 1,
    title: "Temple Premises Cleanliness and Sanctum Maintenance Seva",
    titleTa: "கோவில் தூய்மை மற்றும் சன்னதி பராமரிப்பு சேவை",
    date: getMoonPhaseDate(8, "05-01"),
    location: "Inner Prakaram",
    slots: 20,
    status: "ongoing"
  },
  {
    id: 5,
    templeId: 1,
    title: "Floral Garland Preparation and Alankara Seva",
    titleTa: "மலர் மாலை தயாரிப்பு மற்றும் அலங்கார சேவை",
    date: getMoonPhaseDate(9, "05-17"),
    location: "Alankara Mandapam",
    slots: 16,
    status: "ongoing"
  }
];

async function mapVolunteerRow(row) {
  let signedPhotoUrl = null;
  if (row.photo_path) {
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(row.photo_path, SIGNED_URL_EXPIRES_IN);
    if (!error) {
      signedPhotoUrl = data.signedUrl;
    }
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    skills: row.skills || [],
    availability: row.availability || "Not specified",
    status: row.status,
    photoUrl: row.photo_url,
    signedPhotoUrl,
    photoMetadata: {
      path: row.photo_path,
      fileName: row.photo_filename,
      mimeType: row.photo_mime_type,
      sizeBytes: row.photo_size_bytes
    },
    createdAt: row.created_at
  };
}

function ensureStorageSetup() {
  if (!pool) {
    throw new Error(databaseConfigError || "DATABASE_URL is missing.");
  }
  if (!supabase) {
    throw new Error(supabaseConfigError || "Supabase credentials are missing.");
  }
}

function ensureDatabaseSetup() {
  if (!pool) {
    throw new Error(databaseConfigError || "DATABASE_URL is missing.");
  }
}

async function ensureDatabaseSchema() {
  ensureDatabaseSetup();

  let schemaSql;
  try {
    schemaSql = await readFile(SCHEMA_SQL_PATH, "utf8");
  } catch (error) {
    throw new Error(`Failed to load database schema: ${error.message}`);
  }

  await pool.query(schemaSql);
}

function requireAdminAuth(req, res, next) {
  if (!isAdminConfigured()) {
    return res
      .status(500)
      .json({ message: "Admin credentials are not configured on the server." });
  }

  cleanupExpiredAdminSessions();

  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin authorization token is required." });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const session = adminSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ message: "Admin session expired. Login again." });
  }

  req.adminToken = token;
  return next();
}

function getFileExtension(fileName = "") {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.at(-1).toLowerCase() : "jpg";
}

function isImageFile(file) {
  return Boolean(file?.mimetype && String(file.mimetype).startsWith("image/"));
}

function isSupportedAadhaarFile(file) {
  const mimeType = String(file?.mimetype || "").toLowerCase();
  return Boolean(
    mimeType && (mimeType === "application/pdf" || mimeType.startsWith("image/"))
  );
}

function isValidAadhaarLast4(value = "") {
  return /^[0-9]{4}$/.test(String(value).trim());
}
function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidPhone(phone = "") {
  return /^\+?[0-9]{10,15}$/.test(String(phone).trim());
}

function normalizePhoneValue(phone = "") {
  const cleaned = String(phone).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    return `+${cleaned.slice(1).replace(/\+/g, "")}`;
  }
  return cleaned.replace(/\+/g, "");
}

function buildSystemRegistrationEmail(eventId, normalizedPhone = "") {
  const digits = String(normalizedPhone).replace(/\D/g, "");
  return `event${eventId}.phone${digits || "unknown"}@registrations.local`;
}

function isValidPincode(pincode = "") {
  return /^[0-9]{4,10}$/.test(String(pincode).trim());
}

function isValidVisitDate(isoDate = "") {
  return validateIsoCalendarDate(isoDate).isValid;
}

function getSyntheticEventDateFromId(eventId) {
  const match = String(eventId).match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) {
    return "";
  }

  const isoDate = `${match[1]}-${match[2]}-${match[3]}`;
  return validateIsoCalendarDate(isoDate).isValid ? isoDate : "";
}

function resolveRegistrationEventDate(row = {}) {
  const resolvedEventId = Number(row.event_id ?? row.eventId);
  if (Number.isFinite(resolvedEventId) && resolvedEventId > 0) {
    const matchedEvent = events.find((event) => Number(event.id) === resolvedEventId);
    if (matchedEvent?.date) {
      return matchedEvent.date;
    }

    const syntheticDate = getSyntheticEventDateFromId(resolvedEventId);
    if (syntheticDate) {
      return syntheticDate;
    }

  }

  const registrationDates = Array.isArray(row.registration_dates ?? row.registrationDates)
    ? row.registration_dates ?? row.registrationDates
    : [];
  if (registrationDates.length > 0) {
    const latestDate = registrationDates
      .map((value) => String(value).slice(0, 10))
      .sort()
      .at(-1);
    if (latestDate && validateIsoCalendarDate(latestDate).isValid) {
      return latestDate;
    }
  }

  const createdAt = row.created_at ?? row.createdAt;
  if (createdAt) {
    const isoDate = String(createdAt).slice(0, 10);
    if (validateIsoCalendarDate(isoDate).isValid) {
      return isoDate;
    }
  }

  return "";
}

function normalizeVolunteerDocumentStatus(value = "") {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return VALID_DOCUMENT_VERIFICATION_STATUSES.has(normalizedValue)
    ? normalizedValue
    : "pending";
}

async function createSignedStorageUrl(
  bucketName,
  storagePath,
  { downloadFileName = "" } = {}
) {
  if (!supabase || !bucketName || !storagePath) {
    return null;
  }

  const options = downloadFileName ? { download: downloadFileName } : undefined;
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN, options);

  if (error) {
    return null;
  }

  return data?.signedUrl || null;
}

function buildVolunteerDocumentSummary(document, { includeStatus = false } = {}) {
  if (!document) {
    return null;
  }

  const summary = {
    last4: document.documentLast4,
    isMasked: document.isMasked,
    uploadedAt: document.uploadedAt,
    fileName: document.fileName
  };

  if (includeStatus) {
    summary.status = normalizeVolunteerDocumentStatus(document.verificationStatus);
    summary.verifiedAt = document.verifiedAt;
    summary.verifiedBy = document.verifiedBy;
  }

  return summary;
}

function mapAttendanceKycSummary(row = {}) {
  const hasDocument = Boolean(row.kyc_document_id && row.kyc_storage_path);
  const status = hasDocument
    ? normalizeVolunteerDocumentStatus(row.kyc_verification_status)
    : "missing";

  return {
    status,
    hasDocument,
    last4: row.kyc_document_last4 || "",
    isMasked: row.kyc_is_masked !== false,
    uploadedAt: row.kyc_uploaded_at || null,
    verifiedAt: row.kyc_verified_at || null,
    verifiedBy: row.kyc_verified_by || "",
    fileName: row.kyc_file_name || "",
    mimeType: row.kyc_mime_type || "",
    sizeBytes: row.kyc_size_bytes ?? null
  };
}

async function buildAttendanceRegistrationRow(row, { eventDate = "" } = {}) {
  const {
    kyc_document_id: _kycDocumentId,
    kyc_storage_path: _kycStoragePath,
    kyc_file_name: _kycFileName,
    kyc_mime_type: _kycMimeType,
    kyc_size_bytes: _kycSizeBytes,
    kyc_document_last4: _kycDocumentLast4,
    kyc_is_masked: _kycIsMasked,
    kyc_verification_status: _kycVerificationStatus,
    kyc_uploaded_at: _kycUploadedAt,
    kyc_verified_at: _kycVerifiedAt,
    kyc_verified_by: _kycVerifiedBy,
    ...registrationRow
  } = row;

  const signedPhotoUrl = await createSignedStorageUrl(
    SUPABASE_STORAGE_BUCKET,
    row.photo_path
  );

  const responseRow = {
    ...registrationRow,
    photo_url: signedPhotoUrl,
    kyc: mapAttendanceKycSummary(row)
  };

  if (eventDate) {
    responseRow.event_date = eventDate;
  }

  return responseRow;
}

async function getAttendanceRegistrations() {
  ensureDatabaseSetup();
  const { rows } = await pool.query(
    `${ATTENDANCE_REGISTRATION_SELECT}
     ORDER BY er.created_at DESC`
  );
  return rows;
}

async function getAttendanceRegistrationById(registrationId, dbClient = pool) {
  if (!Number.isFinite(Number(registrationId)) || !dbClient) {
    return null;
  }

  const { rows } = await dbClient.query(
    `${ATTENDANCE_REGISTRATION_SELECT}
     WHERE er.id = $1
     LIMIT 1`,
    [registrationId]
  );

  return rows[0] || null;
}

function parseTeamMembers(rawMembers) {
  if (Array.isArray(rawMembers)) {
    return rawMembers;
  }

  if (typeof rawMembers === "string") {
    const trimmed = rawMembers.trim();
    if (!trimmed) {
      return [];
    }
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  }

  return [];
}

function mapVolunteerDocumentRow(row = {}) {
  return {
    id: row.id,
    volunteerId: row.volunteer_id,
    phone: row.phone,
    documentType: row.document_type,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    documentLast4: row.document_last4,
    isMasked: row.is_masked !== false,
    verificationStatus: normalizeVolunteerDocumentStatus(row.verification_status),
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at
  };
}

async function getVolunteerDocumentByVolunteerId(volunteerId, dbClient = pool) {
  if (!volunteerId || !dbClient) {
    return null;
  }

  const { rows } = await dbClient.query(
    `SELECT id, volunteer_id, phone, document_type, storage_path, file_name,
            mime_type, size_bytes, document_last4, is_masked,
            verification_status, verified_at, verified_by, uploaded_at, updated_at
     FROM volunteer_documents
     WHERE volunteer_id = $1 AND document_type = 'aadhaar'
     LIMIT 1`,
    [volunteerId]
  );

  return rows[0] ? mapVolunteerDocumentRow(rows[0]) : null;
}

async function getVolunteerIdentityByPhone(phone, dbClient = pool) {
  const normalizedPhone = normalizePhoneValue(phone);
  if (!normalizedPhone || !dbClient) {
    return null;
  }

  const { rows } = await dbClient.query(
    `SELECT volunteer_id, full_name
     FROM event_registrations
     WHERE phone = $1 AND volunteer_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedPhone]
  );

  if (!rows.length) {
    return null;
  }

  const volunteerId = rows[0].volunteer_id;
  const document = await getVolunteerDocumentByVolunteerId(volunteerId, dbClient);

  return {
    volunteerId,
    phone: normalizedPhone,
    fullName: rows[0].full_name,
    document
  };
}

async function upsertVolunteerDocument({
  dbClient,
  volunteerId,
  phone,
  storagePath,
  fileName,
  mimeType,
  sizeBytes,
  documentLast4,
  isMasked = true
}) {
  const { rows } = await dbClient.query(
    `INSERT INTO volunteer_documents
      (volunteer_id, phone, document_type, storage_path, file_name, mime_type,
       size_bytes, document_last4, is_masked, verification_status,
       verified_at, verified_by, uploaded_at, updated_at)
     VALUES ($1, $2, 'aadhaar', $3, $4, $5, $6, $7, $8, 'pending', NULL, NULL, NOW(), NOW())
     ON CONFLICT (volunteer_id, document_type)
     DO UPDATE SET
       phone = EXCLUDED.phone,
       storage_path = EXCLUDED.storage_path,
       file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       size_bytes = EXCLUDED.size_bytes,
       document_last4 = EXCLUDED.document_last4,
       is_masked = EXCLUDED.is_masked,
       verification_status = 'pending',
       verified_at = NULL,
       verified_by = NULL,
       updated_at = NOW()
     RETURNING id, volunteer_id, phone, document_type, storage_path, file_name,
               mime_type, size_bytes, document_last4, is_masked,
               verification_status, verified_at, verified_by, uploaded_at, updated_at`,
    [
      volunteerId,
      phone,
      storagePath,
      fileName,
      mimeType,
      sizeBytes,
      documentLast4,
      isMasked
    ]
  );

  return mapVolunteerDocumentRow(rows[0]);
}

async function removeFileFromStorage(bucketName, filePath, failureMessage) {
  if (!bucketName || !filePath || !supabase) {
    return;
  }

  const { error } = await supabase.storage.from(bucketName).remove([filePath]);

  if (error) {
    console.warn(failureMessage, error.message);
  }
}

async function removeFilesFromStorage(bucketName, filePaths = [], failureMessage) {
  const uniquePaths = [...new Set(filePaths.filter(Boolean))];
  for (const filePath of uniquePaths) {
    await removeFileFromStorage(bucketName, filePath, failureMessage);
  }
}

async function removePhotoFromStorage(photoPath) {
  await removeFileFromStorage(
    SUPABASE_STORAGE_BUCKET,
    photoPath,
    "Failed to remove uploaded photo:"
  );
}

async function removePhotosFromStorage(photoPaths = []) {
  await removeFilesFromStorage(
    SUPABASE_STORAGE_BUCKET,
    photoPaths,
    "Failed to remove uploaded photo:"
  );
}

async function removeDocumentsFromStorage(documentPaths = []) {
  await removeFilesFromStorage(
    SUPABASE_DOCUMENTS_BUCKET,
    documentPaths,
    "Failed to remove uploaded Aadhaar document:"
  );
}
async function getRegistrationCountMap(eventIds) {
  if (!eventIds.length) {
    return new Map();
  }

  const { rows } = await pool.query(
    `SELECT event_id, COUNT(*)::int AS registrations
     FROM event_registrations
     WHERE event_id = ANY($1::bigint[])
     GROUP BY event_id`,
    [eventIds]
  );

  return new Map(rows.map((row) => [Number(row.event_id), row.registrations]));
}

async function getEventSettings() {
  ensureDatabaseSetup();
  const { rows } = await pool.query(
    "SELECT normal_slots, special_slots FROM event_settings WHERE id = 1"
  );
  const row = rows[0] || {};
  const normalSlots = Number(row.normal_slots);
  const specialSlots = Number(row.special_slots);
  return {
    normalSlots: Number.isFinite(normalSlots) ? normalSlots : 999,
    specialSlots: Number.isFinite(specialSlots) ? specialSlots : 999
  };
}

async function saveEventSettings(normalSlots, specialSlots) {
  ensureDatabaseSetup();
  const { rows } = await pool.query(
    `INSERT INTO event_settings (id, normal_slots, special_slots, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE
       SET normal_slots = EXCLUDED.normal_slots,
           special_slots = EXCLUDED.special_slots,
           updated_at = NOW()
     RETURNING normal_slots, special_slots, updated_at`,
    [normalSlots, specialSlots]
  );
  const row = rows[0] || { normal_slots: normalSlots, special_slots: specialSlots };
  return {
    normalSlots: Number(row.normal_slots),
    specialSlots: Number(row.special_slots),
    updatedAt: row.updated_at
  };
}


function ensureVisitorPassStorageAvailable() {
  if (pool || supabase) {
    return;
  }

  throw new Error(
    databaseConfigError ||
      supabaseConfigError ||
      "Visitor pass service is unavailable."
  );
}

function mapVisitorPassRow(row = {}) {
  const rawDate = row.date_of_visit ?? row.dateOfVisit ?? "";
  return {
    id: row.id,
    visitorPassId: row.visitor_pass_id ?? row.visitorPassId,
    fullName: row.full_name ?? row.fullName,
    phone: row.phone,
    dateOfVisit: rawDate ? String(rawDate).slice(0, 10) : "",
    city: row.city,
    pincode: row.pincode,
    createdAt: row.created_at ?? row.createdAt ?? null
  };
}

function createVisitorPassError(error) {
  const wrappedError = new Error(error?.message || "Visitor pass service is unavailable.");
  if (error?.code) {
    wrappedError.code = error.code;
  }
  if (error?.details) {
    wrappedError.details = error.details;
  }
  return wrappedError;
}

async function findExistingVisitorPass(phone, dateOfVisit) {
  ensureVisitorPassStorageAvailable();

  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT id, visitor_pass_id, full_name, phone, date_of_visit, city, pincode, created_at
         FROM visitor_pass_registrations
         WHERE phone = $1 AND date_of_visit = $2
         LIMIT 1`,
        [phone, dateOfVisit]
      );
      return rows.map(mapVisitorPassRow);
    } catch (error) {
      if (!supabase) {
        throw error;
      }
    }
  }

  const { data, error } = await supabase
    .from("visitor_pass_registrations")
    .select("id, visitor_pass_id, full_name, phone, date_of_visit, city, pincode, created_at")
    .eq("phone", phone)
    .eq("date_of_visit", dateOfVisit)
    .limit(1);

  if (error) {
    throw createVisitorPassError(error);
  }

  return (data || []).map(mapVisitorPassRow);
}

async function createVisitorPassRegistration({ fullName, phone, dateOfVisit, city, pincode }) {
  ensureVisitorPassStorageAvailable();

  if (pool) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO visitor_pass_registrations
          (full_name, phone, date_of_visit, city, pincode)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, visitor_pass_id, full_name, phone, date_of_visit, city, pincode, created_at`,
        [fullName, phone, dateOfVisit, city, pincode]
      );

      return mapVisitorPassRow(rows[0]);
    } catch (error) {
      if (!supabase) {
        throw error;
      }
    }
  }

  const { data, error } = await supabase
    .from("visitor_pass_registrations")
    .insert({
      full_name: fullName,
      phone,
      date_of_visit: dateOfVisit,
      city,
      pincode
    })
    .select("id, visitor_pass_id, full_name, phone, date_of_visit, city, pincode, created_at")
    .single();

  if (error) {
    throw createVisitorPassError(error);
  }

  return mapVisitorPassRow(data);
}

async function getVisitorPassRegistrationsList(visitDate = "") {
  ensureVisitorPassStorageAvailable();

  if (pool) {
    try {
      const values = [];
      const whereClauses = [];
      if (visitDate) {
        values.push(visitDate);
        whereClauses.push(`date_of_visit = ${values.length}`);
      }

      const whereSql = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";

      const { rows } = await pool.query(
        `SELECT id, visitor_pass_id, full_name, phone, date_of_visit, city, pincode, created_at
         FROM visitor_pass_registrations
         ${whereSql}
         ORDER BY date_of_visit ASC, created_at DESC`,
        values
      );

      return rows.map(mapVisitorPassRow);
    } catch (error) {
      if (!supabase) {
        throw error;
      }
    }
  }

  let query = supabase
    .from("visitor_pass_registrations")
    .select("id, visitor_pass_id, full_name, phone, date_of_visit, city, pincode, created_at")
    .order("date_of_visit", { ascending: true })
    .order("created_at", { ascending: false });

  if (visitDate) {
    query = query.eq("date_of_visit", visitDate);
  }

  const { data, error } = await query;
  if (error) {
    throw createVisitorPassError(error);
  }

  return (data || []).map(mapVisitorPassRow);
}

app.get("/api/health", async (_req, res) => {
  let databaseReachable = false;
  let databaseRuntimeError = null;

  if (pool) {
    try {
      await pool.query("SELECT 1");
      databaseReachable = true;
    } catch (error) {
      databaseRuntimeError = error.message;
    }
  }

  res.json({
    ok: true,
    service: "volunteer-api",
    databaseConfigured: Boolean(pool),
    databaseConfigError,
    databaseReachable,
    databaseRuntimeError,
    supabaseConfigured: Boolean(supabase),
    supabaseConfigError,
    adminConfigured: isAdminConfigured(),
    adminSessionTtlSeconds: ADMIN_SESSION_TTL_SECONDS,
    bucket: SUPABASE_STORAGE_BUCKET,
    signedUrlExpiresIn: SIGNED_URL_EXPIRES_IN
  });
});

app.get("/api/event-settings", async (_req, res) => {
  try {
    const settings = await getEventSettings();
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/visitor-passes/register", async (req, res) => {
  try {
    ensureVisitorPassStorageAvailable();

    const fullName = String(req.body?.fullName || "").trim();
    const phone = normalizePhoneValue(req.body?.phone || "");
    const dateOfVisit = String(req.body?.dateOfVisit || "").trim();
    const city = String(req.body?.city || "").trim();
    const pincode = String(req.body?.pincode || "").trim();
    const todayIsoDate = toIsoDateUTC(Date.now());

    if (!fullName || !phone || !dateOfVisit || !city || !pincode) {
      return res.status(400).json({
        message: "Name, phone, visit date, city, and pincode are required."
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "Enter a valid phone number (10-15 digits)." });
    }

    const visitDateValidation = validateVisitDate(dateOfVisit, { todayIsoDate });
    if (!visitDateValidation.isValid) {
      return res.status(400).json({
        message:
          visitDateValidation.reason === "past"
            ? "Visit date cannot be in the past."
            : "Enter a valid visit date."
      });
    }

    if (!isValidPincode(pincode)) {
      return res.status(400).json({ message: "Enter a valid pincode (4-10 digits)." });
    }

    const existingRows = await findExistingVisitorPass(phone, dateOfVisit);
    if (existingRows.length) {
      return res.status(409).json({
        message: "A visitor pass already exists for this phone number on the selected date."
      });
    }

    const registration = await createVisitorPassRegistration({
      fullName,
      phone,
      dateOfVisit,
      city,
      pincode
    });

    return res.status(201).json(registration);
  } catch (error) {
    if (
      error?.code === "23505" ||
      /visitor_pass_registrations_phone_visit_unique_idx|duplicate/i.test(error?.message || "")
    ) {
      return res.status(409).json({
        message: "A visitor pass already exists for this phone number on the selected date."
      });
    }

    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/admin/login", async (req, res) => {
  if (!isAdminConfigured()) {
    return res
      .status(500)
      .json({ message: "Admin credentials are not configured on the server." });
  }

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const { username: adminUsername, passwordHash: adminPasswordHash } = getAdminCredentials();
  if (!adminUsername || !adminPasswordHash) {
    return res
      .status(500)
      .json({ message: "Admin credentials are not configured on the server." });
  }

  const validUser = secureCompare(
    username.toLowerCase(),
    adminUsername.toLowerCase()
  );
  
  let validPassword = false;
  try {
    validPassword = await bcrypt.compare(password, adminPasswordHash);
  } catch (err) {
    console.error("Error during password verification:", err);
    return res.status(500).json({ message: "Authentication service error." });
  }

  if (!validUser || !validPassword) {
    return res.status(401).json({ message: "Invalid admin username or password." });
  }

  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  adminSessions.set(token, { expiresAt });

  return res.json({
    token,
    expiresAt,
    expiresInSeconds: ADMIN_SESSION_TTL_SECONDS
  });
});

app.put("/api/admin/event-settings", requireAdminAuth, async (req, res) => {
  const normalSlots = Number(req.body?.normalSlots);
  const specialSlots = Number(req.body?.specialSlots);

  if (!Number.isFinite(normalSlots) || !Number.isFinite(specialSlots)) {
    return res.status(400).json({ message: "Volunteer counts are required." });
  }

  if (normalSlots < 0 || specialSlots < 0) {
    return res.status(400).json({ message: "Volunteer counts must be 0 or greater." });
  }

  try {
    const settings = await saveEventSettings(Math.floor(normalSlots), Math.floor(specialSlots));
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/admin/logout", requireAdminAuth, (req, res) => {
  adminSessions.delete(req.adminToken);
  return res.status(204).send();
});

app.get("/api/admin/attendance/:eventId", requireAdminAuth, async (req, res) => {
  try {
    ensureDatabaseSetup();
    ensureStorageSetup();
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return res.status(400).json({ message: "Invalid event id." });
    }

    const { rows } = await pool.query(
      `${ATTENDANCE_REGISTRATION_SELECT}
       WHERE er.event_id = $1
       ORDER BY er.created_at DESC`,
      [eventId]
    );

    const registrations = await Promise.all(
      rows.map((row) => buildAttendanceRegistrationRow(row))
    );

    return res.json({
      eventId,
      registrations
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/admin/attendance-dates", requireAdminAuth, async (_req, res) => {
  try {
    const rows = await getAttendanceRegistrations();
    const dateMap = new Map();

    rows.forEach((row) => {
      const eventDate = resolveRegistrationEventDate(row);
      if (!eventDate) {
        return;
      }

      const existingSummary = dateMap.get(eventDate) || {
        date: eventDate,
        registrations: 0
      };
      existingSummary.registrations += 1;
      dateMap.set(eventDate, existingSummary);
    });

    const dates = Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      dates,
      totals: {
        registrations: dates.reduce((acc, item) => acc + item.registrations, 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/admin/attendance-by-date/:date", requireAdminAuth, async (req, res) => {
  try {
    ensureStorageSetup();
    const dateString = String(req.params.date).trim();
    if (!validateIsoCalendarDate(dateString).isValid) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }

    const rows = await getAttendanceRegistrations();
    const matchingRows = rows.filter(
      (row) => resolveRegistrationEventDate(row) === dateString
    );

    const registrations = await Promise.all(
      matchingRows.map((row) =>
        buildAttendanceRegistrationRow(row, { eventDate: dateString })
      )
    );

    return res.json({
      date: dateString,
      registrations
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.put("/api/admin/attendance/:registrationId", requireAdminAuth, async (req, res) => {
  try {
    ensureDatabaseSetup();
    const registrationId = Number(req.params.registrationId);
    const attendanceStatus = String(req.body?.attendanceStatus || "").trim().toLowerCase();

    if (!Number.isFinite(registrationId) || registrationId <= 0) {
      return res.status(400).json({ message: "Invalid registration id." });
    }

    if (!["pending", "attended", "absent", "cancelled"].includes(attendanceStatus)) {
      return res.status(400).json({ message: "Invalid attendance status." });
    }

    // If status is cancelled, delete the registration record
    if (attendanceStatus === "cancelled") {
      const { rows: deletedRows } = await pool.query(
        `DELETE FROM event_registrations 
         WHERE id = $1
         RETURNING id, event_id, full_name, phone, attendance_status`,
        [registrationId]
      );

      if (deletedRows.length === 0) {
        return res.status(404).json({ message: "Registration not found." });
      }

      return res.json({ message: "Volunteer record deleted successfully.", deletedRecord: deletedRows[0] });
    }

    // For other statuses, update the attendance_status
    const { rows } = await pool.query(
      `UPDATE event_registrations 
       SET attendance_status = $1 
       WHERE id = $2
       RETURNING id, event_id, full_name, phone, attendance_status`,
      [attendanceStatus, registrationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Registration not found." });
    }

    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/admin/events-summary", requireAdminAuth, async (_req, res) => {
  try {
    ensureDatabaseSetup();
    const todayIsoDate = toIsoDateUTC(Date.now());
    const ongoingEvents = events.filter(
      (event) => event.status === "ongoing" && event.date >= todayIsoDate
    );
    const registrationMap = await getRegistrationCountMap(
      ongoingEvents.map((event) => event.id)
    );

    const summary = ongoingEvents
      .map((event) => {
        const registrations = registrationMap.get(event.id) || 0;
        return {
          id: event.id,
          title: event.title,
          titleTa: event.titleTa || null,
          date: event.date,
          location: event.location,
          totalSlots: event.slots,
          registrations,
          availableSlots: Math.max(0, event.slots - registrations)
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      events: summary,
      totals: {
        events: summary.length,
        registrations: summary.reduce(
          (acc, eventSummary) => acc + eventSummary.registrations,
          0
        )
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/admin/visitor-passes", requireAdminAuth, async (req, res) => {
  try {
    ensureVisitorPassStorageAvailable();

    const visitDate = String(req.query?.date || "").trim();
    if (visitDate && !isValidVisitDate(visitDate)) {
      return res.status(400).json({ message: "Enter a valid visit date." });
    }

    const registrations = await getVisitorPassRegistrationsList(visitDate);

    return res.json({
      registrations,
      totals: {
        registrations: registrations.length,
        visitDates: new Set(registrations.map((item) => item.dateOfVisit)).size
      },
      filters: {
        date: visitDate || null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/volunteers", async (_req, res) => {
  try {
    ensureStorageSetup();
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, skills, availability, status,
              photo_url, photo_path, photo_filename, photo_mime_type,
              photo_size_bytes, created_at
       FROM volunteers
       ORDER BY created_at DESC`
    );
    const volunteers = await Promise.all(rows.map((row) => mapVolunteerRow(row)));
    return res.json(volunteers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/temples", (_req, res) => {
  const templesWithCounts = temples.map((temple) => {
    const ongoingEventCount = events.filter(
      (event) => event.templeId === temple.id && event.status === "ongoing"
    ).length;
    return { ...temple, ongoingEventCount };
  });
  res.json(templesWithCounts);
});

app.post("/api/volunteers", upload.single("photo"), async (req, res) => {
  const { name, email, phone, availability } = req.body;
  const rawSkills = req.body.skills;
  const skills = Array.isArray(rawSkills)
    ? rawSkills
    : String(rawSkills || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required." });
  }

  try {
    ensureStorageSetup();
    let photoUrl = null;
    let photoPath = null;
    let photoFileName = null;
    let photoMimeType = null;
    let photoSizeBytes = null;

    if (req.file) {
      const extension = getFileExtension(req.file.originalname);
      photoFileName = req.file.originalname;
      photoMimeType = req.file.mimetype;
      photoSizeBytes = req.file.size;
      photoPath = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(photoPath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        return res
          .status(500)
          .json({ message: `Photo upload failed: ${uploadError.message}` });
      }

      photoUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${photoPath}`;
    }

    const { rows } = await pool.query(
      `INSERT INTO volunteers
        (name, email, phone, skills, availability, status,
         photo_url, photo_path, photo_filename, photo_mime_type, photo_size_bytes)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10)
       RETURNING id, name, email, phone, skills, availability, status,
                 photo_url, photo_path, photo_filename, photo_mime_type,
                 photo_size_bytes, created_at`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        (phone || "").trim(),
        skills,
        (availability || "Not specified").trim(),
        photoUrl,
        photoPath,
        photoFileName,
        photoMimeType,
        photoSizeBytes
      ]
    );

    return res.status(201).json(await mapVolunteerRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.patch("/api/volunteers/:id/toggle-status", async (req, res) => {
  try {
    ensureStorageSetup();
    const id = Number(req.params.id);
    const { rows: existingRows } = await pool.query(
      "SELECT id, status FROM volunteers WHERE id = $1",
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: "Volunteer not found." });
    }

    const nextStatus =
      existingRows[0].status === "active" ? "inactive" : "active";

    const { rows } = await pool.query(
      `UPDATE volunteers
       SET status = $2
       WHERE id = $1
       RETURNING id, name, email, phone, skills, availability, status,
                 photo_url, photo_path, photo_filename, photo_mime_type,
                 photo_size_bytes, created_at`,
      [id, nextStatus]
    );

    return res.json(await mapVolunteerRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete("/api/volunteers/:id", async (req, res) => {
  try {
    ensureStorageSetup();
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      "SELECT id, photo_path FROM volunteers WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Volunteer not found." });
    }

    const photoPath = rows[0].photo_path;
    await pool.query("DELETE FROM volunteers WHERE id = $1", [id]);

    if (photoPath) {
      const { error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .remove([photoPath]);
      if (error) {
        console.warn("Could not delete photo from storage:", error.message);
      }
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get(
  "/api/admin/attendance/:registrationId/kyc-document",
  requireAdminAuth,
  async (req, res) => {
    try {
      ensureDatabaseSetup();
      ensureStorageSetup();
      const registrationId = Number(req.params.registrationId);
      const disposition = String(req.query.disposition || "preview")
        .trim()
        .toLowerCase();

      if (!Number.isFinite(registrationId) || registrationId <= 0) {
        return res.status(400).json({ message: "Invalid registration id." });
      }

      if (!["preview", "download"].includes(disposition)) {
        return res.status(400).json({ message: "Invalid document disposition." });
      }

      const row = await getAttendanceRegistrationById(registrationId);
      if (!row || !row.kyc_storage_path) {
        return res
          .status(404)
          .json({ message: "No Aadhaar document is available for this registration." });
      }

      const mimeType = String(row.kyc_mime_type || "application/pdf").toLowerCase();
      const defaultExtension = mimeType.includes("png")
        ? "png"
        : mimeType.includes("jpeg") || mimeType.includes("jpg")
          ? "jpg"
          : "pdf";
      const defaultFileName =
        row.kyc_file_name ||
        `aadhaar-${row.volunteer_id || row.id}.${defaultExtension}`;
      const signedUrl = await createSignedStorageUrl(
        SUPABASE_DOCUMENTS_BUCKET,
        row.kyc_storage_path,
        {
          downloadFileName: disposition === "download" ? defaultFileName : ""
        }
      );

      if (!signedUrl) {
        return res
          .status(500)
          .json({ message: "Failed to generate document access URL." });
      }

      return res.json({
        registrationId,
        volunteerId: row.volunteer_id,
        disposition,
        fileName: defaultFileName,
        url: signedUrl
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

app.get("/api/volunteers/identity-document", async (req, res) => {
  try {
    ensureDatabaseSetup();
    const phone = normalizePhoneValue(req.query.phone || "");

    if (!phone) {
      return res.status(400).json({ message: "Phone is required." });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "Enter a valid phone number (10-15 digits)." });
    }

    const identity = await getVolunteerIdentityByPhone(phone);

    return res.json({
      phone,
      volunteerFound: Boolean(identity),
      aadhaarOnFile: Boolean(identity?.document),
      aadhaar: buildVolunteerDocumentSummary(identity?.document, {
        includeStatus: true
      })
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
app.get("/api/events/:id/registrations", async (req, res) => {
  try {
    ensureDatabaseSetup();
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return res.status(400).json({ message: "Invalid event id." });
    }

    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS registrations FROM event_registrations WHERE event_id = $1",
      [eventId]
    );
    const registrations = rows[0]?.registrations || 0;
    return res.json({ eventId, registrations });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/events/:id/register", upload.any(), async (req, res) => {
  const eventId = Number(req.params.id);
  const registrationType = String(req.body.registrationType || "individual")
    .trim()
    .toLowerCase();
  const isTeamRegistration = registrationType === "team";
  const city = String(req.body.city || "").trim();
  const state = String(req.body.state || "").trim();
  const country = String(req.body.country || "").trim();
  const pincode = String(req.body.pincode || "").trim();
  const teamName = String(req.body.teamName || "").trim();
  const teamLeadName = String(req.body.teamLeadName || "").trim();
  const teamLeadPhone = normalizePhoneValue(req.body.teamLeadPhone || "");
  const dateOfBirthRaw = String(req.body.dateOfBirth || "").trim();
  const requestedAadhaarAction = String(req.body.aadhaarAction || "")
    .trim()
    .toLowerCase();
  const aadhaarLast4 = String(req.body.aadhaarLast4 || "").trim();
  const aadhaarMasked =
    req.body.aadhaarMasked === "false" || req.body.aadhaarMasked === false
      ? false
      : true;
  const termsAccepted = req.body.termsAccepted === "true" || req.body.termsAccepted === true;
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  const fileMap = new Map(uploadedFiles.map((file) => [file.fieldname, file]));

  if (!termsAccepted) {
    return res.status(400).json({ message: "You must accept the terms and conditions to register." });
  }

  if (!["individual", "team"].includes(registrationType)) {
    return res.status(400).json({ message: "Invalid registration type." });
  }

  if (!state || !country || !pincode) {
    return res
      .status(400)
      .json({ message: "State, country, and pincode are required for registration." });
  }

  if (!isValidPincode(pincode)) {
    return res.status(400).json({ message: "Enter a valid pincode (4-10 digits)." });
  }

  const fallbackEventDate =
    getSyntheticEventDateFromId(eventId) || new Date().toISOString().split("T")[0];

  const targetEvent = events.find(
    (event) => event.id === eventId && event.status === "ongoing"
  ) || {
    id: eventId,
    title: "Volunteer Registration",
    titleTa: "தன்னார்வ தொண்டர் பதிவு",
    date: fallbackEventDate,
    location: "Temple Premises",
    slots: 999,
    status: "ongoing"
  };

  const participants = [];
  let teamId = null;

  if (isTeamRegistration) {
    let members = [];
    try {
      const parsedMembers = parseTeamMembers(req.body.members);
      if (parsedMembers === null) {
        return res
          .status(400)
          .json({ message: "Invalid team members format." });
      }
      members = parsedMembers;
    } catch (_error) {
      return res.status(400).json({ message: "Invalid team members format." });
    }

    if (!members.length || members.length < MIN_TEAM_MEMBERS) {
      return res.status(400).json({
        message: `Add at least ${MIN_TEAM_MEMBERS} team members to register as a team.`
      });
    }

    if (!teamName || !teamLeadName || !teamLeadPhone) {
      return res.status(400).json({
        message:
          "Team name, team lead name, and team lead phone are required for team registration."
      });
    }

    if (!isValidPhone(teamLeadPhone)) {
      return res
        .status(400)
        .json({ message: "Enter a valid phone number (10-15 digits)." });
    }

    for (const member of members) {
      const fullName = String(member?.fullName || "").trim();
      const normalizedPhone = normalizePhoneValue(member?.phone || "");
      const memberCity = String(member?.city || "").trim();
      const memberDob = String(member?.dateOfBirth || "").trim();
      const photoField = String(member?.photoField || "").trim();
      const memberPhoto = photoField ? fileMap.get(photoField) : null;

      if (!fullName || !normalizedPhone || !memberCity || !memberPhoto) {
        return res.status(400).json({
          message: "Each team member must include full name, phone, city, and photo."
        });
      }

      if (!isImageFile(memberPhoto)) {
        return res.status(400).json({ message: PHOTO_FILE_TYPE_ERROR_MESSAGE });
      }

      if (Number(memberPhoto.size) > MAX_PHOTO_SIZE_BYTES) {
        return res.status(400).json({ message: "Photo must be less than 5 MB in size." });
      }

      const validatedMemberDob = validateDateOfBirth(memberDob);
      if (!validatedMemberDob.isValid) {
        return res.status(400).json({ message: INVALID_DOB_ERROR_MESSAGE });
      }

      const memberAge = calculateAgeFromDateOfBirth(validatedMemberDob.normalized);
      if (memberAge === null) {
        return res.status(400).json({ message: INVALID_DOB_ERROR_MESSAGE });
      }

      if (memberAge < MIN_VOLUNTEER_AGE || memberAge > MAX_VOLUNTEER_AGE) {
        return res.status(400).json({ message: AGE_LIMIT_ERROR_MESSAGE });
      }

      if (!isValidPhone(normalizedPhone)) {
        return res
          .status(400)
          .json({ message: "Enter a valid phone number (10-15 digits)." });
      }

      participants.push({
        fullName,
        phone: normalizedPhone,
        city: memberCity,
        dateOfBirth: validatedMemberDob.normalized,
        photo: memberPhoto
      });
    }

    const uniquePhones = new Set(participants.map((participant) => participant.phone));
    if (uniquePhones.size !== participants.length) {
      return res
        .status(400)
        .json({ message: "Team member phone numbers must be unique." });
    }

    if (!uniquePhones.has(teamLeadPhone)) {
      return res
        .status(400)
        .json({ message: "Team lead phone must match one of the team members." });
    }

    teamId = crypto.randomUUID();
  } else {
    const fullName = String(req.body.fullName || "").trim();
    const normalizedPhone = normalizePhoneValue(req.body.phone || "");
    const individualPhoto = fileMap.get("photo");
    const individualAadhaarFile = fileMap.get("aadhaar");
    const dob = dateOfBirthRaw;

    if (!fullName || !normalizedPhone || !city || !individualPhoto) {
      return res.status(400).json({
        message: "Full name, phone, city, and photo are required for individual registration."
      });
    }

    if (!isImageFile(individualPhoto)) {
      return res.status(400).json({ message: PHOTO_FILE_TYPE_ERROR_MESSAGE });
    }

    if (Number(individualPhoto.size) > MAX_PHOTO_SIZE_BYTES) {
      return res.status(400).json({ message: "Photo must be less than 5 MB in size." });
    }

    if (!isValidPhone(normalizedPhone)) {
      return res
        .status(400)
        .json({ message: "Enter a valid phone number (10-15 digits)." });
    }

    const validatedDob = validateDateOfBirth(dob);
    if (!validatedDob.isValid) {
      return res.status(400).json({ message: INVALID_DOB_ERROR_MESSAGE });
    }

    const individualAge = calculateAgeFromDateOfBirth(validatedDob.normalized);
    if (individualAge === null) {
      return res.status(400).json({ message: INVALID_DOB_ERROR_MESSAGE });
    }

    if (individualAge < MIN_VOLUNTEER_AGE || individualAge > MAX_VOLUNTEER_AGE) {
      return res.status(400).json({ message: AGE_LIMIT_ERROR_MESSAGE });
    }

    participants.push({
      fullName,
      phone: normalizedPhone,
      city,
      dateOfBirth: validatedDob.normalized,
      photo: individualPhoto,
      aadhaarFile: individualAadhaarFile,
      aadhaarLast4,
      aadhaarMasked,
      requestedAadhaarAction
    });
  }

  try {
    ensureDatabaseSetup();
    ensureStorageSetup();

    const individualParticipant = !isTeamRegistration ? participants[0] : null;
    const existingIndividualIdentity = individualParticipant
      ? await getVolunteerIdentityByPhone(individualParticipant.phone)
      : null;
    const existingAadhaarDocument = existingIndividualIdentity?.document || null;
    const aadhaarMode = !individualParticipant
      ? "none"
      : existingAadhaarDocument && !individualParticipant.aadhaarFile && requestedAadhaarAction !== "update"
        ? "reuse"
        : existingAadhaarDocument
          ? "update"
          : "upload";

    if (individualParticipant && aadhaarMode !== "reuse") {
      if (!individualParticipant.aadhaarFile) {
        return res.status(400).json({
          message:
            aadhaarMode === "update"
              ? AADHAAR_UPDATE_REQUIRED_ERROR_MESSAGE
              : AADHAAR_REQUIRED_ERROR_MESSAGE
        });
      }

      if (!isSupportedAadhaarFile(individualParticipant.aadhaarFile)) {
        return res.status(400).json({ message: INVALID_AADHAAR_FILE_TYPE_ERROR_MESSAGE });
      }

      if (Number(individualParticipant.aadhaarFile.size) > MAX_AADHAAR_SIZE_BYTES) {
        return res.status(400).json({ message: AADHAAR_SIZE_ERROR_MESSAGE });
      }

      if (!isValidAadhaarLast4(individualParticipant.aadhaarLast4)) {
        return res.status(400).json({ message: INVALID_AADHAAR_LAST4_ERROR_MESSAGE });
      }
    }

    const participantPhones = participants.map((participant) => participant.phone);
    const { rows: existingRows } = await pool.query(
      `SELECT phone
       FROM event_registrations
       WHERE event_id = $1 AND phone = ANY($2::text[])
       LIMIT 1`,
      [eventId, participantPhones]
    );
    if (existingRows.length) {
      return res
        .status(409)
        .json({ message: "You are already registered for this event." });
    }

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*)::int AS registrations FROM event_registrations WHERE event_id = $1",
      [eventId]
    );
    const registrations = countRows[0]?.registrations || 0;
    const availableSlots = Math.max(0, targetEvent.slots - registrations);

    if (availableSlots < participants.length) {
      return res.status(400).json({ message: "No volunteer slots available." });
    }

    const uploadedPhotoPaths = [];
    const uploadedDocumentPaths = [];
    const participantPhotoMetadata = [];
    let aadhaarUploadMetadata = null;

    for (const participant of participants) {
      const extension = getFileExtension(participant.photo.originalname);
      const photoPath = isTeamRegistration
        ? `registrations/${eventId}/${teamId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
        : `registrations/${eventId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(photoPath, participant.photo.buffer, {
          contentType: participant.photo.mimetype,
          upsert: false
        });

      if (uploadError) {
        await removePhotosFromStorage(uploadedPhotoPaths);
        return res
          .status(500)
          .json({ message: `Photo upload failed: ${uploadError.message}` });
      }

      uploadedPhotoPaths.push(photoPath);
      participantPhotoMetadata.push({
        path: photoPath,
        fileName: participant.photo.originalname,
        mimeType: participant.photo.mimetype,
        sizeBytes: participant.photo.size
      });
    }

    if (individualParticipant && aadhaarMode !== "reuse") {
      const aadhaarFile = individualParticipant.aadhaarFile;
      const extension = getFileExtension(aadhaarFile.originalname);
      const aadhaarPath =
        `identity-documents/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: aadhaarUploadError } = await supabase.storage
        .from(SUPABASE_DOCUMENTS_BUCKET)
        .upload(aadhaarPath, aadhaarFile.buffer, {
          contentType: aadhaarFile.mimetype,
          upsert: false
        });

      if (aadhaarUploadError) {
        await removePhotosFromStorage(uploadedPhotoPaths);
        await removeDocumentsFromStorage(uploadedDocumentPaths);
        return res.status(500).json({
          message: `Aadhaar upload failed: ${aadhaarUploadError.message}`
        });
      }

      uploadedDocumentPaths.push(aadhaarPath);
      aadhaarUploadMetadata = {
        path: aadhaarPath,
        fileName: aadhaarFile.originalname,
        mimeType: aadhaarFile.mimetype,
        sizeBytes: aadhaarFile.size,
        documentLast4: individualParticipant.aadhaarLast4,
        isMasked: individualParticipant.aadhaarMasked
      };
    }

    let signedPhotoUrl = null;
    const signedPhotoIndex = isTeamRegistration
      ? participants.findIndex((participant) => participant.phone === teamLeadPhone)
      : 0;
    const signedPhotoPath =
      participantPhotoMetadata[Math.max(0, signedPhotoIndex)]?.path || null;

    if (signedPhotoPath) {
      const { data, error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(signedPhotoPath, SIGNED_URL_EXPIRES_IN);

      if (!error) {
        signedPhotoUrl = data.signedUrl;
      }
    }

    const dbClient = await pool.connect();
    const insertedRows = [];
    const previousAadhaarPath = existingAadhaarDocument?.storagePath || null;
    let finalAadhaarDocument = existingAadhaarDocument;
    let committed = false;

    try {
      await dbClient.query("BEGIN");
      await dbClient.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `${eventId}:registration`
      ]);

      const { rows: duplicateRows } = await dbClient.query(
        `SELECT phone
         FROM event_registrations
         WHERE event_id = $1 AND phone = ANY($2::text[])
         LIMIT 1`,
        [eventId, participantPhones]
      );
      if (duplicateRows.length) {
        await dbClient.query("ROLLBACK");
        await removePhotosFromStorage(uploadedPhotoPaths);
        await removeDocumentsFromStorage(uploadedDocumentPaths);
        return res
          .status(409)
          .json({ message: "You are already registered for this event." });
      }

      const { rows: lockedCountRows } = await dbClient.query(
        "SELECT COUNT(*)::int AS registrations FROM event_registrations WHERE event_id = $1",
        [eventId]
      );
      const lockedRegistrations = lockedCountRows[0]?.registrations || 0;
      const lockedAvailableSlots = Math.max(0, targetEvent.slots - lockedRegistrations);

      if (lockedAvailableSlots < participants.length) {
        await dbClient.query("ROLLBACK");
        await removePhotosFromStorage(uploadedPhotoPaths);
        await removeDocumentsFromStorage(uploadedDocumentPaths);
        return res.status(400).json({ message: "No volunteer slots available." });
      }

      const currentDate = new Date();
      for (let index = 0; index < participants.length; index += 1) {
        const participant = participants[index];

        const { rows: absentRegistrations } = await dbClient.query(
          `SELECT id, phone, event_id, registration_dates, created_at
           FROM event_registrations
           WHERE phone = $1 AND attendance_status = 'absent'
           ORDER BY created_at DESC`,
          [participant.phone]
        );

        for (const absentReg of absentRegistrations) {
          const absentEventDateIso = resolveRegistrationEventDate(absentReg);
          if (!absentEventDateIso) {
            continue;
          }

          const absentEventDate = new Date(`${absentEventDateIso}T00:00:00`);
          const oneYearFromAbsentEvent = new Date(absentEventDate);
          oneYearFromAbsentEvent.setFullYear(oneYearFromAbsentEvent.getFullYear() + 1);

          if (currentDate < oneYearFromAbsentEvent) {
            await dbClient.query("ROLLBACK");
            await removePhotosFromStorage(uploadedPhotoPaths);
            await removeDocumentsFromStorage(uploadedDocumentPaths);
            return res.status(400).json({
              message: `Registration blocked: This volunteer was absent on ${absentEventDateIso}. They are eligible to register again from ${absentEventDateIso.split('-').reverse().join('-')} (1 year from the absent event).`
            });
          }
        }
      }

      for (let index = 0; index < participants.length; index += 1) {
        const participant = participants[index];
        const photoMetadata = participantPhotoMetadata[index];
        const systemEmail = buildSystemRegistrationEmail(eventId, participant.phone);
        const eventDate = targetEvent.date || new Date().toISOString().split("T")[0];

        const { rows: existingVolunteerRows } = await dbClient.query(
          `SELECT volunteer_id, registration_dates
           FROM event_registrations
           WHERE phone = $1 AND volunteer_id IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 1`,
          [participant.phone]
        );

        let volunteerId = existingVolunteerRows[0]?.volunteer_id || null;
        let registrationDates = Array.isArray(existingVolunteerRows[0]?.registration_dates)
          ? [...existingVolunteerRows[0].registration_dates]
          : [];

        if (!volunteerId) {
          const { rows: idRows } = await dbClient.query(
            `SELECT generate_volunteer_id() as vol_id`
          );
          volunteerId = idRows[0]?.vol_id || "SPST0001";
        }

        if (!registrationDates.includes(eventDate)) {
          registrationDates.push(eventDate);
        }

        const { rows } = await dbClient.query(
          `INSERT INTO event_registrations
            (event_id, event_name, registration_type, team_id, team_name, team_lead_name,
             team_lead_phone, full_name, date_of_birth, email, phone, city, state, country, pincode,
             photo_path, photo_filename, photo_mime_type, photo_size_bytes, volunteer_id, registration_dates, terms_accepted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
           RETURNING id, event_id, event_name, registration_type, team_id, team_name,
                      team_lead_name, team_lead_phone, full_name, date_of_birth, phone, city, state, country,
                      pincode, photo_path, photo_filename, photo_mime_type, photo_size_bytes, volunteer_id, registration_dates, terms_accepted, created_at`,
          [
            eventId,
            targetEvent.title,
            registrationType,
            teamId,
            isTeamRegistration ? teamName : null,
            isTeamRegistration ? teamLeadName : null,
            isTeamRegistration ? teamLeadPhone : null,
            participant.fullName,
            participant.dateOfBirth,
            systemEmail,
            participant.phone,
            participant.city,
            state,
            country,
            pincode,
            photoMetadata.path,
            photoMetadata.fileName,
            photoMetadata.mimeType,
            photoMetadata.sizeBytes,
            volunteerId,
            registrationDates,
            termsAccepted
          ]
        );
        insertedRows.push(rows[0]);

        if (!isTeamRegistration && aadhaarUploadMetadata) {
          finalAadhaarDocument = await upsertVolunteerDocument({
            dbClient,
            volunteerId,
            phone: participant.phone,
            storagePath: aadhaarUploadMetadata.path,
            fileName: aadhaarUploadMetadata.fileName,
            mimeType: aadhaarUploadMetadata.mimeType,
            sizeBytes: aadhaarUploadMetadata.sizeBytes,
            documentLast4: aadhaarUploadMetadata.documentLast4,
            isMasked: aadhaarUploadMetadata.isMasked
          });
        }
      }

      await dbClient.query("COMMIT");
      committed = true;
    } catch (error) {
      try {
        await dbClient.query("ROLLBACK");
      } catch (_rollbackError) {
        // ignore rollback failure
      }
      if (!committed) {
        await removePhotosFromStorage(uploadedPhotoPaths);
        await removeDocumentsFromStorage(uploadedDocumentPaths);
      }
      return res.status(500).json({ message: error.message });
    } finally {
      dbClient.release();
    }

    if (
      aadhaarUploadMetadata &&
      previousAadhaarPath &&
      previousAadhaarPath !== aadhaarUploadMetadata.path
    ) {
      await removeDocumentsFromStorage([previousAadhaarPath]);
    }

    const firstRow = insertedRows[0];
    if (isTeamRegistration) {
      return res.status(201).json({
        registrationType,
        teamId: firstRow.team_id,
        eventId: firstRow.event_id,
        eventName: firstRow.event_name,
        teamName: firstRow.team_name,
        teamLeadName: firstRow.team_lead_name,
        teamLeadPhone: firstRow.team_lead_phone,
        volunteerId: firstRow.volunteer_id,
        registrationDates: firstRow.registration_dates || [],
        registeredCount: insertedRows.length,
        members: insertedRows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          phone: row.phone,
          city: row.city,
          volunteerId: row.volunteer_id
        })),
        signedPhotoUrl,
        createdAt: firstRow.created_at
      });
    }

    return res.status(201).json({
      registrationType: firstRow.registration_type,
      teamId: firstRow.team_id,
      teamName: firstRow.team_name,
      teamLeadName: firstRow.team_lead_name,
      teamLeadPhone: firstRow.team_lead_phone,
      volunteerId: firstRow.volunteer_id,
      registrationDates: firstRow.registration_dates || [],
      id: firstRow.id,
      eventId: firstRow.event_id,
      eventName: firstRow.event_name,
      fullName: firstRow.full_name,
      phone: firstRow.phone,
      city: firstRow.city,
      state: firstRow.state,
      country: firstRow.country,
      pincode: firstRow.pincode,
      photoMetadata: {
        path: firstRow.photo_path,
        fileName: firstRow.photo_filename,
        mimeType: firstRow.photo_mime_type,
        sizeBytes: firstRow.photo_size_bytes
      },
      aadhaarDocument: finalAadhaarDocument
        ? {
            ...buildVolunteerDocumentSummary(finalAadhaarDocument, {
              includeStatus: true
            }),
            reusedExisting: aadhaarMode === "reuse"
          }
        : null,
      signedPhotoUrl,
      createdAt: firstRow.created_at
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ message: "Uploaded file must be less than 10 MB in size." });
  }
  return res.status(500).json({ message: error.message || "Server error." });
});

async function startServer() {
  try {
    // Initialize database schema in the background
    ensureDatabaseSchema().catch(error => {
      console.error("Database initialization failed:", error.message);
    });
  } catch (error) {
    console.error("Database initialization error:", error.message);
  }

  app.listen(PORT, () => {
    console.log(`Volunteer API running on http://localhost:${PORT}`);
  });
}

startServer();












