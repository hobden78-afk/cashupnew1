import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  X, 
  RefreshCw, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Bell, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initGoogleAuth, googleSignIn, googleLogout, getAccessToken } from '../lib/googleAuth';
import { 
  fetchGoogleCalendarEvents, 
  createTillCashingCalendarEvent, 
  createDailyCashingReminder, 
  deleteCalendarEvent,
  CalendarEvent 
} from '../lib/googleCalendar';
import { SheetRecord } from '../types';
import { calculateGrandTotals, formatCurrency, formatToUKDate } from '../utils/calculations';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRecord: SheetRecord;
  allRecords?: SheetRecord[];
}

export const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({
  isOpen,
  onClose,
  currentRecord,
  allRecords = [],
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSyncingCurrent, setIsSyncingCurrent] = useState(false);
  const [isSettingReminder, setIsSettingReminder] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reminderTime, setReminderTime] = useState('17:00');

  // Initialize auth state listener
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initGoogleAuth(
      (u, token) => {
        setUser(u);
        setAccessToken(token);
        setIsLoadingAuth(false);
        loadEvents(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setIsLoadingAuth(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isOpen]);

  const loadEvents = async (token: string) => {
    setIsLoadingEvents(true);
    try {
      const items = await fetchGoogleCalendarEvents(token);
      setEvents(items);
    } catch (err: any) {
      console.error('Failed to load events:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setStatusMessage({ type: 'success', text: `Signed in as ${res.user.email}` });
        loadEvents(res.accessToken);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Google Sign-In failed.' });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleLogout();
      setUser(null);
      setAccessToken(null);
      setEvents([]);
      setStatusMessage({ type: 'success', text: 'Signed out of Google Calendar.' });
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleSyncCurrentSheet = async () => {
    const token = accessToken || getAccessToken();
    if (!token) {
      setStatusMessage({ type: 'error', text: 'Please sign in with Google first.' });
      return;
    }

    const totals = calculateGrandTotals(currentRecord.rows, currentRecord, allRecords);
    const ukDate = formatToUKDate(currentRecord.date);

    // Mandatory user confirmation before writing calendar data
    const confirmed = window.confirm(
      `Sync this till cashing sheet to Google Calendar?\n\nDate: ${ukDate}\nNet Takings: ${formatCurrency(totals.totalCol7Actual)}\nVariance: ${formatCurrency(totals.totalVariance)}`
    );

    if (!confirmed) return;

    setIsSyncingCurrent(true);
    setStatusMessage(null);

    try {
      const newEvent = await createTillCashingCalendarEvent(token, currentRecord);
      setStatusMessage({ 
        type: 'success', 
        text: `Successfully synced record for ${ukDate} to Google Calendar!` 
      });
      loadEvents(token);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to sync to Google Calendar.' });
    } finally {
      setIsSyncingCurrent(false);
    }
  };

  const handleScheduleReminder = async () => {
    const token = accessToken || getAccessToken();
    if (!token) {
      setStatusMessage({ type: 'error', text: 'Please sign in with Google first.' });
      return;
    }

    const confirmed = window.confirm(
      `Schedule a daily recurring Google Calendar reminder at ${reminderTime} UTC for Till Cashing Up?`
    );

    if (!confirmed) return;

    setIsSettingReminder(true);
    setStatusMessage(null);

    try {
      await createDailyCashingReminder(token, reminderTime);
      setStatusMessage({
        type: 'success',
        text: `Daily Cashing Up Reminder set for ${reminderTime} in Google Calendar!`,
      });
      loadEvents(token);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to schedule reminder.' });
    } finally {
      setIsSettingReminder(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventSummary: string) => {
    const token = accessToken || getAccessToken();
    if (!token) return;

    // Explicit confirmation for destructive operation
    const confirmed = window.confirm(
      `Are you sure you want to delete "${eventSummary}" from Google Calendar?`
    );

    if (!confirmed) return;

    try {
      await deleteCalendarEvent(token, eventId);
      setStatusMessage({ type: 'success', text: 'Event removed from Google Calendar.' });
      loadEvents(token);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete event.' });
    }
  };

  if (!isOpen) return null;

  const currentTotals = calculateGrandTotals(currentRecord.rows, currentRecord, allRecords);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:hidden">
      <div className="bg-white border-2 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400 text-black border border-black font-bold rounded">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif italic text-lg sm:text-xl font-bold flex items-center gap-2">
                Google Calendar Sync
              </h3>
              <p className="text-xs text-zinc-400">
                Schedule daily audit events & shift cashing reminders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-black">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div className={`p-3 border-2 border-black flex items-center gap-2.5 text-xs font-bold ${
              statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Authentication Section */}
          <div className="bg-zinc-50 border-2 border-black p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {user ? (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full border border-black shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-400 border border-black flex items-center justify-center font-bold text-black shrink-0">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-black">{user.displayName || 'Google Account'}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase rounded">Connected</span>
                  </div>
                  <p className="text-xs text-zinc-600 font-mono">{user.email}</p>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-bold text-sm text-black">Connect Google Calendar</h4>
                <p className="text-xs text-zinc-600">Sign in to enable syncing till records directly to your Google Calendar.</p>
              </div>
            )}

            <div>
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-xs uppercase tracking-wider border-2 border-black cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  {isSigningIn ? 'Signing In...' : 'Sign in with Google'}
                </button>
              )}
            </div>
          </div>

          {user && (
            <>
              {/* Quick Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sync Current Active Sheet Card */}
                <div className="border-2 border-black p-4 bg-amber-50/50 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 bg-amber-200 px-1.5 py-0.5 border border-black">
                        Active Sheet
                      </span>
                      <span className="font-mono text-xs font-bold">{formatToUKDate(currentRecord.date)}</span>
                    </div>
                    <h4 className="font-serif italic font-bold text-base mt-2">Sync Current Record</h4>
                    <p className="text-xs text-zinc-600 mt-1">
                      Exports Net Takings ({formatCurrency(currentTotals.totalCol7Actual)}) and full audit summary to primary Google Calendar.
                    </p>
                  </div>

                  <button
                    onClick={handleSyncCurrentSheet}
                    disabled={isSyncingCurrent}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-black hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    {isSyncingCurrent ? 'Syncing...' : 'Sync Sheet to Calendar'}
                  </button>
                </div>

                {/* Daily Reminder Setup Card */}
                <div className="border-2 border-black p-4 bg-blue-50/50 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-800 bg-blue-200 px-1.5 py-0.5 border border-black">
                        Automation
                      </span>
                      <Bell className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="font-serif italic font-bold text-base mt-2">Daily Audit Reminder</h4>
                    <p className="text-xs text-zinc-600 mt-1">
                      Sets up a daily recurring reminder in Google Calendar for staff cashing up.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="bg-white border-2 border-black font-mono font-bold text-xs px-2 py-1.5 focus:outline-none"
                    />
                    <button
                      onClick={handleScheduleReminder}
                      disabled={isSettingReminder}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {isSettingReminder ? 'Setting...' : 'Schedule Reminder'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Calendar Events List */}
              <div className="border-2 border-black p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <h4 className="font-serif italic font-bold text-base flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-zinc-700" />
                    Google Calendar Entries
                  </h4>
                  <button
                    onClick={() => accessToken && loadEvents(accessToken)}
                    disabled={isLoadingEvents}
                    className="p-1 hover:bg-zinc-100 border border-black transition-colors cursor-pointer"
                    title="Refresh Calendar Events"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {isLoadingEvents ? (
                  <div className="py-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2 font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    Fetching Google Calendar events...
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500 italic">
                    No upcoming till cashing events found in Google Calendar.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200 max-h-60 overflow-y-auto pr-1">
                    {events.map((evt) => {
                      const startStr = evt.start.dateTime || evt.start.date;
                      const formattedDate = startStr 
                        ? new Date(startStr).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                        : 'All day';

                      return (
                        <div key={evt.id} className="py-2.5 flex items-start justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-black truncate">{evt.summary}</span>
                            </div>
                            <p className="text-[11px] font-mono text-zinc-500">{formattedDate}</p>
                            {evt.description && (
                              <p className="text-[11px] text-zinc-600 line-clamp-1">{evt.description.split('\n')[0]}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {evt.htmlLink && (
                              <a
                                href={evt.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 hover:bg-zinc-100 text-zinc-600 border border-zinc-300 transition-colors"
                                title="Open in Google Calendar"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteEvent(evt.id, evt.summary)}
                              className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-zinc-300 transition-colors cursor-pointer"
                              title="Delete Event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-zinc-100 p-3 sm:p-4 border-t-2 border-black flex items-center justify-between text-xs text-zinc-600">
          <span className="font-medium">Google Calendar Workspace API v3</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black hover:bg-zinc-800 text-white font-extrabold uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
