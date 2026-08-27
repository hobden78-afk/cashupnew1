import { SheetRecord } from '../types';
import { calculateGrandTotals, formatCurrency } from '../utils/calculations';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
}

// Fetch list of upcoming calendar events
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  maxResults = 15
): Promise<CalendarEvent[]> {
  try {
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Last 30 days
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', timeMin);
    url.searchParams.append('maxResults', maxResults.toString());
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Calendar API error (${res.status})`);
    }

    const data = await res.json();
    return data.items || [];
  } catch (err: any) {
    console.error('Error fetching Google Calendar events:', err);
    throw err;
  }
}

// Create a Google Calendar event for a completed / reconciled Till Cashing Sheet
export async function createTillCashingCalendarEvent(
  accessToken: string,
  record: SheetRecord
): Promise<CalendarEvent> {
  const totals = calculateGrandTotals(record.rows, record);
  const ukDateStr = new Date(record.date).toLocaleDateString('en-GB');

  // Format description with detailed cashing audit summary
  const summaryText = `[Till Cashing] ${ukDateStr} - Net Takings: ${formatCurrency(totals.totalCol7Actual)}`;
  
  const descriptionLines = [
    `📊 Daily Till Cashing Audit Record`,
    `----------------------------------------`,
    `📅 Date: ${ukDateStr}`,
    `👤 Operator: ${record.operator || 'Unassigned'}`,
    `🔒 Status: ${record.isSaved ? 'SAVED & LOCKED' : 'DRAFT'}`,
    ``,
    `💰 Actual Net Takings: ${formatCurrency(totals.totalCol7Actual)}`,
    `💵 Banking Cash: ${formatCurrency(totals.totalCol4Banking)}`,
    `💳 Actual Card: ${formatCurrency(totals.totalCol6Card)}`,
    `🪙 Float Retained: ${formatCurrency(totals.totalCol5Float)}`,
    `⚖️ Total Variance: ${formatCurrency(totals.totalVariance)}`,
    ``,
    `📝 Notes: ${record.notes || 'No extra notes recorded.'}`,
    `----------------------------------------`,
    `Synced via Daily Till Reconciliation App`
  ];

  // Set event start and end time (e.g. 17:00 to 17:30 on the record's date)
  const eventDate = record.date || new Date().toISOString().split('T')[0];
  const startDateTime = `${eventDate}T17:00:00Z`;
  const endDateTime = `${eventDate}T17:30:00Z`;

  const eventPayload = {
    summary: summaryText,
    description: descriptionLines.join('\n'),
    start: {
      dateTime: startDateTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'UTC',
    },
    colorId: totals.totalVariance < 0 ? '11' : totals.totalVariance > 0 ? '5' : '10', // Red for shortage, Yellow for excess, Green for balanced
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to create Google Calendar event (${res.status})`);
  }

  return await res.json();
}

// Schedule a recurring daily Cashing Up Reminder in Google Calendar
export async function createDailyCashingReminder(
  accessToken: string,
  timeStr: string = '17:00'
): Promise<CalendarEvent> {
  const today = new Date().toISOString().split('T')[0];
  const startDateTime = `${today}T${timeStr}:00Z`;
  
  // End 15 mins later
  const endDateObj = new Date(new Date(startDateTime).getTime() + 15 * 60 * 1000);
  const endDateTime = endDateObj.toISOString();

  const eventPayload = {
    summary: '⏰ Daily Till Cashing Up Audit Reminder',
    description: 'Reminder to perform end-of-day till reconciliation and cashing up audit.',
    start: {
      dateTime: startDateTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'UTC',
    },
    recurrence: ['RRULE:FREQ=DAILY'],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
        { method: 'email', minutes: 30 },
      ],
    },
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to create reminder event (${res.status})`);
  }

  return await res.json();
}

// Delete event from Google Calendar
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to delete calendar event (${res.status})`);
  }
}
