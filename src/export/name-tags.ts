/**
 * MakerWorld tags a cutter's name suggests: what is named, then what goes
 * with it – its occasion, season, kind. Keys of three letters or less, and
 * keys marked “=”, count only as whole words (plurals too: “cats”); longer
 * ones also inside others (“Snowflakes”, “Gingerbreadman”).
 */
const POOL: [keys: string[], tags: string[]][] = [
  // Occasions
  [
    ["christmas", "xmas", "=advent"],
    ["christmas", "xmas", "holiday", "winter"],
  ],
  [["halloween"], ["halloween", "spooky", "autumn"]],
  [["easter"], ["easter", "spring"]],
  [["birthday"], ["birthday", "party", "celebration"]],
  [["valentine"], ["valentine", "love", "heart"]],
  [
    ["wedding", "bride", "groom"],
    ["wedding", "love"],
  ],
  [["engagement"], ["engagement", "wedding", "love"]],
  [["anniversary"], ["anniversary", "love", "celebration"]],
  [["bachelorette"], ["bachelorette", "wedding", "party"]],
  [
    ["mothersday", "mother's day", "mothers day"],
    ["mothersday", "mom", "love"],
  ],
  [
    ["fathersday", "father's day", "fathers day"],
    ["fathersday", "dad"],
  ],
  [
    ["new year", "newyear"],
    ["newyear", "party", "celebration"],
  ],
  [
    ["lunar new year", "chinese new year"],
    ["lunarnewyear", "chinesenewyear"],
  ],
  [["carnival"], ["carnival", "party"]],
  [["mardi gras"], ["mardigras", "carnival", "party"]],
  [
    ["st patrick", "st. patrick", "saint patrick"],
    ["stpatricksday", "irish", "luck"],
  ],
  [
    ["4th of july", "fourth of july", "independence day"],
    ["4thofjuly", "usa", "summer"],
  ],
  [["thanksgiving"], ["thanksgiving", "autumn"]],
  [
    ["hanukkah", "chanukah"],
    ["hanukkah", "holiday"],
  ],
  [["diwali"], ["diwali", "holiday"]],
  [
    ["ramadan", "eid"],
    ["ramadan", "eid"],
  ],
  [
    ["day of the dead", "dia de los muertos", "sugar skull"],
    ["dayofthedead", "halloween"],
  ],
  [["oktoberfest"], ["oktoberfest", "bavaria"]],
  [["school"], ["school", "kids"]],
  [
    ["graduation", "graduate"],
    ["graduation", "school", "celebration"],
  ],
  [["retirement"], ["retirement", "celebration"]],
  [
    ["baptism", "christening"],
    ["baptism", "baby"],
  ],
  [["communion"], ["communion", "church"]],
  [["gender reveal"], ["genderreveal", "baby", "babyshower"]],
  [["baby"], ["baby", "babyshower"]],
  [["party"], ["party", "celebration"]],
  [["pride"], ["pride", "rainbow"]],
  [["=love"], ["love", "valentine"]],
  [["kiss"], ["kiss", "love"]],
  // Christmas and winter
  [["tree"], ["tree", "nature"]],
  [["christmas tree"], ["tree", "christmas"]],
  [
    ["fir", "=pine", "pinecone"],
    ["pine", "forest", "winter"],
  ],
  [["snowflake"], ["snowflake", "snow", "winter", "christmas"]],
  [["snowman"], ["snowman", "snow", "winter", "christmas"]],
  [
    ["snow globe", "snowglobe"],
    ["snowglobe", "snow", "christmas"],
  ],
  [["gingerbread"], ["gingerbread", "christmas", "baking"]],
  [
    ["reindeer", "rudolph"],
    ["reindeer", "christmas", "animal"],
  ],
  [
    ["santa", "saint nick"],
    ["santa", "christmas"],
  ],
  [["north pole"], ["northpole", "christmas", "santa"]],
  [["angel"], ["angel", "christmas"]],
  [
    ["=bell", "jingle"],
    ["bell", "christmas"],
  ],
  [
    ["candycane", "candy cane"],
    ["candycane", "christmas", "candy"],
  ],
  [
    ["ornament", "bauble"],
    ["ornament", "christmas"],
  ],
  [["stocking"], ["stocking", "christmas"]],
  [["wreath"], ["wreath", "christmas"]],
  [["mistletoe"], ["mistletoe", "christmas", "love"]],
  [["holly"], ["holly", "christmas"]],
  [["poinsettia"], ["poinsettia", "christmas", "flower"]],
  [["sleigh"], ["sleigh", "christmas", "winter"]],
  [
    ["elf", "elves"],
    ["elf", "christmas"],
  ],
  [
    ["present", "=gift"],
    ["present", "gift", "christmas", "birthday"],
  ],
  [["nutcracker"], ["nutcracker", "christmas"]],
  [
    ["nativity", "manger", "bethlehem"],
    ["nativity", "christmas"],
  ],
  [["candle"], ["candle", "advent"]],
  [
    ["sweater", "jumper"],
    ["sweater", "winter", "christmas"],
  ],
  [["mitten"], ["mitten", "winter"]],
  [["igloo"], ["igloo", "winter", "snow"]],
  [
    ["cocoa", "hot chocolate"],
    ["cocoa", "winter", "drink"],
  ],
  // Halloween
  [
    ["pumpkin", "jack o", "jack-o"],
    ["pumpkin", "halloween", "autumn"],
  ],
  [["ghost"], ["ghost", "halloween", "spooky"]],
  [["bat"], ["bat", "halloween", "spooky"]],
  [["=witch"], ["witch", "halloween", "spooky"]],
  [["spider"], ["spider", "halloween", "spooky"]],
  [
    ["spiderweb", "spider web", "cobweb"],
    ["spiderweb", "halloween", "spooky"],
  ],
  [["skull"], ["skull", "skeleton", "halloween", "spooky"]],
  [["skeleton"], ["skeleton", "halloween", "spooky"]],
  [["zombie"], ["zombie", "halloween", "spooky"]],
  [
    ["vampire", "dracula"],
    ["vampire", "halloween", "spooky"],
  ],
  [["werewolf"], ["werewolf", "halloween", "monster"]],
  [["monster"], ["monster", "halloween", "kids"]],
  [["mummy"], ["mummy", "halloween", "spooky"]],
  [["frankenstein"], ["frankenstein", "halloween", "monster"]],
  [["cauldron"], ["cauldron", "halloween", "witch"]],
  [["broom"], ["broom", "halloween", "witch"]],
  [["coffin"], ["coffin", "halloween", "spooky"]],
  [
    ["grave", "tombstone", "headstone"],
    ["grave", "halloween", "spooky"],
  ],
  [["haunted"], ["haunted", "halloween", "spooky"]],
  [["eyeball"], ["eyeball", "halloween", "spooky"]],
  [["black cat"], ["blackcat", "halloween"]],
  [["candy corn"], ["candycorn", "halloween", "candy"]],
  [["scarecrow"], ["scarecrow", "autumn", "halloween"]],
  [
    ["=crow", "raven"],
    ["crow", "raven", "bird", "halloween"],
  ],
  // Easter and spring
  [
    ["bunny", "rabbit", "=hare"],
    ["bunny", "rabbit", "easter", "animal"],
  ],
  [["egg"], ["egg", "easter"]],
  [["=chick"], ["chick", "easter", "bird"]],
  [["lamb"], ["lamb", "easter", "animal"]],
  [["carrot"], ["carrot", "easter", "vegetable"]],
  [["=basket"], ["basket", "easter"]],
  [["=cross"], ["cross", "faith"]],
  [["=dove"], ["dove", "peace", "bird"]],
  // Sky and weather
  [["heart"], ["heart", "love", "valentine"]],
  [
    ["=star", "starry"],
    ["star", "stars", "night"],
  ],
  [["shooting star"], ["shootingstar", "star", "night"]],
  [["moon"], ["moon", "night", "sky"]],
  [["crescent"], ["crescent", "moon", "night"]],
  [["sun"], ["sun", "summer"]],
  [["cloud"], ["cloud", "weather", "sky"]],
  [["rainbow"], ["rainbow", "kids", "colorful"]],
  [
    ["raindrop", "droplet"],
    ["raindrop", "rain", "weather"],
  ],
  [
    ["lightning", "thunder"],
    ["lightning", "weather"],
  ],
  [["tornado"], ["tornado", "weather"]],
  [
    ["planet", "saturn"],
    ["planet", "space"],
  ],
  [
    ["=earth", "world"],
    ["earth", "planet", "space"],
  ],
  [["comet"], ["comet", "space", "star"]],
  [["galaxy"], ["galaxy", "space", "star"]],
  // Plants and landscape
  [
    ["flower", "daisy", "blossom", "dandelion"],
    ["flower", "flowers", "spring", "garden"],
  ],
  [["rose"], ["rose", "flower", "love"]],
  [["tulip"], ["tulip", "flower", "spring"]],
  [["sunflower"], ["sunflower", "flower", "summer"]],
  [["lily"], ["lily", "flower"]],
  [["lotus"], ["lotus", "flower", "yoga"]],
  [
    ["cherry blossom", "sakura"],
    ["cherryblossom", "flower", "spring", "japan"],
  ],
  [
    ["leaf", "leaves"],
    ["leaf", "autumn", "nature"],
  ],
  [["maple"], ["maple", "leaf", "autumn", "canada"]],
  [["acorn"], ["acorn", "autumn", "forest"]],
  [
    ["clover", "shamrock"],
    ["clover", "luck", "stpatricksday"],
  ],
  [["horseshoe"], ["horseshoe", "luck"]],
  [
    ["mushroom", "toadstool"],
    ["mushroom", "forest", "autumn"],
  ],
  [
    ["cactus", "succulent"],
    ["cactus", "plant", "summer"],
  ],
  [
    ["sprout", "seedling", "=plant"],
    ["plant", "garden", "spring"],
  ],
  [["bamboo"], ["bamboo", "plant"]],
  [["palm"], ["palm", "summer", "beach"]],
  [["mountain"], ["mountain", "nature", "hiking"]],
  [["volcano"], ["volcano", "nature"]],
  [["island"], ["island", "beach", "summer"]],
  [
    ["beach", "sandcastle"],
    ["beach", "summer"],
  ],
  [
    ["ocean", "sea"],
    ["ocean", "sea"],
  ],
  [["wave"], ["wave", "sea", "beach"]],
  [["shell"], ["shell", "sea", "beach"]],
  // Food and drink
  [["=cake"], ["cake", "birthday", "party"]],
  [
    ["cupcake", "muffin"],
    ["cupcake", "cake", "party"],
  ],
  [["pancake"], ["pancake", "breakfast"]],
  [["waffle"], ["waffle", "breakfast"]],
  [
    ["donut", "doughnut"],
    ["donut", "sweet"],
  ],
  [["macaron"], ["macaron", "sweet", "french"]],
  [["pie"], ["pie", "baking", "thanksgiving"]],
  [
    ["ice cream", "icecream", "popsicle"],
    ["icecream", "summer", "sweet"],
  ],
  [
    ["candy", "bonbon", "sweets"],
    ["candy", "sweet"],
  ],
  [["lollipop"], ["lollipop", "candy", "sweet"]],
  [["chocolate"], ["chocolate", "sweet"]],
  [["honey"], ["honey", "bee"]],
  [["apple"], ["apple", "fruit"]],
  [["=pear"], ["pear", "fruit"]],
  [["peach"], ["peach", "fruit", "summer"]],
  [
    ["cherry", "cherries"],
    ["cherry", "fruit"],
  ],
  [["strawberry"], ["strawberry", "berry", "fruit", "summer"]],
  [
    ["blueberry", "raspberry", "=berry", "berries"],
    ["berry", "fruit", "summer"],
  ],
  [["banana"], ["banana", "fruit"]],
  [["lemon"], ["lemon", "fruit", "summer"]],
  [["pineapple"], ["pineapple", "fruit", "summer", "tropical"]],
  [["watermelon"], ["watermelon", "fruit", "summer"]],
  [["melon"], ["melon", "fruit", "summer"]],
  [["grape"], ["grape", "fruit"]],
  [["mango"], ["mango", "fruit", "tropical"]],
  [["coconut"], ["coconut", "tropical", "summer"]],
  [["avocado"], ["avocado", "fruit"]],
  [["pizza"], ["pizza", "food"]],
  [["burger"], ["burger", "food"]],
  [["fries"], ["fries", "food"]],
  [["popcorn"], ["popcorn", "movie", "snack"]],
  [["pretzel"], ["pretzel", "oktoberfest", "bavaria"]],
  [
    ["=bread", "loaf"],
    ["bread", "baking", "food"],
  ],
  [["croissant"], ["croissant", "breakfast", "french"]],
  [["cheese"], ["cheese", "food"]],
  [["sushi"], ["sushi", "food", "japan"]],
  [["taco"], ["taco", "food", "mexican"]],
  [
    ["coffee", "espresso", "latte"],
    ["coffee", "drink"],
  ],
  [
    ["tea", "teapot", "teacup"],
    ["tea", "drink"],
  ],
  [["milk"], ["milk", "drink"]],
  [["=wine"], ["wine", "drink"]],
  [["beer"], ["beer", "oktoberfest", "drink"]],
  [["cocktail"], ["cocktail", "drink", "party"]],
  [["champagne"], ["champagne", "celebration", "newyear"]],
  // Kitchen
  [["chef"], ["chef", "cooking", "kitchen"]],
  [["baker"], ["baker", "baking"]],
  [["rolling pin"], ["rollingpin", "baking"]],
  [["whisk"], ["whisk", "baking"]],
  [["=oven"], ["oven", "baking"]],
  [["spoon"], ["spoon", "kitchen"]],
  [["=fork"], ["fork", "kitchen"]],
  [["apron"], ["apron", "kitchen"]],
  // Pets and farm
  [
    ["cat", "kitty", "kitten"],
    ["cat", "pet", "animal"],
  ],
  [
    [
      "dog",
      "puppy",
      "doggy",
      "dachshund",
      "corgi",
      "poodle",
      "pug",
      "husky",
      "bulldog",
      "beagle",
      "labrador",
      "terrier",
      "retriever",
      "chihuahua",
    ],
    ["dog", "pet", "animal"],
  ],
  [["paw"], ["paw", "pet", "dog", "cat"]],
  [["bone"], ["bone", "dog", "pet"]],
  [["hamster"], ["hamster", "pet"]],
  [["guinea pig"], ["guineapig", "pet"]],
  [["mouse"], ["mouse", "animal"]],
  [
    ["=horse", "pony"],
    ["horse", "animal", "farm"],
  ],
  [["cow"], ["cow", "farm", "animal"]],
  [
    ["pig", "piglet"],
    ["pig", "farm", "animal"],
  ],
  [["sheep"], ["sheep", "farm", "animal"]],
  [["goat"], ["goat", "farm", "animal"]],
  [
    ["chicken", "hen"],
    ["chicken", "farm", "animal"],
  ],
  [["rooster"], ["rooster", "farm", "animal"]],
  [["duck"], ["duck", "bird", "animal"]],
  [["=goose"], ["goose", "bird", "farm"]],
  [["turkey"], ["turkey", "thanksgiving", "bird"]],
  [
    ["llama", "alpaca"],
    ["llama", "alpaca", "animal"],
  ],
  // Forest
  [["bear"], ["bear", "animal"]],
  [["teddy"], ["teddy", "bear", "kids"]],
  [["fox"], ["fox", "forest", "animal"]],
  [["wolf"], ["wolf", "forest", "animal"]],
  [
    ["deer", "fawn"],
    ["deer", "forest", "animal"],
  ],
  [
    ["moose", "elk"],
    ["moose", "forest", "animal"],
  ],
  [["hedgehog"], ["hedgehog", "forest", "animal"]],
  [["squirrel"], ["squirrel", "forest", "autumn"]],
  [["raccoon"], ["raccoon", "animal"]],
  [["=otter"], ["otter", "animal"]],
  [["beaver"], ["beaver", "animal"]],
  [["badger"], ["badger", "animal"]],
  [["owl"], ["owl", "bird", "forest"]],
  // Birds
  [
    ["bird", "sparrow", "robin"],
    ["bird", "animal"],
  ],
  [["hummingbird"], ["hummingbird", "bird"]],
  [["=eagle"], ["eagle", "bird"]],
  [["swan"], ["swan", "bird", "love"]],
  [["stork"], ["stork", "baby", "bird"]],
  [["peacock"], ["peacock", "bird"]],
  [["parrot"], ["parrot", "bird", "tropical"]],
  [["toucan"], ["toucan", "bird", "tropical"]],
  [["flamingo"], ["flamingo", "bird", "summer"]],
  [["penguin"], ["penguin", "bird", "winter"]],
  // Wild
  [["elephant"], ["elephant", "safari", "animal"]],
  [["=lion"], ["lion", "safari", "animal"]],
  [["tiger"], ["tiger", "safari", "animal"]],
  [["giraffe"], ["giraffe", "safari", "animal"]],
  [["zebra"], ["zebra", "safari", "animal"]],
  [["hippo"], ["hippo", "safari", "animal"]],
  [["rhino"], ["rhino", "safari", "animal"]],
  [["cheetah"], ["cheetah", "safari", "animal"]],
  [["leopard"], ["leopard", "safari", "animal"]],
  [["camel"], ["camel", "desert", "animal"]],
  [
    ["crocodile", "alligator"],
    ["crocodile", "reptile", "animal"],
  ],
  [["monkey"], ["monkey", "jungle", "animal"]],
  [["sloth"], ["sloth", "jungle", "animal"]],
  [["panda"], ["panda", "bear", "animal"]],
  [["polar bear"], ["polarbear", "arctic", "winter"]],
  [["koala"], ["koala", "australia", "animal"]],
  [["kangaroo"], ["kangaroo", "australia", "animal"]],
  [["frog"], ["frog", "pond", "animal"]],
  [["snake"], ["snake", "reptile"]],
  [
    ["lizard", "gecko", "chameleon"],
    ["lizard", "reptile"],
  ],
  [
    ["turtle", "tortoise"],
    ["turtle", "animal"],
  ],
  [["axolotl"], ["axolotl", "animal", "cute"]],
  // Bugs
  [["butterfly"], ["butterfly", "spring", "insect"]],
  [["caterpillar"], ["caterpillar", "insect", "kids"]],
  [["dragonfly"], ["dragonfly", "insect"]],
  [
    ["bee", "bumblebee"],
    ["bee", "summer", "insect"],
  ],
  [
    ["ladybug", "ladybird"],
    ["ladybug", "luck", "insect"],
  ],
  [["ant"], ["ant", "insect"]],
  [["snail"], ["snail", "garden"]],
  [["=worm"], ["worm", "garden"]],
  // Sea
  [["fish"], ["fish", "sea", "ocean"]],
  [["whale"], ["whale", "sea", "ocean"]],
  [["dolphin"], ["dolphin", "sea", "ocean"]],
  [["shark"], ["shark", "sea", "ocean"]],
  [["octopus"], ["octopus", "sea", "ocean"]],
  [["jellyfish"], ["jellyfish", "sea", "ocean"]],
  [["=seal"], ["seal", "sea", "animal"]],
  [["walrus"], ["walrus", "arctic", "animal"]],
  [["crab"], ["crab", "sea", "beach"]],
  [["lobster"], ["lobster", "sea"]],
  [["starfish"], ["starfish", "sea", "beach"]],
  [["seahorse"], ["seahorse", "sea", "ocean"]],
  // Fantasy
  [["unicorn"], ["unicorn", "fantasy", "kids", "magic"]],
  [
    ["dino", "dinosaur", "t-rex", "trex"],
    ["dinosaur", "dino", "kids"],
  ],
  [["=dragon"], ["dragon", "fantasy"]],
  [["mermaid"], ["mermaid", "fantasy", "sea"]],
  [["fairy"], ["fairy", "fantasy", "magic"]],
  [["princess"], ["princess", "crown", "fairytale"]],
  [["=prince"], ["prince", "crown", "fairytale"]],
  [["=king"], ["king", "crown", "royal"]],
  [["=queen"], ["queen", "crown", "royal"]],
  [
    ["crown", "tiara"],
    ["crown", "royal", "king"],
  ],
  [["knight"], ["knight", "castle", "medieval"]],
  [["castle"], ["castle", "fairytale", "medieval"]],
  [["sword"], ["sword", "knight", "medieval"]],
  [["shield"], ["shield", "knight", "medieval"]],
  [["viking"], ["viking", "medieval"]],
  [["wizard"], ["wizard", "magic", "fantasy"]],
  [
    ["magic", "=wand"],
    ["magic", "fantasy"],
  ],
  [["potion"], ["potion", "magic", "witch"]],
  [["gnome"], ["gnome", "garden", "fantasy"]],
  [["troll"], ["troll", "fantasy"]],
  [
    ["yeti", "bigfoot"],
    ["yeti", "monster", "winter"],
  ],
  [["phoenix"], ["phoenix", "fantasy", "bird"]],
  [["pegasus"], ["pegasus", "fantasy", "horse"]],
  [["pirate"], ["pirate", "ship", "kids"]],
  [["ninja"], ["ninja", "kids"]],
  [["samurai"], ["samurai", "japan"]],
  [
    ["cowboy", "cowgirl"],
    ["cowboy", "western"],
  ],
  [["superhero"], ["superhero", "hero", "kids"]],
  [["robot"], ["robot", "kids", "tech"]],
  [["alien"], ["alien", "space", "ufo"]],
  [["ufo"], ["ufo", "alien", "space"]],
  [["astronaut"], ["astronaut", "space", "rocket"]],
  // Places
  [
    ["=house", "home"],
    ["house", "home"],
  ],
  [["lighthouse"], ["lighthouse", "sea", "nautical"]],
  [["windmill"], ["windmill", "dutch"]],
  [
    ["church", "chapel"],
    ["church", "faith"],
  ],
  [["pyramid"], ["pyramid", "egypt"]],
  [["eiffel"], ["eiffeltower", "paris", "france"]],
  [
    ["skyline", "city"],
    ["city", "skyline"],
  ],
  [["flag"], ["flag"]],
  [
    ["usa", "america"],
    ["usa", "america"],
  ],
  [["canada"], ["canada"]],
  // Travel and outdoors
  [["compass"], ["compass", "travel", "nautical"]],
  [["map"], ["map", "travel"]],
  [
    ["suitcase", "luggage"],
    ["suitcase", "travel"],
  ],
  [
    ["camping", "=tent", "campfire"],
    ["camping", "outdoor"],
  ],
  [["backpack"], ["backpack", "school", "travel"]],
  [["anchor"], ["anchor", "sea", "nautical"]],
  [["umbrella"], ["umbrella", "rain"]],
  // Things
  [["key"], ["key", "home"]],
  [["glasses"], ["glasses"]],
  [["sunglasses"], ["sunglasses", "summer"]],
  [["=hat"], ["hat"]],
  [["=bow"], ["bow", "gift"]],
  [
    ["bow tie", "bowtie"],
    ["bowtie", "gentleman"],
  ],
  [
    ["diamond", "gem"],
    ["diamond", "gem"],
  ],
  [["crystal"], ["crystal", "gem", "magic"]],
  [["=ring"], ["ring", "wedding"]],
  [["=arrow"], ["arrow"]],
  [["feather"], ["feather", "boho"]],
  [["infinity"], ["infinity", "love"]],
  [["peace"], ["peace", "hippie"]],
  [
    ["yin yang", "yinyang"],
    ["yinyang", "balance"],
  ],
  [
    ["lightbulb", "light bulb"],
    ["lightbulb", "idea"],
  ],
  [
    ["=fire", "=flame", "campfire"],
    ["fire", "flame"],
  ],
  [
    ["=gear", "cog"],
    ["gear", "mechanic", "tech"],
  ],
  [
    ["hammer", "wrench", "screwdriver", "=tool", "toolbox"],
    ["tools", "diy"],
  ],
  [["axe"], ["axe", "lumberjack"]],
  [
    ["=cup", "mug"],
    ["cup", "coffee"],
  ],
  [["bottle"], ["bottle"]],
  [
    ["clock", "watch"],
    ["clock", "time"],
  ],
  [["hourglass"], ["hourglass", "time"]],
  [["balloon"], ["balloon", "birthday", "party"]],
  [["hot air balloon"], ["hotairballoon", "travel"]],
  [["puzzle"], ["puzzle", "game"]],
  [["dice"], ["dice", "game"]],
  [
    ["chess", "pawn"],
    ["chess", "game"],
  ],
  [
    ["gamepad", "controller", "gaming", "joystick"],
    ["gaming", "gamer", "controller"],
  ],
  [["pixel"], ["pixel", "pixelart", "retro"]],
  [
    ["=phone", "smartphone"],
    ["phone", "tech"],
  ],
  [
    ["laptop", "computer"],
    ["computer", "tech"],
  ],
  [["camera"], ["camera", "photo"]],
  // Music
  [
    ["music", "melody"],
    ["music", "note"],
  ],
  [["guitar"], ["guitar", "music", "instrument"]],
  [["piano"], ["piano", "music", "instrument"]],
  [
    ["violin", "cello"],
    ["violin", "music", "instrument"],
  ],
  [["=drum"], ["drum", "music", "instrument"]],
  [
    ["trumpet", "saxophone"],
    ["trumpet", "music", "instrument"],
  ],
  [
    ["headphones", "headset"],
    ["headphones", "music"],
  ],
  [["microphone"], ["microphone", "music", "karaoke"]],
  // School and craft
  [["=book"], ["book", "reading"]],
  [
    ["pencil", "crayon"],
    ["pencil", "school"],
  ],
  [["scissors"], ["scissors", "craft"]],
  [
    ["paintbrush", "paint brush", "palette"],
    ["paint", "art"],
  ],
  [
    ["yarn", "knitting", "crochet"],
    ["knitting", "crochet", "craft"],
  ],
  [
    ["sewing", "needle", "thimble"],
    ["sewing", "craft"],
  ],
  [["button"], ["button", "sewing"]],
  [
    ["letter", "alphabet", "lettering"],
    ["letter", "alphabet", "name"],
  ],
  [["number"], ["number", "birthday"]],
  // Faces and bodies
  [
    ["smiley", "smile", "emoji"],
    ["smiley", "emoji", "face"],
  ],
  [["poop"], ["poop", "emoji", "funny"]],
  [
    ["thumbs up", "thumb"],
    ["thumbsup", "emoji"],
  ],
  [
    ["=hand", "handprint"],
    ["hand", "kids"],
  ],
  [
    ["=foot", "footprint", "feet"],
    ["foot", "kids"],
  ],
  [["lip"], ["lips", "kiss", "love"]],
  [["eye"], ["eye"]],
  [
    ["tooth", "teeth"],
    ["tooth", "dentist", "kids"],
  ],
  [
    ["mustache", "moustache"],
    ["mustache", "gentleman"],
  ],
  [["beard"], ["beard", "gentleman"]],
  // Clothes and baby
  [["=dress"], ["dress", "fashion"]],
  [["shirt"], ["shirt", "fashion"]],
  [
    ["=shoe", "sneaker", "high heel"],
    ["shoe", "fashion"],
  ],
  [["=boot"], ["boot", "fashion"]],
  [
    ["handbag", "purse"],
    ["handbag", "fashion"],
  ],
  [["=sock"], ["sock"]],
  [["scarf"], ["scarf", "winter"]],
  [["glove"], ["glove", "winter"]],
  [
    ["onesie", "romper"],
    ["onesie", "baby", "babyshower"],
  ],
  [
    ["pacifier", "dummy"],
    ["pacifier", "baby"],
  ],
  [
    ["stroller", "=pram"],
    ["stroller", "baby"],
  ],
  [["=rattle"], ["rattle", "baby"]],
  [["diaper"], ["diaper", "baby"]],
  // Shapes
  [["circle"], ["circle", "shape", "geometric"]],
  [["square"], ["square", "shape", "geometric"]],
  [["triangle"], ["triangle", "shape", "geometric"]],
  [["rectangle"], ["rectangle", "shape", "geometric"]],
  [["pentagon"], ["pentagon", "shape", "geometric"]],
  [["hexagon"], ["hexagon", "shape", "geometric"]],
  [["octagon"], ["octagon", "shape", "geometric"]],
  [["honeycomb"], ["honeycomb", "bee", "hexagon"]],
  [["oval"], ["oval", "shape"]],
  [
    ["spiral", "swirl"],
    ["spiral", "geometric"],
  ],
  [
    ["geometric", "polygon"],
    ["geometric", "shape"],
  ],
  // Vehicles
  [
    ["=car", "racecar", "race car"],
    ["car", "vehicle", "kids"],
  ],
  [
    ["train", "locomotive"],
    ["train", "vehicle", "kids"],
  ],
  [
    ["rocket", "spaceship"],
    ["rocket", "space", "kids"],
  ],
  [
    ["=plane", "airplane", "aeroplane", "jet"],
    ["plane", "travel", "vehicle"],
  ],
  [["helicopter"], ["helicopter", "vehicle"]],
  [
    ["boat", "=ship", "yacht"],
    ["boat", "sea", "nautical"],
  ],
  [["submarine"], ["submarine", "sea"]],
  [
    ["bicycle", "=bike"],
    ["bicycle", "bike", "sport"],
  ],
  [
    ["motorcycle", "motorbike"],
    ["motorcycle", "vehicle"],
  ],
  [["scooter"], ["scooter", "vehicle"]],
  [["tractor"], ["tractor", "farm", "kids"]],
  [
    ["truck", "lorry"],
    ["truck", "vehicle"],
  ],
  [["bus"], ["bus", "vehicle"]],
  [
    ["firetruck", "fire truck", "fire engine"],
    ["firetruck", "fire", "kids"],
  ],
  [["police"], ["police", "kids"]],
  [["ambulance"], ["ambulance", "vehicle"]],
  [
    ["excavator", "digger", "bulldozer", "construction"],
    ["construction", "vehicle", "kids"],
  ],
  // Jobs
  [
    ["doctor", "nurse", "stethoscope"],
    ["doctor", "nurse", "medical"],
  ],
  [
    ["firefighter", "fireman"],
    ["firefighter", "fire", "hero"],
  ],
  [["teacher"], ["teacher", "school", "gift"]],
  [["pilot"], ["pilot", "plane", "travel"]],
  [["builder"], ["builder", "construction", "tools"]],
  // Sports
  [
    ["football", "soccer"],
    ["football", "soccer", "sports"],
  ],
  [["basketball"], ["basketball", "sports"]],
  [["volleyball"], ["volleyball", "sports"]],
  [["rugby"], ["rugby", "sports"]],
  [["tennis"], ["tennis", "sports"]],
  [["golf"], ["golf", "sports"]],
  [["baseball"], ["baseball", "sports"]],
  [["hockey"], ["hockey", "sports"]],
  [["bowling"], ["bowling", "sports"]],
  [["boxing"], ["boxing", "sports"]],
  [
    ["karate", "judo", "taekwondo"],
    ["martialarts", "karate", "sports"],
  ],
  [["yoga"], ["yoga", "fitness"]],
  [
    ["dumbbell", "gym", "fitness"],
    ["fitness", "gym", "sports"],
  ],
  [
    ["running", "marathon"],
    ["running", "sports"],
  ],
  [["swim"], ["swimming", "summer", "sports"]],
  [
    ["ski", "skiing"],
    ["ski", "winter", "sports"],
  ],
  [["skate"], ["skating", "sports"]],
  [["surf"], ["surf", "beach", "summer"]],
  [
    ["cheerleader", "cheerleading"],
    ["cheerleading", "sports"],
  ],
  [["trophy"], ["trophy", "winner", "sports"]],
  [["medal"], ["medal", "winner", "sports"]],
];

/** The tags a name suggests, in the pool's order, each once. */
export const nameTags = (name: string) => {
  const text = name.toLowerCase();
  const words = new Set(text.split(/[^a-z0-9']+/));
  const whole = (word: string) =>
    words.has(word) || words.has(`${word}s`) || words.has(`${word}es`);
  const tags = POOL.filter(([keys]) =>
    keys.some((key) =>
      key.startsWith("=")
        ? whole(key.slice(1))
        : key.length <= 3
          ? whole(key)
          : text.includes(key)
    )
  ).flatMap(([, found]) => found);
  return [...new Set(tags)];
};
