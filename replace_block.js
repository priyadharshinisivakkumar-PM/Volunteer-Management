
const fs = require( fs);
const path =  frontend/src/App.jsx;
const lines = fs.readFileSync(path,  utf8).split(\r\n);
const oldBlock = [
  const isAdminLoginScreen = activeScreen ===  admin-login;
  const isAdminDashboardScreen = activeScreen ===  admin-dashboard;
  const isEventsScreen = activeScreen ===  events && Boolean(selectedMoonDate);
  const isSpecialEventSelection = selectedCardType ===  special;
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
];

const start = lines.findIndex((line, idx) =>
  line === oldBlock[0] && oldBlock.every((entry, offset) =>
    lines[idx + offset] === entry));
if (start === -1) { throw new Error( old block not found); }
const end = start + oldBlock.length;

const replacement = [
  const isAdminLoginScreen = activeScreen ===  admin-login;
  const isAdminDashboardScreen = activeScreen ===  admin-dashboard;
  const isEventsScreen = activeScreen ===  events && Boolean(selectedMoonDate);
  const isSpecialEventSelection = selectedCardType ===  special;
  const todayIsoDate = toIsoDateUTC(Date.now());
  const eventsForSelectedDate = useMemo(() => {
    if (!selectedMoonDate) {
      return [];
    }
    return templeEvents.filter(
      (event) =>
        event.templeId === TEMPLE_ID &&
        event.status ===  ongoing &&
        event.date === selectedMoonDate
    );
  }, [selectedMoonDate, templeEvents]);

  const aggregatedAvailableSlots = eventsForSelectedDate.reduce(
    (total, event) => total + (Number(event.slots) || 0),
    0
  );
  const aggregatedRegisteredCount = eventsForSelectedDate.reduce(
    (total, event) => total + (Number(event.registrations) || 0),
    0
  );
  const primaryEventForDate =
    eventsForSelectedDate.find((event) => Number(event.slots) > 0) ||
    eventsForSelectedDate[0] ||
    null;
  const isSelectedDateFullyBooked =
    eventsForSelectedDate.length > 0 &&
    eventsForSelectedDate.every((event) => Number(event.slots) <= 0);
];
const newLines = [...lines.slice(0, start), ...replacement, ...lines.slice(end)];
fs.writeFileSync(path, newLines.join( \r\n), utf8);
