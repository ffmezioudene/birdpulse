// Static bird catalog (mirror of backend seed) for instant rendering without network.
import { CatalogBird } from './api';

export const SEED_BIRDS: CatalogBird[] = [
  {
    id: 'northern-cardinal',
    commonName: 'Northern Cardinal',
    scientificName: 'Cardinalis cardinalis',
    category: 'Songbirds',
    image: 'https://images.unsplash.com/photo-1511876484235-b5246a4d6dd5?crop=entropy&cs=srgb&fm=jpg&q=85',
    shortDescription:
      'A vivid red songbird with a prominent crest and black face mask. Males are brilliant red; females warm tawny brown with red accents.',
    habitat: 'Woodland edges, gardens, shrublands across eastern and central North America.',
    diet: 'Seeds, grains, fruits, and insects.',
    size: '21–23 cm',
    wingspan: '25–31 cm',
    wingShape: 'Rounded, short and broad',
    genus: 'Cardinalis',
    family: 'Cardinalidae',
    order: 'Passeriformes',
    howToIdentify:
      'Look for the bold crest, thick orange-red conical bill, and black face mask. Males are entirely brilliant red; females are warm buff-brown with red highlights on the crest, wings, and tail.',
    nestingBehavior:
      'Builds a loose cup-shaped nest of twigs, grasses, and bark in dense shrubs 1–4 m off the ground. Lays 2–5 pale greenish eggs. Female incubates while the male feeds her; both feed the chicks.',
    migrationStatus: 'Year-round resident',
    funFacts: [
      'Both males and females sing — uncommon among North American songbirds.',
      'Cardinals mate for life and stay together year-round.',
      'Their crest raises when alarmed or excited.',
    ],
    rangeSummary: 'Eastern and central United States, Mexico, year-round resident.',
    conservationStatus: 'Least Concern',
  },
  {
    id: 'blue-jay',
    commonName: 'Blue Jay',
    scientificName: 'Cyanocitta cristata',
    category: 'Songbirds',
    image: 'https://images.pexels.com/photos/32715552/pexels-photo-32715552.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    shortDescription: 'Striking blue, white, and black corvid known for its intelligence and bold personality.',
    habitat: 'Forests, parks, and suburban yards across eastern and central North America.',
    diet: 'Nuts, seeds, insects, and occasionally small vertebrates.',
    size: '25–30 cm',
    wingspan: '34–43 cm',
    wingShape: 'Broad and rounded',
    genus: 'Cyanocitta',
    family: 'Corvidae',
    order: 'Passeriformes',
    howToIdentify:
      'Bright blue upperparts barred with black, white wing patches, a tall crest, and a bold black necklace across a white throat.',
    nestingBehavior:
      'Both sexes build a bulky stick nest in a tree fork 3–10 m up. Lays 4–5 olive-buff eggs. Pairs are monogamous and may reuse the territory year after year.',
    migrationStatus: 'Partial migrant — many populations are year-round residents',
    funFacts: [
      'Blue Jays can mimic hawk calls to scare off other birds.',
      'Their blue color comes from light refraction, not pigment.',
      'They cache acorns and help oak forests regenerate.',
    ],
    rangeSummary: 'Eastern and central US and Canada, year-round resident.',
    conservationStatus: 'Least Concern',
  },
  {
    id: 'bald-eagle',
    commonName: 'Bald Eagle',
    scientificName: 'Haliaeetus leucocephalus',
    category: 'Birds of Prey',
    image: 'https://images.unsplash.com/photo-1747107187735-06e1d2d92b87?crop=entropy&cs=srgb&fm=jpg&q=85',
    shortDescription:
      "America's national bird — a massive raptor with a white head, dark brown body, and powerful yellow beak.",
    habitat: 'Near large bodies of water across North America.',
    diet: 'Primarily fish, but also waterfowl and carrion.',
    size: '70–102 cm',
    wingspan: '1.8–2.3 m',
    wingShape: 'Long, broad, plank-like with finger-tipped primaries',
    genus: 'Haliaeetus',
    family: 'Accipitridae',
    order: 'Accipitriformes',
    howToIdentify:
      'Adults are unmistakable — white head and tail contrasting with a dark chocolate-brown body and a massive yellow hooked beak. Juveniles are mottled brown and white for ~5 years.',
    nestingBehavior:
      'Builds enormous stick nests near water, often reused and added to for decades — some weigh over a ton. Lays 1–3 white eggs; both parents incubate ~35 days.',
    migrationStatus: 'Partial migrant — northern birds move south in winter',
    funFacts: [
      'Bald Eagles can dive at speeds up to 100 mph.',
      'Nests can weigh over a ton and be reused for decades.',
      'Removed from the US endangered list in 2007 after dramatic recovery.',
    ],
    rangeSummary: 'Across most of North America; coastal and inland waterways.',
    conservationStatus: 'Least Concern',
  },
  {
    id: 'mallard-duck',
    commonName: 'Mallard',
    scientificName: 'Anas platyrhynchos',
    category: 'Waterfowl',
    image: 'https://images.unsplash.com/photo-1585533530535-2f4236949d08?crop=entropy&cs=srgb&fm=jpg&q=85',
    shortDescription: 'The most familiar dabbling duck — males display an iridescent green head and white neck ring.',
    habitat: 'Ponds, lakes, rivers, and wetlands worldwide.',
    diet: 'Aquatic plants, seeds, insects, and small crustaceans.',
    size: '50–65 cm',
    wingspan: '81–98 cm',
    wingShape: 'Pointed, falcate — built for fast, direct flight',
    genus: 'Anas',
    family: 'Anatidae',
    order: 'Anseriformes',
    howToIdentify:
      'Males in breeding plumage show a glossy green head, white neck ring, chestnut breast, and curled black tail feathers. Females are mottled brown with a blue speculum bordered in white.',
    nestingBehavior:
      'Female builds a down-lined nest on the ground near water. Lays 7–13 pale greenish-buff eggs and incubates alone for ~28 days. Ducklings are precocial and follow her to water within a day.',
    migrationStatus: 'Migratory — currently following seasonal water',
    funFacts: [
      'Almost all domestic ducks descend from Mallards.',
      'They can fly up to 55 mph during migration.',
      'Female Mallards say "quack"; males make a softer, raspier call.',
    ],
    rangeSummary: 'Throughout North America, Europe, and Asia.',
    conservationStatus: 'Least Concern',
  },
  {
    id: 'ruby-throated-hummingbird',
    commonName: 'Ruby-throated Hummingbird',
    scientificName: 'Archilochus colubris',
    category: 'Hummingbirds',
    image: 'https://images.unsplash.com/photo-1596117803277-6142bb2ae8ef?crop=entropy&cs=srgb&fm=jpg&q=85',
    shortDescription: 'A tiny, dazzling hummingbird — males flash a brilliant ruby throat in sunlight.',
    habitat: 'Gardens, woodland edges, and parks across eastern North America.',
    diet: 'Flower nectar, tree sap, and small insects.',
    size: '7–9 cm',
    wingspan: '8–11 cm',
    wingShape: 'Narrow, pointed, capable of hovering and reverse flight',
    genus: 'Archilochus',
    family: 'Trochilidae',
    order: 'Apodiformes',
    howToIdentify:
      'Emerald-green back, white underparts. Males show a brilliant iridescent red gorget that flashes in direct light; females have a plain white throat and rounded tail with white tips.',
    nestingBehavior:
      'Female builds a thimble-sized cup of plant down bound with spider silk, decorated with lichen, on a downward-sloping branch. Lays 2 pea-sized white eggs; she raises chicks alone.',
    migrationStatus: 'Long-distance migrant — currently breeding east (Apr–Sep) or wintering in Central America',
    funFacts: [
      'They beat their wings 53 times per second.',
      'Some cross the Gulf of Mexico nonstop — 800 km in 18–22 hours.',
      'Their hearts can beat over 1,200 times per minute.',
    ],
    rangeSummary: 'Eastern North America in summer; Central America in winter.',
    conservationStatus: 'Least Concern',
  },
  {
    id: 'american-robin',
    commonName: 'American Robin',
    scientificName: 'Turdus migratorius',
    category: 'Songbirds',
    image: 'https://images.unsplash.com/photo-1592333281587-d57aaeacdc55?crop=entropy&cs=srgb&fm=jpg&q=85',
    shortDescription:
      'A familiar large thrush with a warm orange breast and gray-brown back — herald of spring.',
    habitat: 'Lawns, gardens, woodlands, and parks across North America.',
    diet: 'Earthworms, insects, and fruit.',
    size: '23–28 cm',
    wingspan: '31–41 cm',
    wingShape: 'Rounded, fairly long for a thrush',
    genus: 'Turdus',
    family: 'Turdidae',
    order: 'Passeriformes',
    howToIdentify:
      'Warm orange-red breast and belly, slate-gray back and head, white throat streaked with black, and a yellow bill. Females are slightly paler.',
    nestingBehavior:
      'Female builds a sturdy cup of mud and grass on a branch or ledge. Lays 3–5 sky-blue eggs and incubates ~14 days. Up to three broods per year.',
    migrationStatus: 'Short-distance migrant — flocks shift south for winter',
    funFacts: [
      'Robins often run, stop, and tilt their heads to spot worms.',
      'They can produce up to three broods per year.',
      'Their distinctive song is one of the earliest at dawn chorus.',
    ],
    rangeSummary: 'Across North America; northern populations migrate.',
    conservationStatus: 'Least Concern',
  },
  {
    id: 'black-capped-chickadee',
    commonName: 'Black-capped Chickadee',
    scientificName: 'Poecile atricapillus',
    category: 'Songbirds',
    image: 'https://images.unsplash.com/photo-1604326531570-2689ea7ec73f?crop=entropy&cs=srgb&fm=jpg&q=85',
    shortDescription: 'A tiny, curious bird with a black cap and bib, white cheeks, and a buffy belly.',
    habitat: 'Mixed and deciduous forests, parks, and feeders in northern North America.',
    diet: 'Insects, seeds, and berries.',
    size: '12–15 cm',
    wingspan: '16–21 cm',
    wingShape: 'Short and rounded',
    genus: 'Poecile',
    family: 'Paridae',
    order: 'Passeriformes',
    howToIdentify:
      'Sharp black cap and bib, bright white cheeks, gray back, and warm buff sides. Compare to the Carolina Chickadee, which has a cleaner edge to the bib and less white in the wing.',
    nestingBehavior:
      'Excavates or uses cavities in rotten wood. Female lines the cavity with moss and fur. Lays 6–8 white eggs spotted reddish-brown; incubates ~12 days.',
    migrationStatus: 'Year-round resident',
    funFacts: [
      "Their 'chick-a-dee' call adds 'dee' notes based on threat level.",
      'They can remember thousands of food cache locations.',
      'They lower their body temperature at night to conserve energy.',
    ],
    rangeSummary: 'Northern US and Canada, year-round.',
    conservationStatus: 'Least Concern',
  },
  {
    id: 'great-horned-owl',
    commonName: 'Great Horned Owl',
    scientificName: 'Bubo virginianus',
    category: 'Birds of Prey',
    image: 'https://images.unsplash.com/photo-1744959055063-b217124d3429?crop=entropy&cs=srgb&fm=jpg&q=85',
    shortDescription: 'A powerful nocturnal raptor with prominent ear tufts and piercing yellow eyes.',
    habitat: 'Forests, deserts, swamps, and city parks across the Americas.',
    diet: 'Mammals, birds, reptiles — even skunks and porcupines.',
    size: '46–63 cm',
    wingspan: '1.0–1.5 m',
    wingShape: 'Broad and rounded, silent in flight',
    genus: 'Bubo',
    family: 'Strigidae',
    order: 'Strigiformes',
    howToIdentify:
      "Massive, stocky owl with widely spaced ear tufts, a white throat patch, mottled gray-brown plumage, and intense yellow eyes. The deep 'hoo-hoo hooo hoo-hoo' is unmistakable.",
    nestingBehavior:
      'Does not build its own nest — takes over old hawk, crow, or squirrel nests. Lays 1–4 dull white eggs in late winter. Incubation ~33 days; chicks fledge at 6–7 weeks.',
    migrationStatus: 'Year-round resident',
    funFacts: [
      'Their grip strength is roughly 500 psi — far stronger than a human hand.',
      'They have asymmetrical ear openings to pinpoint prey in the dark.',
      'They are one of the earliest nesting birds, often starting in January.',
    ],
    rangeSummary: 'Throughout the Americas, year-round.',
    conservationStatus: 'Least Concern',
  },
];

export const CATEGORIES = [
  {
    id: 'Songbirds',
    title: 'Songbirds',
    image: 'https://images.unsplash.com/photo-1612095395498-5e2f3ae4d9a9?crop=entropy&cs=srgb&fm=jpg&q=85',
  },
  {
    id: 'Birds of Prey',
    title: 'Birds of Prey',
    image: 'https://images.pexels.com/photos/33349105/pexels-photo-33349105.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  },
  {
    id: 'Hummingbirds',
    title: 'Hummingbirds',
    image: 'https://images.unsplash.com/photo-1596386447478-d71f5f8fea87?crop=entropy&cs=srgb&fm=jpg&q=85',
  },
  {
    id: 'Waterfowl',
    title: 'Waterfowl',
    image: 'https://images.unsplash.com/photo-1715560016731-65dd8dba2819?crop=entropy&cs=srgb&fm=jpg&q=85',
  },
];

export const EXPLORE_TOPICS = [
  { id: 'all', title: 'All', icon: 'sparkles-outline' },
  { id: 'attract', title: 'Attracting Birds', icon: 'leaf-outline' },
  { id: 'hummingbirds', title: 'Hummingbirds', icon: 'flower-outline' },
  { id: 'migration', title: 'Migration', icon: 'compass-outline' },
  { id: 'poultry', title: 'Poultry', icon: 'egg-outline' },
];

export const EXPLORE_ARTICLES = [
  {
    id: 'identify-breeds',
    topic: 'all',
    title: 'How to Identify Different Breeds',
    subtitle: 'A field guide for new birders',
    image: 'https://images.unsplash.com/photo-1569402928543-87a35efc0606?crop=entropy&cs=srgb&fm=jpg&q=85',
    body:
      "Identification rewards patience. Start with size — compare the bird to a familiar one nearby. Note the silhouette, the bill shape, the wing pattern in flight, and any obvious field marks like wing bars or eye rings. Listen as carefully as you watch: a song often clinches the ID when plumage is ambiguous. Build a mental shortlist of the most common species in your habitat, then work outward to rarer guesses. Keep a small field notebook — three lines per sighting is enough — and within a season you'll recognize the regulars on sight.",
  },
  {
    id: 'attract-songbirds',
    topic: 'attract',
    title: 'The Fascinating World of Songbirds',
    subtitle: 'Why melody matters',
    image: 'https://images.unsplash.com/photo-1612095395498-5e2f3ae4d9a9?crop=entropy&cs=srgb&fm=jpg&q=85',
    body:
      "Songbirds — the Passeriformes — are nature's poets. Their songs are simultaneously territorial defense, mate attraction, and identity. Each species has a unique voice; many individuals have personal variations within that voice. To attract songbirds, plant native shrubs that fruit in different seasons, add a moving-water bath, and skip pesticides so caterpillars stay on the menu for hungry chicks. Within a month you'll hear a chorus that wasn't there before.",
  },
  {
    id: 'birding-hours',
    topic: 'all',
    title: 'The Golden Hours of Birdwatching',
    subtitle: 'When to head out',
    image: 'https://images.unsplash.com/photo-1593192925523-55b6bd063795?crop=entropy&cs=srgb&fm=jpg&q=85',
    body:
      "The first 90 minutes after sunrise are the richest hours of the birding day. Males sing to declare territory, both sexes feed urgently, and the soft light makes plumage glow. The late afternoon is the second-best window — the air cools, insects rise, and swallows and swifts come out to hunt. Midday is for shaded woodlands and water edges. Plan your walks around the light, not the clock, and you'll see more in two hours than a casual visitor sees in a week.",
  },
  {
    id: 'hummingbird-feeders',
    topic: 'hummingbirds',
    title: 'A Hummingbird Garden in One Weekend',
    subtitle: 'Feeders, flowers, fast wings',
    image: 'https://images.unsplash.com/photo-1596386447478-d71f5f8fea87?crop=entropy&cs=srgb&fm=jpg&q=85',
    body:
      "Hummingbirds need three things: nectar, perches, and protein. Hang one feeder per balcony filled with 1:4 white sugar to water — no dye, no honey, changed every 3 days in heat. Add a tubular flower like salvia or cuphea nearby. Leave a few small twigs for them to rest on between bouts. A garden spider's web means tiny insects, which the females need to feed their chicks. Sit still; they tolerate stillness, not movement.",
  },
  {
    id: 'spring-migration',
    topic: 'migration',
    title: 'Spring Migration in 60 Seconds',
    subtitle: 'What to look for in April–May',
    image: 'https://images.unsplash.com/photo-1593192925523-55b6bd063795?crop=entropy&cs=srgb&fm=jpg&q=85',
    body:
      "Spring migration peaks in your area around the second week of May. Warblers move at night and drop into woodlots at dawn to refuel — go early, walk slowly, listen up. Check radar maps the evening before; if the skies south of you light up green and yellow, the next morning will be a 'fallout'. Bring a thermos. The window is small, the reward enormous.",
  },
  {
    id: 'backyard-chickens',
    topic: 'poultry',
    title: 'Backyard Poultry, Honestly',
    subtitle: 'What no one tells you',
    image: 'https://images.unsplash.com/photo-1569402928543-87a35efc0606?crop=entropy&cs=srgb&fm=jpg&q=85',
    body:
      "Chickens are easier than dogs, harder than fish. They want a dry coop, a foot of roost per bird, dust to bathe in, and protection from raccoons. Skip the chicks-in-the-bathtub phase if you can — start with point-of-lay pullets from a small farm. Three hens give you enough eggs for breakfast all year. The conversation they hold all day is unexpectedly companionable.",
  },
];

export const ONBOARDING_IMAGES = [
  'https://images.pexels.com/photos/14293820/pexels-photo-14293820.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1300&w=900',
  'https://images.unsplash.com/photo-1593192925523-55b6bd063795?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
  'https://images.unsplash.com/photo-1520638023360-6def43369781?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
  'https://images.unsplash.com/photo-1612095395498-5e2f3ae4d9a9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
  'https://images.pexels.com/photos/30363520/pexels-photo-30363520.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1300&w=900',
];

export const PAYWALL_BG =
  'https://images.pexels.com/photos/29082522/pexels-photo-29082522.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1400&w=900';

export const OWL_AVATAR =
  'https://customer-assets.emergentagent.com/job_birdscan-pro/artifacts/5lkugvxg_image.png';
