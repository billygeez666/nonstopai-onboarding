// FOOD OS vertical config.
//
// URL slug is /food but `signupValue` is 'takeaway' — it MUST match the
// `niche` column in Supabase `pathway_templates` exactly.
//
// Demo number +441992932782 is the PERMANENT FOOD OS demo (King Kebab
// pathway 3e3c1370-f4b1-4830-bbaa-deada455ece3). It is a demo-purpose
// number, NOT part of the customer provisioning pool. See docs/NUMBERS.md.
//
// status flips to 'live' only when pathway_templates.takeaway.is_active
// is true (gated on the live call test).

export default {
  slug: 'food',
  signupValue: 'takeaway',
  status: 'live', // pathway_templates.takeaway.is_active = true (call test passed 2026-07-08)
  name: 'FOOD OS',
  shortLabel: 'Takeaway & Food Ordering',
  cardBlurb: 'Website, 24/7 AI order line and enquiry handling for takeaways and restaurants.',

  badge: 'THE TAKEAWAY OPERATING SYSTEM',
  heroTitle: 'The complete operating system for takeaways.',
  heroAccent: 'Website. Calls. Orders. Front counter.',
  heroBody:
    'NONSTOP AI gives takeaways and restaurants a professional website, a 24/7 AI order line that answers every call, order capture, missed-call protection and a customer front counter — fully set up for you.',
  heroTicker: 'SETUP DONE FOR YOU · KEEP YOUR EXISTING NUMBER · LIVE FAST',
  ctaLabel: 'Get my FOOD OS',

  demoPhone: '+441992932782',
  demo: {
    badge: 'LIVE TAKEAWAY DEMO',
    title: 'Call King Kebab and hear the AI take your order.',
    body: 'This is the live AI takeaway order line, running as a demo kebab shop. Test it like a hungry customer: ask about the menu, place an order for collection or delivery, and hear how it captures every detail.',
    buttonLabel: 'Call live takeaway demo',
    ticker: 'REAL PHONE DEMO · ORDER CAPTURE · 24/7 AI ORDER LINE',
  },

  benefits: [
    {
      title: 'Professional takeaway website',
      body: 'A custom, sleek website with your menu, built for your takeaway and deployed by us.',
    },
    {
      title: '24/7 AI order line',
      body: 'Every call gets answered — even during the Friday-night rush, when staff are plating up, or after the counter closes.',
    },
    {
      title: 'Order capture system',
      body: 'Captures items, collection or delivery, address, name and timing so no order gets missed.',
    },
  ],

  includedHeading: 'Not just an AI receptionist. A full takeaway business system.',
  includedSub:
    'Everything needed to help your takeaway look professional, answer customers, capture orders and stop the phone ringing out during the rush.',
  included: [
    {
      title: 'Complete takeaway operating system',
      body: 'Website, AI order line, front counter, order capture and notifications working together.',
    },
    {
      title: 'Customer front counter',
      body: 'One place for customers to call, order, ask questions and reach your business properly.',
    },
    {
      title: 'Missed-call protection',
      body: 'Protects your takeaway from losing orders when nobody can pick up the phone.',
    },
    {
      title: 'Menu and enquiry handling',
      body: 'Answers menu questions, delivery areas, opening hours and captures the details that matter.',
    },
    {
      title: 'Automatic notifications',
      body: 'Order and enquiry details can be sent straight to your kitchen by SMS or email.',
    },
    {
      title: 'Setup done for you',
      body: 'No tech work on your side. We build it, connect it, host it and help you go live.',
    },
  ],

  steps: [
    {
      n: '01',
      title: 'Tell us about your takeaway',
      body: 'You complete one simple form with your business details, menu, delivery rules and opening hours.',
    },
    {
      n: '02',
      title: 'We build your system',
      body: 'We set up your website, AI order line, order capture and customer front counter.',
    },
    {
      n: '03',
      title: 'Go live',
      body: 'Your takeaway operating system goes live so customers can call, order and enquire 24/7.',
    },
  ],

  pricing: {
    label: 'TAKEAWAY OPERATING SYSTEM',
    monthly: 99,
    setup: 299,
    sub: 'One system. Setup done for you. Built for takeaways and restaurants.',
    features: [
      'Professional takeaway website',
      '24/7 AI order line',
      'Order capture system',
      'Customer front counter',
      'Missed-call protection',
      'Menu and enquiry handling',
      'Automatic order notifications',
      'Setup done for you',
    ],
  },

  ticket: {
    header: 'ORDER LINE',
    stages: [
      {
        key: 'ringing',
        label: 'INCOMING CALL',
        dotClass: 'bg-signal animate-ping-slow',
        line1: '07922 116 733',
        line2: 'Mobile · Hertford, SG14',
        footLabel: 'STATUS',
        footValue: 'Ringing…',
        footClass: 'text-signal',
      },
      {
        key: 'answering',
        label: 'AI ORDER LINE',
        dotClass: 'bg-signal',
        line1: 'Answered in 1 ring',
        line2: '“Thank you for calling King Kebab!”',
        footLabel: 'STATUS',
        footValue: 'Taking order…',
        footClass: 'text-paper-dim',
      },
      {
        key: 'booked',
        label: 'ORDER CONFIRMED',
        dotClass: 'bg-live',
        line1: '2× Lamb Doner · Cheesy Chips',
        line2: 'Delivery 7:15pm · SG14 1AB',
        footLabel: 'STATUS',
        footValue: 'Sent to kitchen',
        footClass: 'text-live',
      },
    ],
  },

  meta: {
    title: 'FOOD OS — NONSTOP AI | The Complete Operating System for Takeaways',
    description:
      'NONSTOP AI gives takeaways a professional website, 24/7 AI order line, order capture, missed-call protection and a customer front counter — fully set up for you.',
  },
}
