export const categories = [
  {
    slug: 'cables-wires', name: 'Cables & Wires', tagline: 'Connect with confidence',
    alt: 'Orange electrical extension cable',
    description: 'Request electrical wire, SWA cable and related wiring materials for residential, commercial or industrial work in Jamaica.',
    checklist: 'Send the cable type, conductor size, number of cores and length from your materials list. Include the specified armour or insulation where relevant.',
  },
  {
    slug: 'lighting', name: 'Lighting', tagline: 'Bring your space to life',
    alt: 'LED light bulb and its packaging',
    description: 'Enquire about LED lighting and replacement lamps for homes, offices and commercial projects from our Kingston electrical depot.',
    checklist: 'Include the fixture or lamp type, fitting, wattage, colour temperature and quantity. For replacements, a model number or photo of the existing unit helps.',
  },
  {
    slug: 'circuit-protection', name: 'Circuit Protection', tagline: 'Protection at every point',
    alt: 'Triple-pole electrical circuit breaker',
    description: 'Source circuit breakers and load centres for your project. Ask the Kingston depot to confirm the specified parts and availability.',
    checklist: 'Share the manufacturer, model, current rating, pole count and panel details from your electrician’s specification so we can identify compatible items.',
  },
  {
    slug: 'switches-sockets', name: 'Switches & Sockets', tagline: 'The finishing touches',
    alt: 'Weatherproof swivel lamp socket',
    description: 'Request switches, sockets, outlets and other wiring devices for a replacement, renovation or new installation in Jamaica.',
    checklist: 'Include the device type, rating, gang count, finish and any weatherproofing requirement. Specify quantities for each configuration.',
  },
  {
    slug: 'conduits-fittings', name: 'Conduits & Fittings', tagline: 'Keep every run in order',
    alt: 'PVC electrical conduit pipes and fittings',
    description: 'Enquire about PVC electrical conduit and matching fittings for wiring runs, with collection arrangements from our Kingston depot.',
    checklist: 'Provide the conduit diameter, material and lengths required. List matching bends, couplings, adaptors and boxes separately so each quantity can be checked.',
  },
  {
    slug: 'tools-accessories', name: 'Tools & Accessories', tagline: 'Get the job done right',
    alt: 'UNI-T digital clamp meter',
    description: 'Ask about electrical test equipment, installation accessories and tools for trade and project work in Jamaica.',
    checklist: 'Send the tool or accessory type and any model or measurement requirements. For replacement accessories, include the equipment model they need to fit.',
  },
] as const;

export const categoryImage = (slug: string) => '/categories/' + slug + '.webp';
