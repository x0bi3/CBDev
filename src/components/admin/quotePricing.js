// Pricing model + quote math ported from sales_resources/tools/pricing-calculator.html.
// Prices are internal (USD dollars). Line items are { n: label, p: dollars, u?: unit }.

export const P = {
  web: {
    personal: {
      presence: { n: 'Presence', b: 50, m: 9.99, y: 99.99 },
      creator: { n: 'Creator', b: 250, m: 19.99, y: 199.99, fee: '3%' },
      'studio-plus': { n: 'Studio+', b: 1000, m: 49.99, y: 499.99, fee: '1%' },
    },
    business: {
      starter: { n: 'Starter', b: 499, m: 9.99, y: 99.99 },
      standard: { n: 'Standard', b: 999, m: 19.99, y: 199.99, fee: '3%' },
      growth: { n: 'Growth', b: 1499, m: 49.99, y: 499.99, fee: '1%' },
    },
    add: {
      bookingBasic: 30, bookingAdvanced: 50, ecommerceSimple: 75, ecommerceCatalog: 150, ecommerceFull: 300,
      blogSetup: 50, blogPost: 25, customerPortal: 150, imageGallery: 35, testimonials: 30, faq: 20,
      googleAnalytics: 15, emailIntegration: 25, crmBasic: 50, liveChat: 20, mapsIntegration: 20,
      copywritingSection: 50, logoBasic: 100, logoPremium: 250,
    },
  },
  soft: {
    tiers: {
      'quick-fix': { n: 'Quick Fix', min: 49, max: 299 },
      'small-tool': { n: 'Small Tool', min: 299, max: 999 },
      'business-app': { n: 'Business App', min: 999, max: 2500 },
      'full-custom': { n: 'Full Custom', min: 2500, max: 10000 },
    },
    add: {
      userRegistration: 75, userLogin: 50, userRolesBasic: 50, searchBasic: 50, reportingBasic: 75,
      pdfGeneration: 75, emailNotifications: 30, fileUpload: 50, apiRead: 100, stripePayments: 100,
      responsiveDesign: 100, customBranding: 50,
    },
  },
  mobile: {
    tiers: {
      starter: { n: 'Starter', min: 1000, max: 2500 },
      standard: { n: 'Standard', min: 2500, max: 4000 },
      premium: { n: 'Premium', min: 4000, max: 5000 },
    },
    add: {
      socialLoginGoogle: 75, socialLoginApple: 100, phoneLogin: 150, biometricLogin: 100, userProfile: 75,
      pushNotificationsBasic: 100, inAppChat: 200, cameraIntegration: 100, mapDisplay: 75, userLocation: 75,
      offlineMode: 200, stripePayments: 150, inAppPurchases: 200, subscriptions: 300, adminDashboardBasic: 500,
      adminDashboardFull: 1000, appStoreAssets: 175, appSubmission: 150,
    },
  },
  integ: {
    sys: { stripe: 150, quickbooks: 400, hubspot: 250, mailchimp: 150, googleSheets: 100, slack: 100, shopify: 300, airtable: 150 },
    add: { realTimeSync: 100, biDirectional: 150, errorHandling: 75, logging: 50, historicalBackfill: 100, documentation: 50 },
  },
  consult: {
    pkg: {
      'blitz-call': { n: 'Blitz Call', p: 20, u: '30min' },
      essentials: { n: 'Essentials', p: 99, u: 'mo' },
      growth: { n: 'Growth', p: 250, u: 'mo' },
      dedicated: { n: 'Dedicated', p: 999, u: 'mo' },
    },
    audit: { websiteBasic: 150, websiteFull: 300, codeReviewSmall: 150, codeReviewLarge: 350, securityAudit: 400, seoAudit: 250 },
  },
};

export const CATEGORIES = [
  { id: 'website', l: 'Website', d: 'New site or redesign' },
  { id: 'software', l: 'Custom Software', d: 'Business tools & apps' },
  { id: 'mobile', l: 'Mobile App', d: 'iOS, Android, or both' },
  { id: 'integrations', l: 'Integrations', d: 'Connect systems together' },
  { id: 'consulting', l: 'Consulting', d: 'Ongoing support & audits' },
];

export const Q = {
  website: [
    { id: 'audience', q: 'Who is this website for?', sub: 'Determines pricing tiers and typical feature sets.', t: 'single', opts: [
      { v: 'personal', l: 'Personal & Hobby', d: 'Creators, side projects, personal brands' },
      { v: 'business', l: 'Business & Professional', d: 'Local shops, service companies, founders' },
    ] },
    { id: 'websiteType', q: 'New site or redesign?', t: 'single', opts: [
      { v: 'new', l: 'Brand New Website', d: 'Starting from scratch with a fresh design' },
      { v: 'redesign', l: 'Redesign Existing Site', d: 'Updating or rebuilding your current website' },
    ] },
    { id: 'businessType', q: 'What type of business/project?', t: 'single', opts: [
      { v: 'service', l: 'Service Business', d: 'You provide a service to customers' },
      { v: 'retail', l: 'Retail/Restaurant', d: 'Physical location customers visit' },
      { v: 'ecommerce', l: 'E-commerce', d: 'Selling products online' },
      { v: 'portfolio', l: 'Portfolio/Creative', d: 'Showcasing your work or art' },
      { v: 'nonprofit', l: 'Non-profit', d: 'Organization or cause-based' },
      { v: 'other', l: 'Other', d: 'Something different' },
    ] },
    { id: 'sectionCount', q: 'How many sections?', sub: 'A section is a distinct area: Hero, About, Services, Testimonials, FAQ, Contact, etc.', t: 'single', opts: [
      { v: '1-3', l: '1-3 Sections', d: 'Simple landing or minimal site' },
      { v: '4-5', l: '4-5 Sections', d: 'Standard small business site' },
      { v: '6-8', l: '6-8 Sections', d: 'More comprehensive coverage' },
      { v: '9+', l: '9+ Sections', d: 'Large, content-rich site' },
    ] },
    { id: 'features', q: 'What features do you need?', sub: 'Select all that apply.', t: 'multi', opts: [
      { v: 'contactForm', l: 'Contact Form', d: 'Let visitors send you messages', inc: 1 },
      { v: 'booking', l: 'Booking/Scheduling', d: 'Let customers book appointments online', noCharge: 1 },
      { v: 'ecommerce', l: 'E-commerce / Online Store', d: 'Sell products and services online', noCharge: 1 },
      { v: 'blog', l: 'Blog', d: 'Publish articles and updates' },
      { v: 'gallery', l: 'Image Gallery', d: 'Showcase photos and visual work', add: 'imageGallery' },
      { v: 'portal', l: 'Customer Portal', d: 'Members-only login area', add: 'customerPortal' },
      { v: 'testimonials', l: 'Testimonials', d: 'Display customer reviews', add: 'testimonials' },
      { v: 'faq', l: 'FAQ Section', d: 'Answer common questions', add: 'faq' },
    ] },
    { id: 'ecommerceSize', q: 'How large is your product catalog?', t: 'single', showIf: { features: 'ecommerce' }, opts: [
      { v: 'small', l: '1-5 Products', d: 'Simple checkout for a few items', add: 'ecommerceSimple' },
      { v: 'medium', l: '6-20 Products', d: 'Product catalog with categories', add: 'ecommerceCatalog' },
      { v: 'large', l: '20+ Products', d: 'Full store with inventory management', add: 'ecommerceFull' },
    ] },
    { id: 'bookingType', q: 'What type of booking system?', t: 'single', showIf: { features: 'booking' }, opts: [
      { v: 'basic', l: 'Basic Calendar', d: 'Single service, simple time slots', add: 'bookingBasic' },
      { v: 'advanced', l: 'Multiple Services/Staff', d: 'Different services, staff members, durations', add: 'bookingAdvanced' },
    ] },
    { id: 'blogNeeds', q: 'Blog content needs?', t: 'single', showIf: { features: 'blog' }, opts: [
      { v: 'setup', l: 'Just Set It Up', d: "I'll write my own blog posts", add: 'blogSetup' },
      { v: 'posts3', l: 'Include 3 Starter Posts', d: 'Get started with professional content', addN: { a: 'blogPost', n: 3 } },
      { v: 'monthly', l: 'Ongoing Blog Service', d: 'Ask about monthly content packages' },
    ] },
    { id: 'contentReady', q: 'Do you have your content ready?', sub: 'Content = text copy, images, logo, brand colors.', t: 'single', opts: [
      { v: 'yes', l: 'Yes, Everything Ready', d: 'I have all text, images, and branding prepared' },
      { v: 'partial', l: 'Partially Ready', d: 'I have some content but need help with the rest' },
      { v: 'no', l: 'No, I Need Help', d: "I'll need content creation as part of the project" },
    ] },
    { id: 'contentHelp', q: 'What content do you need help with?', t: 'multi', showIf: { contentReady: ['partial', 'no'] }, opts: [
      { v: 'copywriting', l: 'Website Copywriting', d: 'Professional text for your pages' },
      { v: 'logoBasic', l: 'Logo Design', d: '2 concepts, 2 rounds of revisions', add: 'logoBasic', exclusive: 'logo' },
      { v: 'logoPremium', l: 'Logo Design (Premium)', d: '5 concepts, unlimited revisions, brand guide', add: 'logoPremium', exclusive: 'logo' },
    ] },
    { id: 'copySections', q: 'How many sections need copywriting?', sub: 'We write compelling copy for each section.', t: 'num', showIf: { contentHelp: 'copywriting' }, min: 1, max: 20, def: 3 },
    { id: 'integrations', q: 'Connect to external tools?', t: 'multi', opts: [
      { v: 'analytics', l: 'Google Analytics', d: 'Track visitor behavior and traffic sources', add: 'googleAnalytics' },
      { v: 'email', l: 'Email Marketing', d: 'Build subscriber lists with Mailchimp, etc.', add: 'emailIntegration' },
      { v: 'crm', l: 'CRM Integration', d: 'Send leads to HubSpot, Salesforce, etc.', add: 'crmBasic' },
      { v: 'chat', l: 'Live Chat', d: 'Real-time chat with visitors', add: 'liveChat' },
      { v: 'maps', l: 'Google Maps', d: 'Show your location with directions', add: 'mapsIntegration' },
      { v: 'none', l: 'None Needed', d: 'No external integrations required', ex: 1 },
    ] },
    { id: 'timeline', q: "What's your timeline?", t: 'single', opts: [
      { v: 'asap', l: 'ASAP', d: 'Rush delivery - need it as soon as possible' },
      { v: '2-4weeks', l: '2-4 Weeks', d: 'Standard timeline' },
      { v: '1-3months', l: '1-3 Months', d: 'Flexible, no rush' },
    ] },
    { id: 'billing', q: 'Hosting billing preference?', sub: 'Both include hosting, SSL, backups, and support.', t: 'single', opts: [
      { v: 'monthly', l: 'Monthly', d: 'Pay as you go' },
      { v: 'yearly', l: 'Yearly', d: 'Save approximately 17%' },
    ] },
  ],
  software: [
    { id: 'problem', q: 'What problem are you solving?', t: 'text', ph: 'e.g., We track inventory in spreadsheets and it is getting out of control...' },
    { id: 'users', q: 'Who will use this?', t: 'single', opts: [
      { v: 'justMe', l: 'Just Me', d: 'Personal tool for yourself', tier: 'quick-fix' },
      { v: 'smallTeam', l: 'Small Team (2-5)', d: 'A few team members', tier: 'small-tool' },
      { v: 'largeTeam', l: 'Large Team (5+)', d: 'Multiple users in your organization', tier: 'business-app' },
      { v: 'customers', l: 'My Customers', d: 'External users/clients', tier: 'business-app' },
      { v: 'mixed', l: 'Team + Customers', d: 'Both internal staff and external users', tier: 'full-custom' },
    ] },
    { id: 'complexity', q: 'How complex is the solution?', t: 'single', opts: [
      { v: 'simple', l: 'Single Purpose Tool', d: 'Calculator, form, simple dashboard', tier: 'quick-fix' },
      { v: 'moderate', l: 'A Few Features', d: '2-3 related features working together', tier: 'small-tool' },
      { v: 'complex', l: 'Multiple Features', d: 'User accounts, workflows, reporting', tier: 'business-app' },
      { v: 'enterprise', l: 'Full System', d: 'Complex business logic, multiple integrations', tier: 'full-custom' },
    ] },
    { id: 'softFeatures', q: 'What capabilities?', t: 'multi', opts: [
      { v: 'userAccounts', l: 'User Accounts', d: 'Login, registration, profiles', adds: ['userRegistration', 'userLogin'] },
      { v: 'roles', l: 'User Roles', d: 'Different permission levels', add: 'userRolesBasic' },
      { v: 'search', l: 'Search/Filter', d: 'Find and filter data', add: 'searchBasic' },
      { v: 'reporting', l: 'Reports/Dashboards', d: 'Data visualization', add: 'reportingBasic' },
      { v: 'pdf', l: 'PDF Generation', d: 'Generate documents', add: 'pdfGeneration' },
      { v: 'email', l: 'Email Notifications', d: 'Automated emails', add: 'emailNotifications' },
      { v: 'files', l: 'File Uploads', d: 'Upload and store files', add: 'fileUpload' },
      { v: 'api', l: 'API Access', d: 'External integrations', add: 'apiRead' },
    ] },
    { id: 'softInteg', q: 'Payment processing?', t: 'multi', opts: [
      { v: 'stripe', l: 'Accept Payments', d: 'Credit cards via Stripe', add: 'stripePayments' },
      { v: 'none', l: 'No Payments', d: 'Not needed', ex: 1 },
    ] },
    { id: 'softTimeline', q: 'Timeline?', t: 'single', opts: [
      { v: 'asap', l: 'ASAP', d: 'Rush delivery' }, { v: 'month', l: 'Within a Month', d: 'Standard' }, { v: '3months', l: 'Within 3 Months', d: 'Flexible' },
    ] },
  ],
  mobile: [
    { id: 'appConcept', q: 'What does the app do?', t: 'text', ph: 'e.g., Booking app for dog grooming business' },
    { id: 'platforms', q: 'Which platforms?', t: 'single', opts: [
      { v: 'ios', l: 'iPhone Only', d: 'iOS App Store', tier: 'starter' },
      { v: 'android', l: 'Android Only', d: 'Google Play Store', tier: 'starter' },
      { v: 'both', l: 'Both Platforms', d: 'iOS and Android', tier: 'standard' },
    ] },
    { id: 'appLogin', q: 'Do users need accounts?', t: 'single', opts: [
      { v: 'yes', l: 'Yes', d: 'Login, profiles, saved data' },
      { v: 'no', l: 'No', d: 'Anonymous usage' },
    ] },
    { id: 'loginMethods', q: 'Login methods?', t: 'multi', showIf: { appLogin: 'yes' }, opts: [
      { v: 'email', l: 'Email/Password', d: 'Standard login', inc: 1 },
      { v: 'google', l: 'Google Sign-In', d: 'One-tap Google login', add: 'socialLoginGoogle' },
      { v: 'apple', l: 'Apple Sign-In', d: 'Required for iOS apps with login', add: 'socialLoginApple' },
      { v: 'phone', l: 'Phone Number', d: 'SMS verification', add: 'phoneLogin' },
    ] },
    { id: 'appFeatures', q: 'What features?', t: 'multi', opts: [
      { v: 'profile', l: 'User Profiles', d: 'Edit profile, avatar', add: 'userProfile' },
      { v: 'notifications', l: 'Push Notifications', d: 'Send alerts to users', add: 'pushNotificationsBasic' },
      { v: 'chat', l: 'Chat/Messaging', d: 'In-app messaging', add: 'inAppChat' },
      { v: 'camera', l: 'Camera/Photos', d: 'Take or upload photos', add: 'cameraIntegration' },
      { v: 'location', l: 'GPS Location', d: 'User location tracking', add: 'userLocation' },
      { v: 'maps', l: 'Maps', d: 'Display maps', add: 'mapDisplay' },
      { v: 'offline', l: 'Offline Mode', d: 'Works without internet', add: 'offlineMode' },
    ] },
    { id: 'appPayments', q: 'In-app payments?', t: 'single', opts: [
      { v: 'none', l: 'No Payments', d: 'Free app or external payment' },
      { v: 'stripe', l: 'Credit Card', d: 'Direct card payments via Stripe', add: 'stripePayments' },
      { v: 'iap', l: 'In-App Purchases', d: 'Buy items in app', add: 'inAppPurchases' },
      { v: 'subscription', l: 'Subscriptions', d: 'Recurring payments', add: 'subscriptions' },
    ] },
    { id: 'adminDash', q: 'Admin dashboard?', t: 'single', opts: [
      { v: 'none', l: 'No Dashboard', d: 'Manage within the app' },
      { v: 'basic', l: 'Basic Dashboard', d: 'View data, basic edits', add: 'adminDashboardBasic' },
      { v: 'full', l: 'Full Dashboard', d: 'Complete control panel', add: 'adminDashboardFull', tierBump: 'premium' },
    ] },
    { id: 'appStore', q: 'App store submission?', t: 'single', opts: [
      { v: 'self', l: "I'll Handle It", d: 'Submit yourself' },
      { v: 'assets', l: 'Create Assets Only', d: 'Screenshots, descriptions', add: 'appStoreAssets' },
      { v: 'full', l: 'Full Service', d: 'We handle everything', adds: ['appStoreAssets', 'appSubmission'] },
    ] },
  ],
  integrations: [
    { id: 'systemA', q: 'First system to connect?', t: 'single', opts: [
      { v: 'stripe', l: 'Stripe', d: 'Payment processing' }, { v: 'quickbooks', l: 'QuickBooks', d: 'Accounting' }, { v: 'hubspot', l: 'HubSpot', d: 'CRM & Marketing' },
      { v: 'mailchimp', l: 'Mailchimp', d: 'Email marketing' }, { v: 'googleSheets', l: 'Google Sheets', d: 'Spreadsheets' }, { v: 'slack', l: 'Slack', d: 'Team communication' },
      { v: 'shopify', l: 'Shopify', d: 'E-commerce' }, { v: 'other', l: 'Other', d: 'Tell us what system' },
    ] },
    { id: 'systemB', q: 'Second system to connect?', t: 'single', opts: [
      { v: 'stripe', l: 'Stripe', d: 'Payment processing' }, { v: 'quickbooks', l: 'QuickBooks', d: 'Accounting' }, { v: 'hubspot', l: 'HubSpot', d: 'CRM' },
      { v: 'mailchimp', l: 'Mailchimp', d: 'Email' }, { v: 'googleSheets', l: 'Google Sheets', d: 'Spreadsheets' }, { v: 'airtable', l: 'Airtable', d: 'Database' }, { v: 'other', l: 'Other', d: 'Tell us' },
    ] },
    { id: 'dataFlow', q: 'What data should flow between them?', t: 'text', ph: 'e.g., When new order in Shopify -> create invoice in QuickBooks' },
    { id: 'frequency', q: 'How often?', t: 'single', opts: [
      { v: 'realtime', l: 'Real-time', d: 'Immediately when triggered', add: 'realTimeSync' },
      { v: 'hourly', l: 'Hourly', d: 'Sync every hour' }, { v: 'daily', l: 'Daily', d: 'Once per day' }, { v: 'manual', l: 'Manual', d: 'On-demand' },
    ] },
    { id: 'direction', q: 'Data direction?', t: 'single', opts: [
      { v: 'oneWay', l: 'One-way', d: 'System A sends to System B' },
      { v: 'biDirectional', l: 'Both Ways', d: 'Sync both directions', add: 'biDirectional' },
    ] },
    { id: 'extras', q: 'Additional needs?', t: 'multi', opts: [
      { v: 'errors', l: 'Error Handling', d: 'Auto-retry on failure', add: 'errorHandling' },
      { v: 'logging', l: 'Logging', d: 'Track what happened', add: 'logging' },
      { v: 'backfill', l: 'Historical Import', d: 'Import past data', add: 'historicalBackfill' },
      { v: 'docs', l: 'Documentation', d: 'How it works doc', add: 'documentation' },
      { v: 'none', l: 'None', d: 'Basic setup only', ex: 1 },
    ] },
  ],
  consulting: [
    { id: 'consultType', q: 'What kind of help?', t: 'single', opts: [
      { v: 'blitz', l: 'Blitz Call', d: '30-minute troubleshoot or brainstorm session', pkg: 'blitz-call' },
      { v: 'support', l: 'Ongoing Support', d: 'Monthly retainer for continuous help' },
      { v: 'audit', l: 'Audit/Review', d: 'One-time evaluation of something' },
    ] },
    { id: 'supportLevel', q: 'Support level?', t: 'single', showIf: { consultType: 'support' }, opts: [
      { v: 'essentials', l: 'Essentials', d: 'Bug fixes, small tweaks, email support', pkg: 'essentials' },
      { v: 'growth', l: 'Growth', d: 'New features, monthly planning call, priority support', pkg: 'growth' },
      { v: 'dedicated', l: 'Dedicated', d: 'Like a developer on staff, emergency support', pkg: 'dedicated' },
    ] },
    { id: 'auditType', q: 'What to audit?', t: 'single', showIf: { consultType: 'audit' }, opts: [
      { v: 'websiteBasic', l: 'Website Audit (Basic)', d: 'UX, speed, mobile review', add: 'websiteBasic' },
      { v: 'websiteFull', l: 'Website Audit (Full)', d: 'Plus SEO, security, accessibility', add: 'websiteFull' },
      { v: 'codeSmall', l: 'Code Review', d: 'Review codebase for issues', add: 'codeReviewSmall' },
      { v: 'security', l: 'Security Audit', d: 'Vulnerability assessment', add: 'securityAudit' },
      { v: 'seo', l: 'SEO Audit', d: 'Search optimization review', add: 'seoAudit' },
    ] },
  ],
};

export function checkIf(cond, ans) {
  for (const [k, v] of Object.entries(cond)) {
    const a = ans[k];
    if (Array.isArray(v)) {
      if (Array.isArray(a)) { if (!v.some((x) => a.includes(x))) return false; }
      else if (!v.includes(a)) return false;
    } else if (Array.isArray(a)) {
      if (!a.includes(v)) return false;
    } else if (a !== v) return false;
  }
  return true;
}

function detWebTier(ans) {
  const aud = ans.audience, sec = ans.sectionCount;
  if (aud === 'personal') {
    if (sec === '6-8' || sec === '9+') return 'studio-plus';
    if (sec === '4-5') return 'creator';
    return 'presence';
  }
  if (sec === '6-8' || sec === '9+') return 'growth';
  if (sec === '4-5') return 'standard';
  return 'starter';
}
function detSoftTier(c) { if (c === 'simple') return 'quick-fix'; if (c === 'moderate') return 'small-tool'; if (c === 'complex') return 'business-app'; return 'full-custom'; }
function detMobTier(p, a) { if (a === 'full') return 'premium'; if (p === 'both') return 'standard'; return 'starter'; }

const label = (a) => a.replace(/([A-Z])/g, ' $1').trim();

/** Pure port of calcTotal(): returns { items:[{n,p,u?}], total, tier }. */
export function computeQuote(S) {
  const { cat, ans = {}, adds = {}, pkg = null } = S;
  let t = 0;
  const items = [];
  let tier = S.tier || null;

  if (cat === 'website') {
    if (!ans.audience || !ans.sectionCount) return { items: [], total: 0, tier: null };
    tier = detWebTier(ans);
    const td = P.web[ans.audience]?.[tier];
    if (td) { t += td.b; items.push({ n: `${td.n} Tier (Build)`, p: td.b }); }
    const skipFromFeatures = ['bookingBasic', 'bookingAdvanced', 'ecommerceSimple', 'ecommerceCatalog', 'ecommerceFull'];
    Object.entries(adds).forEach(([qId, addons]) => {
      (addons || []).forEach((a) => {
        if (qId === 'features' && skipFromFeatures.includes(a)) return;
        const p = P.web.add[a];
        if (p && !items.find((x) => x.n === label(a))) { t += p; items.push({ n: label(a), p }); }
      });
    });
    if (ans.copySections) { const n = ans.copySections, p = n * 50; t += p; items.push({ n: `Copywriting (${n} sections)`, p }); }
  } else if (cat === 'software') {
    if (!ans.complexity) return { items: [], total: 0, tier: null };
    tier = tier || detSoftTier(ans.complexity);
    const td = P.soft.tiers[tier];
    if (td) { const m = Math.round((td.min + td.max) / 2); t += m; items.push({ n: `${td.n} (Est.)`, p: m }); }
    Object.values(adds).flat().forEach((a) => { const p = P.soft.add[a]; if (p && !items.find((x) => x.n === label(a))) { t += p; items.push({ n: label(a), p }); } });
  } else if (cat === 'mobile') {
    if (!ans.platforms) return { items: [], total: 0, tier: null };
    tier = tier || detMobTier(ans.platforms, ans.adminDash);
    const td = P.mobile.tiers[tier];
    if (td) { const m = Math.round((td.min + td.max) / 2); t += m; items.push({ n: `${td.n} Tier (Est.)`, p: m }); }
    Object.values(adds).flat().forEach((a) => { const p = P.mobile.add[a]; if (p && !items.find((x) => x.n === label(a))) { t += p; items.push({ n: label(a), p }); } });
  } else if (cat === 'integrations') {
    if (!ans.systemA || !ans.systemB) return { items: [], total: 0, tier: null };
    ['systemA', 'systemB'].forEach((k) => { const s = ans[k], p = P.integ.sys[s]; if (p) { t += p; items.push({ n: `${s} Integration`, p }); } });
    Object.values(adds).flat().forEach((a) => { const p = P.integ.add[a]; if (p && !items.find((x) => x.n === label(a))) { t += p; items.push({ n: label(a), p }); } });
  } else if (cat === 'consulting') {
    if (pkg) { const pk = P.consult.pkg[pkg]; if (pk) { t += pk.p; items.push({ n: pk.n, p: pk.p, u: pk.u }); } }
    Object.values(adds).flat().forEach((a) => { const p = P.consult.audit[a]; if (p && !items.find((x) => x.n === label(a))) { t += p; items.push({ n: label(a), p }); } });
  }
  return { items, total: t, tier };
}

export function hostingLine(S) {
  if (S.cat !== 'website') return null;
  const { total, tier } = computeQuote(S);
  if (!tier || total <= 0) return null;
  const td = P.web[S.ans.audience]?.[tier];
  if (!td) return null;
  const yearly = (S.ans.billing || 'monthly') === 'yearly';
  return { monthly: td.m, yearly: td.y, billed: yearly ? 'yearly' : 'monthly', fee: td.fee || null };
}
