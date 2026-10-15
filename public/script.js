
"use strict";

const $ = (id) => document.getElementById(id);

const expressionInput = $("expression-input");
const expressionBox = $("expression");
const resultBox = $("result");
const keypad = $("keypad");
const quickForm = $("quick-form");
const firstInput = $("first");
const secondInput = $("second");
const operationSelect = $("operation");
const historyBox = $("history");

const operationMap = {
  "+": "add",
  "-": "subtract",
  "−": "subtract",
  "*": "multiply",
  "×": "multiply",
  "/": "divide",
  "÷": "divide"
};

const operationSymbols = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷"
};

let historyItems = [];
let isCalculating = false;

function formatNumber(value) {
  if (!Number.isFinite(value)) return "Error";

  return new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 12
  }).format(value);
}

function showResult(value) {
  resultBox.textContent = value;
}

function showMessage(message) {
  expressionBox.textContent = message;
}

function focusExpression(position = null) {
  expressionInput.focus();

  if (position !== null) {
    expressionInput.setSelectionRange(position, position);
  }
}

function clearCalculator() {
  expressionInput.value = "";
  showResult("0");
  showMessage("Ready to calculate");
  focusExpression(0);
}

function insertText(text) {
  const start = expressionInput.selectionStart;
  const end = expressionInput.selectionEnd;
  const value = expressionInput.value;

  expressionInput.value =
    value.slice(0, start) + text + value.slice(end);

  const position = start + text.length;

  focusExpression(position);
  showMessage("Ready to calculate");
}

function deleteCharacter() {
  const start = expressionInput.selectionStart;
  const end = expressionInput.selectionEnd;
  const value = expressionInput.value;

  if (start !== end) {
    expressionInput.value =
      value.slice(0, start) + value.slice(end);

    focusExpression(start);
    return;
  }

  if (start === 0) return;

  expressionInput.value =
    value.slice(0, start - 1) + value.slice(end);

  focusExpression(start - 1);
}

function toggleSign() {
  const value = expressionInput.value;
  const start = expressionInput.selectionStart;
  const end = expressionInput.selectionEnd;

  if (start !== end) {
    const selected = value.slice(start, end);

    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(selected)) return;

    const replacement = selected.startsWith("-")
      ? selected.slice(1)
      : "-" + selected;

    expressionInput.value =
      value.slice(0, start) + replacement + value.slice(end);

    focusExpression(start + replacement.length);
    return;
  }

  const prefix = value.slice(0, start);
  const match = prefix.match(/(?:^|[+\-−*/×÷]\s*)(-?(?:\d+\.?\d*|\.\d+))$/);

  if (match) {
    const token = match[1];
    const tokenStart = start - token.length;
    const replacement = token.startsWith("-")
      ? token.slice(1)
      : "-" + token;

    expressionInput.value =
      value.slice(0, tokenStart) +
      replacement +
      value.slice(start);

    focusExpression(tokenStart + replacement.length);
  } else if (!value.trim()) {
    insertText("-");
  }
}

function applyPercent() {
  const value = expressionInput.value;
  const cursor = expressionInput.selectionStart;

  const prefix = value.slice(0, cursor);
  const match = prefix.match(/(-?(?:\d+\.?\d*|\.\d+))$/);

  if (!match) {
    showMessage("Enter a number before using %.");
    return;
  }

  const token = match[1];
  const tokenStart = cursor - token.length;
  const converted = String(Number(token) / 100);

  expressionInput.value =
    value.slice(0, tokenStart) +
    converted +
    value.slice(cursor);

  focusExpression(tokenStart + converted.length);
}

function parseExpression(raw) {
  const text = raw.trim();

  // This calculator accepts one binary operation at a time.
  // It does not use eval() or execute arbitrary JavaScript.
  const number = String.raw`(-?(?:\d+(?:\.\d*)?|\.\d+))`;

  const pattern = new RegExp(
    String.raw`^\s*${number}\s*([+\-−*/×÷])\s*${number}\s*$`
  );

  const match = text.match(pattern);

  if (!match) {
    throw new Error(
      "Enter an expression such as 20 + 10."
    );
  }

  const a = Number(match[1]);
  const symbol = match[2];
  const b = Number(match[3]);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("Please enter valid numbers.");
  }

  return {
    a,
    b,
    operation: operationMap[symbol],
    expression: text
  };
}

async function requestCalculation(a, b, operation) {
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ a, b, operation })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    const detail = typeof data.detail === "string"
      ? data.detail
      : "Calculation failed.";

    throw new Error(detail);
  }

  if (typeof data.result !== "number" ||
      !Number.isFinite(data.result)) {
    throw new Error("The server returned an invalid result.");
  }

  return data.result;
}

function renderHistory() {
  historyBox.replaceChildren();

  if (historyItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent =
      "Your recent calculations will appear here.";

    historyBox.append(empty);
    return;
  }

  historyItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "history-item";

    const expression = document.createElement("div");
    expression.className = "history-expression";
    expression.textContent = item.expression;

    const answer = document.createElement("div");
    answer.className = "history-result";
    answer.textContent = "= " + item.result;

    const reuse = document.createElement("button");
    reuse.type = "button";
    reuse.className = "history-reuse";
    reuse.textContent = "Use expression again ↗";

    reuse.addEventListener("click", () => {
      expressionInput.value = item.expression;
      showResult(item.result);
      showMessage("Previous calculation selected");
      focusExpression(item.expression.length);
    });

    row.append(expression, answer, reuse);
    historyBox.append(row);
  });
}

function addHistory(expression, result) {
  historyItems.unshift({
    expression,
    result
  });

  historyItems = historyItems.slice(0, 8);
  renderHistory();
}

async function calculateExpression() {
  if (isCalculating) return;

  const raw = expressionInput.value;

  if (!raw.trim()) {
    showMessage("Type an expression first.");
    focusExpression(0);
    return;
  }

  let parsed;

  try {
    parsed = parseExpression(raw);
  } catch (error) {
    showMessage(error.message);
    showResult("—");
    focusExpression();
    return;
  }

  isCalculating = true;
  showMessage("Calculating...");
  showResult("…");

  try {
    const answer = await requestCalculation(
      parsed.a,
      parsed.b,
      parsed.operation
    );

    const formatted = formatNumber(answer);

    showResult(formatted);
    showMessage(parsed.expression);
    addHistory(parsed.expression, formatted);

    operationSelect.value = parsed.operation;
  } catch (error) {
    showResult("Error");
    showMessage(error.message);
  } finally {
    isCalculating = false;
  }
}

async function calculateQuickForm() {
  if (isCalculating) return;

  const aText = firstInput.value.trim();
  const bText = secondInput.value.trim();
  const operation = operationSelect.value;

  if (aText === "" || bText === "") {
    showResult("—");
    showMessage("Enter both numbers in Quick Calculation.");
    return;
  }

  const a = Number(aText);
  const b = Number(bText);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    showResult("Error");
    showMessage("Please enter valid finite numbers.");
    return;
  }

  const expression =
    `${aText} ${operationSymbols[operation]} ${bText}`;

  isCalculating = true;
  showMessage(expression);
  showResult("…");

  try {
    const answer = await requestCalculation(a, b, operation);
    const formatted = formatNumber(answer);

    showResult(formatted);
    showMessage(expression);
    addHistory(expression, formatted);
  } catch (error) {
    showResult("Error");
    showMessage(error.message);
  } finally {
    isCalculating = false;
  }
}

// On-screen keypad
keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const action = button.dataset.action;
  const value = button.dataset.value;

  if (action === "insert") {
    insertText(value);
  } else if (action === "clear") {
    clearCalculator();
  } else if (action === "backspace") {
    deleteCharacter();
  } else if (action === "percent") {
    applyPercent();
  } else if (action === "sign") {
    toggleSign();
  } else if (action === "equals") {
    calculateExpression();
  }
});

// Enter in expression input calculates; other keys remain editable.
expressionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    calculateExpression();
  } else if (event.key === "Escape") {
    event.preventDefault();
    clearCalculator();
  }
});

expressionInput.addEventListener("input", () => {
  showMessage("Expression ready");
});

// Quick input form
quickForm.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateQuickForm();
});

// Clear all fields
$("clear").addEventListener("click", () => {
  firstInput.value = "";
  secondInput.value = "";
  operationSelect.value = "add";
  clearCalculator();
});

// Clear calculation history
$("clear-history").addEventListener("click", () => {
  historyItems = [];
  renderHistory();
});

// Keyboard shortcuts when focus is outside editable controls.
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const active = document.activeElement;
  const tag = active?.tagName;

  if (active === expressionInput) return;

  if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;

  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault();
    focusExpression();
    insertText(event.key);
  } else if (event.key === ".") {
    event.preventDefault();
    focusExpression();
    insertText(".");
  } else if (["+", "-", "*", "/"].includes(event.key)) {
    event.preventDefault();
    focusExpression();
    insertText(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculateExpression();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    focusExpression();
    deleteCharacter();
  } else if (event.key === "Escape") {
    clearCalculator();
  }
});

// Light/dark theme toggle
const themeToggle = $("theme-toggle");

themeToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("dark-theme");

  themeToggle.textContent = enabled ? "☾" : "☼";
  themeToggle.setAttribute(
    "aria-label",
    enabled ? "Switch to light theme" : "Switch to dark theme"
  );
});

// Initial UI
renderHistory();
showResult("0");
