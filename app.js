// app.js

let INGREDIENTS = {};          // nome -> dati nutrizionali
let selectedIngredients = [];  // [{name, grams}]
let recipes = [];              // ricette proposte correnti

// ---------- CARICAMENTO INGREDIENTI ----------
async function loadIngredients() {
  try {
    const res = await fetch("ingredients.json");
    INGREDIENTS = await res.json();
    console.log("Ingredienti caricati:", Object.keys(INGREDIENTS).length);
  } catch (e) {
    console.error("Errore nel caricamento degli ingredienti:", e);
    alert("Errore nel caricamento degli ingredienti. Controlla il file data/ingredients.json");
  }
}

// ---------- AUTOCOMPLETE ----------

const ingredientInput = document.getElementById("ingredientInput");
const suggestionsDiv = document.getElementById("ingredientSuggestions");

ingredientInput.addEventListener("input", () => {
  const q = ingredientInput.value.trim().toLowerCase();
  suggestionsDiv.innerHTML = "";
  if (!q) return;

  const names = Object.keys(INGREDIENTS);
  const matches = names
    .filter(n => n.toLowerCase().includes(q))
    .slice(0, 20);

  matches.forEach(name => {
    const info = INGREDIENTS[name];
    const el = document.createElement("div");
    el.innerHTML = `<strong>${name}</strong> – <span class="badge kcal">${info.kcal} kcal/100g</span>`;
    el.onclick = () => {
      ingredientInput.value = name;
      suggestionsDiv.innerHTML = "";
    };
    suggestionsDiv.appendChild(el);
  });
});

// ---------- AGGIUNTA INGREDIENTI SELEZIONATI ----------

document.getElementById("addIngredientBtn").addEventListener("click", addSelectedIngredient);

ingredientInput.addEventListener("keydown", e => {
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

  const grams = prompt(`Quanti grammi di "${name}" vuoi considerare? (es. 100)`, "100");
  const g = parseFloat(grams);
  if (isNaN(g) || g <= 0) return;

  selectedIngredients.push({ name, grams: g });
  ingredientInput.value = "";
  suggestionsDiv.innerHTML = "";
  renderSelectedIngredients();
}

function renderSelectedIngredients() {
  const ul = document.getElementById("selectedIngredients");
  ul.innerHTML = "";
  selectedIngredients.forEach((item, idx) => {
    const info = INGREDIENTS[item.name];
    const factor = item.grams / 100;
    const kcal = Math.round(info.kcal * factor);
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${item.name}</strong> – ${item.grams} g
        <span class="meta">${kcal} kcal • P: ${(info.protein*factor).toFixed(1)}g • C: ${(info.carb*factor).toFixed(1)}g • F: ${(info.fat*factor).toFixed(1)}g</span>
      </div>
      <div>
        <button class="secondary" data-idx="${idx}">Modifica</button>
        <button class="danger" data-del="${idx}">X</button>
      </div>
    `;
    ul.appendChild(li);
  });

  ul.querySelectorAll("button[data-del]").forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.getAttribute("data-del"), 10);
      selectedIngredients.splice(i, 1);
      renderSelectedIngredients();
    };
  });

  ul.querySelectorAll("button[data-idx]").forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.getAttribute("data-idx"), 10);
      const ing = selectedIngredients[i];
      const newG = prompt(`Nuovi grammi per "${ing.name}"`, ing.grams);
      const g = parseFloat(newG);
      if (!isNaN(g) && g > 0) {
        selectedIngredients[i].grams = g;
        renderSelectedIngredients();
      }
    };
  });
}

// ---------- FOTO DEL FRIGO (UI + SIMULAZIONE) ----------

const fridgeInput = document.getElementById("fridgeImageInput");
const fridgePreview = document.getElementById("fridgePreview");
const mockDetectBtn = document.getElementById("mockDetectBtn");

fridgeInput.addEventListener("change", () => {
  const file = fridgeInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.createElement("img");
    img.src = e.target.result;
    fridgePreview.innerHTML = "";
    fridgePreview.appendChild(img);
  };
  reader.readAsDataURL(file);
});

// simulazione: in futuro qui collegherai una vera IA
mockDetectBtn.addEventListener("click", () => {
  if (!fridgeInput.files[0]) {
    alert("Carica prima una foto del frigo.");
    return;
  }
  const possibili = ["Mela", "Banana", "Zucchine", "Pane integrale", "Pasta di semola", "Petto di pollo", "Tofu"];
  const riconosciuti = possibili.filter(n => INGREDIENTS[n]).slice(0, 4);

  if (!riconosciuti.length) {
    alert("Simulazione: nessun ingrediente riconosciuto. Aggiungi ingredienti nel JSON o modifica questa lista.");
    return;
  }

  riconosciuti.forEach(name => {
    selectedIngredients.push({ name, grams: 100 });
  });
  renderSelectedIngredients();
  alert("Simulazione: ingredienti riconosciuti dal frigo aggiunti alla lista.");
});

// ---------- GENERAZIONE RICETTE ----------

document.getElementById("generateRecipesBtn").addEventListener("click", generateRecipes);

function generateRecipes() {
  if (!selectedIngredients.length) {
    alert("Aggiungi almeno un ingrediente.");
    return;
  }

  const filters = readFilters();
  // per semplicità: una ricetta principale usando tutti gli ingredienti selezionati
  const baseRecipe = buildRecipeFromIngredients(selectedIngredients, filters);
  recipes = [];

  // possiamo generare 2–3 varianti con priorità diverse
  recipes.push(baseRecipe);

  // Variante: più proteica (se possibile)
  const highProt = tweakRecipeForGoal(baseRecipe, "high_protein");
  recipes.push(highProt);

  // Variante: più leggera
  const light = tweakRecipeForGoal(baseRecipe, "light");
  recipes.push(light);

  const filtered = recipes.filter(r => recipeMatchesFilters(r, filters));
  renderRecipes(filtered);
}

function readFilters() {
  return {
    kcalMin: parseFloat(document.getElementById("kcalMin").value) || 0,
    kcalMax: parseFloat(document.getElementById("kcalMax").value) || Infinity,
    proteinMin: parseFloat(document.getElementById("proteinMin").value) || 0,
    carbMax: parseFloat(document.getElementById("carbMax").value) || Infinity,
    fatMax: parseFloat(document.getElementById("fatMax").value) || Infinity,
    costMax: parseFloat(document.getElementById("costMax").value) || Infinity,
    timeMax: parseFloat(document.getElementById("timeMax").value) || Infinity,
    difficulty: document.getElementById("difficultyFilter").value,
    diet: document.getElementById("dietFilter").value,
    event: document.getElementById("eventFilter").value
  };
}

function buildRecipeFromIngredients(ings, filters) {
  // calcolo nutrizionale base
  const totals = { kcal: 0, protein: 0, carb: 0, fat: 0, cost: 0 };
  ings.forEach(i => {
    const info = INGREDIENTS[i.name];
    const f = i.grams / 100;
    totals.kcal += info.kcal * f;
    totals.protein += info.protein * f;
    totals.carb += info.carb * f;
    totals.fat += info.fat * f;
    totals.cost += (info.cost_per_100g || 0.5) * f;
  });

  // difficoltà e tempo stimati in modo semplice
  const stepsCount = 4 + Math.min(ings.length, 4);
  let difficulty = "facile";
  if (ings.length >= 5 || totals.kcal > 800) difficulty = "media";
  if (ings.length >= 8) difficulty = "difficile";

  let time = 10 + 5 * ings.length;
  if (filters.event === "pranzo_veloce") time = Math.min(time, 20);
  if (filters.event === "cena_leggera") time = Math.min(time, 25);

  // titolo in base all'evento
  let title = "Piatto misto";
  if (filters.event === "natale") title = "Piatto speciale di Natale";
  else if (filters.event === "pasqua") title = "Piatto di Pasqua";
  else if (filters.event === "compleanno") title = "Piatto da Compleanno";
  else if (filters.event === "pranzo_veloce") title = "Pranzo veloce";
  else if (filters.event === "cena_leggera") title = "Cena leggera";

  const steps = generateSteps(ings, filters);

  return {
    title,
    ingredients: JSON.parse(JSON.stringify(ings)),
    totals,
    difficulty,
    time,
    tags: buildDietTags(ings),
    event: filters.event,
    steps
  };
}

function buildDietTags(ings) {
  // se tutti gli ingredienti supportano vegano => vegano, ecc.
  const allDiets = ["vegano", "vegetariano", "onnivoro"];
  const supported = new Set(allDiets);
  ings.forEach(i => {
    const info = INGREDIENTS[i.name];
    const d = info.diet || ["onnivoro"];
    allDiets.forEach(diet => {
      if (!d.includes(diet) && supported.has(diet)) supported.delete(diet);
    });
  });
  return Array.from(supported);
}

function generateSteps(ings, filters) {
  const names = ings.map(i => i.name);
  const base = [];
  base.push("1) Prepara tutti gli ingredienti: lava e taglia dove necessario.");
  base.push("2) Inizia a cuocere gli ingredienti che richiedono più tempo (es. verdure dure, carne).");
  base.push("3) Aggiungi a seguire gli altri ingredienti mescolando bene.");
  base.push("4) Regola di sale, spezie e olio a piacere.");
  if (filters.event === "natale") {
    base.push("5) Impiatta in modo elegante e aggiungi qualche decorazione natalizia (es. rosmarino, agrumi).");
  } else if (filters.event === "pasqua") {
    base.push("5) Servi con contorni freschi e colori primaverili.");
  } else if (filters.event === "compleanno") {
    base.push("5) Cura la presentazione: piatto colorato e invitante.");
  } else {
    base.push("5) Servi caldo e accompagna con una fonte di carboidrati o verdure extra secondo i tuoi obiettivi.");
  }
  return base;
}

function tweakRecipeForGoal(recipe, goal) {
  // crea una copia
  const r = JSON.parse(JSON.stringify(recipe));

  if (goal === "high_protein") {
    r.title += " (alta proteina)";
    r.ingredients.forEach(i => {
      const info = INGREDIENTS[i.name];
      if (info.protein > 10) i.grams = Math.round(i.grams * 1.3);
    });
  } else if (goal === "light") {
    r.title += " (leggera)";
    r.ingredients.forEach(i => {
      const info = INGREDIENTS[i.name];
      if (info.kcal > 150) i.grams = Math.round(i.grams * 0.7);
    });
  }

  // ricalcola totali
  const totals = { kcal: 0, protein: 0, carb: 0, fat: 0, cost: 0 };
  r.ingredients.forEach(i => {
    const info = INGREDIENTS[i.name];
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

  // filtro dieta: se selezionato, la dieta deve essere supportata dalla ricetta
  if (f.diet && !r.tags.includes(f.diet)) return false;

  if (f.event && r.event !== f.event) return false;

  return true;
}

function renderRecipes(list) {
  const container = document.getElementById("recipesList");
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = "<p>Nessuna ricetta è compatibile con i filtri impostati. Prova a rilassare qualche limite o a cambiare ingredienti.</p>";
    return;
  }

  list.forEach((r, idx) => {
    const div = document.createElement("div");
    div.className = "recipe-card";

    const kcal = Math.round(r.totals.kcal);
    const meta = `
      <span class="badge kcal">${kcal} kcal</span>
      <span class="badge protein">P ${(r.totals.protein).toFixed(1)}g</span>
      <span class="badge carb">C ${(r.totals.carb).toFixed(1)}g</span>
      <span class="badge fat">F ${(r.totals.fat).toFixed(1)}g</span>
    `;

    div.innerHTML = `
      <h3>${r.title}</h3>
      <div class="recipe-meta">
        ${meta}
        • Tempo: ${r.time} min
        • Difficoltà: ${r.difficulty}
        • Costo stimato: €${r.totals.cost.toFixed(2)}
      </div>
      <div class="recipe-steps">
        <strong>Ingredienti:</strong>
        ${r.ingredients.map(i => `\n- ${i.name}: ${i.grams} g`).join("")}
        \n\n<strong>Procedimento:</strong>
        ${"\n" + r.steps.join("\n")}
      </div>
      <div style="margin-top:6px">
        <button class="primary" data-save="${idx}">Salva ricetta</button>
      </div>
    `;

    container.appendChild(div);
  });

  container.querySelectorAll("button[data-save]").forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.getAttribute("data-save"), 10);
      saveRecipe(list[i]);
    };
  });
}

// ---------- SALVATAGGIO RICETTE (localStorage) ----------

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
    recipe: r
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
  all.forEach(item => {
    const div = document.createElement("div");
    div.className = "saved-item";
    const dateStr = new Date(item.createdAt).toLocaleString();
    const kcal = Math.round(item.recipe.totals.kcal);
    div.innerHTML = `
      <div>
        <strong>${item.recipe.title}</strong><br>
        <span class="recipe-meta">${dateStr} • ${kcal} kcal • P ${(item.recipe.totals.protein).toFixed(1)}g</span>
      </div>
      <div>
        <button class="secondary" data-load="${item.id}">Apri</button>
        <button class="danger" data-del="${item.id}">X</button>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll("button[data-del]").forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute("data-del"), 10);
      const all = loadSavedRecipes().filter(r => r.id !== id);
      localStorage.setItem(SAVED_KEY, JSON.stringify(all));
      renderSavedRecipes();
    };
  });

  container.querySelectorAll("button[data-load]").forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute("data-load"), 10);
      const all = loadSavedRecipes();
      const item = all.find(r => r.id === id);
      if (!item) return;
      // mostra solo questa ricetta in alto
      renderRecipes([item.recipe]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

// ---------- INIT ----------

(async function init() {
  await loadIngredients();
  renderSelectedIngredients();
  renderSavedRecipes();
})();

