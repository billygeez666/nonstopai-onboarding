// Taxi OS vertical config.
// Content extracted verbatim from the original Landing.jsx / CallTicket.jsx —
// this file is the single source of truth for everything taxi-specific.
//
// `signupValue` MUST match the `niche` column of an ACTIVE row in Supabase
// `pathway_templates`. `slug` is the URL segment only.

export default {
  slug: 'taxi',
  signupValue: 'taxi',
  status: 'live', // live | coming_soon
  name: 'Taxi OS',
  shortLabel: 'Taxi & Private Hire',
  cardBlurb: 'Website, 24/7 AI receptionist and booking capture for taxi firms.',

  badge: 'THE TAXI OPERATING SYSTEM',
  heroTitle: 'The complete operating system for taxi companies.',
  heroAccent: 'Website. Calls. Bookings. Front desk.',
  heroBody:
    'NONSTOP AI gives taxi firms a professional website, 24/7 AI receptionist, booking capture system, missed-call protection and customer front desk — fully set up for you.',
  heroTicker: 'SETUP DONE FOR YOU · KEEP YOUR EXISTING NUMBER · LIVE FAST',
  ctaLabel: 'Get my Taxi OS',

  demoPhone: '+447449839233',
  demo: {
    badge: 'LIVE TAXI DEMO',
    title: 'Call the demo and hear how the taxi system works.',
    body: 'This is the live AI taxi receptionist. Test it like a real customer: ask for a taxi, give a pickup, destination and time, and hear how the system captures the booking details.',
    buttonLabel: 'Call live taxi demo',
    ticker: 'REAL PHONE DEMO · BOOKING CAPTURE · 24/7 AI RECEPTIONIST',
  },

  benefits: [
    {
      title: 'Professional taxi website',
      body: 'A custom, sleek website built for your taxi firm and deployed by us.',
    },
    {
      title: '24/7 AI receptionist',
      body: 'Every call gets answered — even when drivers are busy, the office is closed, or the phone would normally ring out.',
    },
    {
      title: 'Booking capture system',
      body: 'Captures pickup, drop-off, time, passenger details and enquiries so no job gets missed.',
    },
  ],

  includedHeading: 'Not just an AI receptionist. A full taxi business system.',
  includedSub:
    'Everything needed to help your taxi firm look professional, answer customers, capture bookings and stop enquiries slipping away.',
  included: [
    {
      title: 'Complete taxi operating system',
      body: 'Website, AI receptionist, front desk, booking capture and notifications working together.',
    },
    {
      title: 'Customer front desk',
      body: 'One place for customers to call, book, ask questions and reach your firm properly.',
    },
    {
      title: 'Missed-call protection',
      body: 'Protects your firm from losing bookings when nobody can answer the phone.',
    },
    {
      title: 'Enquiry handling',
      body: 'Answers common questions, captures details, and helps customers get the right response.',
    },
    {
      title: 'Automatic notifications',
      body: 'Booking and enquiry details can be sent straight to your team by SMS or email.',
    },
    {
      title: 'Setup done for you',
      body: 'No tech work on your side. We build it, connect it, host it and help you go live.',
    },
  ],

  keepExisting: {
    badge: 'NOTHING TO RIP OUT',
    heading: 'Keep everything you already use.',
    sub: 'This sits on top of how your firm already works. Your drivers, your dispatch, your number, your process — all stay exactly as they are.',
    items: [
      {
        title: 'Keep your existing number',
        body: 'Customers carry on calling the same number they always have. Nothing to reprint, nothing to re-advertise.',
      },
      {
        title: 'Keep your dispatch system',
        body: 'We do not replace iCabbi, Autocab, TaxiCaller or whatever you run today. The AI answers the phone; your system keeps dispatching.',
      },
      {
        title: 'Keep your drivers and your process',
        body: 'Bookings reach your team by SMS and email, in the same shape they get them now. No new app for drivers to learn.',
      },
      {
        title: 'Nothing to install',
        body: 'No hardware, no software on your office machines, no engineer visit. We set it up and hand it over working.',
      },
    ],
  },

  steps: [
    {
      n: '01',
      title: 'Tell us about your taxi firm',
      body: 'You complete one simple form with your business details, phone number, services and booking process.',
    },
    {
      n: '02',
      title: 'We build your system',
      body: 'We set up your website, AI receptionist, booking capture and customer front desk.',
    },
    {
      n: '03',
      title: 'We check it with you',
      body: 'You hear your own receptionist before a single customer does. Wording, areas covered and how it handles jobs — changed until you are happy.',
    },
    {
      n: '04',
      title: 'Go live',
      body: 'Your taxi operating system goes live so customers can call, book and enquire 24/7.',
    },
    {
      n: '05',
      title: 'We keep it running',
      body: 'Hosting, updates and support are included. Anything needs changing, you tell us and we change it.',
    },
  ],

  faq: [
    {
      q: 'Do I have to change my phone number?',
      a: 'No. Your existing number stays exactly as it is — calls simply route through the AI front desk first. Your customers never notice a difference.',
    },
    {
      q: 'Will this replace my dispatch system?',
      a: 'No. Your dispatch system stays exactly where it is. The AI answers the phone and captures the booking, then sends it to your team by SMS and email so it goes into dispatch the same way it does today.',
    },
    {
      q: 'What happens if the AI cannot handle a call?',
      a: 'It captures the details and can transfer the caller to a number you choose, so a person can always pick up. You decide which calls get passed straight through.',
    },
    {
      q: 'How do bookings actually reach my drivers?',
      a: 'By SMS and email from day one, to whichever numbers and addresses you tell us. Nothing changes for your drivers.',
    },
    {
      q: 'How long until it is live?',
      a: 'Typically 48 hours from signup. We build it, you check it, then it goes live.',
    },
    {
      q: 'Can I hear it before I pay?',
      a: 'Yes. Call the live taxi demo on this page and test it exactly like a customer would. No signup, no card.',
    },
    {
      q: 'What if I want to cancel?',
      a: 'The £99/month is a rolling monthly subscription. There is no long-term contract to sign.',
    },
  ],

  pricing: {
    label: 'TAXI OPERATING SYSTEM',
    monthly: 99,
    setup: 299,
    sub: 'One system. Setup done for you. Built for taxi companies.',
    features: [
      'Professional taxi website',
      '24/7 AI receptionist',
      'Booking capture system',
      'Customer front desk',
      'Missed-call protection',
      'Enquiry handling',
      'Automatic customer notifications',
      'Setup done for you',
    ],
  },

  ticket: {
    header: 'DISPATCH LINE',
    stages: [
      {
        key: 'ringing',
        label: 'INCOMING CALL',
        dotClass: 'bg-signal animate-ping-slow',
        line1: '07911 224 488',
        line2: 'Mobile · Bolton, BL1',
        footLabel: 'STATUS',
        footValue: 'Ringing…',
        footClass: 'text-signal',
      },
      {
        key: 'answering',
        label: 'AI RECEPTIONIST',
        dotClass: 'bg-signal',
        line1: 'Answered in 1 ring',
        line2: '“NONSTOPAI Taxis, how can I help?”',
        footLabel: 'STATUS',
        footValue: 'Taking booking…',
        footClass: 'text-paper-dim',
      },
      {
        key: 'booked',
        label: 'JOB CONFIRMED',
        dotClass: 'bg-live',
        line1: '14 Mill St → Bolton Rd',
        line2: 'Pickup 6:45pm · Card on file',
        footLabel: 'STATUS',
        footValue: 'Sent to driver',
        footClass: 'text-live',
      },
    ],
  },

  meta: {
    title: 'Taxi OS — NONSTOP AI | The Complete Operating System for Taxi Companies',
    description:
      'NONSTOP AI gives taxi firms a professional website, 24/7 AI receptionist, booking capture, missed-call protection and customer front desk — fully set up for you.',
  },
}
