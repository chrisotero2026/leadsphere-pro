/**
 * defaultTemplates.ts
 * Production-quality default templates for each service type.
 * Import these to seed the database on first run.
 */

export const DEFAULT_TEMPLATES = {

  SELL_HOUSE_FAST: {
    name: 'Sell My House Fast',
    slug: 'sell-house-fast',
    serviceType: 'SELL_HOUSE_FAST' as const,
    description: 'Primary template for motivated sellers looking to sell quickly',
    titleTemplate: 'Sell My House Fast in {{city}}, {{stateCode}} {{zipCode}} | {{company}}',
    metaDescTemplate: 'Sell your house fast in {{city}}, {{stateCode}}. Get a fair cash offer in 24 hours. No repairs, no fees, close in 7 days. Serving ZIP {{zipCode}} and all of {{county}}.',
    h1Template: 'Sell My House Fast in {{city}}, {{stateCode}}',
    heroHeadlineTemplate: 'We Buy Houses in {{city}} for Cash',
    heroSubheadlineTemplate: 'Fair cash offer in 24 hours. Close in as little as 7 days. No repairs, no fees, no hassle in {{cityState}}.',
    ctaText: 'Get My Cash Offer Today',
    ctaSubtext: 'Free · No Obligation · Respond in 24 Hours',
    bodyTemplate: `
<section>
  <h2>Sell Your House Fast in {{city}}, {{stateCode}} — Any Condition</h2>
  <p>Are you searching for a fast, hassle-free way to sell your house in {{city}}, {{stateCode}}? Whether you're dealing with foreclosure, divorce, an inherited property, or simply need to relocate quickly, {{company}} is your local solution. We buy homes throughout {{zipCode}} and all of {{county}} with a simple, transparent process.</p>
  <p>As local cash home buyers serving {{cityState}} and the greater {{nearbyCity}} metropolitan area, we provide real offers based on your home's current condition — no obligation to accept, no hidden fees, no surprises at closing.</p>
</section>

<section>
  <h2>Our Simple 3-Step Process</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <h3>Tell Us About Your Home</h3>
      <p>Fill out our short form with basic details about your {{city}} property. Takes under 2 minutes.</p>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <h3>Receive Your Cash Offer</h3>
      <p>Our local {{stateCode}} team analyzes your home and delivers a fair, no-obligation offer within 24 hours.</p>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <h3>Pick Your Closing Date</h3>
      <p>Accept our offer, then choose a closing date that works for you — as fast as 7 days or on your schedule.</p>
    </div>
  </div>
</section>

<section>
  <h2>Why {{city}} Homeowners Choose {{company}}</h2>
  <ul>
    <li><strong>Zero commissions or closing fees</strong> — We cover all closing costs</li>
    <li><strong>Sell completely as-is</strong> — No repairs, cleaning, or staging required</li>
    <li><strong>Close on your timeline</strong> — 7 days to 90 days, you choose</li>
    <li><strong>Local {{stateCode}} experts</strong> — We know the {{city}} market inside and out</li>
    <li><strong>Cash offers only</strong> — No financing contingencies, no delays</li>
    <li><strong>Transparent process</strong> — No bait-and-switch, no last-minute price drops</li>
  </ul>
</section>

<section>
  <h2>The {{city}} Real Estate Market (ZIP {{zipCode}})</h2>
  <p>{{city}}, {{stateCode}} is one of the most active real estate markets in {{county}}. With a median home value of {{medianValue}} and a population of {{population}}, demand for {{city}} properties remains strong. Whether your home is in move-in condition or needs substantial repairs, {{company}} provides a fair, market-based cash offer so you can move forward with confidence.</p>
  <p>We regularly purchase homes throughout ZIP code {{zipCode}}, surrounding {{nearbyCity}} suburbs, and all of {{stateCode}}. Location, condition, and situation — we work with them all.</p>
</section>

<section>
  <h2>Situations We Help With in {{city}}</h2>
  <ul>
    <li>Facing foreclosure or significantly behind on mortgage payments</li>
    <li>Inherited a property you don't want or can't afford to maintain</li>
    <li>Going through a divorce and need a clean, fast sale</li>
    <li>Relocating for work or family and need to sell immediately</li>
    <li>Property needs major repairs you can't afford or don't want to do</li>
    <li>Tired of being a landlord with difficult tenants</li>
    <li>Owe more than the home is worth (short sale situation)</li>
    <li>Tax liens, code violations, or title complications</li>
  </ul>
</section>
    `.trim(),
    faqTemplate: [
      {
        q: 'How fast can you buy my house in {{city}}, {{stateCode}}?',
        a: 'We can typically close in as little as 7 days in {{city}}. Once you submit your property information, we present a cash offer within 24 hours. From there, closing happens on your schedule — whether that\'s 1 week or several weeks out.'
      },
      {
        q: 'Do I need to make repairs before selling my {{city}} home?',
        a: 'Absolutely not. We buy homes completely as-is throughout {{city}} and {{county}}. You don\'t need to clean, repair, paint, or stage your home. We handle everything after closing, saving you time and thousands of dollars.'
      },
      {
        q: 'How do you calculate the cash offer for my {{zipCode}} property?',
        a: 'We evaluate your property based on its current condition, location in {{zipCode}}, recent comparable sales in {{city}}, and the current {{stateCode}} real estate market. We provide a fair, data-driven offer that reflects true market value minus our estimated repair costs and operating expenses.'
      },
      {
        q: 'Are there any fees or commissions when selling to {{company}}?',
        a: 'None. There are zero agent commissions, zero service fees, and we cover all standard closing costs. The cash offer we present is exactly what you receive at closing — no surprise deductions or hidden charges.'
      },
      {
        q: 'What types of properties do you buy in {{city}}, {{stateCode}}?',
        a: 'We purchase all types of residential properties in {{city}} and ZIP code {{zipCode}}, including single-family homes, condos, townhouses, multi-family properties, inherited properties, and vacant land throughout {{county}}.'
      },
      {
        q: 'Is {{company}} a legitimate cash home buyer serving {{city}}?',
        a: 'Yes. We are a licensed real estate company operating throughout {{stateCode}} with a track record of helping hundreds of homeowners in {{city}} and the broader {{nearbyCity}} metro area sell their homes quickly, fairly, and without stress.'
      },
    ],
  },

  CASH_OFFER: {
    name: 'Cash Home Buyers',
    slug: 'cash-offer',
    serviceType: 'CASH_OFFER' as const,
    description: 'Template targeting homeowners searching for cash buyers',
    titleTemplate: 'Cash Home Buyers in {{city}}, {{stateCode}} — Fair Offers | {{company}}',
    metaDescTemplate: 'Local cash home buyers in {{city}}, {{stateCode}} {{zipCode}}. Fair cash offers, fast closings, zero fees. Request your offer online or call {{phone}} today.',
    h1Template: 'Cash Home Buyers in {{city}}, {{stateCode}}',
    heroHeadlineTemplate: 'Get a Fair Cash Offer for Your {{city}} Home Today',
    heroSubheadlineTemplate: 'Local buyers, honest process, close in days — not months.',
    ctaText: 'Request My Cash Offer',
    ctaSubtext: 'No obligation · Offer in 24 hours',
    bodyTemplate: `
<section>
  <h2>Trusted Cash Home Buyers Serving {{cityState}}</h2>
  <p>{{company}} is a trusted local cash home buying company serving homeowners throughout {{city}}, {{stateCode}} and ZIP code {{zipCode}}. Unlike traditional real estate sales that drag on for months, we make fair cash offers and close on your timeline — no listings, no showings, no uncertainty.</p>
  <p>Our team of {{stateCode}} real estate experts understands the local market. We evaluate your {{city}} property fairly and transparently, then present a no-obligation cash offer you can accept, reject, or negotiate.</p>
</section>

<section>
  <h2>The Cash Buyer Advantage in {{city}}</h2>
  <ul>
    <li><strong>Speed</strong> — Close in 7–21 days vs. 90+ days with traditional sales</li>
    <li><strong>Certainty</strong> — No financing contingencies or last-minute deal collapses</li>
    <li><strong>Simplicity</strong> — One buyer, one contract, one closing</li>
    <li><strong>Savings</strong> — No agent commissions (typically 5–6% of sale price)</li>
    <li><strong>Convenience</strong> — Sell as-is, skip repairs and showings entirely</li>
  </ul>
</section>

<section>
  <h2>{{city}} Market Insight</h2>
  <p>The {{city}} real estate market ({{zipCode}}) remains competitive with a median home value of {{medianValue}}. Cash buyers like {{company}} provide homeowners with a reliable, private alternative to the open market — especially valuable for sellers who need speed, privacy, or certainty of closing.</p>
</section>
    `.trim(),
    faqTemplate: [
      {
        q: 'How does the cash offer process work in {{city}}?',
        a: 'Submit your property details using the form above. Our {{city}} team reviews your information and contacts you within 24 hours with a fair cash offer. If you accept, we open escrow and can close in as little as 7 days.'
      },
      {
        q: 'Will I get a fair price as a cash sale in {{zipCode}}?',
        a: 'Our offers are based on current {{city}} market data and your property\'s condition. While cash offers are typically slightly below retail value, you save 5–6% in agent commissions, avoid repair costs, and eliminate months of carrying costs — making the net result highly competitive.'
      },
    ],
  },

  FORECLOSURE: {
    name: 'Stop Foreclosure',
    slug: 'stop-foreclosure',
    serviceType: 'FORECLOSURE' as const,
    description: 'Template for homeowners facing foreclosure',
    titleTemplate: 'Stop Foreclosure in {{city}}, {{stateCode}} — Sell Before Auction | {{company}}',
    metaDescTemplate: 'Facing foreclosure in {{city}}, {{stateCode}} {{zipCode}}? {{company}} can help you stop foreclosure, protect your credit, and walk away with cash. Act fast — call {{phone}} now.',
    h1Template: 'Stop Foreclosure in {{city}}, {{stateCode}}',
    heroHeadlineTemplate: 'Stop Foreclosure Before It\'s Too Late in {{city}}',
    heroSubheadlineTemplate: 'We can close before your auction date. Protect your credit and your future.',
    ctaText: 'Get Help Stopping Foreclosure',
    ctaSubtext: 'Confidential · No obligation · Fast response',
    bodyTemplate: `
<section>
  <h2>Facing Foreclosure in {{city}}, {{stateCode}}? You Have Options.</h2>
  <p>If you've fallen behind on mortgage payments in {{zipCode}} or have received a Notice of Default, don't panic — you have more options than you may realize. {{company}} specializes in helping homeowners in {{city}} facing foreclosure stop the process and move forward with dignity.</p>
  <p>Acting quickly is critical. The sooner you contact us, the more options you have. We can often close before a scheduled foreclosure sale date, allowing you to avoid the devastating credit damage that comes with a completed foreclosure.</p>
</section>

<section>
  <h2>How Selling Stops Foreclosure in {{stateCode}}</h2>
  <ul>
    <li>We make a cash offer based on your {{city}} home's current value</li>
    <li>If accepted, we open escrow and work to close before your auction date</li>
    <li>Sale proceeds pay off your mortgage, stopping the foreclosure</li>
    <li>Any remaining equity goes directly to you at closing</li>
    <li>Your credit is protected — no foreclosure on your record</li>
  </ul>
</section>

<section>
  <h2>{{city}} Foreclosure Resources</h2>
  <p>{{stateCode}} law provides homeowners certain protections during foreclosure. In many cases, you have the right to sell your property up until the foreclosure auction. {{company}} has experience navigating {{stateCode}} foreclosure timelines and can move quickly to help {{city}} homeowners in {{zipCode}} and throughout {{county}}.</p>
  <p>We strongly recommend also consulting with a HUD-approved housing counselor or attorney regarding your specific situation. Our cash purchase option is one powerful tool — but you deserve to understand all your options.</p>
</section>
    `.trim(),
    faqTemplate: [
      {
        q: 'Can you really stop my foreclosure in {{city}}, {{stateCode}}?',
        a: 'In many cases, yes — if there is sufficient equity in your {{city}} home and we can close before the foreclosure auction date. Selling to {{company}} pays off your mortgage balance, legally stopping the foreclosure process and protecting your credit history.'
      },
      {
        q: 'How much time do I need to sell before foreclosure in {{zipCode}}?',
        a: 'The timeline varies, but we recommend contacting us as soon as possible. We have closed in as little as 7 days in {{city}}. Even if your auction date is close, it\'s worth calling us at {{phone}} to explore whether a fast sale is feasible.'
      },
      {
        q: 'What happens to my credit if I sell instead of going through foreclosure?',
        a: 'Selling your home — even at a loss — is far less damaging to your credit than a completed foreclosure. A foreclosure can remain on your credit report for 7 years and significantly impact your ability to qualify for future loans.'
      },
    ],
  },

} as const;
