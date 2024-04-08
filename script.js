const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

function init() {
  const oldPattern = localStorage.getItem("pattern");
  if (oldPattern !== null) {
    $("#regex-pattern").value = oldPattern;
    adjustInputWidth.call($("#regex-pattern"));
    createPattern(oldPattern);
  }
  const oldSymGroups = localStorage.getItem("sym");
  if (oldSymGroups !== null) {
    setSymPattern(oldSymGroups.split(",").map(num => +num));
  }

  tabChange("text");
  Array.from($$(".tabs")).forEach(tab => {
    tab.addEventListener("click", function() {
      tabChange(this.getAttribute("value"));
    });
  });

  $("#regex-pattern").addEventListener("input", function() {
    adjustInputWidth.call(this);
    savePattern(this.value);
    createPattern(this.value);
  });

  $("#pattern-container").addEventListener("click", () => {
    $("#regex-pattern").focus();
  });

  $("#input-a").addEventListener("input", inputChange);
  $("#input-b").addEventListener("input", inputChange);
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
  try {
    pattern = new RegExp(patternStr, "i");
    patternLen = (new RegExp(patternStr + '|')).exec('').length - 1; // thank you stack overflow!
    populateSymPattern(patternLen);
    $("#warning").textContent = "";
    inputChange();
  }
  catch(err) {
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

    el.addEventListener("click", function() {
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
  const aVal = $("#input-a").value.split("\n");
  const bVal = $("#input-b").value.split("\n");

  const diffLines = getDiffLines(aVal, bVal);
  showDiffLines(diffLines, aVal, bVal);
  updateGrid();
}

function getDiffLines( aVal, bVal ) {
  const a = aVal.map(line => pattern.exec(line));
  const b = bVal.map(line => pattern.exec(line));

  const aIndices = new Set(a.map((_,i) => +i).filter(i => a[i] !== null));
  const bIndices = new Set(b.map((_,i) => +i).filter(i => b[i] !== null));
  
  const differingIndices = [];

  for (const i of aIndices) {
    for (const j of bIndices) {
      // loop through groups to check if they are the same
      const patternA = a[i];
      const patternB = b[j];
      let doPatternsMatch = true;
      for (let k = 1; k < a[i].length; k++) {
        if ((patternA[k] == patternB[k]) != symGroups.has(k)) { // != works as XNOR
          doPatternsMatch = false;
          break;
        }
      }
      if (doPatternsMatch) { // non-matching lines
        differingIndices.push([i,j]);

        // remove valid indices, as they have been used
        aIndices.delete(+i);
        bIndices.delete(+j);
        break;
      }
    }
  }
  return differingIndices;
}

function showDiffLines(diffIndices, aVal, bVal) {
  $("#text-output").innerHTML = ""; // remove all children
  diffIndices.forEach(([ai, bi]) => {
    const aNumEl = document.createElement("div");
    const bNumEl = document.createElement("div");
    aNumEl.classList.add("line-numbers");
    bNumEl.classList.add("line-numbers");
    aNumEl.textContent = ai+1;
    bNumEl.textContent = bi+1;

    const aLineEl = document.createElement("div");
    const bLineEl = document.createElement("div");
    aLineEl.classList.add("line-texts");
    bLineEl.classList.add("line-texts");
    aLineEl.textContent = aVal[ai];
    bLineEl.textContent = bVal[bi];

    const container = document.createElement("div");
    container.classList.add("text-output-containers")

    container.append(aNumEl, aLineEl, bNumEl, bLineEl);
    $("#text-output").append(container);
  });
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

init();