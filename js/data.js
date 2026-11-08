/* Mise - recipes, ingredients, customers, upgrades. All numbers here drive the game. */
(function () {
  "use strict";
  const M = window.Mise;

  // Stock categories used by the restaurant market.
  M.STOCK = {
    produce: { name: "Produce", pack: 10, cost: 12 },
    protein: { name: "Protein", pack: 6, cost: 18 },
    pantry: { name: "Pantry", pack: 12, cost: 10 },
    dairy: { name: "Eggs and dairy", pack: 8, cost: 11 },
  };

  M.ACTIONS = {
    chop: { verb: "Slice", station: "board" },
    crack: { verb: "Crack", station: "bowl" },
    pour: { verb: "Pour", station: "bowl" },
    stir: { verb: "Stir", station: "bowl" },
    fry: { verb: "Fry", station: "stove" },
    boil: { verb: "Boil", station: "pot" },
    season: { verb: "Season", station: "bowl" },
    plate: { verb: "Plate", station: "pass" },
  };

  // Each step: type + params understood by minigames.js
  M.RECIPES = [
    {
      id: "tamagoyaki",
      name: "Rolled omelette",
      short: "Tamagoyaki",
      price: 9,
      stock: ["dairy", "pantry"],
      color: "#F2C14E",
      blurb: "Three eggs, a pinch of salt, rolled in layers and sliced.",
      steps: [
        { type: "crack", count: 3, label: "Crack 3 eggs into the bowl" },
        { type: "season", spice: "salt", label: "Season with salt", target: [0.55, 0.8] },
        { type: "stir", tool: "chopsticks", vessel: "bowl", turns: 5, from: "#F7E3A8", to: "#F2C14E", label: "Beat the eggs" },
        { type: "pour", liquid: "egg", vessel: "pan", target: [0.5, 0.72], label: "Pour into the pan" },
        { type: "fry", item: "tamago", sides: 2, label: "Cook and roll" },
        { type: "chop", ing: "tamago", cuts: 4, label: "Slice into 5 pieces" },
        { type: "plate", dish: "tamagoyaki", label: "Plate and serve" },
      ],
    },
    {
      id: "fried_rice",
      name: "Garlic fried rice",
      short: "Fried rice",
      price: 11,
      stock: ["produce", "pantry"],
      color: "#E0B36A",
      blurb: "Day-old rice, toasted garlic, scallion and a splash of soy.",
      steps: [
        { type: "chop", ing: "garlic", cuts: 5, label: "Slice the garlic" },
        { type: "chop", ing: "scallion", cuts: 7, label: "Slice the scallion" },
        { type: "fry", item: "garlic", sides: 1, label: "Toast the garlic until golden" },
        { type: "stir", tool: "spatula", vessel: "pan", turns: 6, from: "#F4EEDF", to: "#E0B36A", label: "Toss the rice" },
        { type: "pour", liquid: "soy", vessel: "pan", target: [0.3, 0.48], label: "Splash of soy sauce" },
        { type: "plate", dish: "fried_rice", label: "Plate and serve" },
      ],
    },
    {
      id: "salad",
      name: "Garden salad",
      short: "Salad",
      price: 8,
      stock: ["produce"],
      color: "#7FA65A",
      blurb: "Cucumber, tomato and lettuce, tossed with pepper.",
      steps: [
        { type: "chop", ing: "cucumber", cuts: 7, label: "Slice the cucumber" },
        { type: "chop", ing: "tomato", cuts: 5, label: "Slice the tomato" },
        { type: "chop", ing: "lettuce", cuts: 4, label: "Cut the lettuce" },
        { type: "season", spice: "pepper", label: "Crack some pepper", target: [0.4, 0.65] },
        { type: "stir", tool: "tongs", vessel: "bowl", turns: 4, from: "#9DC27A", to: "#7FA65A", label: "Toss the salad" },
        { type: "plate", dish: "salad", label: "Plate and serve" },
      ],
    },
    {
      id: "ramen",
      name: "Shoyu ramen",
      short: "Ramen",
      price: 14,
      stock: ["pantry", "dairy", "produce"],
      color: "#C98A3E",
      blurb: "Springy noodles, soy broth, a soft egg and scallion.",
      steps: [
        { type: "boil", item: "egg", label: "Soft-boil an egg" },
        { type: "boil", item: "noodles", label: "Cook the noodles" },
        { type: "chop", ing: "scallion", cuts: 6, label: "Slice the scallion" },
        { type: "pour", liquid: "broth", vessel: "bowl", target: [0.6, 0.8], label: "Ladle the broth" },
        { type: "plate", dish: "ramen", label: "Top and serve" },
      ],
    },
    {
      id: "pancakes",
      name: "Buttermilk pancakes",
      short: "Pancakes",
      price: 10,
      stock: ["dairy", "pantry"],
      color: "#D9A05B",
      blurb: "One egg, cold milk, a lazy whisk and a single flip.",
      steps: [
        { type: "crack", count: 1, label: "Crack an egg" },
        { type: "pour", liquid: "milk", vessel: "bowl", target: [0.55, 0.75], label: "Pour the milk" },
        { type: "stir", tool: "whisk", vessel: "bowl", turns: 6, from: "#F3E9D2", to: "#E8C98F", label: "Whisk the batter" },
        { type: "pour", liquid: "batter", vessel: "pan", target: [0.45, 0.65], label: "Pour batter into the pan" },
        { type: "fry", item: "pancake", sides: 2, label: "Cook and flip" },
        { type: "plate", dish: "pancakes", label: "Stack and serve" },
      ],
    },
    {
      id: "steak",
      name: "Seared steak",
      short: "Steak",
      price: 18,
      stock: ["protein", "produce"],
      color: "#8E4A32",
      blurb: "Salted early, seared hard on both sides, rested and sliced.",
      steps: [
        { type: "season", spice: "salt", label: "Salt the steak", target: [0.6, 0.85] },
        { type: "fry", item: "steak", sides: 2, label: "Sear both sides" },
        { type: "chop", ing: "steak", cuts: 6, label: "Slice against the grain" },
        { type: "plate", dish: "steak", label: "Plate and serve" },
      ],
    },
    {
      id: "tomato_soup",
      name: "Tomato soup",
      short: "Tomato soup",
      price: 9,
      stock: ["produce", "pantry"],
      color: "#C8442F",
      blurb: "Soft onion, ripe tomatoes and a slow simmer.",
      steps: [
        { type: "chop", ing: "onion", cuts: 6, label: "Slice the onion" },
        { type: "chop", ing: "tomato", cuts: 5, label: "Slice the tomatoes" },
        { type: "fry", item: "onion", sides: 1, label: "Soften the onion" },
        { type: "pour", liquid: "stock", vessel: "pot", target: [0.55, 0.78], label: "Pour in the stock" },
        { type: "boil", item: "soup", label: "Simmer the soup" },
        { type: "plate", dish: "tomato_soup", label: "Ladle and serve" },
      ],
    },
    {
      id: "miso",
      name: "Miso soup",
      short: "Miso soup",
      price: 7,
      stock: ["protein", "pantry"],
      color: "#C9A46A",
      blurb: "Silken tofu, dashi, miso stirred in off the heat.",
      steps: [
        { type: "chop", ing: "tofu", cuts: 5, label: "Cube the tofu" },
        { type: "chop", ing: "scallion", cuts: 6, label: "Slice the scallion" },
        { type: "pour", liquid: "dashi", vessel: "pot", target: [0.5, 0.75], label: "Pour the dashi" },
        { type: "stir", tool: "ladle", vessel: "pot", turns: 4, from: "#E9DDBF", to: "#C9A46A", label: "Stir in the miso" },
        { type: "plate", dish: "miso", label: "Ladle and serve" },
      ],
    },
  ];

  M.recipeById = (id) => M.RECIPES.find((r) => r.id === id);

  M.UNLOCK_COST = {
    fried_rice: 0,
    salad: 0,
    tamagoyaki: 0,
    miso: 60,
    pancakes: 80,
    tomato_soup: 100,
    ramen: 160,
    steak: 220,
  };

  // Customer archetypes (restaurant)
  M.CUSTOMERS = [
    { id: "regular", label: "Regular", patience: 1.0, tip: 1.0, weight: 5, coat: "#3F6B8A", hair: "#3B2A20" },
    { id: "student", label: "Student", patience: 1.25, tip: 0.6, weight: 3, coat: "#5C8A4E", hair: "#1F1A17" },
    { id: "hurry", label: "In a hurry", patience: 0.62, tip: 1.5, weight: 2, coat: "#2F3B45", hair: "#6B4A2E" },
    { id: "critic", label: "Food critic", patience: 0.9, tip: 1.2, weight: 1, coat: "#7A3B2E", hair: "#9A9A96", critic: true },
    { id: "neighbour", label: "Neighbour", patience: 1.4, tip: 0.9, weight: 2, coat: "#B07A2A", hair: "#2E2420" },
  ];

  // Upgrades: effect keys are read by restaurant.js / minigames.js
  M.UPGRADES = [
    { id: "knife", group: "Kitchen", name: "Carbon steel knife", desc: "Slices snap toward the guide lines.", costs: [70, 150], effect: "chopAssist" },
    { id: "pan", group: "Kitchen", name: "Cast iron pan", desc: "Wider golden window when frying.", costs: [80, 170], effect: "fryWindow" },
    { id: "burner", group: "Kitchen", name: "Second burner", desc: "Line cook plates orders 20% faster per level.", costs: [90, 190, 320], effect: "cookSpeed" },
    { id: "mixer", group: "Kitchen", name: "Balloon whisk", desc: "One fewer turn needed when stirring.", costs: [60], effect: "stirAssist" },
    { id: "tables", group: "Dining room", name: "Extra table", desc: "Seat one more party per level.", costs: [100, 180, 280], effect: "tables" },
    { id: "chairs", group: "Dining room", name: "Cushioned chairs", desc: "Guests wait 15% longer per level.", costs: [80, 160], effect: "patience" },
    { id: "lamps", group: "Dining room", name: "Plants and paper lamps", desc: "Reputation grows faster.", costs: [90, 200], effect: "reputation" },
    { id: "records", group: "Dining room", name: "Record player", desc: "Guests in the queue lose patience slower.", costs: [70], effect: "queuePatience" },
    { id: "host", group: "Staff", name: "Host", desc: "Seats the next guest when a table is free.", costs: [150], effect: "autoSeat" },
    { id: "busser", group: "Staff", name: "Busser", desc: "Clears and wipes empty tables.", costs: [120], effect: "autoClean" },
    { id: "linecook", group: "Staff", name: "Line cook (owner role)", desc: "Cooks tickets while you work the floor.", costs: [200], effect: "ownerCook" },
  ];

  M.upgradeLevel = (id) => (M.profile.shop.upgrades[id] || 0);

  M.dayGoal = (day) => {
    const base = 70 + day * 22;
    return [Math.round(base * 0.6), base, Math.round(base * 1.45)];
  };

  M.SKINS = ["#F1D3B5", "#D9A77E", "#B07A52", "#7A4E33"];
})();
