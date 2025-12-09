// app.js

// ================== VARIABILI GLOBALI ==================
let INGREDIENTS = {};          // nome -> dati nutrizionali
let selectedIngredients = [];  // [{name, grams, displayQuantity, displayUnit}]
let ALL_RECIPES = [];          // ricette reali da recipes.json
let currentIngredientToAdd = null;   // { name, info, onConfirmCallback }

// ================== MODALE QUANTITÀ ==================
const qmModal = document.getElementById("quantityModal");
const qmTitle = document.getElementById("qmTitle");
const qmSubtitle = document.getElementById("qmSubtitle");
const qmQuantity = document.getElementById("qmQuantity");
const qmUnit = document.getElementById("qmUnit");
const qmCancel = document.getElementById("qmCancel");
const qmConfirm = document.getElementById("qmConfirm");

function openQuantityModal(name, info, onConfirmCallback) {
  currentIngredientToAdd = { name, info, onConfirmCallback };

  qmTitle.textContent = `Quantità per "${name}"`;
  qmSubtitle.textContent = buildSubtitle(info);

  qmQuantity.value = 100;

  qmUnit.innerHTML = "";
  const units = info.units || defaultUnitsFor(info);
  units.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    qmUnit.appendChild(opt);
  });

  qmModal.classList.remove("hidden");
}

function closeQuantityModal() {
  qmModal.classList.add("hidden");
  currentIngredientToAdd = null;
}

qmCancel.addEventListener("click", closeQuantityModal);

qmConfirm.addEventListener("click", () => {
  if (!currentIngredientToAdd) return;
  const q = parseFloat(qmQuantity.value);
  const unit = qmUnit.value;
  if (isNaN(q) || q <= 0) {
    alert("Inserisci una quantità valida.");
    return;
  }

  const grams = convertToGrams(currentIngredientToAdd.info, unit, q);
  currentIngredientToAdd.onConfirmCallback({
    name: currentIngredientToAdd.name,
    grams,
    displayQuantity: q,
    displayUnit: unit,
  });

  closeQuantityModal();
});

function buildSubtitle(info) {
  const type = info.type || "solid";
  if (type === "liquid") {
    return "Per i liquidi puoi usare ml, cucchiaino o cucchiaio. I valori nutrizionali sono calcolati sulla quantità in grammi equivalente.";
  }
  if (type === "piece") {
    const g = info.grams_per_piece || 50;
    return `1 pezzo ~ ${g} g. I calcoli sono basati su grammi equivalenti.`;
  }
  return "Quantità standard in grammi. I valori nutrizionali sono riferiti a 100 g.";
}

function defaultUnitsFor(info) {
  const type = info.type || "solid";
  if (type === "liquid") return ["ml", "cucchiaino", "cucchiaio"];
  if (type === "piece") return ["pezzo"];
  return ["g"];
}

function convertToGrams(info, unit, quantity) {
  const type = info.type || "solid";

  if (type === "liquid") {
    const density = info.density_g_per_ml || 1;
    if (unit === "ml") return quantity * density;
    if (unit === "cucchiaino") return quantity * 5 * density;
    if (unit === "cucchiaio") return quantity * 10 * density;
  }

  if (type === "piece") {
    const gPerPiece = info.grams_per_piece || 50;
    return quantity * gPerPiece;
  }

  if (unit === "g") return quantity;
  return quantity;
}

// ================== CARICAMENTO INGREDIENTI & RICETTE ==================

async function loadIngredients() {
  try {
    const res = await fetch("data/ingredients.json");
    INGREDIENTS = await res.json();
    console.log("Ingredienti caricati:", Object.keys(INGREDIENTS).length);
  } catch (e) {
    console.error("Errore nel caricamento degli ingredienti:", e);
    alert("Errore nel caricamento degli ingredienti. Controlla data/ingredients.json");
  }
}

async function loadRecipes() {
  try {
    const res = await fetch("data/recipes.json");
    const raw = await res.json();
    ALL_RECIPES = raw.map((r) => ({
      mode: "real",
      title: r.title,
      ingredients: r.ingredients || [],
      totals: {
        kcal: r.kcal || 0,
        protein: r.protein || 0,
        carb: r.carb || 0,
        fat: r.fat || 0,
        cost: r.cost || 0,
      },
      difficulty: r.difficulty || "facile",
      time: r.time || 20,
      tags: r.diets || [],
      events: r.events || [],
      steps: r.steps || [],
    }));
    console.log("Ricette reali caricate:", ALL_RECIPES.length);
  } catch (e) {
    console.error("Errore nel caricamento delle ricette:", e);
  }
}

// ================== AUTOCOMPLETE INGREDIENTI ==================

const ingredientInput = document.getElementById("ingredientInput");
const suggestionsDiv = document.getElementById("ingredientSuggestions");

ingredientInput.addEventListener("input", () => {
  const q = ingredientInput.value.trim().toLowerCase();
  suggestionsDiv.innerHTML = "";
  if (!q) return;

  const names = Object.keys(INGREDIENTS);
  const matches = names
    .filter((n) => n.toLowerCase().includes(q))
    .slice(0, 30);

  matches.forEach((name) => {
    const info = INGREDIENTS[name];
    const el = document.createElement("div");
    el.innerHTML = `
      <strong>${name}</strong>
      <div style="font-size: 0.8rem; color: #555;">
        <span class="badge kcal">${info.kcal} kcal</span>
        <span class="badge protein">P ${info.protein}g</span>
        <span class="badge carb">C ${info.carb}g</span>
        <span class="badge fat">F ${info.fat}g</span>
      </div>
    `;
    el.onclick = () => {
      ingredientInput.value = name;
      suggestionsDiv.innerHTML = "";
    };
    suggestionsDiv.appendChild(el);
  });
});

// ================== AGGIUNTA INGREDIENTI SELEZIONATI ==================

document
  .getElementById("addIngredientBtn")
  .addEventListener("click", addSelectedIngredient);

ingredientInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSelectedIngredient();
});

function addSelectedIngredient() {
  const name = ingredientInput.value.trim();
  if (!name) return;

  const info = INGREDIENTS[name];
  if (!info) {
    alert("Ingrediente non trovato nel database. Aggiungilo in data/ingredients.json se vuoi usarlo.");
    return;
  }

  openQuantityModal(name, info, (item) => {
    selectedIngredients.push(item);
    ingredientInput.value = "";
    suggestionsDiv.innerHTML = "";
    renderSelectedIngredients();
  });
}

function renderSelectedIngredients() {
  const ul = document.getElementById("selectedIngredients");
  ul.innerHTML = "";
  selectedIngredients.forEach((item, idx) => {
    const info = INGREDIENTS[item.name];
    if (!info) return;
    const factor = item.grams / 100;
    const kcal = Math.round(info.kcal * factor);
    const li = document.createElement("li");
    const displayQ = item.displayQuantity ?? item.grams;
    const displayU = item.displayUnit ?? "g";
    li.innerHTML = `
      <div>
        <strong>${item.name}</strong> – ${displayQ} ${displayU} (~${item.grams.toFixed(0)} g)
        <span class="meta">${kcal} kcal • P: ${(info.protein * factor).toFixed(
          1
        )}g • C: ${(info.carb * factor).toFixed(
      1
    )}g • F: ${(info.fat * factor).toFixed(1)}g</span>
      </div>
      <div>
        <button class="secondary" data-idx="${idx}">Modifica</button>
        <button class="danger" data-del="${idx}">X</button>
      </div>
    `;
    ul.appendChild(li);
  });

  ul.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.onclick = () => {
      const i = parseInt(btn.getAttribute("data-del"), 10);
      selectedIngredients.splice(i, 1);
      renderSelectedIngredients();
    };
  });

  ul.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.onclick = () => {
      const i = parseInt(btn.getAttribute("data-idx"), 10);
      const ing = selectedIngredients[i];
      const info = INGREDIENTS[ing.name];
      if (!info) return;

      openQuantityModal(ing.name, info, (item) => {
        selectedIngredients[i] = item;
        renderSelectedIngredients();
      });

      qmQuantity.value = ing.displayQuantity ?? ing.grams;
      qmUnit.innerHTML = "";
      const units = info.units || defaultUnitsFor(info);
      units.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u;
        opt.textContent = u;
        if (u === (ing.displayUnit || "g")) opt.selected = true;
        qmUnit.appendChild(opt);
      });
    };
  });
}

// ================== FOTO DEL FRIGO (SIMULAZIONE) ==================

const fridgeInput = document.getElementById("fridgeImageInput");
const fridgePreview = document.getElementById("fridgePreview");
const mockDetectBtn = document.getElementById("mockDetectBtn");

fridgeInput.addEventListener("change", () => {
  const file = fridgeInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.createElement("img");
    img.src = e.target.result;
    fridgePreview.innerHTML = "";
    fridgePreview.appendChild(img);
  };
  reader.readAsDataURL(file);
});

mockDetectBtn.addEventListener("click", () => {
  if (!fridgeInput.files[0]) {
    alert("Carica prima una foto del frigo.");
    return;
  }
  const possibili = [
    "Mela",
    "Banana",
    "Zucchine",
    "Pane integrale",
    "Pasta di semola",
    "Petto di pollo",
    "Tofu",
  ];
  const riconosciuti = possibili.filter((n) => INGREDIENTS[n]).slice(0, 4);

  if (!riconosciuti.length) {
    alert(
      "Simulazione: nessun ingrediente riconosciuto. Aggiungi ingredienti nel JSON o modifica la lista."
    );
    return;
  }

  riconosciuti.forEach((name) => {
    selectedIngredients.push({
      name,
      grams: 100,
      displayQuantity: 100,
      displayUnit: "g",
    });
  });
  renderSelectedIngredients();
  alert("Simulazione: ingredienti riconosciuti dal frigo aggiunti alla lista.");
});

// ================== FILTRI ==================

function readFilters() {
  return {
    kcalMin: parseFloat(document.getElementById("kcalMin").value) || 0,
    kcalMax: parseFloat(document.getElementById("kcalMax").value) || Infinity,
    proteinMin:
      parseFloat(document.getElementById("proteinMin").value) || 0,
    carbMax: parseFloat(document.getElementById("carbMax").value) || Infinity,
    fatMax: parseFloat(document.getElementById("fatMax").value) || Infinity,
    costMax: parseFloat(document.getElementById("costMax").value) || Infinity,
    timeMax: parseFloat(document.getElementById("timeMax").value) || Infinity,
    difficulty: document.getElementById("difficultyFilter").value,
    diet: document.getElementById("dietFilter").value,
    event: document.getElementById("eventFilter").value,
  };
}

// ================== GENERAZIONE RICETTE REALI ==================

const realBtn = document.getElementById("generateRealRecipesBtn");
const aiBtn = document.getElementById("generateAiRecipesBtn");

realBtn.addEventListener("click", generateRealRecipes);
aiBtn.addEventListener("click", generateAiRecipes);

function generateRealRecipes() {
  if (!selectedIngredients.length) {
    alert("Aggiungi almeno un ingrediente.");
    return;
  }
  const filters = readFilters();
  const available = selectedIngredients.map((i) => i.name);

  const filtered = ALL_RECIPES.filter((r) => {
    if (!r.ingredients.every((i) => available.includes(i.name))) return false;
    return recipeMatchesFilters(r, filters);
  });

  renderRecipes(filtered);
}

// ================== GENERAZIONE RICETTE AI ==================

function generateAiRecipes() {
  if (!selectedIngredients.length) {
    alert("Aggiungi almeno un ingrediente.");
    return;
  }

  const filters = readFilters();
  const baseRecipe = buildRecipeFromIngredients(selectedIngredients, filters);
  let recipes = [];

  recipes.push(baseRecipe);

  const highProt = tweakRecipeForGoal(baseRecipe, "high_protein");
  recipes.push(highProt);

  const light = tweakRecipeForGoal(baseRecipe, "light");
  recipes.push(light);

  const filtered = recipes.filter((r) => recipeMatchesFilters(r, filters));
  renderRecipes(filtered);
}

function buildRecipeFromIngredients(ings, filters) {
  const totals = { kcal: 0, protein: 0, carb: 0, fat: 0, cost: 0 };
  ings.forEach((i) => {
    const info = INGREDIENTS[i.name];
    if (!info) return;
    const f = i.grams / 100;
    totals.kcal += info.kcal * f;
    totals.protein += info.protein * f;
    totals.carb += info.carb * f;
    totals.fat += info.fat * f;
    totals.cost += (info.cost_per_100g || 0.5) * f;
  });

  let difficulty = "facile";
  if (ings.length >= 5 || totals.kcal > 800) difficulty = "media";
  if (ings.length >= 8) difficulty = "difficile";

  let time = 10 + 5 * ings.length;
  if (filters.event === "pranzo_veloce") time = Math.min(time, 20);
  if (filters.event === "cena_leggera") time = Math.min(time, 25);

  let title = "Piatto misto";
  if (filters.event === "natale") title = "Piatto speciale di Natale";
  else if (filters.event === "pasqua") title = "Piatto di Pasqua";
  else if (filters.event === "compleanno") title = "Piatto da Compleanno";
  else if (filters.event === "pranzo_veloce") title = "Pranzo veloce";
  else if (filters.event === "cena_leggera") title = "Cena leggera";

  const steps = generateSteps(ings, filters);

  return {
    mode: "ai",
    title,
    ingredients: JSON.parse(JSON.stringify(ings)),
    totals,
    difficulty,
    time,
    tags: buildDietTags(ings),
    event: filters.event,
    steps,
  };
}

function buildDietTags(ings) {
  const allDiets = ["vegano", "vegetariano", "onnivoro"];
  const supported = new Set(allDiets);
  ings.forEach((i) => {
    const info = INGREDIENTS[i.name];
    if (!info) return;
    const d = info.diet || ["onnivoro"];
    allDiets.forEach((diet) => {
      if (!d.includes(diet) && supported.has(diet)) supported.delete(diet);
    });
  });
  return Array.from(supported);
}

function generateSteps(ings, filters) {
  const base = [];
  base.push("1) Prepara tutti gli ingredienti: lava e taglia dove necessario.");
  base.push(
    "2) Inizia a cuocere gli ingredienti che richiedono più tempo (es. verdure dure, carne)."
  );
  base.push("3) Aggiungi a seguire gli altri ingredienti mescolando bene.");
  base.push("4) Regola di sale, spezie e olio a piacere.");
  if (filters.event === "natale") {
    base.push(
      "5) Impiatta in modo elegante e aggiungi qualche decorazione natalizia (es. rosmarino, agrumi)."
    );
  } else if (filters.event === "pasqua") {
    base.push("5) Servi con contorni freschi e colori primaverili.");
  } else if (filters.event === "compleanno") {
    base.push("5) Cura la presentazione: piatto colorato e invitante.");
  } else {
    base.push(
      "5) Servi caldo e accompagna con una fonte di carboidrati o verdure extra secondo i tuoi obiettivi."
    );
  }
  return base;
}

function tweakRecipeForGoal(recipe, goal) {
  const r = JSON.parse(JSON.stringify(recipe));

  if (goal === "high_protein") {
    r.title += " (alta proteina)";
    r.ingredients.forEach((i) => {
      const info = INGREDIENTS[i.name];
      if (info && info.protein > 10) i.grams = Math.round(i.grams * 1.3);
    });
  } else if (goal === "light") {
    r.title += " (leggera)";
    r.ingredients.forEach((i) => {
      const info = INGREDIENTS[i.name];
      if (info && info.kcal > 150) i.grams = Math.round(i.grams * 0.7);
    });
  }

  const totals = { kcal: 0, protein: 0, carb: 0, fat: 0, cost: 0 };
  r.ingredients.forEach((i) => {
    const info = INGREDIENTS[i.name];
    if (!info) return;
    const f = i.grams / 100;
    totals.kcal += info.kcal * f;
    totals.protein += info.protein * f;
    totals.carb += info.carb * f;
    totals.fat += info.fat * f;
    totals.cost += (info.cost_per_100g || 0.5) * f;
  });
  r.totals = totals;
  return r;
}

function recipeMatchesFilters(r, f) {
  if (r.totals.kcal < f.kcalMin || r.totals.kcal > f.kcalMax) return false;
  if (r.totals.protein < f.proteinMin) return false;
  if (r.totals.carb > f.carbMax) return false;
  if (r.totals.fat > f.fatMax) return false;
  if (r.totals.cost > f.costMax) return false;
  if (r.time > f.timeMax) return false;
  if (f.difficulty && r.difficulty !== f.difficulty) return false;

  if (f.diet && (!r.tags || !r.tags.includes(f.diet))) return false;

  if (f.event) {
    if (r.mode === "real") {
      if (!r.events || !r.events.includes(f.event)) return false;
    } else {
      if (r.event !== f.event) return false;
    }
  }

  return true;
}

// ================== RENDER RICETTE ==================

function renderRecipes(list) {
  const container = document.getElementById("recipesList");
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML =
      "<p>Nessuna ricetta è compatibile con i filtri impostati. Prova a cambiare ingredienti o filtri.</p>";
    return;
  }

  list.forEach((r, idx) => {
    const div = document.createElement("div");
    div.className = "recipe-card";

    const kcal = Math.round(r.totals.kcal);
    const meta = `
      <span class="badge kcal">${kcal} kcal</span>
      <span class="badge protein">P ${r.totals.protein.toFixed(1)}g</span>
      <span class="badge carb">C ${r.totals.carb.toFixed(1)}g</span>
      <span class="badge fat">F ${r.totals.fat.toFixed(1)}g</span>
    `;

    const modeLabel = r.mode === "real" ? "Ricetta reale" : "Ricetta generata";

    div.innerHTML = `
      <h3>${r.title}</h3>
      <div class="recipe-meta">
        ${meta}
        • Tempo: ${r.time} min
        • Difficoltà: ${r.difficulty}
        • Costo stimato: €${(r.totals.cost || 0).toFixed(2)}
        • ${modeLabel}
      </div>
      <div class="recipe-steps">
        <strong>Ingredienti:</strong>
        ${r.ingredients
          .map((i) => `\n- ${i.name}: ${i.grams} g`)
          .join("")}
        \n\n<strong>Procedimento:</strong>
        \n${(r.steps || []).join("\n")}
      </div>
      <div style="margin-top:6px">
        <button class="primary" data-save="${idx}">Salva ricetta</button>
      </div>
    `;

    container.appendChild(div);
  });

  container.querySelectorAll("button[data-save]").forEach((btn, index) => {
    btn.onclick = () => {
      const recipe = list[index];
      saveRecipe(recipe);
    };
  });
}

// ================== SALVATAGGIO RICETTE ==================

const SAVED_KEY = "mealmatch_recipes";

function loadSavedRecipes() {
  const raw = localStorage.getItem(SAVED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRecipe(r) {
  const all = loadSavedRecipes();
  all.unshift({
    id: Date.now(),
    createdAt: new Date().toISOString(),
    recipe: r,
  });
  localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  renderSavedRecipes();
  alert("Ricetta salvata!");
}

function renderSavedRecipes() {
  const container = document.getElementById("savedRecipes");
  const all = loadSavedRecipes();
  container.innerHTML = "";
  if (!all.length) {
    container.innerHTML = "<p>Nessuna ricetta salvata.</p>";
    return;
  }
  all.forEach((item) => {
    const div = document.createElement("div");
    div.className = "saved-item";
    const dateStr = new Date(item.createdAt).toLocaleString();
    const kcal = Math.round(item.recipe.totals.kcal);
    div.innerHTML = `
      <div>
        <strong>${item.recipe.title}</strong><br>
        <span class="recipe-meta">${dateStr} • ${kcal} kcal • P ${item.recipe.totals.protein.toFixed(
      1
    )}g</span>
      </div>
      <div>
        <button class="secondary" data-load="${item.id}">Apri</button>
        <button class="danger" data-del="${item.id}">X</button>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute("data-del"), 10);
      const all = loadSavedRecipes().filter((r) => r.id !== id);
      localStorage.setItem(SAVED_KEY, JSON.stringify(all));
      renderSavedRecipes();
    };
  });

  container.querySelectorAll("button[data-load]").forEach((btn) => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute("data-load"), 10);
      const all = loadSavedRecipes();
      const item = all.find((r) => r.id === id);
      if (!item) return;
      renderRecipes([item.recipe]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

// ================== LOCALIZZAZIONE: SUPERMERCATI & SPESA ONLINE ==================

const findStoreBtn = document.getElementById("findStoreBtn");
const buyOnlineBtn = document.getElementById("buyOnlineBtn");
const locationStatus = document.getElementById("locationStatus");

findStoreBtn.addEventListener("click", () => {
  locationStatus.textContent = "Cerco la tua posizione...";
  if (!navigator.geolocation) {
    locationStatus.textContent =
      "Il tuo browser non supporta la geolocalizzazione.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      locationStatus.textContent =
        "Posizione rilevata! Apro i supermercati più vicini in Maps...";
      const url = `https://www.google.com/maps/search/supermercato/@${lat},${lng},15z`;
      window.open(url, "_blank");
    },
    (err) => {
      console.error(err);
      if (err.code === err.PERMISSION_DENIED) {
        locationStatus.textContent =
          "Permesso negato. Attiva la posizione per usare questa funzione.";
      } else {
        locationStatus.textContent =
          "Impossibile ottenere la posizione. Riprova più tardi.";
      }
    }
  );
});

buyOnlineBtn.addEventListener("click", () => {
  locationStatus.innerHTML =
    'Apro la ricerca per la spesa online...<br/><small>Puoi usare servizi come "spesa online", "consegna a domicilio" o le app del tuo supermercato preferito.</small>';
  const url =
    "https://www.google.com/search?q=spesa+online+consegna+a+domicilio";
  window.open(url, "_blank");
});

// ================== INIT ==================

(async function init() {
  await loadIngredients();
  await loadRecipes();
  renderSelectedIngredients();
  renderSavedRecipes();
})();
