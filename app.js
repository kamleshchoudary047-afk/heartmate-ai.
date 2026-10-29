const characters = [
  { id: "aria", name: "Aria", tagline: "Warm & playful", description: "Warm, playful, and always ready for a little banter.", greeting: "Hey you, finally here ✨", intro: "I'm happy you're here. Tell me how your day is going?", initial: "A" },
  { id: "maya", name: "Maya", tagline: "Witty & confident", description: "A confident, witty companion who loves a little teasing.", greeting: "Well, look who showed up 😉", intro: "I was just thinking this chat needed a little more charm. How are you?", initial: "M" },
  { id: "luna", name: "Luna", tagline: "Dreamy & caring", description: "A dreamy, thoughtful listener with a soft romantic side.", greeting: "Hi, lovely soul 🌙", intro: "Take a breath, get comfy, and tell me what's on your mind.", initial: "L" }
];
const $ = (id) => document.getElementById(id);
const state = {
  active: "aria",
  chats: loadChats(),
  busy: false
};

function loadChats() {
  try { return JSON.parse(localStorage.getItem("heartmate_chats") || "{}"); }
  catch { return {}; }
}
function saveChats() {
  try { localStorage.setItem("heartmate_chats", JSON.stringify(state.chats)); }
  catch { setStatus("Browser storage is full. Clear some saved chats."); }
}
function activeCharacter() {
  return characters.find(c => c.id === state.active) || characters[0];
}
function currentMessages() {
  if (!state.chats[state.active]) state.chats[state.active] = [];
  return state.chats[state.active];
}
function setStatus(text = "") { $("status").textContent = text; }

function renderCharacters() {
  $("character-list").innerHTML = "";
  characters.forEach(c => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "character-button" + (c.id === state.active ? " active" : "");
    button.innerHTML = `<span class="mini-avatar">${c.initial}</span><span class="character-meta"><strong>${c.name}</strong><small>${c.tagline}</small></span>`;
    button.addEventListener("click", () => {
      state.active = c.id;
      renderAll();
      $("sidebar").classList.remove("open");
    });
    $("character-list").appendChild(button);
  });
}
function renderAll() {
  const c = activeCharacter();
  $("active-name").textContent = c.name;
  $("welcome-title").textContent = c.greeting;
  $("welcome-copy").textContent = c.intro;
  $("hero-avatar").textContent = c.initial;
  $("profile-avatar").textContent = c.initial;
  $("profile-name").textContent = c.name;
  $("profile-description").textContent = c.description;
  $("welcome").hidden = currentMessages().length > 0;
  $("messages").innerHTML = "";
  currentMessages().forEach(m => appendMessage(m.role, m.content, false));
  renderCharacters();
}
function appendMessage(role, content, persist = true) {
  const row = document.createElement("div");
  row.className = "message " + (role === "user" ? "user" : "assistant");
  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "You" : activeCharacter().initial;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;
  row.append(avatar, bubble);
  $("messages").appendChild(row);
  $("welcome").hidden = true;
  $("messages").scrollIntoView({ behavior: "smooth", block: "end" });
  if (persist) {
    currentMessages().push({ role, content });
    currentMessages().splice(0, Math.max(0, currentMessages().length - 80));
    saveChats();
  }
  return row;
}
async function sendMessage(text) {
  const message = (text || $("message-input").value).trim();
  if (!message || state.busy) return;
  $("message-input").value = "";
  $("message-input").style.height = "auto";
  appendMessage("user", message);
  state.busy = true;
  $("send-button").disabled = true;
  setStatus(`${activeCharacter().name} is thinking…`);
  const typing = appendMessage("assistant", "…", false);
  try {
    const history = currentMessages().slice(-10);
    // The backend adds the latest user message itself, so exclude it from history.
    history.pop();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: state.active, message, history })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI request failed");
    typing.querySelector(".bubble").textContent = data.reply;
    currentMessages().push({ role: "assistant", content: data.reply });
    saveChats();
  } catch (err) {
    typing.querySelector(".bubble").textContent = "I couldn't connect just now. " + (err.message || "Please try again in a moment.");
  } finally {
    state.busy = false;
    $("send-button").disabled = false;
    setStatus("");
    $("message-input").focus();
  }
}
$("chat-form").addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
$("message-input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("chat-form").requestSubmit(); }
});
$("message-input").addEventListener("input", e => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
});
document.querySelectorAll("[data-prompt]").forEach(button =>
  button.addEventListener("click", () => sendMessage(button.dataset.prompt))
);
$("new-chat").addEventListener("click", () => {
  state.chats[state.active] = [];
  saveChats();
  renderAll();
  setStatus("Fresh conversation started.");
  setTimeout(() => setStatus(""), 1800);
});
$("clear-all").addEventListener("click", () => {
  if (!confirm("Delete all saved chats from this browser? This cannot be undone.")) return;
  state.chats = {};
  saveChats();
  renderAll();
});
$("mobile-menu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("generate-image").addEventListener("click", async () => {
  const prompt = $("image-prompt").value.trim();
  if (!prompt) { setStatus("Describe the portrait first."); return; }
  const button = $("generate-image");
  const result = $("image-result");
  button.disabled = true;
  button.textContent = "Generating…";
  result.hidden = true;
  setStatus("Creating your portrait. This can take a little while…");
  try {
    const response = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    if (!response.ok) {
      let message = "Image generation failed.";
      try { message = (await response.json()).error || message; } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("The provider did not return an image.");
    if (result.dataset.objectUrl) URL.revokeObjectURL(result.dataset.objectUrl);
    const objectUrl = URL.createObjectURL(blob);
    result.dataset.objectUrl = objectUrl;
    result.innerHTML = "";
    const img = document.createElement("img");
    img.src = objectUrl;
    img.alt = "Generated fictional adult character portrait";
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "heartmate-portrait.png";
    link.textContent = "Save portrait";
    result.append(img, link);
    result.hidden = false;
    setStatus("Portrait ready.");
  } catch (err) {
    setStatus(err.message || "Could not generate an image.");
  } finally {
    button.disabled = false;
    button.textContent = "✧ Generate portrait";
  }
});
renderAll();