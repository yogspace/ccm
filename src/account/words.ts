/**
 * The words passphrases are made of (server.ts): plain things one can
 * picture – food, animals, nature, things around the house – lower case,
 * without umlauts or ß, so they are typed the same everywhere. Each list
 * holds over 500 words: three of them, one to three with a number (1–99),
 * give about 40 bits.
 */

const list = (words: string) => [
  ...new Set(words.split(/\s+/).filter(Boolean)),
];

export const WORDS = {
  de: list(`
    apfel birne kirsche pflaume zimt honig mehl zucker butter teig ofen keks
    torte kuchen waffel brezel krapfen strudel mandel nuss walnuss rosine
    vanille kakao sahne quark joghurt milch brot semmel toast hafer reis
    nudel pizza suppe salat gurke tomate paprika karotte kohl spinat erbse
    bohne linse mais kartoffel zwiebel knoblauch pilz basilikum minze ingwer
    pfeffer salz senf marmelade sirup bonbon lakritz praline muffin donut
    pudding sorbet kaffee tee saft zitrone orange banane ananas mango melone
    traube beere erdbeere himbeere kokos dattel feige aprikose pfirsich
    quitte rhabarber olive biskuit zwieback lebkuchen stollen makrone baiser
    karamell nougat marzipan krokant toffee popcorn keksdose zimtstern hund
    katze maus hase igel fuchs wolf dachs luchs reh hirsch elch biber otter
    robbe wal delfin hai krake qualle muschel krebs hummer garnele fisch
    forelle lachs hecht karpfen frosch molch eidechse schlange adler falke
    eule rabe amsel meise spatz taube schwan gans ente huhn hahn pfau
    papagei pinguin flamingo storch kranich specht kolibri tiger panther
    gepard zebra giraffe elefant nashorn nilpferd kamel lama alpaka koala
    panda affe gorilla lemur faultier gecko leguan biene hummel wespe ameise
    libelle falter raupe schnecke wurm spinne motte pony pferd esel ziege
    schaf lamm kuh stier ferkel hamster maulwurf eichhorn wiesel marder baum
    wald wiese blume rose tulpe nelke lilie veilchen mohn klee moos farn
    tanne fichte eiche buche birke linde ahorn weide pappel palme kaktus
    bambus blatt zweig wurzel samen knospe gras heu stroh berg tal fluss
    bach see meer welle strand insel steppe dschungel vulkan gletscher
    felsen stein kiesel sand lehm erde sonne mond stern komet planet himmel
    wolke regen schnee hagel nebel wind sturm blitz donner regenbogen tau
    frost sommer herbst winter morgen abend nacht quelle lagune oase krater
    anker boot schiff segel ruder floss kompass karte globus fernrohr
    laterne kerze lampe spiegel uhr wecker glocke trommel gitarre geige
    harfe klavier banjo tuba horn pauke rassel ball drachen kreisel puppe
    teddy murmel domino puzzle schach roller fahrrad rakete ballon zeppelin
    zug tram bus taxi traktor bagger kran leiter schaufel besen eimer hammer
    zange schraube nagel pinsel kreide stift heft buch brief stempel kiste
    korb tasche koffer rucksack schirm hut kappe schal socke stiefel schuh
    jacke mantel kleid hemd knopf faden nadel schere kamm seife handtuch
    kissen decke sofa sessel stuhl tisch regal schrank fenster treppe dach
    garten zaun brunnen turm burg schloss hafen leuchtturm zelt iglu krone
    ring perle diamant gold silber kupfer magnet kristall schatz flagge
    wimpel konfetti girlande geschenk schleife fackel feuer funke asche
    rauch dampf blase tropfen eis kugel pyramide spirale kreis linie punkt
    zickzack kamin kessel pfanne topf deckel gabel messer teller tasse
    becher glas krug flasche korken dose sieb reibe nudelholz backblech
    ausstecher waage tablett serviette kanne radio kamera telefon roboter
    computer maschine motor rad achse kette seil knoten netz haken
    fallschirm kanu yacht dampfer kutter fregatte matrose lotse taucher oma
    opa tante onkel kobold zwerg riese hexe zauberer fee elfe drache einhorn
    greif meerjungfrau ritter prinz bote koch maler musiker clown akrobat
    jongleur detektiv forscher pilot astronaut tango walzer polka samba
    rumba salsa disco jazz blues rock folk oper ballett zirkus kino theater
    museum bibliothek bahnhof flughafen markt weinberg obstgarten scheune
    stall mittag mitternacht dezember januar februar april juni juli august
    montag freitag sonntag ostern advent sommerfest kirmes jahrmarkt schoko
    zimtschnecke apfelstrudel pfannkuchen berliner kompott gelb blau lila
    rosa beige erbsen melodie rhythmus akkord note takt lied chor
  `).filter((word) => /^[a-z]{3,12}$/.test(word)),
  en: list(`
    apple pear cherry plum cinnamon honey flour sugar butter dough oven
    cookie cake waffle pretzel almond walnut hazelnut raisin vanilla cocoa
    cream cheese bread toast oats rice noodle pizza soup salad cucumber
    tomato pepper carrot cabbage spinach pea bean lentil corn potato onion
    garlic mushroom basil mint ginger salt mustard jam syrup candy toffee
    praline muffin donut pudding sorbet coffee tea juice lemon orange banana
    pineapple mango melon grape berry strawberry raspberry blueberry coconut
    date fig apricot peach quince rhubarb pumpkin olive biscuit gingerbread
    macaroon meringue caramel nougat marzipan brittle popcorn cupcake
    brownie pancake crumble custard scone bagel croissant
    dog cat mouse rabbit hedgehog fox wolf bear badger lynx deer moose
    beaver otter seal whale dolphin shark octopus jellyfish shell crab
    lobster shrimp fish trout salmon pike carp frog toad newt lizard snake
    turtle eagle falcon owl raven crow robin sparrow pigeon swan goose duck
    hen rooster chick peacock parrot penguin flamingo stork crane woodpecker
    hummingbird tiger lion panther cheetah zebra giraffe elephant rhino hippo
    camel llama alpaca kangaroo koala panda monkey gorilla lemur sloth gecko
    iguana bee bumblebee wasp ant beetle dragonfly moth caterpillar snail
    worm spider pony horse donkey goat sheep lamb cow bull piglet hamster
    mole squirrel weasel puffin walrus narwhal seahorse starfish
    tree forest meadow flower rose tulip lily violet poppy clover moss fern
    fir spruce oak beech birch linden maple willow poplar palm cactus bamboo
    leaf twig root seed bud blossom grass hay straw mountain valley river
    brook lake sea wave beach island dune desert jungle volcano glacier cave
    rock stone pebble sand clay earth sun moon star comet planet sky cloud
    rain snow hail fog wind storm thunder rainbow dew frost icicle spring
    summer autumn winter morning evening night lagoon oasis crater canyon
    anchor boat ship sail oar raft compass map globe telescope lantern
    candle lamp mirror clock bell drum guitar violin flute harp piano banjo
    tuba horn rattle ball kite doll teddy dice marble domino puzzle chess
    scooter bicycle rocket balloon train tram bus taxi tractor digger ladder
    shovel broom bucket hammer pliers screw nail brush paint chalk pencil
    notebook book letter stamp box basket bag suitcase backpack umbrella hat
    cap scarf glove sock boot shoe jacket coat dress shirt button thread
    needle scissors comb soap towel pillow blanket sofa chair table shelf
    window door stairs roof garden fence fountain tower castle bridge mill
    harbor lighthouse tent hut igloo crown ring pearl diamond gold silver
    copper magnet crystal coin treasure flag pennant confetti garland gift
    ribbon torch fire spark ash smoke steam bubble drop puddle ice sphere
    cube pyramid spiral circle line dot zigzag
    chimney kettle pan pot lid spoon fork knife plate cup mug glass jug
    bottle cork tin bowl sieve grater rolling tray napkin teapot apron
    radio camera phone robot computer engine wheel axle chain rope knot net
    hook parachute canoe yacht steamer cutter sailor diver captain pilot
    granny grandpa aunt uncle goblin dwarf giant witch wizard fairy elf
    dragon unicorn griffin phoenix mermaid knight prince baker cook gardener
    painter sculptor musician dancer clown acrobat juggler detective explorer
    astronaut messenger
    tango waltz polka samba rumba salsa disco jazz blues rock folk opera
    ballet circus cinema theater museum library station airport market farm
    vineyard orchard greenhouse barn stable
    noon midnight december january february april june july august monday
    friday sunday easter festival carnival
    yellow green blue purple pink turquoise beige
    melody rhythm chord note beat song choir
  `).filter((word) => /^[a-z]{3,12}$/.test(word)),
};
