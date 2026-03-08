import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import crypto from "node:crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 5000;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_TEAM_MEMBERS = 2;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES }
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
const signedUrlExpiresRaw = Number(
  process.env.SUPABASE_SIGNED_URL_EXPIRES_IN || 3600
);
const SIGNED_URL_EXPIRES_IN =
  Number.isFinite(signedUrlExpiresRaw) && signedUrlExpiresRaw > 0
    ? signedUrlExpiresRaw
    : 3600;
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const adminSessionTtlRaw = Number(process.env.ADMIN_SESSION_TTL_SECONDS || 43200);
const ADMIN_SESSION_TTL_SECONDS =
  Number.isFinite(adminSessionTtlRaw) && adminSessionTtlRaw > 0
    ? Math.floor(adminSessionTtlRaw)
    : 43200;
const adminSessions = new Map();
const SYNODIC_MONTH_MS = 29.530588861 * 24 * 60 * 60 * 1000;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const ACTIVE_YEAR = new Date().getFullYear();

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
  return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD);
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

async function removePhotoFromStorage(photoPath) {
  if (!photoPath || !supabase) {
    return;
  }

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove([photoPath]);

  if (error) {
    console.warn("Failed to remove uploaded photo:", error.message);
  }
}

async function removePhotosFromStorage(photoPaths = []) {
  const uniquePaths = [...new Set(photoPaths.filter(Boolean))];
  for (const photoPath of uniquePaths) {
    await removePhotoFromStorage(photoPath);
  }
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

app.post("/api/admin/login", (req, res) => {
  if (!isAdminConfigured()) {
    return res
      .status(500)
      .json({ message: "Admin credentials are not configured on the server." });
  }

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const validUser = secureCompare(
    username.toLowerCase(),
    ADMIN_USERNAME.toLowerCase()
  );
  const validPassword = secureCompare(password, ADMIN_PASSWORD);
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

app.post("/api/admin/logout", requireAdminAuth, (req, res) => {
  adminSessions.delete(req.adminToken);
  return res.status(204).send();
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

app.get("/api/events", async (req, res) => {
  const { templeId } = req.query;
  const filtered = templeId
    ? events.filter((event) => event.templeId === Number(templeId))
    : events;

  try {
    ensureDatabaseSetup();
    const registrationMap = await getRegistrationCountMap(
      filtered.map((event) => event.id)
    );

    return res.json(
      filtered.map((event) => {
        const registrations = registrationMap.get(event.id) || 0;
        return {
          ...event,
          registrations,
          slots: Math.max(0, event.slots - registrations)
        };
      })
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/temples/:id/events", async (req, res) => {
  const templeId = Number(req.params.id);
  const templeExists = temples.some((temple) => temple.id === templeId);

  if (!templeExists) {
    return res.status(404).json({ message: "Temple not found." });
  }

  try {
    ensureDatabaseSetup();
    const templeEvents = events.filter(
      (event) => event.templeId === templeId && event.status === "ongoing"
    );
    const registrationMap = await getRegistrationCountMap(
      templeEvents.map((event) => event.id)
    );

    const eventsWithCounts = templeEvents.map((event) => {
      const registrations = registrationMap.get(event.id) || 0;
      return {
        ...event,
        registrations,
        slots: Math.max(0, event.slots - registrations)
      };
    });

    return res.json(eventsWithCounts);
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
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  const fileMap = new Map(uploadedFiles.map((file) => [file.fieldname, file]));

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

  const targetEvent = events.find(
    (event) => event.id === eventId && event.status === "ongoing"
  );

  if (!targetEvent) {
    return res.status(404).json({ message: "Ongoing event not found." });
  }

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
      const photoField = String(member?.photoField || "").trim();
      const memberPhoto = photoField ? fileMap.get(photoField) : null;

      if (!fullName || !normalizedPhone || !memberCity || !memberPhoto) {
        return res.status(400).json({
          message: "Each team member must include full name, phone, city, and photo."
        });
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

    if (!fullName || !normalizedPhone || !city || !individualPhoto) {
      return res.status(400).json({
        message: "Full name, phone, city, and photo are required for individual registration."
      });
    }

    if (!isValidPhone(normalizedPhone)) {
      return res
        .status(400)
        .json({ message: "Enter a valid phone number (10-15 digits)." });
    }

    participants.push({
      fullName,
      phone: normalizedPhone,
      city,
      photo: individualPhoto
    });
  }

  try {
    ensureDatabaseSetup();
    ensureStorageSetup();

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
    const participantPhotoMetadata = [];
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
    let committed = false;
    try {
      await dbClient.query("BEGIN");
      // Serializes all registrations per event to avoid slot-race conditions.
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
        return res.status(400).json({ message: "No volunteer slots available." });
      }

      for (let index = 0; index < participants.length; index += 1) {
        const participant = participants[index];
        const photoMetadata = participantPhotoMetadata[index];
        const systemEmail = buildSystemRegistrationEmail(eventId, participant.phone);
        const { rows } = await dbClient.query(
          `INSERT INTO event_registrations
            (event_id, event_name, registration_type, team_id, team_name, team_lead_name,
             team_lead_phone, full_name, email, phone, city, state, country, pincode,
             photo_path, photo_filename, photo_mime_type, photo_size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           RETURNING id, event_id, event_name, registration_type, team_id, team_name,
                      team_lead_name, team_lead_phone, full_name, phone, city, state, country,
                      pincode, photo_path, photo_filename, photo_mime_type, photo_size_bytes, created_at`,
          [
            eventId,
            targetEvent.title,
            registrationType,
            teamId,
            isTeamRegistration ? teamName : null,
            isTeamRegistration ? teamLeadName : null,
            isTeamRegistration ? teamLeadPhone : null,
            participant.fullName,
            systemEmail,
            participant.phone,
            participant.city,
            state,
            country,
            pincode,
            photoMetadata.path,
            photoMetadata.fileName,
            photoMetadata.mimeType,
            photoMetadata.sizeBytes
          ]
        );
        insertedRows.push(rows[0]);
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
      }
      return res.status(500).json({ message: error.message });
    } finally {
      dbClient.release();
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
        registeredCount: insertedRows.length,
        members: insertedRows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          phone: row.phone,
          city: row.city
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
      .json({ message: "Photo must be less than 5 MB in size." });
  }
  return res.status(500).json({ message: error.message || "Server error." });
});

app.listen(PORT, () => {
  console.log(`Volunteer API running on http://localhost:${PORT}`);
});
