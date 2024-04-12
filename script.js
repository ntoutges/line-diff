const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// set these to null to have nothing load in
const defaultPattern = "^(.+?) +(.+?)  +(.+?) +(.+?)  +(.+?)(?:(?: .*$)|(?:$))";
const defaultSym = "1,2,4"; // CSV
const defaultFlags = "i"; // standard regex flag flags
var initializing = true;

function init() {
  initializing = true;
  const oldPattern = localStorage.getItem("pattern") ?? defaultPattern;
  if (oldPattern !== null) {
    $("#regex-pattern").value = oldPattern;
    adjustInputWidth.call($("#regex-pattern"));
    createPattern(oldPattern);
  }
  const oldSymGroups = localStorage.getItem("sym") ?? defaultSym;
  if (oldSymGroups !== null) {
    setSymPattern(oldSymGroups.split(",").map(num => +num));
  }
  const oldFlags = localStorage.getItem("flags") ?? defaultFlags ?? "";
  buildFlags("iuy", oldFlags);

  tabChange("text");
  Array.from($$(".tabs")).forEach(tab => {
    tab.addEventListener("click", function () {
      tabChange(this.getAttribute("value"));
    });
  });

  $("#regex-pattern").addEventListener("input", function () {
    adjustInputWidth.call(this);
    savePattern(this.value);
    createPattern(this.value);
  });

  $("#pattern-container").addEventListener("click", () => {
    $("#regex-pattern").focus();
  });

  $("#input-a").addEventListener("input", inputChange);
  $("#input-b").addEventListener("input", inputChange);

  const inputAVal = localStorage.getItem("input-a");
  const inputBVal = localStorage.getItem("input-b");
  if (inputAVal !== null) $("#input-a").value = inputAVal;
  if (inputBVal !== null) $("#input-b").value = inputBVal;
  if (inputAVal !== null || inputBVal !== null) inputChange(); // update

  initializing = false;
  inputChange();
}

const selectedFlags = new Set();
function buildFlags(flags, selected="") {
  for (const flag of flags) {
    const el = document.createElement("div");
    el.classList.add("regex-flags");
    el.textContent = flag;
    el.setAttribute("data-flag", flag);
    $("#regex-flag-container").append(el);

    el.addEventListener("click", toggleFlag);

    if (selected.includes(flag)) el.click();
  }
}

function toggleFlag() {
  this.classList.toggle("selected");
  const flag = this.getAttribute("data-flag");
  
  if (this.classList.contains("selected")) selectedFlags.add(flag);
  else selectedFlags.delete(flag);
  saveFlags();
  
  inputChange();
}

function saveFlags() {
  localStorage.setItem("flags", Array.from(selectedFlags).reduce((acc, flag) => acc + flag, ""));
}

var lastTab = null;
function tabChange(tab) {
  if (lastTab === tab) return; // no change
  if (lastTab !== null) {
    $(`.tabs[value="${lastTab}"]`).classList.remove("selected");
    $(`.modes[value="${lastTab}"]`).classList.remove("selected");
  }
  if (tab) {
    $(`.tabs[value="${tab}"]`).classList.add("selected");
    $(`.modes[value="${tab}"]`).classList.add("selected");
  }

  lastTab = tab;
}

function adjustInputWidth() {
  const span = document.createElement('span');
  span.textContent = this.value || this.placeholder;

  const inputStyles = window.getComputedStyle(this);
  const fontProperties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-variant'];
  for (const prop of fontProperties) {
    span.style[prop] = inputStyles[prop];
  }

  span.classList.add("text-measurer");
  document.body.appendChild(span); // Append the span to the body

  const width = span.getBoundingClientRect().width;
  this.style.width = width + 'px';

  // Remove the temporary span element
  document.body.removeChild(span);
}

function savePattern(pattern) {
  localStorage.setItem("pattern", pattern);
}

var pattern = null;
var symGroups = new Set([]);
var patternLen = 0;
function createPattern(patternStr) {
  const flags = Array.from(selectedFlags).reduce((acc, flag) => acc + flag, "");
  try {
    pattern = new RegExp(patternStr, flags);
    patternLen = (new RegExp(patternStr + '|')).exec('').length - 1; // thank you stack overflow!
    populateSymPattern(patternLen);
    $("#warning").textContent = "";
    inputChange();
  }
  catch (err) {
    $("#warning").textContent = "Invalid Pattern";
  }
}

function populateSymPattern(len) {
  $("#matching-ids").innerHTML = "";

  for (let i = 1; i <= len; i++) {
    const el = document.createElement("div");
    el.classList.add("sym-groups")
    el.textContent = i;
    el.setAttribute("value", i);

    $("#matching-ids").append(el);

    el.addEventListener("click", function () {
      this.classList.toggle("selected");
      if (this.classList.contains("selected")) symGroups.add(+this.getAttribute("value"));
      else symGroups.delete(+this.getAttribute("value"));

      localStorage.setItem("sym", Array.from(symGroups).join(","));
      inputChange();
    });
    if (symGroups.has(i)) el.click();
  }

  // get rid of any 'i' value too high
  for (const i of symGroups) {
    if (i >= len) symGroups.delete(i);
  }
}

function setSymPattern(indicesSet) {
  const childs = $("#matching-ids").children;
  for (const i of indicesSet) {
    const childI = +i - 1; // [indicesSet] starts at 1 because RegEx
    if (childs.length < childI || childI < 0) continue;
    childs[childI].click();
  }
}

function inputChange() {
  if (initializing) return;

  const aVal = $("#input-a").value.split("\n");
  const bVal = $("#input-b").value.split("\n");

  const diffLines = getDiffLines(aVal, bVal);
  showDiffLines(diffLines, aVal, bVal);
  updateGrid();
}

function getDiffLines(aVal, bVal) {
  if (pattern === null) {
    return {
      differing: [],
      aMissing: [],
      bMissing: []
    };
  }

  const a = aVal.map(line => pattern.exec(line));
  const b = bVal.map(line => pattern.exec(line));

  const aIndices = new Set(a.map((_, i) => +i).filter(i => a[i] !== null));
  const bIndices = new Set(b.map((_, i) => +i).filter(i => b[i] !== null));

  const differingIndices = [];

  for (const i of aIndices) {
    for (const j of bIndices) {
      // loop through groups to check if they are the same
      const patternA = a[i];
      const patternB = b[j];
      let doPatternsMatch = false;
      for (let k = 1; k < a[i].length; k++) {
        if (patternA[k] != patternB[k]) { // any difference indicates the end of the loop
          if (selectedFlags.has("i") && patternA[k].toLowerCase() == patternB[k].toLowerCase()) continue; // case insensitive; and match when ignoring case
          doPatternsMatch = !symGroups.has(k); // patterns match only if difference when there shouldn't be one
          break;
        }
      }
      if (doPatternsMatch) { // non-matching lines
        differingIndices.push([i, j]);

        // remove valid indices, as they have been used
        aIndices.delete(+i);
        bIndices.delete(+j);
        break;
      }
    }
  }

  const { aMissing, bMissing } = getMissingIndices(
    new Map(Array.from(aIndices).map(index => [index, a[index]])),
    new Map(Array.from(bIndices).map((index) => [index, b[index]]))
  );

  return {
    differing: differingIndices,
    aMissing, bMissing
  };
}

function getMissingIndices(
  aMap, bMap
) {
  // note: values cannot contain '\n' char, so that will be used to deliniate groups
  const aGroups = new Map();
  const bGroups = new Map();
  aMap.forEach((val, index) => {
    let groups = [];
    for (let i = 1; i < val.length; i++) { groups.push(selectedFlags.has("i") ? val[i].toLowerCase() : val[i]); } // reduce regex output to array // if case insensitive: ignore case
    const key = groups.join("\n");

    if (!aGroups.has(key)) aGroups.set(key, []);
    aGroups.get(key).push({ index, groups });
  });

  bMap.forEach((val, index) => {
    let groups = [];
    for (let i = 1; i < val.length; i++) { groups.push(selectedFlags.has("i") ? val[i].toLowerCase() : val[i]); } // reduce regex output to array // if case insensitive: ignore case
    const key = groups.join("\n");

    if (!bGroups.has(key)) bGroups.set(key, []);
    bGroups.get(key).push({ index, groups });
  });

  aGroups.forEach((aEntries, key) => {
    if (!bGroups.has(key)) return; // ignore

    const aLen = aEntries.length;
    const bLen = bGroups.get(key).length;

    // remove as many repeat lines as possible
    const delCt = Math.min(aLen, bLen);
    for (let i = 0; i < delCt; i++) {
      aGroups.get(key).pop();
      bGroups.get(key).pop();
    }

    if (aGroups.get(key).length == 0) aGroups.delete(key);
    if (bGroups.get(key).length == 0) bGroups.delete(key);
  });

  // all duplicates removed
  return {
    aMissing: Array.from(aGroups.values()).map((entries) => entries.map(({ index }) => index)).flat(),
    bMissing: Array.from(bGroups.values()).map((entries) => entries.map(({ index }) => index)).flat()
  }
}

function showDiffLines(diffIndices, aVal, bVal) {
  $("#text-output").innerHTML = ""; // remove all children
  const lineData = [];
  diffIndices.differing.forEach(([ai, bi]) => { createLine(ai, bi, "differences"); });
  // diffIndices.aMissing.forEach((ai) => { createLine(ai, -1, "missings"); });
  // diffIndices.bMissing.forEach((bi) => { createLine(-1, bi, "missings"); });
  
  // push line data to be sorted before appending lines
  // diffIndices.differing.forEach(([ai, bi]) => { lineData.push([ai, bi, "differences"]) });
  diffIndices.aMissing.forEach((ai) => { lineData.push([ai, -1, "missings"]); });
  diffIndices.bMissing.forEach((bi) => { lineData.push([-1, bi, "missings"]) });

  // sort lines
  lineData.sort((a,b) => {
    const ai = (a[0] != -1) ? a[0] : ((a[1] != -1) ? a[1] : -1);
    const bi = (b[0] != -1) ? b[0] : ((b[1] != -1) ? b[1] : -1);

    return ai - bi;
  });
  for (const data of lineData) { createLine.apply(null, data); }

  function createLine(ai, bi, classname) {
    const aNumEl = document.createElement("div");
    const bNumEl = document.createElement("div");
    aNumEl.classList.add("line-numbers");
    bNumEl.classList.add("line-numbers");
    aNumEl.textContent = (ai >= 0) ? ai + 1 : "/";
    bNumEl.textContent = (bi >= 0) ? bi + 1 : "/";

    const aLineEl = document.createElement("div");
    const bLineEl = document.createElement("div");
    aLineEl.classList.add("line-texts");
    bLineEl.classList.add("line-texts");
    if (ai >= 0) aLineEl.textContent = aVal[ai];
    if (bi >= 0) bLineEl.textContent = bVal[bi];

    const container = document.createElement("div");
    container.classList.add("text-output-containers", classname)

    container.append(aNumEl, aLineEl, bNumEl, bLineEl);
    $("#text-output").append(container);

    aLineEl.addEventListener("click", () => { selectTextareaLine($("#input-a"), ai) });
    bLineEl.addEventListener("click", () => { selectTextareaLine($("#input-b"), bi) });

    if (ai >= 0) container.style.order = ai;
    else if (bi >= 0) container.style.order = bi;
  }
}

function updateGrid() {
  const aData = $("#input-a").value.split("\n").map(line => pattern ? pattern.exec(line) : null);
  const bData = $("#input-b").value.split("\n").map(line => pattern ? pattern.exec(line) : null);

  $("#grid-a").innerHTML = "";
  $("#grid-b").innerHTML = "";
  $("#grid-a").style.gridTemplateColumns = `repeat(${patternLen}, auto)`;
  $("#grid-b").style.gridTemplateColumns = `repeat(${patternLen}, auto)`;

  const aHeader = document.createElement("div");
  const bHeader = document.createElement("div");
  aHeader.classList.add("grid-mode-rows", "grid-mode-headers");
  bHeader.classList.add("grid-mode-rows", "grid-mode-headers");
  for (let i = 1; i <= patternLen; i++) {
    const elA = document.createElement("div");
    elA.textContent = i;
    const elB = document.createElement("div");
    elB.textContent = i;

    aHeader.append(elA);
    bHeader.append(elB);
  }
  $("#grid-a").append(aHeader);
  $("#grid-b").append(bHeader);

  for (const data of aData) {
    const container = document.createElement("div");
    container.classList.add("grid-mode-rows");
    for (let i = 1; i <= patternLen; i++) {
      let text = "< empty >"
      if (data !== null) text = data[i] ?? "null";

      const el = document.createElement("div");
      el.textContent = text
      container.append(el);
    }
    $("#grid-a").append(container);
  }

  for (const data of bData) {
    const container = document.createElement("div");
    container.classList.add("grid-mode-rows");
    for (let i = 1; i <= patternLen; i++) {
      let text = "< empty >"
      if (data !== null) text = data[i] ?? "null";

      const el = document.createElement("div");
      el.textContent = text;
      container.append(el);
    }
    $("#grid-b").append(container);
  }
}

// ctrl-c/ctrl-v: https://stackoverflow.com/questions/13650534/how-to-select-line-of-text-in-textarea
function selectTextareaLine(tarea, lineNum) {
  if (lineNum < 0) return;

  var lines = tarea.value.split("\n");

  // calculate start/end
  var startPos = 0, endPos = tarea.value.length;
  for (var x = 0; x < lines.length; x++) {
    if (x == lineNum) {
      break;
    }
    startPos += (lines[x].length + 1);

  }

  var endPos = lines[lineNum].length + startPos;

  // do selection
  // Chrome / Firefox

  if (typeof (tarea.selectionStart) != "undefined") {
    tarea.focus();
    tarea.selectionStart = startPos;
    tarea.selectionEnd = endPos;
  }

  // IE
  if (document.selection && document.selection.createRange) {
    tarea.focus();
    tarea.select();
    var range = document.selection.createRange();
    range.collapse(true);
    range.moveEnd("character", endPos);
    range.moveStart("character", startPos);
    range.select();
  }

  var lineHeight = tarea.scrollHeight / tarea.value.split("\n").length;
  var jump = lineNum * lineHeight;
  tarea.scrollTop = jump;
}

window.onbeforeunload = () => {
  localStorage.setItem("input-a", $("#input-a").value);
  localStorage.setItem("input-b", $("#input-b").value);
}

init();