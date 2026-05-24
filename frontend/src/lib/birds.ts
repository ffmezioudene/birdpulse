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
    size: '70–102 cm; wingspan 1.8–2.3 m',
    funFacts: [
      'Bald Eagles can dive at speeds up to 100 mph.',
      'Nests can weigh over a ton and be reused for decades.',
      'Removed from US endangered list in 2007 after dramatic recovery.',
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
    size: '46–63 cm; wingspan 1–1.5 m',
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
    id: 'Birds_of_Prey',
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
  { id: 'attract', title: 'Attracting Birds', icon: 'leaf-outline' },
  { id: 'hummingbirds', title: 'Hummingbirds', icon: 'flower-outline' },
  { id: 'migration', title: 'Migration', icon: 'compass-outline' },
  { id: 'poultry', title: 'Poultry', icon: 'egg-outline' },
];

export const EXPLORE_ARTICLES = [
  {
    id: 'identify-breeds',
    title: 'How to Identify Different Breeds',
    subtitle: 'A field guide for new birders',
    image: 'https://images.unsplash.com/photo-1569402928543-87a35efc0606?crop=entropy&cs=srgb&fm=jpg&q=85',
  },
  {
    id: 'attract-songbirds',
    title: 'The Fascinating World of Songbirds',
    subtitle: 'Why melody matters',
    image: 'https://images.unsplash.com/photo-1612095395498-5e2f3ae4d9a9?crop=entropy&cs=srgb&fm=jpg&q=85',
  },
  {
    id: 'birding-hours',
    title: 'The Golden Hours of Birdwatching',
    subtitle: 'When to head out',
    image: 'https://images.unsplash.com/photo-1593192925523-55b6bd063795?crop=entropy&cs=srgb&fm=jpg&q=85',
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
  'https://images.unsplash.com/photo-1720210534279-ac8c50a53e82?crop=entropy&cs=srgb&fm=jpg&q=85&w=400';
