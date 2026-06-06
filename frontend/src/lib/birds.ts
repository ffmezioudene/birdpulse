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
    readingMinutes: 5,
    body:
      "Identification gets easier the moment you stop trying to memorize 200 species at once. The trick is to look at the bird, not the field guide. A handful of habits — shape first, size against something familiar, bill shape, voice, behavior — will get you to the right answer faster than any plumage detail. Here's the order I use, in the order it actually matters.",
    sections: [
      {
        heading: 'Start with shape, not color',
        body:
          "Color is what most beginners reach for first, and it's the least reliable thing about a bird. Light angle, age, season, and individual variation all shift the colors you see. Shape doesn't. A chickadee's round head and short tail look the same in any light. A heron's S-curved neck and dagger bill are unmistakable from a mile away. When you spot something new, ignore the color for thirty seconds and ask: how big is the head relative to the body? Is the tail short and stubby or long and tapered? Are the wings pointed or rounded? You'll narrow it to a family — finch, thrush, warbler, raptor — before you ever say the word red.",
      },
      {
        heading: 'Size yourself a yardstick',
        body:
          "Saying 'medium-sized' is useless. Saying 'about the size of a House Sparrow' is gold. Pick three reference birds you know on sight — a sparrow, a robin, a crow — and measure every new bird against them. A bird that's robin-sized but stockier is probably a thrush or a starling. Crow-sized with broad wings? Almost certainly a hawk. This is the single fastest way to cut a field guide page from thirty candidates down to three. Apex birders do this without thinking about it. Force yourself to do it consciously for a season and it becomes automatic.",
      },
      {
        heading: 'The bill tells you what they eat',
        body:
          "Bills are evolution's most honest billboard. A finch's thick conical bill cracks seeds. A warbler's thin tweezers picks caterpillars off leaves. A heron's dagger spears fish. A hawk's hooked bill tears meat. Once you know the shape, you've narrowed the diet, which narrows the habitat, which narrows the species. A bird with a long, decurved bill probing mud is a curlew or sandpiper, not a sparrow — even if it's brown and streaky. Spend a minute studying bills in your field guide before your next outing. The pattern recognition kicks in surprisingly fast.",
      },
      {
        heading: 'Listen as carefully as you watch',
        body:
          "Half of the birds in any woodland are heard before they're seen, and many are only ever heard. A White-throated Sparrow's clear three-note whistle is easier to confirm than its barely-visible body in dense cover. The 'chick-a-dee-dee-dee' of a Black-capped Chickadee gives it away before you raise your binoculars. Use a sound ID tool (yes, like this app) to learn the regulars in your area, then start matching voices to species without checking. The first ten you commit to memory unlock a different way of birding — you'll start picking out the rare bird because its voice doesn't fit.",
      },
      {
        heading: 'Behavior is a fingerprint',
        body:
          "A nuthatch walks down a tree trunk head-first. A creeper walks up the trunk in spirals. A wagtail bobs its tail. A phoebe pumps its tail. A junco hops; a starling walks. A kingfisher hovers, then plunges. These behaviors are species-specific and visible at a great distance, often when color and size are useless. When you can't see a bird clearly, watch what it does for ten seconds. The behavior often gives you the species before the binoculars do.",
      },
      {
        heading: 'Build a mental shortlist',
        body:
          "In any given habitat at any given time of year, there are maybe 30-40 species you're likely to see — not 700. Learn those cold. Know the year-round residents, the summer breeders, the winter visitors, and the migrants for your patch. When you encounter something new, run through the shortlist first. Nine times out of ten, it's on the list. The tenth time is the rare bird that makes a great story. A small field notebook helps — three lines per sighting is enough, and within a single season you'll know your local cast on sight. Try identifying the next three birds you see using this order: shape, size, bill, voice, behavior. The answer comes faster than you'd expect.",
      },
      {
        heading: 'Try this next time you are outside',
        body:
          "Pick five common species in your area before your next walk — say, a sparrow, a finch, a thrush, a woodpecker, and a hawk. Look them up in this app, study their bills and silhouettes, listen to their songs, read the behavior notes. Then go outside and try to find all five. The first one you spot, run through the full checklist out loud: shape, size, bill, voice, behavior. By the third bird you'll be doing it in your head. By the fifth you'll feel something click — birds you've walked past for years will start to have names. Identification is a muscle. It strengthens the moment you start using it deliberately.",
      },
    ],
  },
  {
    id: 'attract-songbirds',
    topic: 'attract',
    title: 'The Fascinating World of Songbirds',
    subtitle: 'Why melody matters',
    image: 'https://images.unsplash.com/photo-1612095395498-5e2f3ae4d9a9?crop=entropy&cs=srgb&fm=jpg&q=85',
    readingMinutes: 5,
    body:
      "More than half of all bird species in the world are songbirds — the order Passeriformes, the perching birds, the singers. Their voices aren't decoration. Songs defend territory, attract mates, signal alarm, and pass information between generations. Once you understand what songbirds are actually doing when they sing, your garden becomes a more interesting place to stand still in.",
    sections: [
      {
        heading: 'What makes a songbird a songbird',
        body:
          "Songbirds share a specialized vocal organ called the syrinx, located where the windpipe splits into the lungs. Unlike our single-voiced larynx, the syrinx has two independent membranes — meaning a thrush can literally sing two notes at once, in harmony with itself. That's why the song of a Wood Thrush sounds like a flute duet: it is one. The brain wiring that controls this is so elaborate that songbirds learn their songs the way we learn language — from listening to adults during a critical young-bird period, with regional dialects and individual variations layered on top.",
      },
      {
        heading: 'Songs vs calls — they are different things',
        body:
          "When birders say 'song,' they mean the longer, more elaborate vocalization usually delivered by males in spring to declare territory and attract a mate. 'Calls' are the shorter, less musical sounds birds make all year round — chips, tseeps, scolds, contact notes between pair members, alarm signals at a hawk. A male Northern Cardinal sings a clear whistled song in spring; both sexes use a sharp 'chip' call all year. Learning the call notes is harder but unlocks late summer and winter birding, when songs largely stop and calls are all you've got.",
      },
      {
        heading: 'The dawn chorus is not a coincidence',
        body:
          "Songbirds sing hardest in the first hour after sunrise for three reasons. Insects aren't active yet, so feeding is a waste. The cool, still morning air carries sound farther than the warm, turbulent air of midday — a male can advertise to twice as much territory for the same calorie cost. And testosterone-driven motivation peaks at dawn during breeding season. If you've ever stood outside on a May morning and heard what feels like ten species singing at once, that's not your imagination — it's evolution timing a concert.",
      },
      {
        heading: 'Why songs vary by region',
        body:
          "A White-crowned Sparrow from Seattle sings a noticeably different song from one in Boston. These regional dialects emerge because young birds learn songs from local adults, accumulating drift over generations. In some cases the dialects are so distinct that researchers can identify a bird's hatching valley by its voice alone. Eastern and Western Meadowlarks were classified as one species until ornithologists realized they wouldn't respond to each other's songs — different language, no mating, two species. Voice is identity, in a literal biological sense.",
      },
      {
        heading: 'How to plant a soundtrack into your yard',
        body:
          "Songbirds need three things to settle and breed: shelter, water, and food they can feed to chicks. Native fruiting shrubs — serviceberry, elderberry, dogwood, viburnum — give cover and seasonal berries. A water source with movement (a dripper, a small fountain) draws them from blocks away; songbirds hear running water and orient toward it. Skip the pesticides: 96% of land birds feed their chicks caterpillars, not seeds, and a single chickadee brood needs roughly 6,000-9,000 caterpillars to fledge. A native oak in your yard supports hundreds of caterpillar species; a non-native ornamental supports almost none.",
      },
      {
        heading: 'Listening pairs to learn first',
        body:
          "Pick two species at a time and learn them by ear before adding a third. American Robin's clear caroling phrases vs Northern Cardinal's whistled 'cheer-cheer-cheer.' House Wren's bubbly cascade vs Carolina Wren's loud 'teakettle-teakettle-teakettle.' Song Sparrow's 'maids-maids-maids put on your tea kettle' vs the Chipping Sparrow's flat insect-like trill. Once a pair is locked, your ear builds the next pair around them. Within a month of casual listening you'll recognize a dozen voices — and the garden will sound completely different.",
      },
      {
        heading: 'Try this tomorrow morning',
        body:
          "Step outside half an hour after sunrise with a cup of coffee and no agenda. Don't bring binoculars on this first round — just listen. Count how many distinct voices you can hear. Most people, doing this for the first time, hear three or four. After a week of paying attention they hear seven or eight. After a month it's twelve. The voices were always there; you just stopped filtering them as noise. Then start matching: use the Sound ID feature in this app to confirm one voice at a time. Confirm the same species several mornings in a row and your brain locks it in permanently. Within a single spring you'll have ten regulars by ear, and the world will sound twice as alive on the way to work. The cardinal at the corner, the wren in the hedge, the robin in the magnolia — they were always there. You just hadn't met them yet.",
      },
    ],
  },
  {
    id: 'birding-hours',
    topic: 'all',
    title: 'The Golden Hours of Birdwatching',
    subtitle: 'When to head out',
    image: 'https://images.unsplash.com/photo-1593192925523-55b6bd063795?crop=entropy&cs=srgb&fm=jpg&q=85',
    readingMinutes: 4,
    body:
      "The single biggest variable in how many birds you see is not where you go — it's when. Birds run on solar time, on weather time, on insect time. A good location at the wrong hour shows you nothing. A mediocre location at the right hour shows you everything. Here's the timing playbook I'd give my own father if he was starting today.",
    sections: [
      {
        heading: 'The first 90 minutes after sunrise',
        body:
          "This is the richest window of the birding day, full stop. Males sing to defend territory before the day's work begins. Both sexes feed urgently after the night's fast. The cool, still air carries sound. And the low-angle light makes plumage glow — a Northern Cardinal at 6:30 AM is a different bird from a Northern Cardinal at noon. Set an alarm 30 minutes before sunrise, be in your spot when the first light hits the treetops, and stay until the chorus quiets. Two early hours beat a casual all-day walk every time.",
      },
      {
        heading: 'Why the late-afternoon window works',
        body:
          "The second-best slot is the last two hours before sunset. The day cools, insects rise into the warm boundary layer above the ground, and aerial insectivores — swallows, swifts, flycatchers, nighthawks — come out to hunt them. Songbirds visit feeders heavily before roosting. Raptors hunt actively in the warm thermals dying down. The light goes long and golden, perfect for photography. The chorus is shorter than dawn's, but the activity is concentrated and visible.",
      },
      {
        heading: 'Midday is for shaded specialists',
        body:
          "Between 11 AM and 3 PM, most birds in open habitats settle into the shade and don't move. This is when beginners give up. It's also when experienced birders shift habitat: walk a creek bed, a shaded woodlot, a wooded ravine. The species that live in dense cover — vireos, certain warblers, thrushes — are still active because the canopy keeps them cool. You won't hear a chorus, but you'll see birds doing what they do when they're not performing. It's a different style of birding — closer, slower, quieter.",
      },
      {
        heading: 'Weather windows that beat any time of day',
        body:
          "Two weather patterns trump the daily clock entirely. The first is the morning after a cold front passes during migration — the night's tailwind drops thousands of southbound or northbound birds into your patch overnight, and dawn is a feeding frenzy. The second is the calm two-hour window just after a multi-day rainstorm finally clears. Insects come out, birds come out, every leaf is wet and shining, and the air is full of song. Check the radar the night before a planned outing; it tells you whether tomorrow will be a fallout or a quiet day.",
      },
      {
        heading: 'Three habits that double your sightings',
        body:
          "First, stop walking. Most beginners walk too far, too fast. Pick a spot with mixed habitat — edge of a field, a creek crossing, a feeder station — and stand still for fifteen minutes. Birds that froze at your approach will resume activity. You'll see more in fifteen still minutes than in an hour of strolling. Second, look up sometimes. Beginners search at eye level; many species — hawks, woodpeckers, warblers — are in the canopy. Third, use your ears as your primary sensor and your eyes as confirmation. Sound carries through cover that vision cannot penetrate. Plan walks around the light, not the clock, and you'll see more in two hours than a casual visitor sees in a week.",
      },
      {
        heading: 'Try this weekend',
        body:
          "Set an alarm for 30 minutes before sunrise on Saturday. Make coffee, dress warm, walk out the door before the sky is fully light, and head to the nearest patch of habitat with cover and an edge — a park with a treeline, a creek with shrubs alongside, a cemetery with old oaks. Stand in one spot for the first fifteen minutes without moving. Then walk slowly along the edge for another half hour. Use this app to confirm any voices you can't place. You'll be back home before nine with a longer bird list than you'd believe possible from one short outing. Then try the same spot at 5 PM on Sunday — same place, completely different cast — and watch the afternoon hunters come out. Two two-hour windows beat any full-day midday wander.",
      },
      {
        heading: 'One more habit worth building',
        body:
          "Keep a small notebook — physical or in your phone — and log every outing: date, location, weather, what you saw. Three lines is enough. Within a year you'll have a personal phenology — when migrants arrive, when songs start, when nestlings fledge. That pattern is more valuable than any field guide because it's specifically about your patch. You'll start predicting things. The first Eastern Phoebe of spring almost always shows up at the bridge in mid-March. The waxwings strip the holly berries the second week of January. The Cooper's Hawk that hunts your feeder is the same bird year after year. The notebook turns birding from a series of moments into an ongoing relationship with a place.",
      },
    ],
  },
  {
    id: 'hummingbird-feeders',
    topic: 'hummingbirds',
    title: 'A Hummingbird Garden in One Weekend',
    subtitle: 'Feeders, flowers, fast wings',
    image: 'https://images.unsplash.com/photo-1596386447478-d71f5f8fea87?crop=entropy&cs=srgb&fm=jpg&q=85',
    readingMinutes: 5,
    body:
      "Hummingbirds are the cheapest wildlife show in the world. A clean feeder, the right sugar ratio, and a few well-chosen plants and you'll have them visiting within a week. They're also more demanding than they look: dirty feeders kill them, the wrong sugar harms them, and they need protein you can't put in a feeder. Done right, a small balcony can host dozens of birds a day during peak season.",
    sections: [
      {
        heading: 'The three things hummingbirds actually need',
        body:
          "Nectar is the fuel — they need their body weight in sugar water and flower nectar every day just to stay alive. Protein is the building material — they catch tiny flying insects (gnats, fruit flies, spiders raided from webs) for amino acids, and females must catch hundreds of them daily to feed nestlings. Perches are the recovery — they're not actually in flight 100% of the time; they spend 60-80% perched, watching their territory, conserving energy between feeding bouts. Give them all three and they'll stay. Give them only nectar and you'll get tourists, not residents.",
      },
      {
        heading: 'The right feeder recipe (and what NOT to use)',
        body:
          "One part plain white refined cane sugar to four parts water. Boil briefly to dissolve and to kill any yeast spores, then cool fully before filling. That's it. Do NOT use honey (ferments fast, breeds fungus that's fatal to hummingbirds), brown sugar (too much iron), turbinado or raw sugar (mineral content can harm them), or red dye (unnecessary — the feeder's red parts attract them just fine, and the dye is suspected to cause long-term liver damage). Change the solution every 2-3 days in warm weather, every 4-5 in cool weather. If it ever looks cloudy, smells off, or you see black mold inside the feeder, dump it and clean immediately.",
      },
      {
        heading: 'Plants that earn their keep',
        body:
          "Feeders pull hummingbirds in; plants keep them. Tubular red, orange, or hot-pink flowers are the magnet shape — they evolved together. Top performers across most North American climates: salvia (any species, particularly 'Black and Blue' and pineapple sage), cuphea (cigar plant), bee balm (Monarda), trumpet honeysuckle (the native Lonicera sempervirens, not the invasive Japanese kind), cardinal flower (Lobelia cardinalis) for moist spots, and trumpet vine for big spaces. Plant in a rough sequence so something is always blooming from May through frost. Even a single 24-inch pot of salvia on a balcony does the job.",
      },
      {
        heading: 'Where to hang the feeder',
        body:
          "Three criteria: visible from where you sit (or what's the point), a few feet from a perching twig or shrub (so they can rest between sips), and at least 4-5 feet from a window (closer than that and a startled bird hits the glass at full speed). Morning shade is gentler on the nectar than afternoon sun. Don't hang multiple feeders in line of sight of each other unless your space is huge — males defend feeders aggressively, and visible competition just means one bird hogs everything. Spread them around corners, behind shrubs.",
      },
      {
        heading: 'Cleaning is non-negotiable',
        body:
          "More feeders are killing birds than helping them because owners don't clean them. Every 2-3 days in summer, take the feeder fully apart, wash every surface (a bottle brush gets into the reservoir, a pipe cleaner gets into the feeding ports), rinse thoroughly, and refill with fresh solution. If you can't commit to that, take the feeder down — it's better than leaving fermented sugar out. Once a month, soak parts in a 1:4 vinegar:water solution to kill any black mold spores you can't see. Five minutes of work, but it's the difference between hosting hummingbirds and accidentally poisoning them.",
      },
      {
        heading: 'The first migrants arrive on a schedule',
        body:
          "Ruby-throated Hummingbirds reach the Gulf Coast in mid-March, the Mid-Atlantic by mid-April, and southern Canada by mid-May. Anna's Hummingbirds are year-round residents along the Pacific Coast. Rufous Hummingbirds pour through the Mountain West in April and back south in July-August. Put your feeder out two weeks before the first historical arrival in your zip code — early migrants are exhausted and a fresh feeder is a lifesaver. Take note of the date the first male arrives; he'll be back almost to the day next year, and his hatch-year grandchildren after that. Sit still — they tolerate stillness, not movement. After a few sessions they'll feed inches from your face.",
      },
      {
        heading: 'Set the garden up this weekend',
        body:
          "If you have just one Saturday afternoon: buy one quality glass feeder with a built-in ant moat (the plastic Walmart ones harbor mold), one pound of plain cane sugar, and two 1-gallon pots of salvia from the nursery. Mix the syrup the way described above. Hang the feeder where you'll see it from breakfast. Plant the salvia in the morning sun. Total cost: under thirty dollars. First visitor usually within a week of hanging, sometimes the same afternoon during spring migration. Once you have them, the work is simple: keep the syrup fresh, keep the feeder clean, sit outside more. Try identifying which species visit using the Photo ID in this app — most yards have one or two regular species, but during migration you'll catch surprises passing through.",
      },
    ],
  },
  {
    id: 'spring-migration',
    topic: 'migration',
    title: 'Spring Migration in 60 Seconds',
    subtitle: 'What to look for in April–May',
    image: 'https://images.unsplash.com/photo-1593192925523-55b6bd063795?crop=entropy&cs=srgb&fm=jpg&q=85',
    readingMinutes: 4,
    body:
      "Spring migration is the closest thing North American birding has to a championship event. Hundreds of millions of birds funnel north over a few short weeks, and most of them are wearing breeding plumage so vivid you'll think someone turned up the saturation on the world. Miss the window and you wait a year. Read it right and you have the best three weeks of birding you'll do all season.",
    sections: [
      {
        heading: 'Why spring is the spectacle',
        body:
          "Two things make spring migration richer than fall. First, birds are in fresh breeding plumage — males especially are vibrant, structurally important field marks are crisp, and many species look genuinely different from their drab fall selves. A male Blackburnian Warbler in May has a fluorescent orange throat that stops you in your tracks; in October the same bird is muted gray-yellow and easily missed. Second, males are singing on territory along the way. You can identify a Cerulean Warbler at the top of an oak by voice when you'd never see it through the leaves.",
      },
      {
        heading: 'The peak is narrower than you think',
        body:
          "Across most of the eastern United States, the warbler peak compresses into about 10 days in early-to-mid May. Further north (Maine, southern Canada) it's mid-to-late May. In the Southeast and Gulf Coast it's late April. The compression means that during peak, a single woodlot can hold 20+ warbler species in a single morning — and three days before or after, the same woodlot might hold five. Track the historical peak for your latitude (eBird's bar charts show it clearly) and clear your calendar around that week.",
      },
      {
        heading: 'Read the night radar',
        body:
          "Most songbirds migrate at night, riding favorable south or southwest tailwinds. Doppler weather radar picks up the biomass of millions of nocturnal migrants as a soft green bloom expanding outward from their dawn descent points. BirdCast (birdcast.info) translates this into county-level migration forecasts you can check the evening before a planned outing. If the forecast shows heavy movement south of you tonight, pack a thermos — the dawn after will be a fallout day. If it shows nothing, sleep in.",
      },
      {
        heading: 'What a fallout looks like',
        body:
          "A 'fallout' happens when a flying mass of migrants hits unfavorable weather — usually a north wind or rain — and is forced down into whatever cover is nearest. Coastal woodlots after a Gulf-crossing storm are the textbook setting: a half-acre of stunted oaks on the Texas coast can hold 30 species and hundreds of individual warblers, vireos, tanagers, thrushes, and orioles all foraging at eye level because they're exhausted. Inland, look for the same effect at small wooded parks during peak week — they concentrate birds because the surrounding habitat is hostile (urban, agricultural). Don't drive to a famous site — walk the small park three blocks from your house at 6 AM after a north wind. You'll be surprised.",
      },
      {
        heading: 'The warbler-neck species you will actually see',
        body:
          "Of the 35 or so warbler species in eastern North America, a dozen do the heavy lifting at most stopover sites: Yellow-rumped, Yellow, Common Yellowthroat, Black-and-white, American Redstart, Magnolia, Black-throated Green, Black-throated Blue, Chestnut-sided, Blackpoll, Northern Parula, and Tennessee. Learn these twelve by sight AND song before peak week — most are detected by ear in the canopy, then chased visually. The rare ones are bonuses; the regulars are the lesson. Western US species shift toward Wilson's, Townsend's, Hermit, MacGillivray's, Yellow-rumped (Audubon's form), and Orange-crowned — different cast, same concept.",
      },
      {
        heading: 'Three rules for the chase',
        body:
          "First, go early. Be on site at sunrise. Half of the action is over by 9 AM as birds settle into the canopy. Second, walk slowly and stop often. Migrating birds move through a site as a wave — stand still and the wave comes to you. Third, embrace the ones you can't see clearly. A warbler heard well-enough at the top of a 60-foot oak is a real sighting; you don't need a photo for it to count. Spring migration is small and short and intense. Bring a thermos. The window is narrow, the reward enormous.",
      },
      {
        heading: 'Plan your week around the peak',
        body:
          "Two weeks before your historical peak date, start checking BirdCast nightly. The evening it predicts heavy movement is the morning you call in late to work. Walk a small park — the woodlot behind your office, the cemetery near home, the city park three blocks away. Don't drive an hour to a famous spot; the warblers are the same warblers, and the close one means you can stay until activity drops. Use this app's Sound ID to confirm what you're hearing in the canopy. Log every species. Three days of this in the right window will give you more new birds than a casual year. Then, in October, do the same exercise in reverse — fall migration is quieter, the plumages are drabber, but the volume of birds is actually higher, and the season runs longer.",
      },
    ],
  },
  {
    id: 'backyard-chickens',
    topic: 'poultry',
    title: 'Backyard Poultry, Honestly',
    subtitle: 'What no one tells you',
    image: 'https://images.unsplash.com/photo-1569402928543-87a35efc0606?crop=entropy&cs=srgb&fm=jpg&q=85',
    readingMinutes: 5,
    body:
      "Backyard chickens are having a moment, and most of the romantic guides about them gloss over the parts that send first-time owners back to buying eggs from the supermarket within a year. The setup is simple enough. The reality is more demanding than 'easier than a dog, harder than a goldfish' implies. Here's what the cheerful blog posts left out.",
    sections: [
      {
        heading: 'Chickens vs the romance',
        body:
          "The fantasy version: a few hens roaming a sunny yard, an egg basket on the kitchen counter every morning. The actual version: a hens-on-the-patio mess of dust baths, scattered feed, dropping splatter on the deck, and a coop that has to be cleaned every weekend. Chickens are not pets in the dog sense; they're livestock with personalities. Some will sit on your lap. Most won't. They scratch up your garden enthusiastically — every flowerbed within their range will be excavated within a season unless you fence specifically against them. Start with this expectation set correctly and you'll enjoy them more.",
      },
      {
        heading: 'Coop reality',
        body:
          "A coop needs four square feet of indoor floor per bird, ten square feet of outdoor run per bird, one foot of linear roost per bird (roosts about 18 inches off the floor), one nesting box per 3-4 hens, and ventilation at the roof line that doesn't create a draft at roost level. It must be predator-proof: 1/4-inch hardware cloth (NOT chicken wire — raccoons rip chicken wire like tissue paper), buried 12 inches deep along the perimeter to stop digging predators, and locking latches that a raccoon can't open. (They can open simple slide bolts. Carabiner clips defeat them.) Skimp on any of these and you'll wake up to a massacre within the first six months. Most backyard chicken deaths are predator-related.",
      },
      {
        heading: 'What kind of birds — and skip the chicks if you can',
        body:
          "The famously easy starter breeds are Australorps, Buff Orpingtons, Plymouth Rocks, Wyandottes, and the various 'Easter Egger' crosses. They're calm, cold-hardy, and lay reliably. Starting from day-old chicks sounds adorable but means a heat lamp (a real fire risk), six weeks of indoor brooder mess, the chance some will turn out to be roosters (illegal in many cities, loud everywhere), and zero eggs for four to five months. Start instead with point-of-lay pullets (16-20 weeks old) from a small farm or a 4-H seller. You skip the riskiest phase, you know the sex, and they'll lay within weeks of arriving home.",
      },
      {
        heading: 'The predator problem is constant',
        body:
          "Once you have chickens, you have a predator concentration. Raccoons, foxes, coyotes, weasels, neighborhood dogs, and (depending on region) hawks, owls, snakes, bobcats, and bears all show up sooner or later. The day a fox figures out your run is a day you remember. Predators learn — once one gets a bird, it WILL come back, often nightly, until your defenses change. Standard advice: birds locked in a fully enclosed coop overnight, run reinforced on all six sides (yes, including a wire top against hawks and climbing predators), and a battery-powered motion-light or two as deterrents. Insurance against the inevitable bad night.",
      },
      {
        heading: 'Eggs are a side benefit, not the main story',
        body:
          "A healthy hen lays roughly 5 eggs a week during peak season, dropping to 2-3 in winter and zero during her annual late-summer molt. Three hens give a small family a steady but not overwhelming supply. Six is plenty for most households. Egg quality genuinely is better than supermarket — deeper-colored yolks, firmer whites — because the birds eat bugs and greens daily. But the cost-per-egg, factoring coop construction, feed, bedding, and time, is comfortably higher than store eggs unless you scale large. People who do this for the eggs get disappointed. People who do it for the daily entertainment of watching small dinosaurs run around the yard stay with it.",
      },
      {
        heading: 'Hidden costs no one mentions',
        body:
          "Vacations get harder — chicken-sitters are rarer than dog-sitters and cost more. Feed prices spike with grain markets. Hens get sick: respiratory infections, egg-bound emergencies, mites, lice, internal parasites — most of which require treating the whole flock at once. Lifespan is 6-10 years, but laying drops sharply after year 3 and stops by year 5; you'll be feeding birds that don't produce, or you'll have to make a hard decision. None of this is a reason NOT to keep chickens — it's a reason to go in with eyes open. The conversation they hold all day is unexpectedly companionable, and a fresh egg cracked into a hot pan is a small private luxury. Just don't romanticize the rest of it.",
      },
      {
        heading: 'Before you start, do this',
        body:
          "Spend a Saturday at a local farm with chickens — most small farms welcome a visit if you ask politely a week ahead. Watch the chores: the morning feed, the egg collection, the coop check, the predator inspection. Smell the coop on a humid day. Watch a hen get caught when she doesn't want to be caught. Notice how much of the yard is unrecognizably scratched up. Ask the farmer what their hardest year was, what they wish they'd known on day one, and what they'd do differently. An hour of honest observation tells you more than ten cheerful YouTube videos. If you come away energized — start. If you come away thinking 'maybe a really good farmer's market subscription instead' — that's also a valid answer. Either way, you'll have made the decision honestly.",
      },
    ],
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
