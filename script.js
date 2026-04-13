/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const generateRoutineButton = document.getElementById("generateRoutine");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsButtonId = "clearSelections";

const selectedProductsStorageKey = "loreal-selected-products";

let allProducts = [];
let currentProducts = [];
let selectedProducts = [];
let expandedProducts = [];
let conversationHistory = [];

const routineSystemPrompt =
  "You are a helpful beauty advisor. Answer only about the generated routine, skincare, haircare, makeup, fragrance, and closely related beauty topics. Use the full conversation history to stay consistent. If the user asks something unrelated, politely say you can only help with the routine or related beauty topics.";

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

selectedProductsList.innerHTML = `
  <div class="placeholder-message selected-placeholder">
    No products selected yet
  </div>
`;

function setChatMessage(message, isLoading = false) {
  chatWindow.innerHTML = `
    <div class="chat-message ${isLoading ? "loading" : ""}">
      ${message}
    </div>
  `;
}

function setInitialChatPrompt() {
  setChatMessage(
    "Generate a routine first, then ask follow-up questions in the chatbox.",
  );
}

function appendChatMessage(role, message) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role === "user" ? "user-message" : "ai-response"}`;

  const messageParagraph = document.createElement("p");
  messageParagraph.textContent = message;
  messageElement.appendChild(messageParagraph);

  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendLoadingMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.className = "chat-message loading";

  const messageParagraph = document.createElement("p");
  messageParagraph.textContent = message;
  messageElement.appendChild(messageParagraph);

  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return messageElement;
}

function appendNoticeMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.className = "chat-message notice-message";

  const messageParagraph = document.createElement("p");
  messageParagraph.textContent = message;
  messageElement.appendChild(messageParagraph);

  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCloudflareWorkerUrl() {
  const configuredUrl =
    typeof CLOUDFLARE_WORKER_URL !== "undefined"
      ? CLOUDFLARE_WORKER_URL.trim()
      : "";

  const isPlaceholderUrl =
    configuredUrl === "https://nameless-sun-24db.jcmiltn.workers.dev/" ||
    configuredUrl === "nameless-sun-24db.jcmiltn.workers.dev/";

  if (isPlaceholderUrl) {
    return "";
  }

  if (configuredUrl) {
    if (
      configuredUrl.startsWith("https://") ||
      configuredUrl.startsWith("http://")
    ) {
      return configuredUrl;
    }

    if (configuredUrl.endsWith(".workers.dev")) {
      return `https://${configuredUrl}`;
    }

    throw new Error(
      "CLOUDFLARE_WORKER_URL must be a full URL like https://your-worker.your-subdomain.workers.dev",
    );
  }

  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocalHost) {
    return "http://127.0.0.1:8787";
  }

  return "";
}

async function sendMessageToCloudflareWorker(messages) {
  const workerUrl = getCloudflareWorkerUrl();

  if (!workerUrl) {
    throw new Error("Set CLOUDFLARE_WORKER_URL in secrets.js.");
  }

  const requestBody = {
    model:
      typeof OPENAI_MODEL !== "undefined" && OPENAI_MODEL
        ? OPENAI_MODEL
        : "gpt-4o",
    messages,
    temperature: 0.7,
    max_tokens: 500,
  };

  let response;

  try {
    response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw new Error(
      `Network error reaching your Cloudflare Worker at ${workerUrl}. Check the URL, deployment, and CORS settings.`,
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `API error: ${response.status}`);
  }

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Unexpected API response format.");
  }

  return data;
}

function saveSelectedProductsToStorage() {
  const selectedProductIds = selectedProducts.map((product) => product.id);

  localStorage.setItem(
    selectedProductsStorageKey,
    JSON.stringify(selectedProductIds),
  );
}

function getSavedSelectedProductIds() {
  const savedValue = localStorage.getItem(selectedProductsStorageKey);

  if (!savedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(savedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue;
  } catch (error) {
    return [];
  }
}

function restoreSelectedProducts() {
  const savedSelectedProductIds = getSavedSelectedProductIds();

  selectedProducts = savedSelectedProductIds
    .map((productId) => allProducts.find((product) => product.id === productId))
    .filter(Boolean);
}

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;

  return allProducts;
}

function isProductSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

function isProductExpanded(productId) {
  return expandedProducts.includes(productId);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentProducts = products;

  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found for this category
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${isProductSelected(product.id) ? "selected" : ""} ${isProductExpanded(product.id) ? "expanded" : ""}" data-product-id="${product.id}" role="button" tabindex="0" aria-pressed="${isProductSelected(product.id)}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <button type="button" class="product-details-toggle" aria-expanded="${isProductExpanded(product.id)}" aria-controls="product-details-${product.id}">
        ${isProductExpanded(product.id) ? "Hide details" : "Show details"}
      </button>
      <div class="product-description" id="product-details-${product.id}" ${isProductExpanded(product.id) ? "" : "hidden"}>
        <p>${product.description}</p>
      </div>
      ${isProductSelected(product.id) ? '<span class="selected-badge">Selected</span>' : ""}
    </div>
  `,
    )
    .join("");
}

function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="placeholder-message selected-placeholder">
        No products selected yet
      </div>
    `;
    const clearButton = document.getElementById(clearSelectionsButtonId);

    if (clearButton) {
      clearButton.disabled = true;
    }
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
    <div class="selected-product-item" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="selected-product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <button type="button" class="remove-selected-product" aria-label="Remove ${product.name}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `,
    )
    .join("");

  const clearButton = document.getElementById(clearSelectionsButtonId);

  if (clearButton) {
    clearButton.disabled = false;
  }
}

function toggleProductSelection(productId) {
  const selectedIndex = selectedProducts.findIndex(
    (product) => product.id === productId,
  );

  if (selectedIndex >= 0) {
    selectedProducts.splice(selectedIndex, 1);
  } else {
    const product = allProducts.find((item) => item.id === productId);

    if (product) {
      selectedProducts.push(product);
    }
  }

  displayProducts(currentProducts);
  renderSelectedProducts();
  saveSelectedProductsToStorage();
}

function toggleProductDetails(productId) {
  const expandedIndex = expandedProducts.indexOf(productId);

  if (expandedIndex >= 0) {
    expandedProducts.splice(expandedIndex, 1);
  } else {
    expandedProducts = [...expandedProducts, productId];
  }

  displayProducts(currentProducts);
}

function removeSelectedProduct(productId) {
  selectedProducts = selectedProducts.filter(
    (product) => product.id !== productId,
  );

  displayProducts(currentProducts);
  renderSelectedProducts();
  saveSelectedProductsToStorage();
}

function clearAllSelectedProducts() {
  selectedProducts = [];
  conversationHistory = [];

  localStorage.removeItem(selectedProductsStorageKey);
  displayProducts(currentProducts);
  renderSelectedProducts();
  setInitialChatPrompt();
}

function buildSelectedProductPayload() {
  return selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
}

function resetConversationHistory(routineText, selectedProductPayload) {
  conversationHistory = [
    {
      role: "system",
      content: routineSystemPrompt,
    },
    {
      role: "user",
      content: `Selected products JSON:\n${JSON.stringify(selectedProductPayload, null, 2)}`,
    },
    {
      role: "assistant",
      content: routineText,
    },
  ];
}

function addRoutineToChatWindow(routineText) {
  chatWindow.innerHTML = "";
  appendChatMessage("assistant", routineText);
}

async function generateRoutine() {
  if (selectedProducts.length === 0) {
    setChatMessage("Select at least one product before generating a routine.");
    return;
  }

  if (!getCloudflareWorkerUrl()) {
    setChatMessage(
      "Set CLOUDFLARE_WORKER_URL in secrets.js to your deployed Cloudflare Worker URL before generating a routine.",
    );
    return;
  }

  const selectedProductPayload = buildSelectedProductPayload();

  setChatMessage("Generating your personalized routine...", true);

  try {
    const data = await sendMessageToCloudflareWorker([
      {
        role: "system",
        content:
          "You are a helpful skincare and haircare advisor. Create a short, practical personalized routine using only the selected products provided by the user. Organize the routine into a simple morning or daily sequence and explain why each step belongs there. Keep the language clear and beginner-friendly.",
      },
      {
        role: "user",
        content: `Selected products JSON:\n${JSON.stringify(selectedProductPayload, null, 2)}`,
      },
    ]);

    const routine = data.choices?.[0]?.message?.content;

    if (!routine) {
      throw new Error("No routine was returned.");
    }

    addRoutineToChatWindow(routine);
    resetConversationHistory(routine, selectedProductPayload);
    userInput.focus();
  } catch (error) {
    setChatMessage(
      error.message ||
        "We couldn't generate a routine right now. Please try again.",
    );
  }
}

async function sendFollowUpQuestion(question) {
  appendChatMessage("user", question);

  if (conversationHistory.length === 0) {
    appendNoticeMessage(
      "Generate a routine first, then ask follow-up questions in the chatbox.",
    );
    return;
  }

  if (!getCloudflareWorkerUrl()) {
    appendNoticeMessage(
      "Set CLOUDFLARE_WORKER_URL in secrets.js so the chatbox can reach your Cloudflare Worker.",
    );
    return;
  }

  conversationHistory.push({ role: "user", content: question });

  const loadingMessage = appendLoadingMessage("Thinking...");

  try {
    const data = await sendMessageToCloudflareWorker(conversationHistory);
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("No response was returned.");
    }

    conversationHistory.push({ role: "assistant", content: reply });

    chatWindow.innerHTML = "";
    conversationHistory
      .filter((message) => message.role !== "system")
      .forEach((message) => {
        appendChatMessage(message.role, message.content);
      });
  } catch (error) {
    loadingMessage.remove();
    appendNoticeMessage("We couldn't answer that right now. Please try again.");
  }
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

productsContainer.addEventListener("click", (e) => {
  const detailsButton = e.target.closest(".product-details-toggle");

  if (detailsButton) {
    const card = detailsButton.closest(".product-card");
    const productId = Number(card.dataset.productId);

    e.stopPropagation();
    toggleProductDetails(productId);
    return;
  }

  const card = e.target.closest(".product-card");

  if (!card || !productsContainer.contains(card)) {
    return;
  }

  const productId = Number(card.dataset.productId);
  toggleProductSelection(productId);
});

productsContainer.addEventListener("keydown", (e) => {
  const detailsButton = e.target.closest(".product-details-toggle");

  if (detailsButton && (e.key === "Enter" || e.key === " ")) {
    const card = detailsButton.closest(".product-card");
    const productId = Number(card.dataset.productId);

    e.preventDefault();
    toggleProductDetails(productId);
    return;
  }

  if (e.key !== "Enter" && e.key !== " ") {
    return;
  }

  const card = e.target.closest(".product-card");

  if (!card || !productsContainer.contains(card)) {
    return;
  }

  e.preventDefault();

  const productId = Number(card.dataset.productId);
  toggleProductSelection(productId);
});

selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-selected-product");

  if (!removeButton) {
    return;
  }

  const selectedItem = removeButton.closest(".selected-product-item");
  const productId = Number(selectedItem.dataset.productId);

  removeSelectedProduct(productId);
});

document.addEventListener("click", (e) => {
  const clearSelectionsButton = e.target.closest(`#${clearSelectionsButtonId}`);

  if (!clearSelectionsButton) {
    return;
  }

  clearAllSelectedProducts();
});

generateRoutineButton.addEventListener("click", () => {
  generateRoutine();
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const question = userInput.value.trim();

  if (!question) {
    return;
  }

  userInput.value = "";
  sendFollowUpQuestion(question);
});

userInput.addEventListener("focus", () => {
  if (conversationHistory.length === 0) {
    setInitialChatPrompt();
  }
});

async function initializeApp() {
  await loadProducts();
  restoreSelectedProducts();
  renderSelectedProducts();
  setInitialChatPrompt();

  if (selectedProducts.length > 0 && currentProducts.length > 0) {
    displayProducts(currentProducts);
  }
}

initializeApp();
