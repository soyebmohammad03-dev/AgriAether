export type LanguageCode = 'en' | 'hi';

export const AVAILABLE_LANGUAGES: ReadonlyArray<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' }
];

/**
 * Static UI-chrome labels only — headers, section names, status words,
 * button text. Dynamic agricultural content (recommendation rationale,
 * insight text built in farmer/FarmerInsights.ts) is deliberately NOT
 * routed through this dictionary: the Phase 13 brief is explicit that
 * machine-generated translation of safety-relevant agricultural advice
 * must not happen without review, so that text stays English until a
 * reviewed translation pipeline exists. Add a language by adding one more
 * key to this record — no other code changes needed.
 */
const STRINGS: Record<LanguageCode, Record<string, string>> = {
  en: {
    'farmer.title': 'Farm Overview',
    'farmer.conditions': 'Current Conditions',
    'farmer.changes': 'Recent Changes',
    'farmer.opportunities': 'Recommended Actions',
    'farmer.tasks': 'Tasks',
    'farmer.mission': 'Drone Activity',
    'farmer.dataQuality': 'Data Quality',
    'farmer.missingInfo': 'What We Need From You',
    'farmer.offline': 'Offline / Sync Status',
    'status.open': 'Open',
    'status.inProgress': 'In Progress',
    'status.completed': 'Completed',
    'status.dismissed': 'Dismissed',
    'sync.local': 'Saved on this device',
    'sync.synced': 'Synced',
    'sync.pending': 'Waiting to sync',
    'sync.stale': 'May be out of date',
    'sync.error': 'Sync error',
    'action.markInProgress': 'Start',
    'action.markComplete': 'Mark Done',
    'action.dismiss': 'Dismiss'
  },
  hi: {
    'farmer.title': 'खेत का विवरण',
    'farmer.conditions': 'मौजूदा स्थिति',
    'farmer.changes': 'हाल के बदलाव',
    'farmer.opportunities': 'सुझाए गए कार्य',
    'farmer.tasks': 'कार्य सूची',
    'farmer.mission': 'ड्रोन गतिविधि',
    'farmer.dataQuality': 'डेटा गुणवत्ता',
    'farmer.missingInfo': 'हमें आपसे क्या चाहिए',
    'farmer.offline': 'ऑफ़लाइन / सिंक स्थिति',
    'status.open': 'खुला',
    'status.inProgress': 'प्रगति पर',
    'status.completed': 'पूर्ण',
    'status.dismissed': 'खारिज',
    'sync.local': 'इस डिवाइस पर सहेजा गया',
    'sync.synced': 'सिंक हो गया',
    'sync.pending': 'सिंक होना बाकी है',
    'sync.stale': 'पुराना हो सकता है',
    'sync.error': 'सिंक में त्रुटि',
    'action.markInProgress': 'शुरू करें',
    'action.markComplete': 'पूर्ण करें',
    'action.dismiss': 'खारिज करें'
  }
};

/** Falls back to English, then to the raw key, so a missing translation is visible/debuggable rather than blank. */
export function t(key: string, lang: LanguageCode): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
